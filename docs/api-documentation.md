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
