import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** High-entropy opaque token for refresh / password-reset links. */
export function generateToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

/** Tokens are stored only as SHA-256 hashes so a database leak does not leak sessions. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
