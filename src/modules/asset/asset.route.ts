import { Router } from "express";
import rateLimit from "express-rate-limit";
import { PERMISSIONS } from "../../constants/roles";
import { authenticate } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/authorize.middleware";
import { uploadImage } from "../../middlewares/upload.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { assetController } from "./asset.controller";
import { assetIdSchema, bulkDeleteSchema, listAssetsSchema, renameAssetSchema } from "./asset.validation";

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? "anonymous",
  message: { success: false, message: "Too many uploads. Try again later." },
});

const apiKeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.apiKey,
  keyGenerator: (req) => req.apiKey?.id ?? req.user?.id ?? "anonymous",
  message: { success: false, message: "Too many API requests. Try again later." },
});

const assetRouter = Router();

assetRouter.use(authenticate);
assetRouter.use(apiKeyLimiter);

assetRouter.get("/", requirePermission(PERMISSIONS.ASSET_READ), validate(listAssetsSchema), assetController.list);
assetRouter.post(
  "/",
  requirePermission(PERMISSIONS.ASSET_UPLOAD),
  uploadLimiter,
  uploadImage,
  assetController.create,
);
assetRouter.post(
  "/bulk-delete",
  requirePermission(PERMISSIONS.ASSET_DELETE),
  validate(bulkDeleteSchema),
  assetController.removeMany,
);
assetRouter.get(
  "/:id",
  requirePermission(PERMISSIONS.ASSET_READ),
  validate(assetIdSchema),
  assetController.getOne,
);
assetRouter.patch(
  "/:id",
  requirePermission(PERMISSIONS.ASSET_UPDATE),
  validate(renameAssetSchema),
  assetController.rename,
);
assetRouter.post(
  "/:id/replace",
  requirePermission(PERMISSIONS.ASSET_UPDATE),
  validate(assetIdSchema),
  uploadLimiter,
  uploadImage,
  assetController.replace,
);
assetRouter.delete(
  "/:id",
  requirePermission(PERMISSIONS.ASSET_DELETE),
  validate(assetIdSchema),
  assetController.remove,
);

export { assetRouter };
