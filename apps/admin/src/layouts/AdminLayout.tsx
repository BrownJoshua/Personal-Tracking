import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NAV = [
  { to: "/", label: "Dashboard", hint: "Platform overview", end: true },
  { to: "/users", label: "User Management", hint: "Accounts and roles" },
  { to: "/exercises", label: "Exercise Management", hint: "Exercise master" },
  { to: "/lookups", label: "Muscles & Equipment", hint: "Categories" },
  { to: "/workouts", label: "Workout Management", hint: "Plans & assignments" },
  { to: "/foods", label: "Nutrition Management", hint: "Food master" },
  { to: "/meal-plans", label: "Meal Plans", hint: "Meal templates" },
  { to: "/targets", label: "Goals & Targets", hint: "Calculation defaults" },
  { to: "/activity", label: "Activity Management", hint: "Phase 5", soon: true },
  { to: "/reports", label: "Reports & Analytics", hint: "Platform activity" },
  { to: "/audit", label: "Audit Log", hint: "Admin changes" },
  { to: "/settings", label: "System Settings", hint: "Phase 6", soon: true },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={`shell ${menuOpen ? "menu-open" : ""}`}>
      <aside className="sidebar" onClick={() => setMenuOpen(false)}>
        <div className="brand">
          Recomp<span>Track</span>
          <small>Admin</small>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-item ${isActive ? "active" : ""} ${item.soon ? "soon" : ""}`}>
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setMenuOpen((o) => !o)}>
            ☰
          </button>
          <div className="topbar-spacer" />
          <span className="muted">{user?.email}</span>
          <button className="btn btn-sm" onClick={() => void logout()}>
            Sign out
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
