import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./layouts/AdminLayout";
import { AuditLogPage } from "./pages/AuditLogPage";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExercisesPage } from "./pages/ExercisesPage";
import { FoodsPage } from "./pages/FoodsPage";
import { LoginPage } from "./pages/LoginPage";
import { LookupsPage } from "./pages/LookupsPage";
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
          <Route
            path="workouts"
            element={<ComingSoonPage title="Workout Management" phase="Phase 2" items={["Plan builder with drag-to-reorder", "Versioned publishing", "Assign plans to users with a start date", "Mobile preview"]} />}
          />
          <Route
            path="meal-plans"
            element={<ComingSoonPage title="Meal Plans" phase="Phase 2" items={["Meal templates built from the food master", "Automatic calorie and macro totals", "Assign meal plans to users"]} />}
          />
          <Route
            path="targets"
            element={<ComingSoonPage title="Goals & Targets" phase="Phase 2" items={["Calorie equation (Mifflin-St Jeor)", "Activity multipliers", "Protein, fat and fibre defaults", "Per-user target overrides"]} />}
          />
          <Route
            path="activity"
            element={<ComingSoonPage title="Activity Management" phase="Phase 5" items={["Activity types", "Strava and Apple Health sync status", "Import logs and de-duplication"]} />}
          />
          <Route
            path="reports"
            element={<ComingSoonPage title="Reports & Analytics" phase="Phase 4" items={["Platform analytics", "User progress reports (with user consent)"]} />}
          />
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
