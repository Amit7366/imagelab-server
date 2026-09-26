import Stripe from "stripe";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import type { PaidPlanId } from "./plans";

const PRICE_ID = /^price_[A-Za-z0-9]+$/;
let client: Stripe | null = null;

export function stripeEnabled() {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      PRICE_ID.test(env.STRIPE_PRICE_STARTER) &&
      PRICE_ID.test(env.STRIPE_PRICE_PRO),
  );
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
  if (!PRICE_ID.test(priceId)) {
    throw new ApiError(503, "Stripe price IDs must look like price_... from the Stripe Dashboard, not a dollar amount");
  }
  return priceId;
}

export function planFromPriceId(priceId: string | undefined | null) {
  if (!priceId) return null;
  if (env.STRIPE_PRICE_STARTER && priceId === env.STRIPE_PRICE_STARTER) return "starter" as const;
  if (env.STRIPE_PRICE_PRO && priceId === env.STRIPE_PRICE_PRO) return "pro" as const;
  return null;
}
