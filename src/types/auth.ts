import type { Role } from "../constants/roles";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}
