import type { Request, Response } from "express";
import type { z } from "zod";
import { requireActor } from "../../utils/request";
import { asyncHandler } from "../../utils/asyncHandler";
import { userService } from "./user.service";
import type { createUserSchema, listUsersSchema, updateRoleSchema, updateUserSchema } from "./user.validation";

export const userController = {
  list: asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listUsersSchema>["query"];
    const data = await userService.list(query);
    res.json({ success: true, message: "Users fetched", data });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof createUserSchema>["body"];
    const data = await userService.create(requireActor(req), body);
    res.status(201).json({ success: true, message: "User created", data });
  }),

  getById: asyncHandler(async (req, res) => {
    const data = await userService.getById(requireActor(req), String(req.params.id));
    res.json({ success: true, message: "User fetched", data });
  }),

  update: asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateUserSchema>["body"];
    const data = await userService.update(requireActor(req), String(req.params.id), body);
    res.json({ success: true, message: "User updated", data });
  }),

  updateRole: asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateRoleSchema>["body"];
    const data = await userService.updateRole(requireActor(req).id, String(req.params.id), body.role);
    res.json({ success: true, message: "Role updated", data });
  }),

  remove: asyncHandler(async (req, res) => {
    await userService.remove(requireActor(req).id, String(req.params.id));
    res.json({ success: true, message: "User deleted" });
  }),
};
