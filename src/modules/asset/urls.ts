import { env } from "../../config/env";

const PRODUCTION_ASSET_ORIGIN = "https://api.imagelab.site";

function publicAssetOrigin(): string {
  const configured = env.PUBLIC_ASSET_URL.replace(/\/$/, "");
  if (env.NODE_ENV !== "production") return configured;

  try {
    const { hostname } = new URL(configured);
    if (hostname === "localhost" || hostname === "127.0.0.1") return PRODUCTION_ASSET_ORIGIN;
  } catch {
    return PRODUCTION_ASSET_ORIGIN;
  }

  return configured;
}

export function deliveryBaseUrl(): string {
  return `${publicAssetOrigin()}/image/upload`;
}

export function originalUrl(publicId: string): string {
  return `${deliveryBaseUrl()}/${publicId}`;
}

export function exampleTransformUrl(publicId: string): string {
  return `${deliveryBaseUrl()}/w_800,f_auto,q_auto/${publicId}`;
}
