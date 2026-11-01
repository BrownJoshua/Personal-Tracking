import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimit";
import { apiRouter } from "./routes";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);
  app.set("query parser", "simple"); // no nested objects from query strings (e.g. ?status[$ne]=x)

  app.use(helmet());
  app.use(
    cors({
      // Browsers only. Native mobile requests have no Origin header and are not affected by CORS.
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-RecompTrack-Client"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== "test" }));
  app.use((req, _res, next) => {
    req.valid = {};
    next();
  });

  app.use("/api", apiLimiter, apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
