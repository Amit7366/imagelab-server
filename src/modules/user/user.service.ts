import { PERMISSIONS, ROLES, hasPermission, type Role } from "../../constants/roles";
import type { AuthUser } from "../../types/auth";
import { ApiError } from "../../utils/ApiError";
import { normalizePlan, type PlanId } from "../billing/plans";
import { User, type UserDocument } from "./user.model";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  plan: PlanId;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    plan: normalizePlan(user.plan),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function assertNotLastSuperAdmin(userId: string) {
  const remaining = await User.countDocuments({
    _id: { $ne: userId },
    role: ROLES.SUPER_ADMIN,
    isActive: true,
  });
  if (remaining === 0) {
    throw new ApiError(400, "At least one active super admin is required");
  }
}

function assertCanManage(actor: AuthUser, target: UserDocument) {
  if (actor.id === target.id) return;
  if (!hasPermission(actor.role, PERMISSIONS.USER_UPDATE)) {
    throw new ApiError(403, "You cannot update this user");
  }
  if (actor.role === ROLES.ADMIN && target.role !== ROLES.USER) {
    throw new ApiError(403, "Admins can only manage standard users");
  }
}

export const userService = {
  async create(actor: AuthUser, input: { name: string; email: string; password: string; role: Role }) {
    if (!hasPermission(actor.role, PERMISSIONS.USER_CREATE)) {
      throw new ApiError(403, "You cannot create users");
    }
    if (input.role === ROLES.ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
      throw new ApiError(403, "Only a super admin can create an admin");
    }
    if (input.role === ROLES.SUPER_ADMIN) {
      throw new ApiError(403, "Assign the super admin role from the role endpoint");
    }

    const existing = await User.findOne({ email: input.email });
    if (existing) throw new ApiError(409, "Email is already registered");

    const user = await User.create(input);
    return toPublicUser(user);
  },

  async list(query: { page: number; limit: number; search?: string; role?: Role }) {
    const filter: {
      role?: Role;
      $or?: Array<{ name?: RegExp; email?: RegExp }>;
    } = {};
    if (query.role) filter.role = query.role;
    if (query.search) {
      const pattern = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ name: new RegExp(pattern, "i") }, { email: new RegExp(pattern, "i") }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      User.countDocuments(filter),
    ]);

    return {
      users: users.map(toPublicUser),
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit) || 1,
    };
  },

  async getById(actor: AuthUser, id: string) {
    const user = await User.findById(id);
    if (!user) throw new ApiError(404, "User not found");
    if (actor.id !== id && !hasPermission(actor.role, PERMISSIONS.USER_READ)) {
      throw new ApiError(403, "You cannot view this user");
    }
    return toPublicUser(user);
  },

  async update(actor: AuthUser, id: string, input: { name?: string; isActive?: boolean }) {
    const user = await User.findById(id);
    if (!user) throw new ApiError(404, "User not found");
    assertCanManage(actor, user);

    if (input.isActive !== undefined && actor.id === user.id) {
      throw new ApiError(400, "You cannot change your own active status");
    }

    if (input.isActive === false && user.role === ROLES.SUPER_ADMIN) {
      await assertNotLastSuperAdmin(user.id);
    }

    if (input.name !== undefined) user.name = input.name;
    if (input.isActive !== undefined) user.isActive = input.isActive;
    await user.save();
    return toPublicUser(user);
  },

  async updateRole(actorId: string, id: string, role: Role) {
    if (actorId === id) throw new ApiError(400, "You cannot change your own role");

    const user = await User.findById(id);
    if (!user) throw new ApiError(404, "User not found");

    if (user.role === ROLES.SUPER_ADMIN && role !== ROLES.SUPER_ADMIN) {
      await assertNotLastSuperAdmin(user.id);
    }

    user.role = role;
    await user.save();
    return toPublicUser(user);
  },

  async remove(actorId: string, id: string) {
    if (actorId === id) throw new ApiError(400, "You cannot delete your own account");

    const user = await User.findById(id);
    if (!user) throw new ApiError(404, "User not found");
    if (user.role === ROLES.SUPER_ADMIN) await assertNotLastSuperAdmin(user.id);

    await user.deleteOne();
  },
};
