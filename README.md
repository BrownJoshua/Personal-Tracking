# RecompTrack

A multi-user fitness platform: a **mobile app** for members to track nutrition, workouts, measurements and progress, and an **admin web panel** to manage users, exercises, foods and (soon) plans. Both share one Node.js API and one MongoDB database.

```
apps/mobile   Expo / React Native user app (iOS first)
apps/admin    React + Vite admin panel
server        Node.js + Express + Mongoose API
shared        Types, enums, permissions, zod validation, calculations (used by all three)
docs          Architecture, database schema, API reference, business rules
```

**Status: Phases 1–4 built** (foundation, admin plans/meals/targets, member logging, analytics). See the [roadmap](#roadmap).

## Design

Both the admin panel and the mobile app use a **glassmorphism** theme: frosted translucent panels (CSS `backdrop-filter` on web, `expo-blur` on iOS) over a dark teal/indigo gradient, with light text for contrast.

## Connecting MongoDB Atlas

1. In Atlas: **Database → Connect → Drivers** and copy the `mongodb+srv://…` connection string.
2. **Network Access**: allow the IP of the machine running the API (your computer, or your host's outbound IPs).
3. **Database Access**: create a database user with *readWrite* on the `recomptrack` database (not an Atlas admin).
4. Put it in `server/.env` (never commit it):
   `MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/recomptrack?retryWrites=true&w=majority`
5. `npm run seed` then `npm run dev:server`. The API creates its indexes on start.

For CI you can point `MONGO_TEST_URI` at a *separate* Atlas test database; integration tests wipe the database they use.

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
npm run dev:mobile                        # press i for the iOS simulator, w for a web preview
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
| **1 Foundation** ✅ | Auth, roles, profile, exercise & food masters, admin dashboard, audit log |
| **2 Admin masters** ✅ | Workout plan builder (drag order, weekday or rotation schedule, versions, publish, duplicate, mobile preview), plan assignment, meal templates & assignment, target defaults, per-member target override |
| **3 Mobile logging** ✅ | Today's workout, plan view, active workout logger (sets, warm-ups, notes, discomfort, pause/resume, rest timer, add/remove exercises), summary with PRs, history; food diary with targets, food search/recent/custom foods/saved meals/meal plans, nutrition history, weekly measurements, weight trend |
| **4 Analytics** ✅ | Weight & waist charts with 7-day average and weekly rate, strength progression (e1RM, heaviest set, volume), weekly training volume, weekly report with recommendations, platform analytics, consent-gated member reports, in-app sharing controls |
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
