import { DocumentModel, DocumentPermission } from "../models";
import type { Role } from "../shared";

/**
 * A document's owner always has OWNER access even without an explicit
 * DocumentPermission row (belt-and-suspenders alongside always creating
 * that row up front — see src/db/seed.ts) — everyone else must have one.
 */
export async function getRole(documentId: string, userId: string): Promise<Role | null> {
  const permission = await DocumentPermission.findOne({ documentId, userId });
  if (permission) return permission.role;

  const document = await DocumentModel.findById(documentId);
  if (document?.ownerId === userId) return "OWNER";

  return null;
}
