import Stripe from "stripe";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import type { PaidPlanId } from "./plans";

let client: Stripe | null = null;

export function stripeEnabled() {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_STARTER && env.STRIPE_PRICE_PRO);
}

export function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ApiError(503, "Billing is not configured");
  }
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return client;
}

export function priceIdForPlan(plan: PaidPlanId) {
  const priceId = plan === "starter" ? env.STRIPE_PRICE_STARTER : env.STRIPE_PRICE_PRO;
  if (!priceId) {
    throw new ApiError(503, "Billing is not configured");
  }
  return priceId;
}

export function planFromPriceId(priceId: string | undefined | null) {
  if (!priceId) return null;
  if (env.STRIPE_PRICE_STARTER && priceId === env.STRIPE_PRICE_STARTER) return "starter" as const;
  if (env.STRIPE_PRICE_PRO && priceId === env.STRIPE_PRICE_PRO) return "pro" as const;
  return null;
}
