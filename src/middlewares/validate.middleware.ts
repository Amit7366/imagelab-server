import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

export const validate =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      next(result.error);
      return;
    }

    const data = result.data as { body?: unknown; query?: unknown; params?: unknown };
    if (data.body !== undefined) req.body = data.body;
    try {
      if (data.query !== undefined) req.query = data.query as Request["query"];
    } catch {
      // Express 5 exposes query as a getter.
    }
    try {
      if (data.params !== undefined) req.params = data.params as Request["params"];
    } catch {
      // Express 5 params may be a getter.
    }
    next();
  };
