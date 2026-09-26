export const ALLOWED_FORMATS = ["jpeg", "png", "webp", "gif", "avif", "pdf"] as const;

export type AllowedFormat = (typeof ALLOWED_FORMATS)[number];

export const FORMAT_MIME: Record<AllowedFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  pdf: "application/pdf",
};

export const MAX_INPUT_PIXELS = 50_000_000;
export const MAX_TRANSFORM_DIMENSION = 4000;

export function isAllowedFormat(value: string): value is AllowedFormat {
  return (ALLOWED_FORMATS as readonly string[]).includes(value);
}
