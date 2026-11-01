# Architecture

RecompTrack is a monorepo with one backend and two clients that share one MongoDB database.

```
┌────────────────────┐   ┌────────────────────┐
│ Mobile app         │   │ Admin web panel    │
│ Expo / React Native│   │ React + Vite       │
│ apps/mobile        │   │ apps/admin         │
└─────────┬──────────┘   └─────────┬──────────┘
          │ Bearer access token     │ Bearer access token
          │ refresh token in body   │ refresh token in httpOnly cookie
          ▼                         ▼
┌──────────────────────────────────────────────┐
│ Backend API — Node.js + Express (server/)    │
│ auth · permissions · validation · audit      │
│ modules: auth, users, exercises, nutrition,  │
│ measurements, workouts*, admin               │
└─────────────────────┬────────────────────────┘
                      ▼
              ┌──────────────┐        ┌──────────────────────────┐
              │ MongoDB      │        │ Integrations (Phase 5)   │
              │ (Mongoose)   │        │ Apple Health · Strava ·  │
              └──────────────┘        │ food import adapters     │
                                      └──────────────────────────┘
```
`*` schema defined, API in Phase 2/3.

## Packages

| Package | Purpose |
|---|---|
| `shared/` (`@recomptrack/shared`) | Roles & permissions, enums, **zod validation schemas**, API DTO types, pure calculations (nutrition scaling, unit conversion). Used by all three apps, so the client and server validate input with the *same* rules. Ships TypeScript source; the server bundles it with tsup, Vite and Metro compile it directly. |
| `server/` | Express 5 API. One folder per module under `src/modules/`, each with its models, service and routes. |
| `apps/admin/` | Admin panel: sidebar layout, tables with search/filter/pagination, create/edit modals, confirmation dialogs. Works on desktop and mobile browsers. |
| `apps/mobile/` | User app (iOS first). Expo Router with five tabs: Dashboard, Workout, Nutrition, Progress, Profile. |

## Authentication

* **Passwords**: bcrypt (cost 12 by default), never returned by queries (`select: false`).
* **Access token**: 15-minute HS256 JWT (`sub` = user id, `sid` = session id). Algorithm, issuer and audience are pinned on verify.
* **Refresh token**: 48 random bytes, stored only as a SHA-256 hash in `sessions`. Rotated on every refresh. Presenting an already-rotated token revokes the whole token family (theft detection).
  * Mobile: returned in the response body, stored in the iOS Keychain via `expo-secure-store`.
  * Web: `HttpOnly; SameSite=Strict; Path=/api/auth` cookie, never visible to JavaScript. Cookie refreshes also require the `X-RecompTrack-Client: web` header, which cross-site forms cannot send.
* `authenticate` re-reads the user on every request, so **deactivation and role changes apply immediately**, not when the token expires. Deactivation and role changes also revoke all sessions.
* Password change signs out other devices; password reset signs out all devices.

## Authorisation

Routes authorise by **permission**, never by comparing role strings (`shared/src/constants/roles.ts`):

```ts
admin.use(authenticate, authorize(PERMISSIONS.ADMIN_DASHBOARD_READ));
adminFoodsRouter.use(authorize(PERMISSIONS.FOODS_MANAGE));
```

Adding the future `TRAINER` role means granting it permissions in `ROLE_PERMISSIONS` (it already exists there with `ASSIGNED_USERS_READ`) and building the assignment check — no route rewrites. `TRAINER` cannot be assigned until that feature exists.

### Ownership (user isolation)

Personal-data routes never accept a user id. The user id comes only from `req.auth.userId`, and every query includes it:

```ts
const doc = await BodyMeasurement.findOne({ _id: req.valid.params.id, userId });
if (!doc) throw HttpError.notFound("Measurement"); // same answer for "missing" and "not yours"
```

`server/src/modules/measurements/measurements.routes.ts` is the reference implementation for every future personal-data module (food logs, workout sessions, activities, photos).

## Request pipeline

`helmet → CORS allow-list → JSON (100 kb limit) → cookies → request logging (secrets redacted) → rate limit → router → 404 → error handler`

* Every body, query and params object is parsed by a **strict** zod schema in `validate()`. Unknown fields are rejected, which blocks mass-assignment (`role`, `status`, `userId`…). Handlers read only `req.valid`.
* Query strings use Express's *simple* parser, so `?status[$ne]=x` cannot become a MongoDB operator.
* Search terms are regex-escaped.
* Errors always have the shape `{ error: { code, message, details? } }`. Internal errors never leak stack traces.

## Time

Timestamps are stored in UTC. Calendar facts that are not instants (date of birth, a food log's "day") are stored as `YYYY-MM-DD` strings. The user's IANA time zone lives in `userPreferences.timezone` and decides which local day a log belongs to.

## Future-proofing (not built yet, but the design allows it)

* **Trainers**: role + permission exist; add a `trainerAssignments` collection and an ownership check of the form "is this user assigned to me and has the user consented".
* **Subscriptions**: add `subscriptions` and a `requireEntitlement()` middleware next to `authorize()`.
* **Public registration controls**: registration lives in one route; add invite codes or email verification there.
