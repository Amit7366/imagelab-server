import { Router } from "express";
import { authenticate, requireJwt } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/authorize.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { PERMISSIONS } from "../../constants/roles";
import { userController } from "./user.controller";
import { createUserSchema, listUsersSchema, updateRoleSchema, updateUserSchema, userIdSchema } from "./user.validation";

const userRouter = Router();

userRouter.use(authenticate, requireJwt);

userRouter.get("/", requirePermission(PERMISSIONS.USER_READ), validate(listUsersSchema), userController.list);
userRouter.post("/", requirePermission(PERMISSIONS.USER_CREATE), validate(createUserSchema), userController.create);
userRouter.get("/:id", validate(userIdSchema), userController.getById);
userRouter.patch("/:id", validate(updateUserSchema), userController.update);
userRouter.patch(
  "/:id/role",
  requirePermission(PERMISSIONS.ROLE_ASSIGN),
  validate(updateRoleSchema),
  userController.updateRole,
);
userRouter.delete("/:id", requirePermission(PERMISSIONS.USER_DELETE), validate(userIdSchema), userController.remove);

export { userRouter };
