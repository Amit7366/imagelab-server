import { env } from "../../config/env";

export function deliveryBaseUrl(): string {
  return `${env.PUBLIC_ASSET_URL.replace(/\/$/, "")}/image/upload`;
}

export function originalUrl(publicId: string): string {
  return `${deliveryBaseUrl()}/${publicId}`;
}

export function exampleTransformUrl(publicId: string): string {
  return `${deliveryBaseUrl()}/w_800,f_auto,q_auto/${publicId}`;
}
