import { Router } from "express";
import { assetRouter } from "../modules/asset/asset.route";
import { authRouter } from "../modules/auth/auth.route";
import { roleRouter } from "../modules/role/role.route";
import { userRouter } from "../modules/user/user.route";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ success: true, message: "ImageLab API is running" });
});

router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/roles", roleRouter);
router.use("/assets", assetRouter);

export { router };
