import type { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireActor } from "../../utils/request";
import { apiKeyService } from "./api-key.service";
import type { apiKeyIdSchema, createApiKeySchema } from "./api-key.validation";

export const apiKeyController = {
  list: asyncHandler(async (req, res) => {
    const data = await apiKeyService.list(requireActor(req));
    res.json({ success: true, message: "API keys fetched", data });
  }),

  create: asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createApiKeySchema>["body"];
    const data = await apiKeyService.create(requireActor(req), body);
    res.status(201).json({ success: true, message: "API key created. Copy the secret now; it will not be shown again.", data });
  }),

  revoke: asyncHandler(async (req, res) => {
    const params = req.params as unknown as z.infer<typeof apiKeyIdSchema>["params"];
    const data = await apiKeyService.revoke(requireActor(req), params.id);
    res.json({ success: true, message: "API key revoked", data });
  }),
};
