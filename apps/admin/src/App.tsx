import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./layouts/AdminLayout";
import { AuditLogPage } from "./pages/AuditLogPage";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExercisesPage } from "./pages/ExercisesPage";
import { FoodsPage } from "./pages/FoodsPage";
import { LoginPage } from "./pages/LoginPage";
import { LookupsPage } from "./pages/LookupsPage";
import { MealTemplatesPage } from "./pages/MealTemplatesPage";
import { PlanBuilderPage } from "./pages/PlanBuilderPage";
import { ReportsPage } from "./pages/ReportsPage";
import { TargetSettingsPage } from "./pages/TargetSettingsPage";
import { WorkoutPlansPage } from "./pages/WorkoutPlansPage";
import { UsersPage } from "./pages/UsersPage";
import { RequireAdmin } from "./routes/RequireAdmin";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="exercises" element={<ExercisesPage />} />
          <Route path="lookups" element={<LookupsPage />} />
          <Route path="foods" element={<FoodsPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="workouts" element={<WorkoutPlansPage />} />
          <Route path="workouts/:id" element={<PlanBuilderPage />} />
          <Route path="meal-plans" element={<MealTemplatesPage />} />
          <Route path="targets" element={<TargetSettingsPage />} />
          <Route
            path="activity"
            element={<ComingSoonPage title="Activity Management" phase="Phase 5" items={["Activity types", "Strava and Apple Health sync status", "Import logs and de-duplication"]} />}
          />
          <Route path="reports" element={<ReportsPage />} />
          <Route
            path="settings"
            element={<ComingSoonPage title="System Settings" phase="Phase 6" items={["Permissions", "Integration credentials", "Application configuration"]} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
