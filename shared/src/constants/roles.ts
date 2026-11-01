/**
 * Roles and permissions.
 *
 * Phase 1 enables ADMIN and USER. TRAINER is declared so the data model and
 * permission checks already understand it, but registration and admin tooling
 * refuse to assign it until the trainer feature is built.
 *
 * Routes authorise by *permission*, never by comparing role strings directly,
 * so adding a role later means adding one entry to ROLE_PERMISSIONS.
 */
export const ROLES = {
  ADMIN: "ADMIN",
  USER: "USER",
  TRAINER: "TRAINER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES = Object.values(ROLES) as Role[];

/** Roles that can currently be assigned to an account. */
export const ENABLED_ROLES: readonly Role[] = [ROLES.ADMIN, ROLES.USER];

export const PERMISSIONS = {
  // Own data (always scoped to the authenticated user on the server)
  OWN_PROFILE_READ: "own:profile:read",
  OWN_PROFILE_WRITE: "own:profile:write",
  OWN_RECORDS_READ: "own:records:read",
  OWN_RECORDS_WRITE: "own:records:write",

  // Catalogue (read-only view of active master data)
  CATALOGUE_READ: "catalogue:read",

  // Admin
  ADMIN_DASHBOARD_READ: "admin:dashboard:read",
  USERS_MANAGE: "admin:users:manage",
  EXERCISES_MANAGE: "admin:exercises:manage",
  FOODS_MANAGE: "admin:foods:manage",
  LOOKUPS_MANAGE: "admin:lookups:manage",
  WORKOUT_PLANS_MANAGE: "admin:workout-plans:manage",
  MEAL_PLANS_MANAGE: "admin:meal-plans:manage",
  TARGETS_MANAGE: "admin:targets:manage",
  AUDIT_READ: "admin:audit:read",

  // Future trainer capability: read records of *assigned* users who consented.
  ASSIGNED_USERS_READ: "trainer:assigned-users:read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const USER_PERMISSIONS: Permission[] = [
  PERMISSIONS.OWN_PROFILE_READ,
  PERMISSIONS.OWN_PROFILE_WRITE,
  PERMISSIONS.OWN_RECORDS_READ,
  PERMISSIONS.OWN_RECORDS_WRITE,
  PERMISSIONS.CATALOGUE_READ,
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.USER]: USER_PERMISSIONS,
  [ROLES.TRAINER]: [...USER_PERMISSIONS, PERMISSIONS.ASSIGNED_USERS_READ],
  [ROLES.ADMIN]: [
    ...USER_PERMISSIONS,
    PERMISSIONS.ADMIN_DASHBOARD_READ,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.EXERCISES_MANAGE,
    PERMISSIONS.FOODS_MANAGE,
    PERMISSIONS.LOOKUPS_MANAGE,
    PERMISSIONS.WORKOUT_PLANS_MANAGE,
    PERMISSIONS.MEAL_PLANS_MANAGE,
    PERMISSIONS.TARGETS_MANAGE,
    PERMISSIONS.AUDIT_READ,
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
