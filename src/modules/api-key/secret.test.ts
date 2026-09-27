import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "../../constants/roles";
import { ApiError } from "../../utils/ApiError";
import {
  createApiKeySecret,
  hashApiKey,
  isApiKeySecret,
  keyPrefix,
  MAX_API_KEYS,
  normalizeScopes,
} from "./secret";

describe("api key secrets", () => {
  it("uses a test prefix outside production", () => {
    expect(keyPrefix("development")).toBe("il_sk_test_");
    expect(keyPrefix("test")).toBe("il_sk_test_");
    expect(keyPrefix("production")).toBe("il_sk_live_");
  });

  it("creates a hashed secret that is only shown in full once", () => {
    const generated = createApiKeySecret("development");
    expect(generated.secret.startsWith("il_sk_test_")).toBe(true);
    expect(isApiKeySecret(generated.secret)).toBe(true);
    expect(generated.keyHash).toBe(hashApiKey(generated.secret));
    expect(generated.keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(generated.lastFour).toBe(generated.secret.slice(-4));
    expect(generated.prefix.startsWith("il_sk_test_")).toBe(true);
    expect(generated.secret.includes(generated.lastFour)).toBe(true);
  });

  it("creates live keys in production", () => {
    const generated = createApiKeySecret("production");
    expect(generated.secret.startsWith("il_sk_live_")).toBe(true);
    expect(isApiKeySecret(generated.secret)).toBe(true);
  });

  it("rejects tokens that are not ImageLab secrets", () => {
    expect(isApiKeySecret("sk_test_abc")).toBe(false);
    expect(isApiKeySecret("eyJhbGciOiJIUzI1NiJ9")).toBe(false);
  });

  it("defaults to all asset scopes and drops unknown values", () => {
    expect(normalizeScopes()).toEqual([
      PERMISSIONS.ASSET_UPLOAD,
      PERMISSIONS.ASSET_READ,
      PERMISSIONS.ASSET_UPDATE,
      PERMISSIONS.ASSET_DELETE,
    ]);
    expect(normalizeScopes([PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_READ, "user:read"])).toEqual([
      PERMISSIONS.ASSET_READ,
    ]);
  });

  it("rejects a scope list with no asset permissions", () => {
    expect(() => normalizeScopes(["user:read"])).toThrow(ApiError);
  });

  it("caps active keys per account", () => {
    expect(MAX_API_KEYS).toBe(8);
  });
});
