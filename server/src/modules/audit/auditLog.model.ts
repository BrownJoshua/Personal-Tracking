import { Schema, model, type Types } from "mongoose";

/** Append-only record of administrative actions (and admin access to user data). */
export interface IAuditLog {
  _id: Types.ObjectId;
  actorId: Types.ObjectId | null;
  action: string; // e.g. EXERCISE_CREATED, USER_DEACTIVATED, USER_VIEWED
  entityType: string; // e.g. EXERCISE, FOOD, USER
  entityId: Types.ObjectId | null;
  summary: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  ip: string | null;
  createdAt: Date;
}

const schema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, default: null },
    summary: { type: String, required: true },
    changes: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
schema.index({ createdAt: -1 });
schema.index({ entityType: 1, entityId: 1, createdAt: -1 });
schema.index({ actorId: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>("AuditLog", schema, "auditLogs");
