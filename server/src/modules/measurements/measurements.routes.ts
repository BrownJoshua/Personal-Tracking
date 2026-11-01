import { Router } from "express";
import { z } from "zod";
import {
  PERMISSIONS,
  createMeasurementSchema,
  measurementListQuerySchema,
  objectIdSchema,
  type BodyMeasurementDTO,
} from "@recomptrack/shared";
import { requireAuth } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { HttpError } from "../../utils/httpError";
import { paginate, paginated } from "../../utils/pagination";
import { idOf } from "../../utils/serialize";
import { BodyMeasurement, type IBodyMeasurement } from "./bodyMeasurement.model";

/**
 * Body measurements — the reference pattern for every personal-data module:
 *   - userId always comes from req.auth, never from the request
 *   - every query includes { userId }, so another user's id simply returns 404
 * Mounted at /api/measurements.
 */
export const measurementsRouter = Router();

const idParams = z.object({ id: objectIdSchema });

function toDTO(m: IBodyMeasurement): BodyMeasurementDTO {
  const measurements = Object.fromEntries(
    Object.entries(m.measurements ?? {}).filter(([, v]) => v !== null && v !== undefined),
  );
  return { id: idOf(m._id), recordedAt: m.recordedAt.toISOString(), measurements, source: m.source, notes: m.notes };
}

measurementsRouter.post(
  "/",
  authorize(PERMISSIONS.OWN_RECORDS_WRITE),
  validate({ body: createMeasurementSchema }),
  async (req, res) => {
    const { userId } = requireAuth(req);
    const body = req.valid.body;
    const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date();
    if (recordedAt.getTime() > Date.now() + 5 * 60 * 1000) {
      throw HttpError.validation([{ path: "recordedAt", message: "Cannot record a measurement in the future" }]);
    }
    const doc = await BodyMeasurement.create({
      userId,
      recordedAt,
      measurements: body.measurements,
      source: "MANUAL",
      notes: body.notes ?? null,
    });
    res.status(201).json(toDTO(doc.toObject()));
  },
);

measurementsRouter.get(
  "/",
  authorize(PERMISSIONS.OWN_RECORDS_READ),
  validate({ query: measurementListQuerySchema }),
  async (req, res) => {
    const { userId } = requireAuth(req);
    const { page, limit, from, to } = req.valid.query;
    const filter: Record<string, unknown> = { userId };
    if (from || to) filter.recordedAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    const { skip } = paginate(page, limit);
    const [items, total] = await Promise.all([
      BodyMeasurement.find(filter).sort({ recordedAt: -1 }).skip(skip).limit(limit).lean(),
      BodyMeasurement.countDocuments(filter),
    ]);
    res.json(paginated(items.map(toDTO), total, page, limit));
  },
);

/** Latest value of each measurement field plus a 7-day weight average, for the dashboard. */
measurementsRouter.get("/summary", authorize(PERMISSIONS.OWN_RECORDS_READ), async (req, res) => {
  const { userId } = requireAuth(req);
  const [latestWeight, latestWaist, weekWeights] = await Promise.all([
    BodyMeasurement.findOne({ userId, "measurements.weightKg": { $ne: null } }).sort({ recordedAt: -1 }).lean(),
    BodyMeasurement.findOne({ userId, "measurements.waistCm": { $ne: null } }).sort({ recordedAt: -1 }).lean(),
    BodyMeasurement.find({
      userId,
      "measurements.weightKg": { $ne: null },
      recordedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
      .select({ "measurements.weightKg": 1 })
      .lean(),
  ]);
  const weights = weekWeights.map((w) => w.measurements.weightKg!).filter((w) => typeof w === "number");
  res.json({
    latestWeight: latestWeight
      ? { valueKg: latestWeight.measurements.weightKg, recordedAt: latestWeight.recordedAt.toISOString() }
      : null,
    weightSevenDayAverageKg: weights.length
      ? Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10
      : null,
    weightEntriesLastSevenDays: weights.length,
    latestWaist: latestWaist
      ? { valueCm: latestWaist.measurements.waistCm, recordedAt: latestWaist.recordedAt.toISOString() }
      : null,
  });
});

measurementsRouter.get("/:id", authorize(PERMISSIONS.OWN_RECORDS_READ), validate({ params: idParams }), async (req, res) => {
  const { userId } = requireAuth(req);
  const doc = await BodyMeasurement.findOne({ _id: req.valid.params.id, userId }).lean();
  if (!doc) throw HttpError.notFound("Measurement"); // same answer whether it doesn't exist or isn't yours
  res.json(toDTO(doc));
});

measurementsRouter.delete(
  "/:id",
  authorize(PERMISSIONS.OWN_RECORDS_WRITE),
  validate({ params: idParams }),
  async (req, res) => {
    const { userId } = requireAuth(req);
    const result = await BodyMeasurement.deleteOne({ _id: req.valid.params.id, userId });
    if (result.deletedCount === 0) throw HttpError.notFound("Measurement");
    res.status(204).end();
  },
);
