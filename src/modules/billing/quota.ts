import mongoose from "mongoose";
import { ApiError } from "../../utils/ApiError";
import { Asset } from "../asset/asset.model";
import { User } from "../user/user.model";
import { normalizePlan, quotaBytesFor, usageFromBytes, type StorageUsage } from "./plans";

export async function usedBytes(ownerId: string): Promise<number> {
  const [row] = await Asset.aggregate<{ total: number }>([
    { $match: { owner: new mongoose.Types.ObjectId(ownerId), status: "ready" } },
    { $group: { _id: null, total: { $sum: "$bytes" } } },
  ]);
  return row?.total ?? 0;
}

export async function usageForOwner(ownerId: string): Promise<StorageUsage> {
  const [used, user] = await Promise.all([usedBytes(ownerId), User.findById(ownerId).select("plan")]);
  return usageFromBytes(used, normalizePlan(user?.plan));
}

export async function assertStorageFits(ownerId: string, nextBytes: number, replaceOldBytes = 0) {
  const [used, user] = await Promise.all([usedBytes(ownerId), User.findById(ownerId).select("plan")]);
  const plan = normalizePlan(user?.plan);
  const projected = used - replaceOldBytes + nextBytes;
  if (projected > quotaBytesFor(plan)) {
    throw new ApiError(402, "Credits finished. Upgrade your plan to upload more.");
  }
}
