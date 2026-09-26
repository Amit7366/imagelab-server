import type { z } from "zod";
import { requireActor } from "../../utils/request";
import { asyncHandler } from "../../utils/asyncHandler";
import { authService } from "./auth.service";
import type { loginSchema, refreshSchema, registerSchema } from "./auth.validation";

export const authController = {
  register: asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof registerSchema>["body"];
    const data = await authService.register(body);
    res.status(201).json({ success: true, message: "Account created", data });
  }),

  login: asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof loginSchema>["body"];
    const data = await authService.login(body);
    res.json({ success: true, message: "Logged in", data });
  }),

  refresh: asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof refreshSchema>["body"];
    const data = await authService.refresh(body.refreshToken);
    res.json({ success: true, message: "Token refreshed", data });
  }),

  logout: asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof refreshSchema>["body"];
    await authService.logout(body.refreshToken);
    res.json({ success: true, message: "Logged out" });
  }),

  me: asyncHandler(async (req, res) => {
    const data = await authService.me(requireActor(req).id);
    res.json({ success: true, message: "Profile fetched", data });
  }),
};
