import type Stripe from "stripe";
import { env } from "../../config/env";
import type { AuthUser } from "../../types/auth";
import { ApiError } from "../../utils/ApiError";
import { User, type UserDocument } from "../user/user.model";
import { catalog, normalizePlan, type PaidPlanId, type PlanId } from "./plans";
import { usageForOwner } from "./quota";
import { getStripe, planFromPriceId, priceIdForPlan, stripeEnabled } from "./stripe";

const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

async function loadUser(actor: AuthUser) {
  const user = await User.findById(actor.id);
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

async function ensureCustomer(user: UserDocument) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });
  user.stripeCustomerId = customer.id;
  await user.save();
  return customer.id;
}

function subscriptionPriceId(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price?.id;
}

async function syncSubscription(user: UserDocument) {
  if (!stripeEnabled() || !user.stripeCustomerId) return user;
  const subscriptions = await getStripe().subscriptions.list({
    customer: user.stripeCustomerId,
    status: "all",
    limit: 10,
  });
  const current = subscriptions.data.find((sub) => PAID_STATUSES.has(sub.status)) ?? subscriptions.data[0];
  if (!current) return user;
  await applySubscription(current, user.stripeCustomerId);
  return (await User.findById(user.id)) ?? user;
}

export async function applySubscription(subscription: Stripe.Subscription, customerId?: string) {
  const ownerId = subscription.metadata?.userId;
  const customer = customerId || (typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id);
  const user =
    (ownerId ? await User.findById(ownerId) : null) ??
    (customer ? await User.findOne({ stripeCustomerId: customer }) : null) ??
    (await User.findOne({ stripeSubscriptionId: subscription.id }));

  if (!user) return;

  const paidPlan = planFromPriceId(subscriptionPriceId(subscription));
  const plan: PlanId = PAID_STATUSES.has(subscription.status) && paidPlan ? paidPlan : "free";

  user.plan = plan;
  user.stripeSubscriptionId = subscription.status === "canceled" ? undefined : subscription.id;
  user.stripeSubscriptionStatus = subscription.status;
  if (customer) user.stripeCustomerId = customer;
  await user.save();
}

export const billingService = {
  async plans(actor: AuthUser) {
    const user = await syncSubscription(await loadUser(actor));
    return {
      stripeEnabled: stripeEnabled(),
      current: {
        ...(await usageForOwner(user.id)),
        subscriptionStatus: user.stripeSubscriptionStatus ?? null,
      },
      plans: catalog(),
    };
  },

  async checkout(actor: AuthUser, plan: PaidPlanId) {
    if (!stripeEnabled()) {
      throw new ApiError(503, "Billing is not configured");
    }

    const user = await loadUser(actor);
    if (normalizePlan(user.plan) === plan && PAID_STATUSES.has(user.stripeSubscriptionStatus ?? "")) {
      throw new ApiError(400, "You are already on this plan");
    }

    const stripe = getStripe();
    const customerId = await ensureCustomer(user);
    const price = priceIdForPlan(plan);

    if (user.stripeSubscriptionId && PAID_STATUSES.has(user.stripeSubscriptionStatus ?? "")) {
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      const itemId = subscription.items.data[0]?.id;
      if (!itemId) throw new ApiError(400, "Existing subscription is missing a price");
      const updated = await stripe.subscriptions.update(subscription.id, {
        items: [{ id: itemId, price }],
        proration_behavior: "create_prorations",
        metadata: { userId: user.id },
      });
      await applySubscription(updated, customerId);
      return { url: null as string | null, plan };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      success_url: `${env.CLIENT_URL}/dashboard/billing?checkout=success`,
      cancel_url: `${env.CLIENT_URL}/dashboard/billing?checkout=cancel`,
      line_items: [{ price, quantity: 1 }],
      metadata: { userId: user.id, plan },
      subscription_data: {
        metadata: { userId: user.id, plan },
      },
    });

    if (!session.url) {
      throw new ApiError(502, "Stripe did not return a checkout URL");
    }

    return { url: session.url, plan };
  },

  async portal(actor: AuthUser) {
    if (!stripeEnabled()) {
      throw new ApiError(503, "Billing is not configured");
    }
    const user = await loadUser(actor);
    if (!user.stripeCustomerId) {
      throw new ApiError(400, "No billing account yet. Choose a paid plan first.");
    }
    const session = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${env.CLIENT_URL}/dashboard/billing`,
    });
    return { url: session.url };
  },

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new ApiError(503, "Billing is not configured");
    }
    if (!signature) {
      throw new ApiError(400, "Missing Stripe signature");
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new ApiError(400, "Invalid Stripe signature");
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) return;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      await applySubscription(subscription, customerId);
      return;
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
      await applySubscription(subscription, customerId);
    }
  },
};
