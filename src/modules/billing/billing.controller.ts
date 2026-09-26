import type { Request, Response } from "express";
import type { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireActor } from "../../utils/request";
import { billingService } from "./billing.service";
import type { checkoutSchema } from "./billing.validation";

export const billingController = {
  plans: asyncHandler(async (req, res) => {
    const data = await billingService.plans(requireActor(req));
    res.json({ success: true, message: "Plans fetched", data });
  }),

  checkout: asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof checkoutSchema>["body"];
    const data = await billingService.checkout(requireActor(req), body.plan);
    res.json({ success: true, message: data.url ? "Checkout created" : "Plan updated", data });
  }),

  portal: asyncHandler(async (req, res) => {
    const data = await billingService.portal(requireActor(req));
    res.json({ success: true, message: "Billing portal created", data });
  }),

  webhook: asyncHandler(async (req: Request, res: Response) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const header = req.headers["stripe-signature"];
    const signature = Array.isArray(header) ? header[0] : header;
    await billingService.handleWebhook(rawBody, signature);
    res.json({ received: true });
  }),
};
