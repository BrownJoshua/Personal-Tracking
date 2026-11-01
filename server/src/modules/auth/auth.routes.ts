import { Router, type Request } from "express";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from "@recomptrack/shared";
import { authenticate, requireAuth } from "../../middleware/authenticate";
import { authLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import { HttpError } from "../../utils/httpError";
import * as auth from "./auth.service";

export const authRouter = Router();

/**
 * Web clients send the refresh token as a SameSite=Strict cookie. They must also send
 * the X-RecompTrack-Client header, which a cross-site form cannot set (CSRF defence).
 */
function presentedRefreshToken(req: Request): string | undefined {
  const bodyToken = req.valid.body?.refreshToken as string | undefined;
  if (bodyToken) return bodyToken;
  const cookieToken = req.cookies?.[auth.REFRESH_COOKIE] as string | undefined;
  if (cookieToken) {
    if (req.get("x-recomptrack-client") !== "web") throw HttpError.forbidden("Missing client header");
    return cookieToken;
  }
  return undefined;
}

authRouter.post("/register", authLimiter, validate({ body: registerSchema }), async (req, res) => {
  res.status(201).json(await auth.register(req, res, req.valid.body));
});

authRouter.post("/login", authLimiter, validate({ body: loginSchema }), async (req, res) => {
  res.json(await auth.login(req, res, req.valid.body));
});

authRouter.post("/refresh", validate({ body: refreshSchema }), async (req, res) => {
  try {
    res.json(await auth.refresh(req, res, presentedRefreshToken(req)));
  } catch (err) {
    auth.clearRefreshCookie(res);
    throw err;
  }
});

authRouter.post("/logout", validate({ body: refreshSchema }), async (req, res) => {
  await auth.logout(res, presentedRefreshToken(req));
  res.status(204).end();
});

authRouter.post("/forgot-password", authLimiter, validate({ body: forgotPasswordSchema }), async (req, res) => {
  await auth.forgotPassword(req.valid.body.email);
  res.status(202).json({ message: "If that email is registered, a reset link has been sent." });
});

authRouter.post("/reset-password", authLimiter, validate({ body: resetPasswordSchema }), async (req, res) => {
  await auth.resetPassword(req.valid.body.token, req.valid.body.password);
  res.status(204).end();
});

authRouter.post("/change-password", authenticate, authLimiter, validate({ body: changePasswordSchema }), async (req, res) => {
  const { userId, sessionId } = requireAuth(req);
  await auth.changePassword(userId, sessionId, req.valid.body.currentPassword, req.valid.body.newPassword);
  res.status(204).end();
});
