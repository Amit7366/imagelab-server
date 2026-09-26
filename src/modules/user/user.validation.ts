import { z } from "zod";
import { ROLES } from "../../constants/roles";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().max(80).optional(),
    role: z.enum([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER]).optional(),
  }),
});

export const userIdSchema = z.object({
  params: z.object({ id: objectId }),
});

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().toLowerCase(),
    password: z.string().min(8).max(72),
    role: z.enum([ROLES.ADMIN, ROLES.USER]).default(ROLES.USER),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((body) => body.name !== undefined || body.isActive !== undefined, {
      message: "Provide a name or active status to update",
    }),
});

export const updateRoleSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    role: z.enum([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER]),
  }),
});
