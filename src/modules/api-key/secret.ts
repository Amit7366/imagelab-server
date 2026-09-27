import { createHash, randomBytes } from "node:crypto";
import { PERMISSIONS, type Permission } from "../../constants/roles";
import { ApiError } from "../../utils/ApiError";

export const ASSET_KEY_SCOPES = [
  PERMISSIONS.ASSET_UPLOAD,
  PERMISSIONS.ASSET_READ,
  PERMISSIONS.ASSET_UPDATE,
  PERMISSIONS.ASSET_DELETE,
] as const;

export type AssetKeyScope = (typeof ASSET_KEY_SCOPES)[number];

export const MAX_API_KEYS = 8;

const scopeSet = new Set<string>(ASSET_KEY_SCOPES);

export function keyPrefix(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === "production" ? "il_sk_live_" : "il_sk_test_";
}

export function isApiKeySecret(token: string) {
  return token.startsWith("il_sk_test_") || token.startsWith("il_sk_live_");
}

export function hashApiKey(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function createApiKeySecret(nodeEnv = process.env.NODE_ENV) {
  const prefix = keyPrefix(nodeEnv);
  const secret = `${prefix}${randomBytes(32).toString("base64url")}`;
  return {
    secret,
    keyHash: hashApiKey(secret),
    prefix: secret.slice(0, prefix.length + 8),
    lastFour: secret.slice(-4),
  };
}

export function normalizeScopes(input?: string[]): Permission[] {
  if (!input || input.length === 0) {
    return [...ASSET_KEY_SCOPES];
  }

  const scopes = [...new Set(input)].filter((scope): scope is AssetKeyScope => scopeSet.has(scope));
  if (scopes.length === 0) {
    throw new ApiError(400, "Choose at least one asset scope: upload, read, update, or delete");
  }
  return scopes;
}
