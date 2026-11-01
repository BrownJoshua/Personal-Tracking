# RecompTrack

A multi-user fitness platform: a **mobile app** for members to track nutrition, workouts, measurements and progress, and an **admin web panel** to manage users, exercises, foods and (soon) plans. Both share one Node.js API and one MongoDB database.

```
apps/mobile   Expo / React Native user app (iOS first)
apps/admin    React + Vite admin panel
server        Node.js + Express + Mongoose API
shared        Types, enums, permissions, zod validation, calculations (used by all three)
docs          Architecture, database schema, API reference, business rules
```

**Status: Phase 1 — Foundation.** See [what's included](#phase-1-scope) and the [roadmap](#roadmap).

## Quick start

Requirements: Node 20.19+ (22 recommended), MongoDB 7+ (local, Docker, or Atlas), and for the app: Xcode + iOS Simulator or the Expo Go app.

```bash
npm install

# 1. API
cp server/.env.example server/.env        # then set JWT_ACCESS_SECRET and SEED_ADMIN_PASSWORD
docker run -d --name recomptrack-mongo -p 27017:27017 mongo:7   # or point MONGODB_URI at Atlas
npm run seed                              # creates the admin + starter exercises/foods
npm run dev:server                        # http://localhost:4000/api/health

# 2. Admin panel
npm run dev:admin                         # http://localhost:5173  (sign in with the seeded admin)

# 3. Mobile app
cp apps/mobile/.env.example apps/mobile/.env   # set EXPO_PUBLIC_API_URL (LAN IP for a real phone)
npm run dev:mobile                        # press i for the iOS simulator
```

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

## Checks

```bash
npm run typecheck                          # all four packages
npm test                                   # shared + server unit and integration tests
npm run test:unit -w @recomptrack/server   # no database needed
MONGO_TEST_URI=mongodb://127.0.0.1:27017 npm run test:integration -w @recomptrack/server
```

Integration tests use `MONGO_TEST_URI` if set, otherwise they start a throwaway MongoDB with `mongodb-memory-server`. CI (`.github/workflows/ci.yml`) runs everything against a MongoDB service container.

## Phase 1 scope

Completion condition — *an admin creates an exercise and a food item, and an authenticated user retrieves them through the mobile app* — is covered end-to-end by `server/test/integration/catalogue.test.ts`.

**Backend**
- Registration, login, logout, refresh-token rotation with reuse detection, forgot/reset/change password
- Roles `ADMIN` / `USER` with permission-based authorisation (`TRAINER` modelled, not yet assignable)
- Profile, onboarding assessment, goals (with history), preferences and privacy sharing flags
- Exercise master + muscle groups + equipment: CRUD, archive/restore, delete-only-if-unused
- Food master: generic vs branded, raw/cooked/packaged basis, duplicate and barcode checks, archive/restore, delete-only-if-unused
- Body measurements (own records only) — the reference ownership pattern
- Admin dashboard stats, user management (activate/deactivate, role), audit log of every admin change
- Mongoose models for the Phase 2–3 collections (plans with versions, sessions, exercise logs, meal templates, food logs) so delete/archive rules already hold

**Admin panel** — sign-in (admins only), dashboard with date range, users, exercise master, food master, muscles & equipment, audit log; placeholders for later modules. Responsive.

**Mobile app** — sign in, register, forgot password, onboarding assessment, five-tab navigation: Dashboard (real data only), Workout (exercise library + details), Nutrition (food search + quantity calculator), Progress (weigh-in + history), Profile (profile, privacy, integrations status, sign out).

## Roadmap

| Phase | Contents |
|---|---|
| **1 Foundation** ✅ | This release |
| 2 Admin masters | Workout plan builder (drag order, versions, publish, assign), meal templates & assignment, target rules |
| 3 Mobile logging | Assigned plan & today's workout, active workout logger + rest timer, food diary, saved meals, custom foods, weekly measurements |
| 4 Analytics | Calorie/macro engine, strength progression, weight & waist charts, weekly report |
| 5 Integrations | Apple HealthKit (dev build), Strava OAuth + webhooks, food import adapter, de-duplication |
| 6 Production | Security review, backups, monitoring, email provider, App Store |

## Docs

- [Architecture](docs/architecture.md) — components, auth flow, permissions, ownership pattern
- [Database schema](docs/database-schema.md) — every collection, indexes, delete rules
- [API reference](docs/api-documentation.md)
- [Business rules](docs/business-rules.md)

## Security notes

- No personal-data endpoint accepts a user id; the server takes it from the token and every query includes it.
- Strict input schemas reject unknown fields (no mass assignment of `role`, `status`, `userId`).
- Refresh tokens are stored hashed; web uses an `HttpOnly; SameSite=Strict` cookie; mobile uses the iOS Keychain.
- Password reset currently logs the token in **development only** — configure an email provider in `server/src/modules/auth/mailer.ts` before production.
