import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import type { Types } from "mongoose";
import type { AuthResponse, ClientType } from "@recomptrack/shared";
import { env, isProduction } from "../../config/env";
import { generateToken, hashToken } from "../../utils/crypto";
import { HttpError } from "../../utils/httpError";
import { User, type IUser } from "../users/user.model";
import { UserPreference } from "../users/userPreference.model";
import { UserProfile } from "../users/userProfile.model";
import { toUserDTO } from "../users/users.serializers";
import { sendPasswordResetEmail } from "./mailer";
import { PasswordReset } from "./passwordReset.model";
import { Session, type ISession } from "./session.model";
import { signAccessToken } from "./tokens";

export const REFRESH_COOKIE = "rt";
const REFRESH_COOKIE_PATH = "/api/auth";
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-0000", 10);

export const hashPassword = (password: string) => bcrypt.hash(password, env.BCRYPT_ROUNDS);

function refreshExpiry() {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function createSession(user: IUser, clientType: ClientType, req: Request, familyId: string = randomUUID()) {
  const refreshToken = generateToken();
  const session = await Session.create({
    userId: user._id,
    familyId,
    refreshTokenHash: hashToken(refreshToken),
    clientType,
    userAgent: req.get("user-agent")?.slice(0, 300) ?? null,
    ip: req.ip ?? null,
    expiresAt: refreshExpiry(),
  });
  return { session, refreshToken };
}

/** Build the auth response. Web clients get the refresh token as an httpOnly cookie only. */
function issue(res: Response, user: IUser, session: ISession, refreshToken: string): AuthResponse {
  const accessToken = signAccessToken({ sub: String(user._id), sid: String(session._id), role: user.role });
  const body: AuthResponse = {
    user: toUserDTO(user),
    accessToken,
    accessTokenExpiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  };
  if (session.clientType === "web") {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: REFRESH_COOKIE_PATH,
      expires: session.expiresAt,
    });
  } else {
    body.refreshToken = refreshToken;
  }
  return body;
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: isProduction, sameSite: "strict", path: REFRESH_COOKIE_PATH });
}

export async function register(
  req: Request,
  res: Response,
  input: { name: string; email: string; password: string; clientType: ClientType },
) {
  if (await User.exists({ email: input.email })) {
    throw HttpError.conflict("An account with this email already exists", "EMAIL_TAKEN");
  }
  // Public registration always creates a USER. Admins are created by seed or by another admin.
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role: "USER",
    status: "ACTIVE",
    lastLoginAt: new Date(),
  });
  await Promise.all([UserProfile.create({ userId: user._id }), UserPreference.create({ userId: user._id })]);
  const { session, refreshToken } = await createSession(user, input.clientType, req);
  return issue(res, user, session, refreshToken);
}

export async function login(
  req: Request,
  res: Response,
  input: { email: string; password: string; clientType: ClientType },
) {
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw HttpError.unauthorized("Incorrect email or password", "INVALID_CREDENTIALS");
  // Only reveal deactivation once the password is proven correct.
  if (user.status !== "ACTIVE") throw HttpError.forbidden("This account has been deactivated", "ACCOUNT_DEACTIVATED");

  user.lastLoginAt = new Date();
  await user.save();
  const { session, refreshToken } = await createSession(user, input.clientType, req);
  return issue(res, user, session, refreshToken);
}

export async function revokeAllSessions(userId: Types.ObjectId | string, reason: string) {
  await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
}

/**
 * Rotate a refresh token. Presenting an already-rotated token means it was copied —
 * the whole token family is revoked and the user must sign in again.
 */
export async function refresh(req: Request, res: Response, presented: string | undefined) {
  if (!presented) throw HttpError.unauthorized("Missing refresh token", "REFRESH_INVALID");
  const session = await Session.findOne({ refreshTokenHash: hashToken(presented) });
  if (!session) throw HttpError.unauthorized("Session expired, please sign in again", "REFRESH_INVALID");

  if (session.revokedAt) {
    if (session.revokedReason === "ROTATED") {
      await Session.updateMany(
        { familyId: session.familyId, revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: "REUSE_DETECTED" } },
      );
    }
    throw HttpError.unauthorized("Session expired, please sign in again", "REFRESH_INVALID");
  }
  if (session.expiresAt <= new Date()) throw HttpError.unauthorized("Session expired, please sign in again", "REFRESH_INVALID");

  const user = await User.findById(session.userId);
  if (!user || user.status !== "ACTIVE") {
    await revokeAllSessions(session.userId, "ACCOUNT_INACTIVE");
    throw HttpError.forbidden("This account has been deactivated", "ACCOUNT_DEACTIVATED");
  }

  const next = await createSession(user, session.clientType, req, session.familyId);
  // Atomic guard: only one concurrent refresh with the same token can win.
  const rotated = await Session.updateOne(
    { _id: session._id, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: "ROTATED", replacedBy: next.session._id, lastUsedAt: new Date() } },
  );
  if (rotated.modifiedCount !== 1) {
    await Session.deleteOne({ _id: next.session._id });
    throw HttpError.unauthorized("Session expired, please sign in again", "REFRESH_INVALID");
  }
  return issue(res, user, next.session, next.refreshToken);
}

export async function logout(res: Response, presented: string | undefined, sessionId?: string) {
  const filter = presented ? { refreshTokenHash: hashToken(presented) } : sessionId ? { _id: sessionId } : null;
  if (filter) {
    await Session.updateOne({ ...filter, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: "LOGOUT" } });
  }
  clearRefreshCookie(res);
}

/** Always succeeds from the caller's point of view, so it cannot be used to discover accounts. */
export async function forgotPassword(email: string) {
  const user = await User.findOne({ email, status: "ACTIVE" }).select({ _id: 1, email: 1 }).lean();
  if (!user) return;
  await PasswordReset.updateMany({ userId: user._id, usedAt: null }, { $set: { usedAt: new Date() } });
  const token = generateToken(32);
  await PasswordReset.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) });
  await sendPasswordResetEmail(user.email, token);
}

export async function resetPassword(token: string, password: string) {
  const reset = await PasswordReset.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  if (!reset) throw HttpError.badRequest("This reset link is invalid or has expired");
  await User.updateOne(
    { _id: reset.userId },
    { $set: { passwordHash: await hashPassword(password), passwordChangedAt: new Date() } },
  );
  await revokeAllSessions(reset.userId, "PASSWORD_RESET");
}

export async function changePassword(userId: string, sessionId: string, currentPassword: string, newPassword: string) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw HttpError.unauthorized();
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw HttpError.badRequest("Current password is incorrect", [{ path: "currentPassword", message: "Incorrect password" }]);
  }
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  // Sign out every other device; keep the current one.
  await Session.updateMany(
    { userId: user._id, revokedAt: null, _id: { $ne: sessionId } },
    { $set: { revokedAt: new Date(), revokedReason: "PASSWORD_CHANGED" } },
  );
}
