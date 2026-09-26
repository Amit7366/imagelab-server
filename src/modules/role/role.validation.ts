import { z } from "zod";

export const listRolesSchema = z.object({
  query: z.object({}).optional(),
});
