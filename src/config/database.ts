import mongoose from "mongoose";
import { ROLES } from "../constants/roles";
import { User } from "../modules/user/user.model";
import { env } from "./env";

export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI);
  await seedSuperAdmin();
}

async function seedSuperAdmin() {
  const existing = await User.findOne({ role: ROLES.SUPER_ADMIN });
  if (existing) return;

  await User.create({
    name: env.SUPER_ADMIN_NAME,
    email: env.SUPER_ADMIN_EMAIL,
    password: env.SUPER_ADMIN_PASSWORD,
    role: ROLES.SUPER_ADMIN,
  });

  console.log(`Seeded super admin: ${env.SUPER_ADMIN_EMAIL}`);
}
