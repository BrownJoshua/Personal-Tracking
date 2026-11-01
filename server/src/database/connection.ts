import mongoose from "mongoose";
import { logger } from "../config/logger";

// Reject unknown fields in queries. Operator injection is prevented upstream: every
// request body/query is parsed by a strict zod schema and the query parser is "simple".
mongoose.set("strictQuery", true);

export async function connectDatabase(uri: string) {
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  // Build indexes declared on the schemas (unique email, exercise code, etc.).
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  logger.info({ db: mongoose.connection.name }, "Connected to MongoDB");
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
