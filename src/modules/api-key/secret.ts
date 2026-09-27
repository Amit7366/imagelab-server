import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
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

function encryptionKey(keyMaterial: string) {
  return createHash("sha256").update(keyMaterial).digest();
}

export function encryptSecret(secret: string, keyMaterial: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(keyMaterial), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string, keyMaterial: string) {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new ApiError(409, "This API key cannot be revealed. Create a new key.");
  }
  try {
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(keyMaterial), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new ApiError(409, "This API key cannot be revealed. Create a new key.");
  }
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
