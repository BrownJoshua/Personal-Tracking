# Business rules

| Rule | Expected behaviour | Where enforced (Phase 1) |
|---|---|---|
| User isolation | Users access only their own records. Another user's id returns **404**, not 403. | Every personal query includes `userId` from the token — `measurements.routes.ts`, `users.service.ts` |
| No client-supplied identity | `userId`, `role`, `status` in a request body are rejected. | Strict zod schemas (`shared/src/validation`) |
| Admin master control | Only admins change exercises, foods, lookups and accounts. | `authorize(PERMISSIONS.…)` on `/api/admin/*` |
| Public registration | Always creates a `USER`. Admins come from the seed script or another admin. | `auth.service.ts#register` |
| Last admin | The last active admin cannot be demoted or deactivated; admins cannot change their own role/status. | `admin-users.routes.ts` |
| Deactivation | Takes effect immediately and signs the user out everywhere. | `authenticate`, `revokeAllSessions` |
| Exercise deletion | Archive if referenced by a plan or a logged set; delete only if unused. | `exercises.service.ts#deleteExercise` |
| Exercise edits | Changing defaults affects only plans built afterwards. Plans copy sets/reps; logs keep `exerciseNameSnapshot`. | Data model |
| Food history | Food logs keep a nutrition snapshot; correcting a food never changes past intake. | `foodLogs.nutritionSnapshot` |
| Food duplicates | Same name + brand + preparation cannot exist twice; barcodes are unique. | `foods.dedupeKey`, partial unique index |
| Food basis | Every food states its preparation (raw / cooked / as packaged) and basis (per 100 g or ml). Macros cannot weigh more than the basis. | `createFoodSchema` |
| Branded vs generic | Branded foods require a brand; generic foods must not have one. | `createFoodSchema`, re-checked on partial update |
| Body measurements | Every entry is a new record; profile updates never overwrite history. Future-dated entries are rejected. | `measurements.routes.ts`, `submitAssessment` |
| Goals | Changing goal ends the current one and starts a new one (one active goal per user). | `users.service.ts#setGoal`, partial unique index |
| Plan updates | Published versions are read-only. Editing creates the next version as a draft; publishing it archives the previous version for *new* assignments only. Members keep their assigned version until reassigned. | `plans.service.ts` |
| Plan assignment | Only published plans can be assigned; a new assignment ends the previous one and keeps it as history. | `assignPlan` |
| Workout logging | One open workout per user. Plan days can only be started by the user they are assigned to. Completed workouts are read-only; PRs compare against the user's own earlier logs (the first time is a baseline, not a record). | `sessions.service.ts` |
| Diary quantity edits | Recomputed from the nutrition captured when the food was logged, so later food corrections never leak into history. | `diary.service.ts#updateLog` |
| Custom foods | Private to their owner; deleting one keeps past diary entries. | `diary.service.ts` |
| Meal templates | Totals are always derived from ingredients. Only published templates can be assigned; archiving ends assignments. | `mealTemplates.service.ts` |
| Targets | Calculated from the member's own profile and latest weight (Mifflin-St Jeor × activity, goal adjustment, protein g/kg, fat floor, fibre per 1000 kcal, minimum calories). Recalculated automatically when profile, goal or weight change — unless an admin set an individual target, which stays until reset. | `targets.service.ts`, `shared/src/utils/targets.ts` |
| Activity imports | Provider + external id are unique, so duplicate rides are ignored. | Data model (Phase 5) |
| Calories | Exercise calories are never added automatically to the food budget; the dashboard shows recorded data only. | Product rule (Phase 4 engine) |
| Admin privacy | Admins see account basics only. Measurements, food logs and photos require the user's `sharing` opt-in (off by default). Admin views of a user are audited. | `admin-users.routes.ts`, `userPreferences.sharing` |
| Audit trail | Every admin create / update / archive / restore / delete / role / status change is logged with a field diff. | `recordAudit()` |
| Time zones | Instants in UTC; local calendar days as `YYYY-MM-DD` using the user's time zone. | Data model |

## Example: an admin changes Bench Press from 3×8–10 to 4×8–12

1. New plans built afterwards default to 4×8–12.
2. Existing published plans keep 3×8–10 until an admin publishes a new plan version.
3. Users on an assigned plan stay on their assigned version until a new version is assigned.
4. Completed workouts keep exactly the weights and reps recorded.
