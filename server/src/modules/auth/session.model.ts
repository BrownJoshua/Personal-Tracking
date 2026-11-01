import { Schema, model, type Types } from "mongoose";

/**
 * One document per refresh token. Tokens rotate on every refresh; a rotated
 * token keeps `revokedAt` + `replacedBy` so re-use of a stolen token can be
 * detected and the whole family revoked.
 */
export interface ISession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  familyId: string;
  refreshTokenHash: string;
  clientType: "web" | "mobile";
  userAgent: string | null;
  ip: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  replacedBy: Types.ObjectId | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    familyId: { type: String, required: true },
    refreshTokenHash: { type: String, required: true },
    clientType: { type: String, enum: ["web", "mobile"], required: true },
    userAgent: { type: String, default: null, maxlength: 300 },
    ip: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
    replacedBy: { type: Schema.Types.ObjectId, default: null },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
schema.index({ refreshTokenHash: 1 }, { unique: true });
schema.index({ userId: 1, revokedAt: 1 });
schema.index({ familyId: 1 });
// MongoDB removes expired sessions automatically.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = model<ISession>("Session", schema, "sessions");
