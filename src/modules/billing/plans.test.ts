import { describe, expect, it } from "vitest";
import { CREDIT_BYTES, catalog, quotaBytesFor, usageFromBytes } from "./plans";

describe("billing plans", () => {
  it("gives free accounts 25 MiB", () => {
    expect(quotaBytesFor("free")).toBe(25 * CREDIT_BYTES);
    expect(quotaBytesFor("starter")).toBe(1024 * CREDIT_BYTES);
    expect(quotaBytesFor("pro")).toBe(10240 * CREDIT_BYTES);
  });

  it("counts used storage as credits without blocking views", () => {
    const usage = usageFromBytes(12.5 * CREDIT_BYTES, "free");
    expect(usage.usedCredits).toBe(12.5);
    expect(usage.quotaCredits).toBe(25);
    expect(usage.remainingCredits).toBe(12.5);
    expect(usage.canUpload).toBe(true);
  });

  it("blocks uploads when the plan quota is full", () => {
    const usage = usageFromBytes(25 * CREDIT_BYTES, "free");
    expect(usage.canUpload).toBe(false);
    expect(usage.remainingCredits).toBe(0);
  });

  it("exposes the public catalog", () => {
    expect(catalog().map((plan) => plan.id)).toEqual(["free", "starter", "pro"]);
  });
});
