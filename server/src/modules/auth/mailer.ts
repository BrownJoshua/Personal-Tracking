import { isProduction } from "../../config/env";
import { logger } from "../../config/logger";

/**
 * Outbound email boundary. Phase 1 has no email provider, so in development the
 * reset link is written to the server log. Plug a provider in here for production.
 */
export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  if (isProduction) {
    logger.warn({ to }, "Password reset requested but no email provider is configured");
    return;
  }
  logger.info({ to, resetToken: token }, "DEV ONLY: password reset token (configure an email provider for production)");
}
