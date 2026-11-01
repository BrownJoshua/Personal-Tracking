import type { RequestHandler } from "express";
import { ROLE_PERMISSIONS } from "@recomptrack/shared";
import { verifyAccessToken } from "../modules/auth/tokens";
import { User } from "../modules/users/user.model";
import { HttpError } from "../utils/httpError";

/**
 * Verifies the Bearer access token, then re-reads the user so that role changes
 * and deactivation take effect immediately rather than when the token expires.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw HttpError.unauthorized();

  const claims = verifyAccessToken(header.slice("Bearer ".length));
  if (!claims) throw HttpError.unauthorized("Session expired or invalid", "TOKEN_INVALID");

  const user = await User.findById(claims.sub).select({ role: 1, status: 1 }).lean();
  if (!user) throw HttpError.unauthorized("Session expired or invalid", "TOKEN_INVALID");
  if (user.status !== "ACTIVE") throw HttpError.forbidden("This account has been deactivated", "ACCOUNT_DEACTIVATED");

  req.auth = {
    userId: String(user._id),
    role: user.role,
    sessionId: claims.sid,
    permissions: ROLE_PERMISSIONS[user.role] ?? [],
  };
  next();
};

/** Narrowing helper for handlers mounted after `authenticate`. */
export function requireAuth(req: Express.Request) {
  if (!req.auth) throw HttpError.unauthorized();
  return req.auth;
}
