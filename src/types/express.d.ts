import type { ApiKeyAuth, AuthUser } from "./auth";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      apiKey?: ApiKeyAuth;
    }
  }
}

export {};
