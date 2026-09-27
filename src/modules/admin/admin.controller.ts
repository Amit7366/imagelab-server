import { asyncHandler } from "../../utils/asyncHandler";
import { adminService } from "./admin.service";

export const adminController = {
  overview: asyncHandler(async (_req, res) => {
    const data = await adminService.overview();
    res.json({ success: true, message: "Overview fetched", data });
  }),
};
