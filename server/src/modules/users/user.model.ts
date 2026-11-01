import { Schema, model, type Types } from "mongoose";
import { ALL_ROLES, USER_STATUSES, type Role, type UserStatus } from "@recomptrack/shared";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  onboardingCompleted: boolean;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    // select:false — the hash is never returned by a query unless explicitly requested.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ALL_ROLES, required: true, default: "USER" },
    status: { type: String, enum: USER_STATUSES, required: true, default: "ACTIVE" },
    onboardingCompleted: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdAt: -1 });

export const User = model<IUser>("User", userSchema, "users");
