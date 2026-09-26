import { asyncHandler } from "../../utils/asyncHandler";
import { roleService } from "./role.service";

export const roleController = {
  list: asyncHandler(async (_req, res) => {
    res.json({ success: true, message: "Roles fetched", data: roleService.list() });
  }),
};
