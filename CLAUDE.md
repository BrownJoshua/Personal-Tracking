# RecompTrack — notes for coding assistants

- Monorepo (npm workspaces): `shared`, `server`, `apps/admin`, `apps/mobile`. Read `docs/architecture.md` first.
- Put enums, permissions, validation schemas and DTO types in `shared/` and import them everywhere; don't duplicate them.
- Personal-data routes: take the user id from `req.auth.userId` only and include it in every query. Follow `server/src/modules/measurements/measurements.routes.ts`.
- Validate every request with a strict zod schema via `validate()` and read `req.valid.*`, never `req.body`/`req.query`.
- Admin changes call `recordAudit()`. Referenced master data is archived, never deleted.
- Mobile: Expo SDK 58 + Expo Router, routes in `apps/mobile/src/app/` (see `apps/mobile/AGENTS.md`). Use `npx expo install` for native packages.
- Before finishing: `npm run typecheck` and `npm test`.
