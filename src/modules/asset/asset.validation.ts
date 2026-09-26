import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid asset id");

export const listAssetsSchema = z.object({
  query: z.object({
    q: z.string().trim().max(120).optional(),
  }),
});

export const assetIdSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});

export const renameAssetSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    originalName: z.string().trim().min(1).max(180),
  }),
});

export const bulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(objectId).min(1).max(50),
  }),
});
