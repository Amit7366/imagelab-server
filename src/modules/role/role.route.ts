import { Router } from "express";
import { PERMISSIONS } from "../../constants/roles";
import { authenticate, requireJwt } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/authorize.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { roleController } from "./role.controller";
import { listRolesSchema } from "./role.validation";

const roleRouter = Router();

roleRouter.get(
  "/",
  authenticate,
  requireJwt,
  requirePermission(PERMISSIONS.ROLE_READ),
  validate(listRolesSchema),
  roleController.list,
);

export { roleRouter };
