import { Router } from "express";
import { authenticate, requireJwt } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { billingController } from "./billing.controller";
import { checkoutSchema } from "./billing.validation";

const billingRouter = Router();

billingRouter.use(authenticate, requireJwt);

billingRouter.get("/plans", billingController.plans);
billingRouter.post("/checkout", validate(checkoutSchema), billingController.checkout);
billingRouter.post("/portal", billingController.portal);

export { billingRouter };
