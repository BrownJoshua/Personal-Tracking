import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { connectDatabase, disconnectDatabase } from "./database/connection";

async function main() {
  await connectDatabase(env.MONGODB_URI);
  const server = createApp().listen(env.PORT, () => logger.info(`RecompTrack API listening on :${env.PORT}`));

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start");
  process.exit(1);
});
