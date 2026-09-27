import { z } from "zod";
import { ASSET_KEY_SCOPES } from "./secret";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid API key id");

export const createApiKeySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(80).optional(),
    scopes: z.array(z.enum(ASSET_KEY_SCOPES)).min(1).max(4).optional(),
  }),
});

export const apiKeyIdSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});
