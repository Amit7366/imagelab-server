import mongoose from "mongoose";
import { env } from "../../config/env";
import { Asset } from "../asset/asset.model";
import { storageUsageBytes } from "../asset/storage";
import { PLANS, normalizePlan, usageFromBytes, type PlanId } from "../billing/plans";
import { BandwidthDay } from "../usage/bandwidth.model";
import { User } from "../user/user.model";
import { toPublicUser } from "../user/user.service";
import { bandwidthSeries, capacityBreakdown, estimatedMrrCents, signupSeries } from "./metrics";

const SIGNUP_DAYS = 14;
const BANDWIDTH_DAYS = 14;

function startOfUtcDay(daysAgo: number, now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
}

function sumBandwidth(
  rows: Array<{ inboundBytes: number; outboundBytes: number; requests: number; originals: number; transforms: number; uploads: number }>,
) {
  return rows.reduce(
    (acc, row) => ({
      inboundBytes: acc.inboundBytes + row.inboundBytes,
      outboundBytes: acc.outboundBytes + row.outboundBytes,
      requests: acc.requests + row.requests,
      originals: acc.originals + row.originals,
      transforms: acc.transforms + row.transforms,
      uploads: acc.uploads + row.uploads,
    }),
    { inboundBytes: 0, outboundBytes: 0, requests: 0, originals: 0, transforms: 0, uploads: 0 },
  );
}

export const adminService = {
  async overview() {
    const now = new Date();
    const since7 = startOfUtcDay(6, now);
    const since30 = startOfUtcDay(29, now);
    const since14 = startOfUtcDay(SIGNUP_DAYS - 1, now);
    const since7Key = since7.toISOString().slice(0, 10);
    const since30Key = since30.toISOString().slice(0, 10);
    const since14Key = since14.toISOString().slice(0, 10);

    const [
      totalUsers,
      activeUsers,
      pausedUsers,
      signups7,
      signups30,
      planRows,
      storageRows,
      signupRows,
      recent,
      activeAccounts,
      disk,
      bandwidthRows,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ createdAt: { $gte: since7 } }),
      User.countDocuments({ createdAt: { $gte: since30 } }),
      User.aggregate<{ _id: string | null; count: number }>([{ $group: { _id: "$plan", count: { $sum: 1 } } }]),
      Asset.aggregate<{ bytes: number; assets: number }>([
        { $match: { status: "ready" } },
        { $group: { _id: null, bytes: { $sum: "$bytes" }, assets: { $sum: 1 } } },
      ]),
      User.aggregate<{ _id: string; count: number }>([
        { $match: { createdAt: { $gte: since14 } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
      ]),
      User.find().sort({ createdAt: -1 }).limit(8),
      User.find({ isActive: true }).select("plan"),
      storageUsageBytes(),
      BandwidthDay.find({ day: { $gte: since30Key } }).lean(),
    ]);

    const planMix: Record<PlanId, number> = { free: 0, starter: 0, pro: 0 };
    for (const row of planRows) {
      planMix[normalizePlan(row._id)] += row.count;
    }

    const paidActive = { starter: 0, pro: 0 };
    const usageByOwner = await Asset.aggregate<{ _id: mongoose.Types.ObjectId; bytes: number }>([
      { $match: { status: "ready" } },
      { $group: { _id: "$owner", bytes: { $sum: "$bytes" } } },
    ]);
    const usedMap = new Map(usageByOwner.map((row) => [String(row._id), row.bytes]));

    let atQuota = 0;
    for (const account of activeAccounts) {
      const plan = normalizePlan(account.plan);
      if (plan === "starter") paidActive.starter += 1;
      if (plan === "pro") paidActive.pro += 1;
      const usage = usageFromBytes(usedMap.get(account.id) ?? 0, plan);
      if (!usage.canUpload) atQuota += 1;
    }

    const storage = storageRows[0] ?? { bytes: 0, assets: 0 };
    const estimatedMrr = estimatedMrrCents(paidActive);
    const capacity = capacityBreakdown(disk.usedBytes, env.PLATFORM_STORAGE_BYTES);
    const last7 = sumBandwidth(bandwidthRows.filter((row) => row.day >= since7Key));
    const last30 = sumBandwidth(bandwidthRows);
    const seriesRows = bandwidthRows.filter((row) => row.day >= since14Key);

    return {
      users: { total: totalUsers, active: activeUsers, paused: pausedUsers },
      signups: {
        last7: signups7,
        last30: signups30,
        series: signupSeries(
          SIGNUP_DAYS,
          signupRows.map((row) => ({ day: row._id, count: row.count })),
          now,
        ),
      },
      storage: {
        usedBytes: capacity.usedBytes,
        originalBytes: disk.originals,
        variantBytes: disk.variants,
        libraryBytes: storage.bytes,
        freeBytes: capacity.freeBytes,
        capacityBytes: capacity.capacityBytes,
        usedPercent: capacity.usedPercent,
        assets: storage.assets,
      },
      bandwidth: {
        last7,
        last30,
        series: bandwidthSeries(
          BANDWIDTH_DAYS,
          seriesRows.map((row) => ({
            day: row.day,
            outboundBytes: row.outboundBytes,
            inboundBytes: row.inboundBytes,
            requests: row.requests,
          })),
          now,
        ),
        note: "Outbound is public image delivery. Inbound is uploads through the API.",
      },
      plans: planMix,
      revenue: {
        estimatedMrrCents: estimatedMrr,
        paidActive: paidActive.starter + paidActive.pro,
        currency: "usd",
        note: "Estimated from active Starter and Pro plans, not Stripe payouts.",
      },
      atQuota,
      catalog: {
        starterCents: PLANS.starter.priceCents,
        proCents: PLANS.pro.priceCents,
      },
      recent: recent.map(toPublicUser),
    };
  },
};
