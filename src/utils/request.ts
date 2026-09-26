import type { Request } from "express";
import type { AuthUser } from "../types/auth";
import { ApiError } from "./ApiError";

export function requireActor(req: Request): AuthUser {
  if (!req.user) throw new ApiError(401, "Authentication required");
  return req.user;
}
