import { MAX_TRANSFORM_DIMENSION } from "./constants";

export const CROP_MODES = ["fill", "fit", "limit", "scale", "thumb"] as const;
export type CropMode = (typeof CROP_MODES)[number];

export const OUTPUT_FORMATS = ["jpeg", "jpg", "png", "webp", "avif", "auto"] as const;
export type OutputFormat = "jpeg" | "png" | "webp" | "avif" | "auto";
export type ResolvedFormat = "jpeg" | "png" | "webp" | "avif";

export interface ImageTransforms {
  width?: number;
  height?: number;
  crop?: CropMode;
  quality?: number | "auto";
  format?: OutputFormat;
}

export interface ResolvedTransforms {
  width?: number;
  height?: number;
  crop?: CropMode;
  quality: number;
  format: ResolvedFormat;
}

export class TransformParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransformParseError";
  }
}

const cropSet = new Set<string>(CROP_MODES);

function parseDimension(token: string, value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new TransformParseError(`Invalid ${token} value`);
  }
  const size = Number(value);
  if (size < 1 || size > MAX_TRANSFORM_DIMENSION) {
    throw new TransformParseError(`${token} must be between 1 and ${MAX_TRANSFORM_DIMENSION}`);
  }
  return size;
}

export function parseTransforms(raw: string): ImageTransforms {
  const input = raw.trim();
  if (!input) {
    throw new TransformParseError("Transform string is empty");
  }

  const result: ImageTransforms = {};
  const seen = new Set<string>();

  for (const part of input.split(",")) {
    const token = part.trim();
    if (!token) {
      throw new TransformParseError("Empty transform token");
    }

    const separator = token.indexOf("_");
    if (separator <= 0 || separator === token.length - 1) {
      throw new TransformParseError(`Invalid transform token: ${token}`);
    }

    const key = token.slice(0, separator);
    const value = token.slice(separator + 1);

    if (seen.has(key)) {
      throw new TransformParseError(`Duplicate transform token: ${key}`);
    }
    seen.add(key);

    switch (key) {
      case "w":
        result.width = parseDimension("w", value);
        break;
      case "h":
        result.height = parseDimension("h", value);
        break;
      case "c":
        if (!cropSet.has(value)) {
          throw new TransformParseError(`Unsupported crop mode: ${value}`);
        }
        result.crop = value as CropMode;
        break;
      case "q":
        if (value === "auto") {
          result.quality = "auto";
          break;
        }
        if (!/^\d+$/.test(value)) {
          throw new TransformParseError("Invalid q value");
        }
        {
          const quality = Number(value);
          if (quality < 1 || quality > 100) {
            throw new TransformParseError("q must be auto or between 1 and 100");
          }
          result.quality = quality;
        }
        break;
      case "f":
        if (value === "jpg" || value === "jpeg") {
          result.format = "jpeg";
          break;
        }
        if (value === "png" || value === "webp" || value === "avif" || value === "auto") {
          result.format = value;
          break;
        }
        throw new TransformParseError(`Unsupported format: ${value}`);
      default:
        throw new TransformParseError(`Unknown transform token: ${key}`);
    }
  }

  return result;
}

export function resolveFormat(
  format: OutputFormat | undefined,
  acceptHeader: string | undefined,
  originalFormat: string,
): ResolvedFormat {
  if (format && format !== "auto") return format;

  const accept = acceptHeader ?? "";
  if (accept.includes("image/avif")) return "avif";
  if (accept.includes("image/webp")) return "webp";
  if (originalFormat === "png" || originalFormat === "gif") return "png";
  return "jpeg";
}

export function resolveTransforms(
  transforms: ImageTransforms,
  acceptHeader: string | undefined,
  originalFormat: string,
): ResolvedTransforms {
  const quality = transforms.quality === "auto" || transforms.quality === undefined ? 80 : transforms.quality;
  return {
    width: transforms.width,
    height: transforms.height,
    crop: transforms.crop,
    quality,
    format: resolveFormat(transforms.format, acceptHeader, originalFormat),
  };
}

export function canonicalizeResolved(transforms: ResolvedTransforms): string {
  const parts: string[] = [];
  if (transforms.crop) parts.push(`c_${transforms.crop}`);
  parts.push(`f_${transforms.format}`);
  if (transforms.height) parts.push(`h_${transforms.height}`);
  parts.push(`q_${transforms.quality}`);
  if (transforms.width) parts.push(`w_${transforms.width}`);
  return parts.join(",");
}

export function hasNoOps(transforms: ImageTransforms): boolean {
  return (
    transforms.width === undefined &&
    transforms.height === undefined &&
    transforms.crop === undefined &&
    transforms.quality === undefined &&
    transforms.format === undefined
  );
}
