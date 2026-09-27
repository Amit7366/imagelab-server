import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, requireJwt } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { authController } from "./auth.controller";
import { loginSchema, refreshSchema, registerSchema } from "./auth.validation";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Try again later." },
});

const authRouter = Router();

authRouter.post("/register", authLimiter, validate(registerSchema), authController.register);
authRouter.post("/login", authLimiter, validate(loginSchema), authController.login);
authRouter.post("/refresh", validate(refreshSchema), authController.refresh);
authRouter.post("/logout", validate(refreshSchema), authController.logout);
authRouter.get("/me", authenticate, requireJwt, authController.me);

export { authRouter };
