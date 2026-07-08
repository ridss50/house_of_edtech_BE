
import { z } from "zod";

export const RoleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"]);
export type Role = z.infer<typeof RoleSchema>;

/** Roles allowed to push document mutations (Yjs updates / awareness writes). */
export const WRITE_ROLES: readonly Role[] = ["OWNER", "EDITOR"];

export function canWrite(role: Role): boolean {
  return WRITE_ROLES.includes(role);
}

/** Only owners may change permissions or delete a document. */
export function canManagePermissions(role: Role): boolean {
  return role === "OWNER";
}
