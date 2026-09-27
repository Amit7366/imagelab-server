import mongoose, { type HydratedDocument, type Model } from "mongoose";

export interface IBandwidthDay {
  day: string;
  inboundBytes: number;
  outboundBytes: number;
  requests: number;
  originals: number;
  transforms: number;
  uploads: number;
}

export type BandwidthDayDocument = HydratedDocument<IBandwidthDay>;

const bandwidthDaySchema = new mongoose.Schema<IBandwidthDay, Model<IBandwidthDay>>(
  {
    day: { type: String, required: true, unique: true, index: true },
    inboundBytes: { type: Number, default: 0 },
    outboundBytes: { type: Number, default: 0 },
    requests: { type: Number, default: 0 },
    originals: { type: Number, default: 0 },
    transforms: { type: Number, default: 0 },
    uploads: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const BandwidthDay = mongoose.model<IBandwidthDay>("BandwidthDay", bandwidthDaySchema);
