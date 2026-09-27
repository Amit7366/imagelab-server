import { z } from "zod";

const assetRef = z
  .string()
  .trim()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid asset id");

export const listAssetsSchema = z.object({
  query: z.object({
    q: z.string().trim().max(120).optional(),
  }),
});

export const assetIdSchema = z.object({
  params: z.object({
    id: assetRef,
  }),
});

export const renameAssetSchema = z.object({
  params: z.object({
    id: assetRef,
  }),
  body: z.object({
    originalName: z.string().trim().min(1).max(180),
  }),
});

export const bulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(assetRef).min(1).max(50),
  }),
});
