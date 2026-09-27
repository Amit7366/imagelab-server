import { env } from "../../config/env";
import { assertStorageFits, usageForOwner } from "../billing/quota";
import { recordBandwidth } from "../usage/bandwidth";
import type { AuthUser } from "../../types/auth";
import { ApiError } from "../../utils/ApiError";
import { Asset, type AssetDocument } from "./asset.model";
import { inspectAsset } from "./process";
import { hashBuffer, newPublicId, originalExists, removeBlobIfOrphaned, sanitizeOriginalName, writeOriginal } from "./storage";
import { exampleTransformUrl, originalUrl } from "./urls";

export interface PublicAsset {
  id: string;
  publicId: string;
  bytes: number;
  width: number;
  height: number;
  format: string;
  mime: string;
  originalName: string;
  url: string;
  transformUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

function isObjectId(value: string) {
  return OBJECT_ID.test(value);
}

function matchesAssetRef(asset: AssetDocument, ref: string) {
  return asset.id === ref || asset.publicId === ref;
}

async function findReadyByRef(id: string) {
  if (isObjectId(id)) {
    const byId = await Asset.findById(id);
    if (byId) return byId;
  }
  return Asset.findOne({ publicId: id });
}

export function toPublicAsset(asset: AssetDocument): PublicAsset {
  return {
    id: asset.id,
    publicId: asset.publicId,
    bytes: asset.bytes,
    width: asset.width,
    height: asset.height,
    format: asset.format,
    mime: asset.mime,
    originalName: asset.originalName,
    url: originalUrl(asset.publicId),
    transformUrl: asset.format === "pdf" ? originalUrl(asset.publicId) : exampleTransformUrl(asset.publicId),
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

export const assetService = {
  async create(actor: AuthUser, file: { buffer: Buffer; originalname: string; size: number }) {
    if (!file?.buffer?.length) {
      throw new ApiError(400, "Choose an image or PDF to upload");
    }

    if (file.size > env.MAX_UPLOAD_BYTES) {
      throw new ApiError(413, `File is too large. Max ${env.MAX_UPLOAD_BYTES} bytes`);
    }

    const inspected = await inspectAsset(file.buffer);
    await assertStorageFits(actor.id, file.buffer.length);

    const contentHash = hashBuffer(file.buffer);
    await writeOriginal(contentHash, file.buffer);

    recordBandwidth({ inboundBytes: file.buffer.length, uploads: 1 });

    const asset = await Asset.create({
      owner: actor.id,
      publicId: newPublicId(),
      contentHash,
      bytes: file.buffer.length,
      width: inspected.width,
      height: inspected.height,
      format: inspected.format,
      mime: inspected.mime,
      originalName: sanitizeOriginalName(file.originalname),
      status: "ready",
    });

    return toPublicAsset(asset);
  },

  async getOwnedReady(actor: AuthUser, id: string) {
    const asset = await findReadyByRef(id);
    if (!asset || asset.status !== "ready") {
      throw new ApiError(404, "Asset not found");
    }
    if (asset.owner.toString() !== actor.id) {
      throw new ApiError(403, "You do not own this asset");
    }
    return asset;
  },

  async getOne(actor: AuthUser, id: string) {
    return toPublicAsset(await assetService.getOwnedReady(actor, id));
  },

  async listMine(actor: AuthUser, query?: string) {
    const filter: Record<string, unknown> = { owner: actor.id, status: "ready" };
    const q = query?.trim();
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { originalName: { $regex: safe, $options: "i" } },
        { publicId: { $regex: safe, $options: "i" } },
        { format: { $regex: safe, $options: "i" } },
        { mime: { $regex: safe, $options: "i" } },
      ];
    }

    const [items, usage] = await Promise.all([
      Asset.find(filter).sort({ createdAt: -1 }).limit(200),
      usageForOwner(actor.id),
    ]);

    return {
      items: items.map(toPublicAsset),
      usage,
    };
  },

  async rename(actor: AuthUser, id: string, originalName: string) {
    const asset = await assetService.getOwnedReady(actor, id);
    asset.originalName = sanitizeOriginalName(originalName);
    await asset.save();
    return toPublicAsset(asset);
  },

  async replace(actor: AuthUser, id: string, file: { buffer: Buffer; originalname: string; size: number }) {
    if (!file?.buffer?.length) {
      throw new ApiError(400, "Choose an image or PDF to upload");
    }
    if (file.size > env.MAX_UPLOAD_BYTES) {
      throw new ApiError(413, `File is too large. Max ${env.MAX_UPLOAD_BYTES} bytes`);
    }

    const asset = await assetService.getOwnedReady(actor, id);
    const inspected = await inspectAsset(file.buffer);
    await assertStorageFits(actor.id, file.buffer.length, asset.bytes);

    const previousHash = asset.contentHash;
    const contentHash = hashBuffer(file.buffer);
    await writeOriginal(contentHash, file.buffer);

    asset.contentHash = contentHash;
    asset.bytes = file.buffer.length;
    asset.width = inspected.width;
    asset.height = inspected.height;
    asset.format = inspected.format;
    asset.mime = inspected.mime;
    asset.originalName = sanitizeOriginalName(file.originalname);
    await asset.save();
    recordBandwidth({ inboundBytes: file.buffer.length, uploads: 1 });

    if (previousHash !== contentHash) {
      const remaining = await Asset.countDocuments({ contentHash: previousHash, status: "ready" });
      if (remaining === 0) {
        await removeBlobIfOrphaned(previousHash);
      }
    }

    return toPublicAsset(asset);
  },

  async remove(actor: AuthUser, id: string) {
    await assetService.removeMany(actor, [id]);
  },

  async removeMany(actor: AuthUser, ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    const objectIds = uniqueIds.filter(isObjectId);
    const publicIds = uniqueIds.filter((id) => !isObjectId(id));
    const assets = await Asset.find({
      owner: actor.id,
      status: "ready",
      $or: [
        ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
        ...(publicIds.length ? [{ publicId: { $in: publicIds } }] : []),
      ],
    });

    const matched = uniqueIds.map((id) => assets.find((asset) => matchesAssetRef(asset, id)));
    if (matched.some((asset) => !asset)) {
      throw new ApiError(404, "One or more images were not found");
    }

    const ready = matched as AssetDocument[];
    const mongoIds = [...new Set(ready.map((asset) => asset.id))];
    const hashes = [...new Set(ready.map((asset) => asset.contentHash))];
    await Asset.updateMany({ _id: { $in: mongoIds } }, { $set: { status: "deleted" } });

    for (const hash of hashes) {
      const remaining = await Asset.countDocuments({ contentHash: hash, status: "ready" });
      if (remaining === 0) {
        await removeBlobIfOrphaned(hash);
      }
    }
  },

  async getReadyByPublicId(publicId: string) {
    const asset = await Asset.findOne({ publicId, status: "ready" });
    if (!asset) throw new ApiError(404, "Image not found");
    if (!(await originalExists(asset.contentHash))) {
      throw new ApiError(404, "Image file is missing");
    }
    return asset;
  },
};
