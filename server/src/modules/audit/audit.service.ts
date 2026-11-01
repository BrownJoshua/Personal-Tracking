import type { Request } from "express";
import type { AuditLogDTO } from "@recomptrack/shared";
import { logger } from "../../config/logger";
import { idOf, toObjectId } from "../../utils/serialize";
import { AuditLog, type IAuditLog } from "./auditLog.model";

interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  changes?: Record<string, { from: unknown; to: unknown }> | null;
}

/**
 * Record an administrative action. Called after the change succeeds.
 * Failure to write the audit log is logged loudly but does not undo the change.
 */
export async function recordAudit(req: Request, entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create({
      actorId: req.auth ? toObjectId(req.auth.userId) : null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ? toObjectId(entry.entityId) : null,
      summary: entry.summary,
      changes: entry.changes && Object.keys(entry.changes).length > 0 ? entry.changes : null,
      ip: req.ip ?? null,
    });
  } catch (err) {
    logger.error({ err, entry }, "Failed to write audit log");
  }
}

type PopulatedActor = { _id: unknown; name: string; email: string } | null;

export function toAuditDTO(log: Omit<IAuditLog, "actorId"> & { actorId: PopulatedActor | unknown }): AuditLogDTO {
  const actor = log.actorId as PopulatedActor;
  return {
    id: idOf(log._id),
    actor: actor && typeof actor === "object" && "email" in actor ? { id: idOf(actor._id), name: actor.name, email: actor.email } : null,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId ? idOf(log.entityId) : null,
    summary: log.summary,
    changes: log.changes,
    createdAt: log.createdAt.toISOString(),
  };
}
