import type { NextFunction, Request, Response } from "express";
import { isRole } from "../constants/roles";
import { isApiKeySecret } from "../modules/api-key/secret";
import { apiKeyService } from "../modules/api-key/api-key.service";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/token";

async function authenticateRequest(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required");
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new ApiError(401, "Authentication required");
  }

  if (isApiKeySecret(token)) {
    const resolved = await apiKeyService.authenticate(token);
    req.user = resolved.user;
    req.apiKey = resolved.apiKey;
    return;
  }

  const payload = verifyAccessToken(token);
  if (!isRole(payload.role)) {
    throw new ApiError(401, "Invalid access token");
  }
  req.user = { id: payload.sub, email: payload.email, role: payload.role };
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  void authenticateRequest(req)
    .then(() => next())
    .catch(next);
}

export function requireJwt(req: Request, _res: Response, next: NextFunction) {
  if (req.apiKey) {
    next(new ApiError(403, "This endpoint requires a dashboard session, not an API key"));
    return;
  }
  next();
}
