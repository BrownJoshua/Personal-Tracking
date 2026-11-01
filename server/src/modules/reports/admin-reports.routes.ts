import { Router } from "express";
import { z } from "zod";
import { PERMISSIONS, addDays, isoDateSchema, objectIdSchema, weekStart, type AdminAnalyticsDTO, type AdminUserReportDTO } from "@recomptrack/shared";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { HttpError } from "../../utils/httpError";
import { idOf } from "../../utils/serialize";
import { recordAudit } from "../audit/audit.service";
import { BodyMeasurement } from "../measurements/bodyMeasurement.model";
import { FoodLog } from "../nutrition/nutrition.models";
import { User } from "../users/user.model";
import { UserPreference } from "../users/userPreference.model";
import { ExerciseLog, UserWorkoutAssignment, WorkoutPlan, WorkoutSession } from "../workouts/workout.models";
import { bodyTrend, weeklyReport } from "./reports.service";

export const adminReportsRouter = Router();

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Platform analytics: aggregate counts only, bucketed by UTC week.
 * No individual member's values are exposed here.
 */
adminReportsRouter.get(
  "/analytics",
  authorize(PERMISSIONS.ADMIN_DASHBOARD_READ),
  validate({ query: z.object({ weeks: z.coerce.number().int().min(2).max(52).default(12) }) }),
  async (req, res) => {
    const weeks = req.valid.query.weeks as number;
    const thisWeek = weekStart(utcDay(new Date()));
    const first = addDays(thisWeek, -7 * (weeks - 1));
    const since = new Date(`${first}T00:00:00Z`);
    const weekExpr = (field: string) => ({ $dateToString: { format: "%Y-%m-%d", date: { $dateTrunc: { date: `$${field}`, unit: "week", startOfWeek: "monday" } } } });

    const [newUsers, sessions, foodLogs, measurements, activeSets, topExercises, plans, members, membersWithPlan] = await Promise.all([
      User.aggregate<{ _id: string; n: number }>([{ $match: { role: "USER", createdAt: { $gte: since } } }, { $group: { _id: weekExpr("createdAt"), n: { $sum: 1 } } }]),
      WorkoutSession.aggregate<{ _id: string; n: number }>([{ $match: { status: "COMPLETED", completedAt: { $gte: since } } }, { $group: { _id: weekExpr("completedAt"), n: { $sum: 1 } } }]),
      FoodLog.aggregate<{ _id: string; n: number }>([{ $match: { loggedAt: { $gte: since } } }, { $group: { _id: weekExpr("loggedAt"), n: { $sum: 1 } } }]),
      BodyMeasurement.aggregate<{ _id: string; n: number }>([{ $match: { recordedAt: { $gte: since } } }, { $group: { _id: weekExpr("recordedAt"), n: { $sum: 1 } } }]),
      // Active = recorded anything that week (workout, food or measurement) — distinct members.
      Promise.all([
        WorkoutSession.aggregate<{ _id: { w: string; u: unknown } }>([{ $match: { status: "COMPLETED", completedAt: { $gte: since } } }, { $group: { _id: { w: weekExpr("completedAt"), u: "$userId" } } }]),
        FoodLog.aggregate<{ _id: { w: string; u: unknown } }>([{ $match: { loggedAt: { $gte: since } } }, { $group: { _id: { w: weekExpr("loggedAt"), u: "$userId" } } }]),
        BodyMeasurement.aggregate<{ _id: { w: string; u: unknown } }>([{ $match: { recordedAt: { $gte: since } } }, { $group: { _id: { w: weekExpr("recordedAt"), u: "$userId" } } }]),
      ]),
      ExerciseLog.aggregate<{ _id: unknown; name: string; sessions: number; users: unknown[] }>([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$exerciseId", name: { $last: "$exerciseNameSnapshot" }, sessions: { $sum: 1 }, users: { $addToSet: "$userId" } } },
        { $sort: { sessions: -1 } },
        { $limit: 8 },
      ]),
      UserWorkoutAssignment.aggregate<{ _id: unknown; n: number }>([{ $match: { status: "ACTIVE" } }, { $group: { _id: "$workoutPlanId", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 }]),
      User.countDocuments({ role: "USER", status: "ACTIVE" }),
      UserWorkoutAssignment.distinct("userId", { status: "ACTIVE" }),
    ]);

    const toMap = (rows: { _id: string; n: number }[]) => new Map(rows.map((r) => [r._id, r.n]));
    const [nu, se, fl, me] = [toMap(newUsers), toMap(sessions), toMap(foodLogs), toMap(measurements)];
    const active = new Map<string, Set<string>>();
    for (const rows of activeSets) for (const r of rows) active.set(r._id.w, (active.get(r._id.w) ?? new Set()).add(idOf(r._id.u)));
    const planNames = new Map(
      (await WorkoutPlan.find({ _id: { $in: plans.map((p) => idOf(p._id)) } }).select({ name: 1, version: 1 }).lean()).map((p) => [idOf(p._id), `${p.name} v${p.version}`]),
    );
    const weekKeys = Array.from({ length: weeks }, (_, i) => addDays(first, 7 * i));
    const current = weekKeys[weekKeys.length - 1]!;
    const [foodThisWeek, trainThisWeek] = [activeSets[1], activeSets[0]].map((rows) => new Set(rows.filter((r) => r._id.w === current).map((r) => idOf(r._id.u))).size);

    const body: AdminAnalyticsDTO = {
      weeks: weekKeys.map((w) => ({
        weekStart: w,
        newUsers: nu.get(w) ?? 0,
        activeUsers: active.get(w)?.size ?? 0,
        workoutsCompleted: se.get(w) ?? 0,
        foodLogEntries: fl.get(w) ?? 0,
        measurementEntries: me.get(w) ?? 0,
      })),
      topExercises: topExercises.map((t) => ({ exerciseId: idOf(t._id), exerciseName: t.name, sessions: t.sessions, users: t.users.length })),
      planAdoption: plans.map((p) => ({ planName: planNames.get(idOf(p._id)) ?? "Deleted plan", activeAssignments: p.n })),
      totals: { members, membersWithPlan: membersWithPlan.length, membersLoggingFoodThisWeek: foodThisWeek!, membersTrainingThisWeek: trainThisWeek! },
    };
    res.json(body);
  },
);

/**
 * One member's weekly report — only the sections the member chose to share.
 * Progress consent covers training and body data; nutrition consent covers food logs.
 * Every view is written to the audit log.
 */
adminReportsRouter.get(
  "/users/:id/report",
  authorize(PERMISSIONS.USERS_MANAGE),
  validate({ params: z.object({ id: objectIdSchema }), query: z.object({ week: isoDateSchema.optional() }) }),
  async (req, res) => {
    const { id } = req.valid.params;
    const [user, prefs] = await Promise.all([User.findById(id).lean(), UserPreference.findOne({ userId: id }).select({ sharing: 1 }).lean()]);
    if (!user) throw HttpError.notFound("User");
    const consent = { progress: !!prefs?.sharing?.shareProgressWithAdmin, nutrition: !!prefs?.sharing?.shareNutritionWithAdmin };
    if (!consent.progress && !consent.nutrition) {
      throw HttpError.forbidden("This member hasn't shared their progress or nutrition with admins", "CONSENT_REQUIRED");
    }
    const r = await weeklyReport(id, req.valid.query.week);
    await recordAudit(req, {
      action: "USER_REPORT_VIEWED",
      entityType: "USER",
      entityId: id,
      summary: `Viewed shared report of ${user.email} (week of ${r.weekStart}; ${[consent.progress && "progress", consent.nutrition && "nutrition"].filter(Boolean).join(" + ")})`,
    });
    const body: AdminUserReportDTO = {
      user: { id, name: user.name, email: user.email },
      consent,
      report: {
        weekStart: r.weekStart,
        weekEnd: r.weekEnd,
        nutrition: consent.nutrition ? r.nutrition : null,
        training: consent.progress ? r.training : null,
        body: consent.progress ? r.body : null,
      },
      bodyTrend: consent.progress ? await bodyTrend(id, 90) : null,
    };
    res.json(body);
  },
);
