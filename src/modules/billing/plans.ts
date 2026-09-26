export const CREDIT_BYTES = 1024 * 1024;

export const PLAN_IDS = ["free", "starter", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type PaidPlanId = Exclude<PlanId, "free">;

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceCents: number;
  interval: "month";
  credits: number;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: { id: "free", name: "Free", priceCents: 0, interval: "month", credits: 25 },
  starter: { id: "starter", name: "Starter", priceCents: 2999, interval: "month", credits: 1024 },
  pro: { id: "pro", name: "Pro", priceCents: 4999, interval: "month", credits: 10240 },
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && PLAN_IDS.includes(value as PlanId);
}

export function normalizePlan(value: unknown): PlanId {
  return isPlanId(value) ? value : "free";
}

export function quotaBytesFor(plan: PlanId): number {
  return PLANS[plan].credits * CREDIT_BYTES;
}

export function roundCredits(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
  usedCredits: number;
  quotaCredits: number;
  remainingCredits: number;
  plan: PlanId;
  canUpload: boolean;
}

export function usageFromBytes(usedBytes: number, plan: PlanId): StorageUsage {
  const quotaBytes = quotaBytesFor(plan);
  const quotaCredits = PLANS[plan].credits;
  const usedCredits = roundCredits(usedBytes / CREDIT_BYTES);
  const remainingCredits = roundCredits(Math.max(0, quotaCredits - usedBytes / CREDIT_BYTES));
  return {
    usedBytes,
    quotaBytes,
    usedCredits,
    quotaCredits,
    remainingCredits,
    plan,
    canUpload: usedBytes < quotaBytes,
  };
}

export function catalog() {
  return PLAN_IDS.map((id) => ({
    ...PLANS[id],
    quotaBytes: quotaBytesFor(id),
  }));
}
