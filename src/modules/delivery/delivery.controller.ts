import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { Request, Response } from "express";
import { FORMAT_MIME } from "../asset/constants";
import { applyTransforms } from "../asset/process";
import { assetService } from "../asset/asset.service";
import { hashString, originalPath, variantExists, variantPath, writeVariant } from "../asset/storage";
import {
  TransformParseError,
  canonicalizeResolved,
  parseTransforms,
  resolveTransforms,
} from "../asset/transforms";
import { recordBandwidth } from "../usage/bandwidth";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";

const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]+(?:\.(?:jpe?g|png|webp|gif|avif|pdf))?$/i;

function normalizePublicId(raw: string): string {
  const value = decodeURIComponent(raw);
  if (!PUBLIC_ID_PATTERN.test(value)) {
    throw new ApiError(400, "Invalid image id");
  }
  return value.replace(/\.(jpe?g|png|webp|gif|avif|pdf)$/i, "");
}

async function sendFile(
  req: Request,
  res: Response,
  filePath: string,
  mime: string,
  etag: string,
  kind: "original" | "transform",
) {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("ETag", etag);
  res.setHeader("Content-Type", mime);

  let size = 0;
  try {
    size = (await stat(filePath)).size;
  } catch {
    throw new ApiError(404, "Image file is missing");
  }

  const hit = req.headers["if-none-match"] === etag;
  recordBandwidth({
    outboundBytes: hit ? 0 : size,
    requests: 1,
    originals: kind === "original" ? 1 : 0,
    transforms: kind === "transform" ? 1 : 0,
  });

  if (hit) {
    res.status(304).end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.status(404).json({ success: false, message: "Image file is missing" });
    }
  });
  stream.pipe(res);
}

export const deliveryController = {
  original: asyncHandler(async (req, res) => {
    const publicId = normalizePublicId(String(req.params.publicId));
    const asset = await assetService.getReadyByPublicId(publicId);
    await sendFile(req, res, originalPath(asset.contentHash), asset.mime, `"${asset.contentHash}"`, "original");
  }),

  transformed: asyncHandler(async (req, res) => {
    const publicId = normalizePublicId(String(req.params.publicId));
    const rawTransforms = String(req.params.transforms);

    let parsed;
    try {
      parsed = parseTransforms(rawTransforms);
    } catch (error) {
      if (error instanceof TransformParseError) {
        throw new ApiError(400, error.message);
      }
      throw error;
    }

    const asset = await assetService.getReadyByPublicId(publicId);
    if (asset.format === "pdf") {
      throw new ApiError(400, "Transforms are only available for images");
    }
    const resolved = resolveTransforms(parsed, req.headers.accept, asset.format);
    const canonical = canonicalizeResolved(resolved);
    const transformHash = hashString(canonical).slice(0, 32);
    const ext = resolved.format === "jpeg" ? "jpg" : resolved.format;
    const cached = await variantExists(asset.contentHash, transformHash, ext);

    if (!cached) {
      const buffer = await applyTransforms(originalPath(asset.contentHash), resolved);
      await writeVariant(asset.contentHash, transformHash, ext, buffer);
    }

    await sendFile(
      req,
      res,
      variantPath(asset.contentHash, transformHash, ext),
      FORMAT_MIME[resolved.format],
      `"${asset.contentHash}-${transformHash}"`,
      "transform",
    );
  }),
};
