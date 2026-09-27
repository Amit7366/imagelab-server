import mongoose, { type HydratedDocument, type Model } from "mongoose";
import { PERMISSIONS, type Permission } from "../../constants/roles";
import { ASSET_KEY_SCOPES } from "./secret";

export const API_KEY_STATUSES = ["active", "revoked"] as const;
export type ApiKeyStatus = (typeof API_KEY_STATUSES)[number];

export interface IApiKey {
  owner: mongoose.Types.ObjectId;
  name: string;
  keyHash: string;
  prefix: string;
  lastFour: string;
  secretCipher?: string;
  scopes: Permission[];
  status: ApiKeyStatus;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ApiKeyDocument = HydratedDocument<IApiKey>;

const apiKeySchema = new mongoose.Schema<IApiKey, Model<IApiKey>>(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    keyHash: { type: String, required: true, unique: true, select: false },
    secretCipher: { type: String, select: false },
    prefix: { type: String, required: true },
    lastFour: { type: String, required: true, minlength: 4, maxlength: 4 },
    scopes: {
      type: [String],
      enum: Object.values(PERMISSIONS),
      default: () => [...ASSET_KEY_SCOPES],
      required: true,
    },
    status: { type: String, enum: API_KEY_STATUSES, default: "active", required: true, index: true },
    lastUsedAt: { type: Date },
  },
  { timestamps: true },
);

apiKeySchema.index({ owner: 1, status: 1 });

export const ApiKey = mongoose.model<IApiKey>("ApiKey", apiKeySchema);
