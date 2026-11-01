import { Router } from "express";
import { z } from "zod";
import {
  PERMISSIONS,
  RECORD_STATUSES,
  createExerciseSchema,
  exerciseListQuerySchema,
  lookupSchema,
  objectIdSchema,
} from "@recomptrack/shared";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { diff } from "../../utils/diff";
import { HttpError } from "../../utils/httpError";
import { idOf } from "../../utils/serialize";
import { slugify } from "../../utils/text";
import { recordAudit } from "../audit/audit.service";
import { updateExerciseSchema } from "@recomptrack/shared";
import { Exercise } from "./exercise.model";
import { LOOKUP_TYPES, type LookupType } from "./lookup.models";
import * as svc from "./exercises.service";

const idParams = z.object({ id: objectIdSchema });

/** Mounted at /api/admin/exercises. */
export const adminExercisesRouter = Router();
adminExercisesRouter.use(authorize(PERMISSIONS.EXERCISES_MANAGE));

adminExercisesRouter.get("/", validate({ query: exerciseListQuerySchema }), async (req, res) => {
  res.json(await svc.listExercises(req.valid.query, { activeOnly: false }));
});

adminExercisesRouter.get("/:id", validate({ params: idParams }), async (req, res) => {
  const [exercise, usage] = await Promise.all([
    svc.getExercise(req.valid.params.id, { activeOnly: false }),
    svc.exerciseUsage(req.valid.params.id),
  ]);
  res.json({ ...exercise, usage });
});

adminExercisesRouter.post("/", validate({ body: createExerciseSchema }), async (req, res) => {
  res.status(201).json(await svc.createExercise(req, req.valid.body));
});

adminExercisesRouter.patch("/:id", validate({ params: idParams, body: updateExerciseSchema }), async (req, res) => {
  res.json(await svc.updateExercise(req, req.valid.params.id, req.valid.body));
});

adminExercisesRouter.post("/:id/archive", validate({ params: idParams }), async (req, res) => {
  res.json(await svc.setExerciseStatus(req, req.valid.params.id, "ARCHIVED"));
});

adminExercisesRouter.post("/:id/restore", validate({ params: idParams }), async (req, res) => {
  res.json(await svc.setExerciseStatus(req, req.valid.params.id, "ACTIVE"));
});

adminExercisesRouter.delete("/:id", validate({ params: idParams }), async (req, res) => {
  await svc.deleteExercise(req, req.valid.params.id);
  res.status(204).end();
});

// ---- Lookups: /api/admin/lookups/:type ---------------------------------
export const adminLookupsRouter = Router();
adminLookupsRouter.use(authorize(PERMISSIONS.LOOKUPS_MANAGE));

const typeParams = z.object({ type: z.enum(Object.keys(LOOKUP_TYPES) as [LookupType, ...LookupType[]]) });
const typeIdParams = typeParams.extend({ id: objectIdSchema });
const lookupPatchSchema = lookupSchema
  .partial()
  .extend({ status: z.enum(RECORD_STATUSES).optional() })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

adminLookupsRouter.get("/:type", validate({ params: typeParams }), async (req, res) => {
  const { model } = LOOKUP_TYPES[req.valid.params.type as LookupType];
  const items = await model.find().sort({ status: 1, name: 1 }).lean();
  res.json(items.map(svc.toLookupDTO));
});

adminLookupsRouter.post("/:type", validate({ params: typeParams, body: lookupSchema }), async (req, res) => {
  const { model, label, entityType } = LOOKUP_TYPES[req.valid.params.type as LookupType];
  const slug = slugify(req.valid.body.name);
  if (await model.exists({ slug })) throw HttpError.conflict(`${label} "${req.valid.body.name}" already exists`, "DUPLICATE");
  const doc = await model.create({ ...req.valid.body, slug, createdBy: req.auth!.userId });
  await recordAudit(req, {
    action: `${entityType}_CREATED`,
    entityType,
    entityId: idOf(doc._id),
    summary: `Created ${label.toLowerCase()} ${doc.name}`,
  });
  res.status(201).json(svc.toLookupDTO(doc.toObject()));
});

adminLookupsRouter.patch("/:type/:id", validate({ params: typeIdParams, body: lookupPatchSchema }), async (req, res) => {
  const { model, label, entityType } = LOOKUP_TYPES[req.valid.params.type as LookupType];
  const doc = await model.findById(req.valid.params.id);
  if (!doc) throw HttpError.notFound(label);
  const before = doc.toObject();
  if (req.valid.body.name) {
    const slug = slugify(req.valid.body.name);
    if (await model.exists({ slug, _id: { $ne: doc._id } })) throw HttpError.conflict(`${label} already exists`, "DUPLICATE");
    doc.slug = slug;
  }
  // A muscle group still used by an active exercise cannot be archived.
  if (req.valid.body.status === "ARCHIVED" && req.valid.params.type === "muscle-groups") {
    const used = await Exercise.exists({
      status: "ACTIVE",
      $or: [{ primaryMuscleId: doc._id }, { secondaryMuscleIds: doc._id }],
    });
    if (used) throw HttpError.conflict("Active exercises still use this muscle group", "LOOKUP_IN_USE");
  }
  if (req.valid.body.status === "ARCHIVED" && req.valid.params.type === "equipment") {
    if (await Exercise.exists({ status: "ACTIVE", equipmentId: doc._id })) {
      throw HttpError.conflict("Active exercises still use this equipment", "LOOKUP_IN_USE");
    }
  }
  doc.set(req.valid.body);
  await doc.save();
  await recordAudit(req, {
    action: `${entityType}_UPDATED`,
    entityType,
    entityId: idOf(doc._id),
    summary: `Updated ${label.toLowerCase()} ${doc.name}`,
    changes: diff(before as never, doc.toObject() as never),
  });
  res.json(svc.toLookupDTO(doc.toObject()));
});
