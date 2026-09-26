import mongoose from "mongoose";
import { env } from "../../config/env";
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

async function usedBytes(ownerId: string): Promise<number> {
  const [row] = await Asset.aggregate<{ total: number }>([
    { $match: { owner: new mongoose.Types.ObjectId(ownerId), status: "ready" } },
    { $group: { _id: null, total: { $sum: "$bytes" } } },
  ]);
  return row?.total ?? 0;
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
    const used = await usedBytes(actor.id);
    if (used + file.buffer.length > env.USER_STORAGE_QUOTA_BYTES) {
      throw new ApiError(413, "Storage quota exceeded");
    }

    const contentHash = hashBuffer(file.buffer);
    await writeOriginal(contentHash, file.buffer);

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
    const asset = await Asset.findById(id);
    if (!asset || asset.status !== "ready") {
      throw new ApiError(404, "Asset not found");
    }
    if (asset.owner.toString() !== actor.id) {
      throw new ApiError(403, "You cannot change this image");
    }
    return asset;
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

    const [items, used] = await Promise.all([
      Asset.find(filter).sort({ createdAt: -1 }).limit(200),
      usedBytes(actor.id),
    ]);

    return {
      items: items.map(toPublicAsset),
      usage: {
        usedBytes: used,
        quotaBytes: env.USER_STORAGE_QUOTA_BYTES,
      },
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
    const used = await usedBytes(actor.id);
    if (used - asset.bytes + file.buffer.length > env.USER_STORAGE_QUOTA_BYTES) {
      throw new ApiError(413, "Storage quota exceeded");
    }

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
    const assets = await Asset.find({
      _id: { $in: uniqueIds },
      owner: actor.id,
      status: "ready",
    });

    if (assets.length !== uniqueIds.length) {
      throw new ApiError(404, "One or more images were not found");
    }

    const hashes = [...new Set(assets.map((asset) => asset.contentHash))];
    await Asset.updateMany({ _id: { $in: uniqueIds } }, { $set: { status: "deleted" } });

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
