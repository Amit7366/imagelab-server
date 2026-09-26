import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/error.middleware";
import { notFound } from "./middlewares/notFound.middleware";
import { billingController } from "./modules/billing/billing.controller";
import { deliveryRouter } from "./modules/delivery/delivery.route";
import { router } from "./routes";

const allowedOrigins = [
  ...new Set([env.CLIENT_URL, "https://imagelab.site", "https://www.imagelab.site"]),
];

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use((req, res, next) => {
    if (req.path.startsWith("/image")) {
      cors({ origin: "*" })(req, res, next);
      return;
    }
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    })(req, res, next);
  });

  app.post("/api/v1/billing/webhook", express.raw({ type: "application/json" }), billingController.webhook);
  app.use(express.json());

  app.use("/image", (_req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Content-Security-Policy", `frame-ancestors 'self' ${allowedOrigins.join(" ")}`);
    next();
  });
  app.use("/image", deliveryRouter);

  app.use("/api/v1", router);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
