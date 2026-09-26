import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { billingController } from "./billing.controller";
import { checkoutSchema } from "./billing.validation";

const billingRouter = Router();

billingRouter.get("/plans", authenticate, billingController.plans);
billingRouter.post("/checkout", authenticate, validate(checkoutSchema), billingController.checkout);
billingRouter.post("/portal", authenticate, billingController.portal);

export { billingRouter };
