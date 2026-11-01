import { rateLimit } from "express-rate-limit";
import { env } from "../config/env";

const skip = () => env.NODE_ENV === "test";
const message = { error: { code: "RATE_LIMITED", message: "Too many requests, please try again later" } };

/** Credential endpoints: login, register, password reset. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip,
  message,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip,
  message,
});
