import jwt from "jsonwebtoken";
import type { Role } from "@recomptrack/shared";
import { env } from "../../config/env";

const ISSUER = "recomptrack-api";
const AUDIENCE = "recomptrack-clients";

export interface AccessClaims {
  sub: string; // user id
  sid: string; // session id
  role: Role; // informational only — authenticate() re-reads the role from the database
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function verifyAccessToken(token: string): AccessClaims | null {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"], // pin the algorithm: never accept "none" or asymmetric confusion
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload !== "object" || typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    return { sub: payload.sub, sid: payload.sid, role: payload.role as Role };
  } catch {
    return null;
  }
}
