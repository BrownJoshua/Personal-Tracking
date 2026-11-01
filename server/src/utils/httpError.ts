export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "HttpError";
  }

  static badRequest(message = "Bad request", details?: HttpError["details"]) {
    return new HttpError(400, "BAD_REQUEST", message, details);
  }
  static validation(details: NonNullable<HttpError["details"]>) {
    return new HttpError(400, "VALIDATION_ERROR", "Some fields are invalid", details);
  }
  static unauthorized(message = "Authentication required", code = "UNAUTHORIZED") {
    return new HttpError(401, code, message);
  }
  static forbidden(message = "You do not have permission to do that", code = "FORBIDDEN") {
    return new HttpError(403, code, message);
  }
  /** Also used when a record exists but belongs to someone else — never reveal that. */
  static notFound(what = "Resource") {
    return new HttpError(404, "NOT_FOUND", `${what} not found`);
  }
  static conflict(message: string, code = "CONFLICT") {
    return new HttpError(409, code, message);
  }
}
