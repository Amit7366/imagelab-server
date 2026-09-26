import { createReadStream } from "node:fs";
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

function sendFile(req: Request, res: Response, filePath: string, mime: string, etag: string) {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("ETag", etag);
  res.setHeader("Content-Type", mime);

  if (req.headers["if-none-match"] === etag) {
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
    sendFile(req, res, originalPath(asset.contentHash), asset.mime, `"${asset.contentHash}"`);
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

    sendFile(
      req,
      res,
      variantPath(asset.contentHash, transformHash, ext),
      FORMAT_MIME[resolved.format],
      `"${asset.contentHash}-${transformHash}"`,
    );
  }),
};
