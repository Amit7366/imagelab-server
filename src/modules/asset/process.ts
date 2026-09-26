import sharp from "sharp";
import { FORMAT_MIME, MAX_INPUT_PIXELS, isAllowedFormat, type AllowedFormat } from "./constants";
import type { ResolvedTransforms } from "./transforms";
import { ApiError } from "../../utils/ApiError";

export interface InspectedImage {
  format: AllowedFormat;
  mime: string;
  width: number;
  height: number;
}

function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 4).toString("latin1") === "%PDF";
}

export async function inspectAsset(buffer: Buffer): Promise<InspectedImage> {
  if (isPdf(buffer)) {
    return { format: "pdf", mime: FORMAT_MIME.pdf, width: 0, height: 0 };
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).metadata();
  } catch {
    throw new ApiError(400, "File is not a valid image or PDF");
  }

  if (!metadata.format || !isAllowedFormat(metadata.format) || metadata.format === "pdf") {
    throw new ApiError(400, "Unsupported type. Use JPEG, PNG, WebP, GIF, AVIF, or PDF.");
  }
  if (!metadata.width || !metadata.height) {
    throw new ApiError(400, "Could not read image dimensions");
  }
  if (metadata.width * metadata.height > MAX_INPUT_PIXELS) {
    throw new ApiError(400, "Image dimensions are too large");
  }

  return {
    format: metadata.format,
    mime: FORMAT_MIME[metadata.format],
    width: metadata.width,
    height: metadata.height,
  };
}

function resizeOptions(transforms: ResolvedTransforms): sharp.ResizeOptions | null {
  if (!transforms.width && !transforms.height) return null;

  const crop = transforms.crop ?? (transforms.width && transforms.height ? "fill" : "fit");
  const fitMap: Record<string, keyof sharp.FitEnum> = {
    fill: "cover",
    fit: "inside",
    limit: "inside",
    scale: "fill",
    thumb: "cover",
  };

  return {
    width: transforms.width,
    height: transforms.height,
    fit: fitMap[crop],
    withoutEnlargement: crop === "limit",
    position: crop === "thumb" ? sharp.strategy.attention : "centre",
  };
}

export async function applyTransforms(inputPath: string, transforms: ResolvedTransforms): Promise<Buffer> {
  let image = sharp(inputPath, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "none" }).rotate();
  const resize = resizeOptions(transforms);
  if (resize) image = image.resize(resize);

  const quality = transforms.quality;
  switch (transforms.format) {
    case "jpeg":
      image = image.jpeg({ quality, mozjpeg: true });
      break;
    case "png":
      image = image.png({ compressionLevel: 9 });
      break;
    case "webp":
      image = image.webp({ quality });
      break;
    case "avif":
      image = image.avif({ quality });
      break;
  }

  return image.toBuffer();
}
