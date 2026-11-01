import { Router } from "express";
import mongoose from "mongoose";
import { PERMISSIONS } from "@recomptrack/shared";
import { authenticate } from "./middleware/authenticate";
import { authorize } from "./middleware/authorize";
import { adminRouter } from "./modules/admin/admin.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { adminExercisesRouter, adminLookupsRouter } from "./modules/exercises/admin-exercises.routes";
import { exercisesRouter, lookupsRouter } from "./modules/exercises/exercises.routes";
import { measurementsRouter } from "./modules/measurements/measurements.routes";
import { adminFoodsRouter, foodsRouter } from "./modules/nutrition/foods.routes";
import { adminUsersRouter } from "./modules/users/admin-users.routes";
import { usersRouter } from "./modules/users/users.routes";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  const db = mongoose.connection.readyState === 1 ? "up" : "down";
  res.status(db === "up" ? 200 : 503).json({ status: db === "up" ? "ok" : "degraded", db });
});

// ---- Public ----
apiRouter.use("/auth", authRouter);

// ---- Authenticated (any role) ----
apiRouter.use("/users", authenticate, usersRouter);
apiRouter.use("/exercises", authenticate, exercisesRouter);
apiRouter.use("/lookups", authenticate, lookupsRouter);
apiRouter.use("/foods", authenticate, foodsRouter);
apiRouter.use("/measurements", authenticate, measurementsRouter);

// ---- Admin ----
// Every /admin route needs authentication plus at least the dashboard permission;
// each sub-router then checks its own specific permission.
const admin = Router();
admin.use(authenticate, authorize(PERMISSIONS.ADMIN_DASHBOARD_READ));
admin.use("/users", adminUsersRouter);
admin.use("/exercises", adminExercisesRouter);
admin.use("/lookups", adminLookupsRouter);
admin.use("/foods", adminFoodsRouter);
admin.use("/", adminRouter);
apiRouter.use("/admin", admin);
