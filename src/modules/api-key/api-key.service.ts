import { isRole, type Permission } from "../../constants/roles";
import type { AuthUser } from "../../types/auth";
import { ApiError } from "../../utils/ApiError";
import { User } from "../user/user.model";
import { ApiKey, type ApiKeyDocument } from "./api-key.model";
import { env } from "../../config/env";
import { createApiKeySecret, decryptSecret, encryptSecret, hashApiKey, MAX_API_KEYS, normalizeScopes } from "./secret";

export interface PublicApiKey {
  id: string;
  name: string;
  prefix: string;
  lastFour: string;
  scopes: Permission[];
  status: "active" | "revoked";
  lastUsedAt: Date | null;
  createdAt: Date;
  canReveal: boolean;
}

export interface CreatedApiKey extends PublicApiKey {
  secret: string;
}

export interface ResolvedApiKey {
  user: AuthUser;
  apiKey: { id: string; scopes: Permission[] };
}

function toPublicApiKey(key: ApiKeyDocument): PublicApiKey {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    lastFour: key.lastFour,
    scopes: key.scopes,
    status: key.status,
    lastUsedAt: key.lastUsedAt ?? null,
    createdAt: key.createdAt,
    canReveal: Boolean(key.secretCipher),
  };
}

export const apiKeyService = {
  async list(actor: AuthUser) {
    const keys = await ApiKey.find({ owner: actor.id }).select("+secretCipher").sort({ createdAt: -1 });
    return keys.map(toPublicApiKey);
  },

  async create(actor: AuthUser, input: { name?: string; scopes?: string[] }) {
    const active = await ApiKey.countDocuments({ owner: actor.id, status: "active" });
    if (active >= MAX_API_KEYS) {
      throw new ApiError(400, `You can have at most ${MAX_API_KEYS} active API keys`);
    }

    const generated = createApiKeySecret();
    const key = await ApiKey.create({
      owner: actor.id,
      name: input.name?.trim() || "Default",
      keyHash: generated.keyHash,
      secretCipher: encryptSecret(generated.secret, env.JWT_ACCESS_SECRET),
      prefix: generated.prefix,
      lastFour: generated.lastFour,
      scopes: normalizeScopes(input.scopes),
      status: "active",
    });

    return {
      ...toPublicApiKey(key),
      secret: generated.secret,
    } satisfies CreatedApiKey;
  },

  async revoke(actor: AuthUser, id: string) {
    const key = await ApiKey.findOne({ _id: id, owner: actor.id }).select("+secretCipher");
    if (!key) throw new ApiError(404, "API key not found");
    if (key.status === "revoked") {
      return toPublicApiKey(key);
    }
    key.status = "revoked";
    await key.save();
    return toPublicApiKey(key);
  },

  async reveal(actor: AuthUser, id: string) {
    const key = await ApiKey.findOne({ _id: id, owner: actor.id }).select("+secretCipher");
    if (!key) throw new ApiError(404, "API key not found");
    if (!key.secretCipher) {
      throw new ApiError(409, "This API key cannot be revealed. Create a new key.");
    }
    return { secret: decryptSecret(key.secretCipher, env.JWT_ACCESS_SECRET) };
  },

  async authenticate(secret: string): Promise<ResolvedApiKey> {
    const key = await ApiKey.findOne({ keyHash: hashApiKey(secret) }).select("+keyHash");
    if (!key || key.status !== "active") {
      throw new ApiError(401, "Invalid API key");
    }

    const owner = await User.findById(key.owner);
    if (!owner || !owner.isActive) {
      throw new ApiError(401, "Invalid API key");
    }
    if (!isRole(owner.role)) {
      throw new ApiError(401, "Invalid API key");
    }

    void ApiKey.updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() } }).exec();

    return {
      user: { id: owner.id, email: owner.email, role: owner.role },
      apiKey: { id: key.id, scopes: key.scopes },
    };
  },
};
