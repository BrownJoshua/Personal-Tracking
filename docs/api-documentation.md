# API reference (Phase 1)

Base URL: `/api`. JSON in and out. Authenticated routes need `Authorization: Bearer <accessToken>`.

**Errors** — always `{ "error": { "code": "…", "message": "…", "details": [{ "path": "field", "message": "…" }] } }`.
Common codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` / `TOKEN_INVALID` / `INVALID_CREDENTIALS` / `REFRESH_INVALID` (401), `FORBIDDEN` / `ACCOUNT_DEACTIVATED` (403), `NOT_FOUND` (404), `EMAIL_TAKEN` / `DUPLICATE_CODE` / `DUPLICATE_FOOD` / `EXERCISE_IN_USE` / `FOOD_IN_USE` / `LAST_ADMIN` (409), `RATE_LIMITED` (429).

**Lists** — `?page=1&limit=20` (max 100) → `{ items, page, limit, total, totalPages }`.

## Health

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/health` | Public | `{ status, db }`; 503 when the database is down |

## Auth — `/auth`

| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/auth/register` | `{ name, email, password, clientType? }` | 201 `AuthResponse`. Always role `USER`. |
| POST | `/auth/login` | `{ email, password, clientType? }` | `AuthResponse` |
| POST | `/auth/refresh` | `{ refreshToken }` (mobile) or cookie + `X-RecompTrack-Client: web` | New `AuthResponse`; the old refresh token is revoked |
| POST | `/auth/logout` | `{ refreshToken }` or cookie | 204 |
| POST | `/auth/forgot-password` | `{ email }` | 202, same response whether or not the email exists |
| POST | `/auth/reset-password` | `{ token, password }` | 204; signs out all devices |
| POST | `/auth/change-password` 🔒 | `{ currentPassword, newPassword }` | 204; signs out other devices |

`clientType` is `"mobile"` (default: refresh token in body) or `"web"` (refresh token as `HttpOnly` cookie).
`AuthResponse = { user, accessToken, accessTokenExpiresIn, refreshToken? }`.
Auth endpoints are rate-limited (20 per 15 min per IP).

## Current user — `/users` 🔒 (no user id is ever accepted)

| Method | Path | Body |
|---|---|---|
| GET | `/users/me` | → `{ user, profile, goal, preferences, permissions }` |
| PATCH | `/users/me` | `{ name }` |
| PUT | `/users/me/profile` | `{ dateOfBirth?, heightCm?, sex?, activityLevel?, trainingExperience? }` |
| POST | `/users/me/assessment` | `{ profile, currentWeightKg?, waistCm?, bodyFatPercent?, goal? }` — onboarding; body values become the first measurement |
| PUT | `/users/me/goal` | `{ goalType, targetWeightKg?, targetBodyFatPercent? }` — ends the previous goal |
| PATCH | `/users/me/preferences` | `{ units?, timezone?, notifications?, sharing? }` — partial, nested-safe |

## Body measurements — `/measurements` 🔒 (own records only)

| Method | Path | Notes |
|---|---|---|
| POST | `/measurements` | `{ recordedAt?, measurements: { weightKg?, waistCm?, … }, notes? }` |
| GET | `/measurements` | `?from&to&page&limit`, newest first |
| GET | `/measurements/summary` | latest weight, 7-day average, latest waist |
| GET | `/measurements/:id` | 404 if not yours |
| DELETE | `/measurements/:id` | 404 if not yours |

## Catalogue (any signed-in user) 🔒

| Method | Path | Notes |
|---|---|---|
| GET | `/exercises` | Active only. `?q&muscleId&equipmentId&exerciseType&page&limit` |
| GET | `/exercises/:id` | Includes archived (so history and plans still resolve) |
| GET | `/lookups/muscle-groups` | Active |
| GET | `/lookups/equipment` | Active |
| GET | `/foods` | Active only. `?q` (name, brand or barcode) `&category&kind&page&limit` |
| GET | `/foods/:id` | |

## Admin — `/admin` 🔒 ADMIN

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/dashboard` | `?from&to` (ISO). Aggregate counts, latest registrations, latest admin changes |
| GET | `/admin/users` | `?q&role&status&page&limit` |
| GET | `/admin/users/:id` | Account basics + sharing flags only. **Audited.** |
| PATCH | `/admin/users/:id` | `{ status?, role? }` (`ADMIN`/`USER`). Revokes the user's sessions |
| GET | `/admin/exercises` | `?status=ACTIVE\|ARCHIVED\|ALL&q&muscleId&equipmentId&exerciseType` |
| GET | `/admin/exercises/:id` | Includes `usage { planDays, exerciseLogs, inUse }` |
| POST | `/admin/exercises` | `createExerciseSchema` |
| PATCH | `/admin/exercises/:id` | Partial; rep range re-checked against the stored document |
| POST | `/admin/exercises/:id/archive` · `/restore` | |
| DELETE | `/admin/exercises/:id` | 409 `EXERCISE_IN_USE` if referenced |
| GET/POST | `/admin/lookups/:type` | `type` = `muscle-groups` \| `equipment` |
| PATCH | `/admin/lookups/:type/:id` | `{ name?, description?, status? }`; can't archive while in use |
| GET | `/admin/foods` | Like `/foods` plus `status` filter |
| GET | `/admin/foods/:id` | Includes `usage { foodLogs, mealTemplates, inUse }` |
| POST | `/admin/foods` | `createFoodSchema` |
| PATCH | `/admin/foods/:id` | Partial; merged document re-validated |
| POST | `/admin/foods/:id/archive` · `/restore` | |
| DELETE | `/admin/foods/:id` | 409 `FOOD_IN_USE` if referenced |
| GET | `/admin/audit-logs` | `?entityType&entityId&actorId&page&limit` |

Request/response types: `shared/src/types/index.ts`. Validation schemas: `shared/src/validation/`.

---

# Phase 2 — Admin plans, meals and targets 🔒 ADMIN

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/workout-plans` | `?q&status&latestOnly=true\|false&page&limit` |
| GET | `/admin/workout-plans/:id` | Plan + days + exercises + all versions + active assignment count |
| POST | `/admin/workout-plans` | `savePlanSchema` → new **DRAFT v1** |
| PUT | `/admin/workout-plans/:id` | Replace a **draft** (409 `PLAN_NOT_EDITABLE` for published/archived) |
| POST | `/admin/workout-plans/:id/publish` | Draft → PUBLISHED; earlier published versions of the same plan → ARCHIVED |
| POST | `/admin/workout-plans/:id/revise` | Start the next version as a draft (one draft per plan) |
| POST | `/admin/workout-plans/:id/duplicate` | Copy as a new plan (v1 draft) |
| POST | `/admin/workout-plans/:id/archive` | No new assignments; current members keep it |
| DELETE | `/admin/workout-plans/:id` | Drafts only |
| GET | `/admin/assignments` | `?userId&workoutPlanId&status` |
| POST | `/admin/assignments` | `{ userId, workoutPlanId, startDate }` — published plans only; ends the member's previous assignment |
| POST | `/admin/assignments/:id/end` | |
| GET/POST | `/admin/meal-templates` | Totals are always computed from ingredients |
| GET/PUT/DELETE | `/admin/meal-templates/:id` | Delete only if never assigned or logged |
| POST | `/admin/meal-templates/:id/publish` · `/unpublish` · `/archive` · `/restore` | Archiving ends active assignments |
| POST | `/admin/meal-assignments` | `{ userId, mealTemplateId, startDate }` |
| POST | `/admin/meal-assignments/:id/end` | |
| GET/PUT | `/admin/target-settings` | Calculation defaults (`targetSettingsSchema`) |
| GET | `/admin/users/:id/plans` | Workout assignment + history, meal assignments, current target (breakdown only with the member's consent) |
| PUT | `/admin/users/:id/targets` | Individual (MANUAL) target |
| POST | `/admin/users/:id/targets/recalculate` | Drop the override, back to CALCULATED |

# Phase 3 — Member logging 🔒 own records only

### Workouts — `/workouts`

| Method | Path | Notes |
|---|---|---|
| GET | `/workouts/plan` | Current assignment + the exact plan version, or `null` |
| GET | `/workouts/today` | `{ day, reason: NO_PLAN \| NOT_STARTED \| SCHEDULED \| ROTATION \| REST_DAY \| DONE_TODAY, activeSessionId }` |
| GET | `/workouts/sessions` | Completed history `?page&limit&exerciseId` |
| GET | `/workouts/sessions/active` | The open session or `null` |
| POST | `/workouts/sessions` | `{ workoutPlanDayId? }` — the day must belong to *your* active plan; sets pre-filled with last used weight. 409 `SESSION_IN_PROGRESS` if one is open |
| GET | `/workouts/sessions/:id` | Session + exercise logs + previous performance |
| PATCH | `/workouts/sessions/:id` | `{ notes }` |
| POST | `/workouts/sessions/:id/pause` · `/resume` · `/complete` · `/discard` | Complete computes duration (excluding pauses), volume and personal records; completed sessions are read-only |
| POST | `/workouts/sessions/:id/exercises` | `{ exerciseId }` add an exercise |
| PUT | `/workouts/sessions/:id/exercises/:logId` | `{ sets[], notes, discomfort }` |
| DELETE | `/workouts/sessions/:id/exercises/:logId` | |

### Nutrition — `/nutrition`

| Method | Path | Notes |
|---|---|---|
| GET | `/nutrition/diary` | `?date=YYYY-MM-DD` (default: today in your time zone) → meals, totals, target |
| GET | `/nutrition/history` | `?from&to` (≤ 93 days) daily totals; unlogged days are reported as empty |
| GET | `/nutrition/recent-foods` | Quick re-add |
| POST | `/nutrition/logs` | `{ foodId \| customFoodId, quantity, mealType, localDate? }` → nutrition snapshot |
| PATCH/DELETE | `/nutrition/logs/:id` | Quantity changes recompute from the snapshot, not the current food |
| GET/POST | `/nutrition/custom-foods` · PUT/DELETE `/:id` | Private to you |
| GET/POST | `/nutrition/saved-meals` · DELETE `/:id` | |
| POST | `/nutrition/saved-meals/from-diary` | `{ name, localDate, mealType }` |
| POST | `/nutrition/saved-meals/:id/log` | `{ mealType, localDate?, portion? }` |
| GET | `/nutrition/meal-plans` | Your assigned meal templates |
| POST | `/nutrition/meal-plans/:assignmentId/log` | Logs each ingredient |
| GET | `/nutrition/targets` | `{ target, missing[], reviewDue }` |
| POST | `/nutrition/targets/recalculate` | |

# Phase 4 — Analytics

### Member reports — `/reports` 🔒 own records only

| Method | Path | Notes |
|---|---|---|
| GET | `/reports/body?days=90` | Daily weight (multiple weigh-ins averaged), trailing 7-calendar-day average, waist entries, least-squares weekly rate, goal |
| GET | `/reports/strength` | Every exercise with completed sets: sessions, first/latest/best estimated 1RM |
| GET | `/reports/strength/:exerciseId?days=180` | Per-session best e1RM (Epley), heaviest working set, volume, working sets |
| GET | `/reports/training?weeks=8` | Weekly workouts, working sets, volume, minutes (user's time zone) |
| GET | `/reports/weekly?week=YYYY-MM-DD` | Monday–Sunday report: nutrition averages over **logged days only**, training vs plan, PRs, discomfort count, weekly average weight vs previous week, waist change, and rule-based recommendations |

### Admin analytics 🔒 ADMIN

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/analytics?weeks=12` | Aggregate counts per UTC week: new members, active members (recorded anything), workouts, food entries, measurements; top exercises; plan adoption. No individual values. |
| GET | `/admin/users/:id/report?week=` | 403 `CONSENT_REQUIRED` unless the member shares something. Nutrition section needs `shareNutritionWithAdmin`; training, body and the 90-day weight trend need `shareProgressWithAdmin`. Audited as `USER_REPORT_VIEWED`. |
