import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import type { ApiErrorBody } from "@recomptrack/shared";
import { logger } from "../config/logger";
import { HttpError } from "../utils/httpError";
import { zodDetails } from "./validate";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, "ROUTE_NOT_FOUND", `No route for ${req.method} ${req.path}`));
};

function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof ZodError) return HttpError.validation(zodDetails(err));
  if (err instanceof mongoose.Error.CastError) return HttpError.badRequest(`Invalid value for ${err.path}`);
  if (err instanceof mongoose.Error.ValidationError) {
    return HttpError.validation(Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })));
  }
  if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
    return HttpError.conflict("A record with the same unique value already exists", "DUPLICATE");
  }
  if (typeof err === "object" && err !== null && "type" in err && (err as { type: string }).type === "entity.parse.failed") {
    return HttpError.badRequest("Malformed JSON body");
  }
  if (typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 413) {
    return new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  return new HttpError(500, "INTERNAL_ERROR", "Something went wrong");
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const httpError = toHttpError(err);
  if (httpError.status >= 500) logger.error({ err, path: req.path }, "Unhandled error");
  const body: ApiErrorBody = {
    error: { code: httpError.code, message: httpError.message, ...(httpError.details ? { details: httpError.details } : {}) },
  };
  res.status(httpError.status).json(body);
};
