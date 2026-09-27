import type { Permission, Role } from "../constants/roles";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface ApiKeyAuth {
  id: string;
  scopes: Permission[];
}
