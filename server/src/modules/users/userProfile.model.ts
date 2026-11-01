import { Schema, model, type Types } from "mongoose";
import {
  ACTIVITY_LEVELS,
  EXPERIENCE_LEVELS,
  SEXES,
  type ActivityLevel,
  type ExperienceLevel,
  type Sex,
} from "@recomptrack/shared";

/**
 * Slow-changing personal attributes. Body values that change over time
 * (weight, waist, body-fat) live in `bodyMeasurements` so history is never overwritten.
 */
export interface IUserProfile {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  dateOfBirth: string | null; // YYYY-MM-DD calendar date (no time zone)
  heightCm: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
  trainingExperience: ExperienceLevel | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IUserProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dateOfBirth: { type: String, default: null },
    heightCm: { type: Number, default: null, min: 100, max: 250 },
    sex: { type: String, enum: [...SEXES, null], default: null },
    activityLevel: { type: String, enum: [...ACTIVITY_LEVELS, null], default: null },
    trainingExperience: { type: String, enum: [...EXPERIENCE_LEVELS, null], default: null },
  },
  { timestamps: true },
);
schema.index({ userId: 1 }, { unique: true });

export const UserProfile = model<IUserProfile>("UserProfile", schema, "userProfiles");
