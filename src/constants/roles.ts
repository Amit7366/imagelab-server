export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  USER: "user",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  USER_READ: "user:read",
  USER_CREATE: "user:create",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  ROLE_READ: "role:read",
  ROLE_ASSIGN: "role:assign",
  ASSET_UPLOAD: "asset:upload",
  ASSET_READ: "asset:read",
  ASSET_UPDATE: "asset:update",
  ASSET_DELETE: "asset:delete",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface RoleDefinition {
  key: Role;
  label: string;
  rank: number;
  permissions: Permission[];
}

/**
 * Add a future role here: key, label, rank, and permissions.
 * Routes check permissions, so existing handlers keep working.
 */
export const ROLE_CATALOG: RoleDefinition[] = [
  {
    key: ROLES.SUPER_ADMIN,
    label: "Super Admin",
    rank: 100,
    permissions: Object.values(PERMISSIONS),
  },
  {
    key: ROLES.ADMIN,
    label: "Admin",
    rank: 50,
    permissions: [
      PERMISSIONS.USER_READ,
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.ROLE_READ,
      PERMISSIONS.ASSET_UPLOAD,
      PERMISSIONS.ASSET_READ,
      PERMISSIONS.ASSET_UPDATE,
      PERMISSIONS.ASSET_DELETE,
    ],
  },
  {
    key: ROLES.USER,
    label: "User",
    rank: 10,
    permissions: [
      PERMISSIONS.ASSET_UPLOAD,
      PERMISSIONS.ASSET_READ,
      PERMISSIONS.ASSET_UPDATE,
      PERMISSIONS.ASSET_DELETE,
    ],
  },
];

const catalogByRole = new Map(ROLE_CATALOG.map((role) => [role.key, role]));

export function isRole(value: string): value is Role {
  return catalogByRole.has(value as Role);
}

export function getRoleDefinition(role: Role): RoleDefinition {
  const definition = catalogByRole.get(role);
  if (!definition) {
    throw new Error(`Unknown role: ${role}`);
  }
  return definition;
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return getRoleDefinition(role).permissions.includes(permission);
}
