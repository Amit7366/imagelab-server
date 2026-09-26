import type { NextFunction, Request, Response } from "express";
import { hasPermission, type Permission } from "../constants/roles";
import { ApiError } from "../utils/ApiError";

export const requirePermission =
  (...permissions: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new ApiError(401, "Authentication required"));
      return;
    }

    const allowed = permissions.every((permission) => hasPermission(req.user!.role, permission));
    if (!allowed) {
      next(new ApiError(403, "You do not have permission to perform this action"));
      return;
    }

    next();
  };
