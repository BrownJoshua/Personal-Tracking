import { Schema, model, type Types } from "mongoose";
import { UNIT_SYSTEMS, type UnitSystem } from "@recomptrack/shared";

export interface IUserPreference {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  units: UnitSystem;
  timezone: string; // IANA zone; used to turn UTC timestamps into the user's local "day"
  notifications: { workoutReminders: boolean; weighInReminders: boolean; mealReminders: boolean };
  /** Consent for admins (and later trainers) to view personal records. Off by default. */
  sharing: { shareProgressWithAdmin: boolean; shareNutritionWithAdmin: boolean };
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IUserPreference>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    units: { type: String, enum: UNIT_SYSTEMS, default: "METRIC" },
    timezone: { type: String, default: "UTC" },
    notifications: {
      workoutReminders: { type: Boolean, default: true },
      weighInReminders: { type: Boolean, default: true },
      mealReminders: { type: Boolean, default: false },
    },
    sharing: {
      shareProgressWithAdmin: { type: Boolean, default: false },
      shareNutritionWithAdmin: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);
schema.index({ userId: 1 }, { unique: true });

export const UserPreference = model<IUserPreference>("UserPreference", schema, "userPreferences");
