import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { requireActor } from "../../utils/request";
import { assetService } from "./asset.service";
import type { assetIdSchema, bulkDeleteSchema, listAssetsSchema, renameAssetSchema } from "./asset.validation";

export const assetController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, "Choose an image file to upload");
    }
    const data = await assetService.create(requireActor(req), req.file);
    res.status(201).json({ success: true, message: "Image uploaded", data });
  }),

  list: asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listAssetsSchema>["query"];
    const data = await assetService.listMine(requireActor(req), query.q);
    res.json({ success: true, message: "Assets fetched", data });
  }),

  getOne: asyncHandler(async (req, res) => {
    const params = req.params as unknown as z.infer<typeof assetIdSchema>["params"];
    const data = await assetService.getOne(requireActor(req), params.id);
    res.json({ success: true, message: "Asset fetched", data });
  }),

  rename: asyncHandler(async (req, res) => {
    const parsed = req as unknown as {
      params: z.infer<typeof renameAssetSchema>["params"];
      body: z.infer<typeof renameAssetSchema>["body"];
    };
    const data = await assetService.rename(requireActor(req), parsed.params.id, parsed.body.originalName);
    res.json({ success: true, message: "Image updated", data });
  }),

  replace: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, "Choose an image file to upload");
    }
    const params = req.params as unknown as z.infer<typeof assetIdSchema>["params"];
    const data = await assetService.replace(requireActor(req), params.id, req.file);
    res.json({ success: true, message: "Image replaced", data });
  }),

  remove: asyncHandler(async (req, res) => {
    const params = req.params as unknown as z.infer<typeof assetIdSchema>["params"];
    await assetService.remove(requireActor(req), params.id);
    res.json({ success: true, message: "Image deleted" });
  }),

  removeMany: asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof bulkDeleteSchema>["body"];
    await assetService.removeMany(requireActor(req), body.ids);
    res.json({ success: true, message: "Images deleted" });
  }),
};
