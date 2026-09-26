import bcrypt from "bcryptjs";
import mongoose, { type HydratedDocument, type Model } from "mongoose";
import { ROLES, type Role } from "../../constants/roles";
import { PLAN_IDS, type PlanId } from "../billing/plans";

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
  plan?: PlanId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: string;
  refreshTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(plain: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<IUser, IUserMethods>;

const userSchema = new mongoose.Schema<IUser, Model<IUser, {}, IUserMethods>, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER, required: true },
    isActive: { type: Boolean, default: true },
    plan: { type: String, enum: PLAN_IDS, default: "free" },
    stripeCustomerId: { type: String, index: true },
    stripeSubscriptionId: { type: String },
    stripeSubscriptionStatus: { type: String },
    refreshTokenHash: { type: String, select: false },
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (plain: string) {
  return bcrypt.compare(plain, this.password);
};

export const User = mongoose.model<IUser, Model<IUser, {}, IUserMethods>>("User", userSchema);
