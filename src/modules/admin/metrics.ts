import { PLANS } from "../billing/plans";

export function estimatedMrrCents(paidActive: { starter: number; pro: number }) {
  return paidActive.starter * PLANS.starter.priceCents + paidActive.pro * PLANS.pro.priceCents;
}

export function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function utcDays(days: number, now = new Date()) {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    keys.push(dayKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset))));
  }
  return keys;
}

export function signupSeries(days: number, rows: Array<{ day: string; count: number }>, now = new Date()) {
  const counts = new Map(rows.map((row) => [row.day, row.count]));
  return utcDays(days, now).map((day) => ({ day, count: counts.get(day) ?? 0 }));
}

export function capacityBreakdown(usedBytes: number, capacityBytes: number) {
  const capacity = Math.max(0, capacityBytes);
  const used = Math.max(0, usedBytes);
  const freeBytes = Math.max(0, capacity - used);
  const usedPercent = capacity === 0 ? 0 : Math.min(100, (used / capacity) * 100);
  return { usedBytes: used, freeBytes, capacityBytes: capacity, usedPercent };
}

export function bandwidthSeries(
  days: number,
  rows: Array<{ day: string; outboundBytes: number; inboundBytes: number; requests: number }>,
  now = new Date(),
) {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return utcDays(days, now).map((day) => {
    const row = byDay.get(day);
    return {
      day,
      outboundBytes: row?.outboundBytes ?? 0,
      inboundBytes: row?.inboundBytes ?? 0,
      requests: row?.requests ?? 0,
    };
  });
}
