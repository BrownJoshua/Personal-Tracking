import type { RequestHandler } from "express";
import type { Permission } from "@recomptrack/shared";
import { HttpError } from "../utils/httpError";

/** Require every listed permission. Must run after `authenticate`. */
export function authorize(...required: Permission[]): RequestHandler {
  return (req, _res, next) => {
    const auth = req.auth;
    if (!auth) throw HttpError.unauthorized();
    const missing = required.filter((p) => !auth.permissions.includes(p));
    if (missing.length > 0) throw HttpError.forbidden();
    next();
  };
}
