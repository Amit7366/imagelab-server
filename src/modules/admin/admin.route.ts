import { Router } from "express";
import { PERMISSIONS } from "../../constants/roles";
import { authenticate, requireJwt } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/authorize.middleware";
import { adminController } from "./admin.controller";

const adminRouter = Router();

adminRouter.use(authenticate, requireJwt);
adminRouter.get("/overview", requirePermission(PERMISSIONS.OPS_READ), adminController.overview);

export { adminRouter };
