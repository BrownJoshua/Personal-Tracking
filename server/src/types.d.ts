import type { Permission, Role } from "@recomptrack/shared";

export interface AuthContext {
  userId: string;
  role: Role;
  sessionId: string;
  permissions: readonly Permission[];
}

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate`. The only trusted source of the caller's identity. */
      auth?: AuthContext;
      /** Parsed & validated input, set by `validate`. Express 5 makes req.query read-only. */
      valid: { body?: any; query?: any; params?: any };
    }
  }
}
