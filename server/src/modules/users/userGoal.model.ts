import { Schema, model, type Types } from "mongoose";
import { GOAL_TYPES, type GoalType } from "@recomptrack/shared";

/** Goals are append-only: changing goal ends the current one and starts a new one. */
export interface IUserGoal {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  goalType: GoalType;
  targetWeightKg: number | null;
  targetBodyFatPercent: number | null;
  startDate: Date;
  endDate: Date | null;
  status: "ACTIVE" | "ENDED";
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IUserGoal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    goalType: { type: String, enum: GOAL_TYPES, required: true },
    targetWeightKg: { type: Number, default: null },
    targetBodyFatPercent: { type: Number, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    status: { type: String, enum: ["ACTIVE", "ENDED"], required: true, default: "ACTIVE" },
  },
  { timestamps: true },
);
schema.index({ userId: 1, startDate: -1 });
// At most one active goal per user.
schema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: "ACTIVE" }, name: "one_active_goal" });

export const UserGoal = model<IUserGoal>("UserGoal", schema, "userGoals");
