import { Schema, model, type Types } from "mongoose";
import { RECORD_STATUSES, type RecordStatus } from "@recomptrack/shared";

/** Shared shape for admin-managed lookup lists (muscle groups, equipment types). */
export interface ILookup {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string | null;
  status: RecordStatus;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

function lookupSchema() {
  const s = new Schema<ILookup>(
    {
      name: { type: String, required: true, trim: true, maxlength: 60 },
      slug: { type: String, required: true },
      description: { type: String, default: null, maxlength: 300 },
      status: { type: String, enum: RECORD_STATUSES, default: "ACTIVE" },
      createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true },
  );
  s.index({ slug: 1 }, { unique: true });
  return s;
}

export const MuscleGroup = model<ILookup>("MuscleGroup", lookupSchema(), "muscleGroups");
export const EquipmentType = model<ILookup>("EquipmentType", lookupSchema(), "equipmentTypes");

export const LOOKUP_TYPES = {
  "muscle-groups": { model: MuscleGroup, label: "Muscle group", entityType: "MUSCLE_GROUP" },
  equipment: { model: EquipmentType, label: "Equipment type", entityType: "EQUIPMENT_TYPE" },
} as const;
export type LookupType = keyof typeof LOOKUP_TYPES;
