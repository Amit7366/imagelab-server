import { Router } from "express";
import { authenticate, requireJwt } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { apiKeyController } from "./api-key.controller";
import { apiKeyIdSchema, createApiKeySchema } from "./api-key.validation";

const apiKeyRouter = Router();

apiKeyRouter.use(authenticate, requireJwt);

apiKeyRouter.get("/", apiKeyController.list);
apiKeyRouter.post("/", validate(createApiKeySchema), apiKeyController.create);
apiKeyRouter.post("/:id/reveal", validate(apiKeyIdSchema), apiKeyController.reveal);
apiKeyRouter.delete("/:id", validate(apiKeyIdSchema), apiKeyController.revoke);

export { apiKeyRouter };
