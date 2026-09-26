import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_BYTES,
    files: 1,
  },
});

export function uploadImage(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(new ApiError(413, `File is too large. Max ${env.MAX_UPLOAD_BYTES} bytes`));
        return;
      }
      next(new ApiError(400, error.message));
      return;
    }

    next(error);
  });
}
