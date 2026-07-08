import jwt from "jsonwebtoken";

/**
 * Verifies the short-lived bridge JWT the frontend mints from its NextAuth
 * session (see frontend/src/app/api/sync-token/route.ts). NextAuth's own
 * session cookie is encrypted (JWE), not a plain signed JWT, so it can't be
 * verified here directly — this token exists specifically to cross that gap.
 */
export function verifyToken(token: string): { userId: string } | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload === "object" && payload !== null && typeof payload.sub === "string") {
      return { userId: payload.sub };
    }
    return null;
  } catch {
    return null;
  }
}
