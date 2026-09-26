import mongoose, { type HydratedDocument, type Model, type Types } from "mongoose";
import { ALLOWED_FORMATS, type AllowedFormat } from "./constants";

export type AssetStatus = "ready" | "deleted";

export interface IAsset {
  owner: Types.ObjectId;
  publicId: string;
  contentHash: string;
  bytes: number;
  width: number;
  height: number;
  format: AllowedFormat;
  mime: string;
  originalName: string;
  status: AssetStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type AssetDocument = HydratedDocument<IAsset>;

const assetSchema = new mongoose.Schema<IAsset, Model<IAsset>>(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    publicId: { type: String, required: true, unique: true, index: true },
    contentHash: { type: String, required: true, index: true },
    bytes: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    format: { type: String, enum: ALLOWED_FORMATS, required: true },
    mime: { type: String, required: true },
    originalName: { type: String, required: true },
    status: { type: String, enum: ["ready", "deleted"], default: "ready", required: true },
  },
  { timestamps: true },
);

assetSchema.index({ owner: 1, createdAt: -1 });
assetSchema.index({ owner: 1, status: 1 });

export const Asset = mongoose.model<IAsset>("Asset", assetSchema);
