import { z } from "zod";
import { PASSWORD_RULES } from "../constants";
import { text } from "./common";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(254));

export const passwordSchema = z
  .string()
  .min(PASSWORD_RULES.MIN_LENGTH, `Password must be at least ${PASSWORD_RULES.MIN_LENGTH} characters`)
  .max(PASSWORD_RULES.MAX_LENGTH)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Password must contain letters and numbers");

export const CLIENT_TYPES = ["web", "mobile"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const registerSchema = z.object({
  name: text(100),
  email: emailSchema,
  password: passwordSchema,
  clientType: z.enum(CLIENT_TYPES).default("mobile"),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // Do not apply strength rules on login: just bound the size.
  password: z.string().min(1, "Required").max(PASSWORD_RULES.MAX_LENGTH),
  clientType: z.enum(CLIENT_TYPES).default("mobile"),
});
export type LoginInput = z.input<typeof loginSchema>;

/** Mobile sends the refresh token in the body; web sends it as an httpOnly cookie. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(512).optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(512),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_RULES.MAX_LENGTH),
  newPassword: passwordSchema,
});
