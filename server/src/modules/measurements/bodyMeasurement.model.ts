import { Schema, model, type Types } from "mongoose";
import { DATA_SOURCES, MEASUREMENT_FIELDS, type DataSource, type MeasurementField } from "@recomptrack/shared";

export interface IBodyMeasurement {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  recordedAt: Date;
  measurements: Partial<Record<MeasurementField, number | null>>;
  source: DataSource;
  /** Provider record id for imported values (Apple Health) — used for de-duplication. */
  externalId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const measurementsShape = Object.fromEntries(
  MEASUREMENT_FIELDS.map((f) => [f, { type: Number, default: null, min: 0 }]),
);

const schema = new Schema<IBodyMeasurement>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recordedAt: { type: Date, required: true },
    measurements: { type: new Schema(measurementsShape, { _id: false }), required: true },
    source: { type: String, enum: DATA_SOURCES, default: "MANUAL" },
    externalId: { type: String, default: null },
    notes: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true },
);
schema.index({ userId: 1, recordedAt: -1 });
schema.index(
  { userId: 1, source: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: "string" } } },
);
schema.index({ createdAt: -1 });

export const BodyMeasurement = model<IBodyMeasurement>("BodyMeasurement", schema, "bodyMeasurements");
