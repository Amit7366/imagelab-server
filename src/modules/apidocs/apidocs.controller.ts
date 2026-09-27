import type { Request, Response } from "express";
import { openApiSpec } from "./openapi";

export const apidocsController = {
  spec(_req: Request, res: Response) {
    res.json(openApiSpec);
  },
};
