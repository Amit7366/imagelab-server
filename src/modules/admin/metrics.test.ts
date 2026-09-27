import { describe, expect, it } from "vitest";
import { bandwidthSeries, capacityBreakdown, estimatedMrrCents, signupSeries } from "./metrics";

describe("admin metrics", () => {
  it("prices estimated MRR from active paid plans", () => {
    expect(estimatedMrrCents({ starter: 2, pro: 1 })).toBe(2 * 2999 + 4999);
    expect(estimatedMrrCents({ starter: 0, pro: 0 })).toBe(0);
  });

  it("fills missing signup days", () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    const series = signupSeries(3, [{ day: "2026-09-27", count: 4 }], now);
    expect(series).toEqual([
      { day: "2026-09-25", count: 0 },
      { day: "2026-09-26", count: 0 },
      { day: "2026-09-27", count: 4 },
    ]);
  });

  it("splits used and free capacity", () => {
    expect(capacityBreakdown(25 * 1024 * 1024, 200 * 1024 * 1024 * 1024)).toMatchObject({
      usedBytes: 25 * 1024 * 1024,
      capacityBytes: 200 * 1024 * 1024 * 1024,
    });
    expect(capacityBreakdown(25 * 1024 * 1024, 200 * 1024 * 1024 * 1024).freeBytes).toBe(200 * 1024 * 1024 * 1024 - 25 * 1024 * 1024);
    expect(capacityBreakdown(300, 200).usedPercent).toBe(100);
    expect(capacityBreakdown(50, 200).usedPercent).toBe(25);
  });

  it("fills missing bandwidth days", () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    const series = bandwidthSeries(3, [{ day: "2026-09-27", outboundBytes: 40, inboundBytes: 10, requests: 2 }], now);
    expect(series[0]).toEqual({ day: "2026-09-25", outboundBytes: 0, inboundBytes: 0, requests: 0 });
    expect(series[2]).toEqual({ day: "2026-09-27", outboundBytes: 40, inboundBytes: 10, requests: 2 });
  });
});
