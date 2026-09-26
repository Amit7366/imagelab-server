import { Router } from "express";
import { deliveryController } from "./delivery.controller";

const deliveryRouter = Router();

deliveryRouter.get("/upload/:transforms/:publicId", deliveryController.transformed);
deliveryRouter.get("/upload/:publicId", deliveryController.original);

export { deliveryRouter };
