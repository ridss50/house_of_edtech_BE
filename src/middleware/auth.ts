import type { Request, Response, NextFunction } from "express";
import type { Role } from "../shared";
import { verifyToken } from "../auth/verify-token";
import { getRole } from "../auth/get-role";

export interface AuthedRequest extends Request {
  userId?: string;
  role?: Role;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

/** Verifies the Bearer token only — for routes with no single document to
 * resolve a role against yet (e.g. creating or listing documents). */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const verified = verifyToken(token);
  if (!verified) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.userId = verified.userId;
  next();
}

/** Verifies the Bearer token and resolves the caller's role on :id, the same
 * checks the WS 'auth' handler performs for a socket connection. */
export async function requireDocumentRole(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const verified = verifyToken(token);
  if (!verified) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const role = await getRole(req.params.id, verified.userId);
  if (!role) {
    return res.status(403).json({ error: "Not authorized for this document" });
  }

  req.userId = verified.userId;
  req.role = role;
  next();
}
