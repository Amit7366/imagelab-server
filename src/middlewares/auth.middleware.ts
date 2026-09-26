import type { NextFunction, Request, Response } from "express";
import { isRole } from "../constants/roles";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/token";

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new ApiError(401, "Authentication required"));
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    if (!isRole(payload.role)) {
      next(new ApiError(401, "Invalid access token"));
      return;
    }
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch (error) {
    next(error);
  }
}
