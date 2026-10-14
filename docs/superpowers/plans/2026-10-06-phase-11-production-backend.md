# Phase 11 Production Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the prototype's in-memory state to Supabase (Postgres, phone OTP, RLS, Storage, B4 functions) without changing what the screens do. The domain commands stay the single source of rules.

**Architecture:** SQL migrations in `supabase/migrations/` define tables, RLS and Postgres functions. A repository adapter in `src/data/` maps `ConstructionDataState` shapes to rows and calls the B4 functions. Domain code never imports Supabase. The provider switches from the in-memory store to the adapter behind one flag, and screens keep their calls.

**Tech Stack:** Supabase (Postgres, Auth phone OTP, Storage, Supabase CLI), `@supabase/supabase-js`, TypeScript, React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-phase-11-production-backend-design.md` (approved at `165b92a`; decisions B1–B10).

## Global Constraints

- `src/domain/*.ts` never imports Supabase or `src/mock/*`. Test files may import `../mock/seed`.
- Legacy-style files keep single quotes and no semicolons. New files use double quotes and no semicolons. SQL uses lowercase keywords and snake_case identifiers.
- Every table has RLS enabled. A table with no policy denies all access.
- Refusals from the database use SQLSTATE class `P0001` with message codes `conflict` or `permission`; the adapter maps them to `ConflictError` and `PermissionError` with the same messages the domain uses.
- The database derives time and dates: `now()` and `(now() at time zone 'Asia/Kolkata')::date`. No client-supplied timestamps for attendance.
- Secrets come from environment variables. `.env*` files are git-ignored. No keys are committed.
- Demo accounts exist only in local and staging seeds, with Supabase test phone numbers and test OTPs.
- Phone-argument identity checks are removed. Workers are identified by the session.
- Each migration is committed; migrations are never edited after they are merged (add a new one).
- Out of scope: real payments, mobile, offline, real-time, email sign-in, search and reports, contractor verification, the worker profile screen, queues, PostGIS.

## File Structure

- Create `supabase/config.toml` (from `supabase init`), `supabase/seed.sql` (local/staging demo data).
- Create `supabase/migrations/0001_identity.sql` — organizations, people, memberships, workers, worker_onboardings; `current_person_id()` helper.
- Create `supabase/migrations/0002_projects.sql` — projects, units, stages, trades, work types, templates, work plan items, tasks, task assignments, worker_project_assignments; `has_permission()` and `in_scope()` helpers.
- Create `supabase/migrations/0003_progress.sql` — daily_progress (versioning), progress_reviews, progress_publications, evidence, documents, issues, threads, messages, thread_reads, call_logs.
- Create `supabase/migrations/0004_attendance_marketplace_billing.sql` — worker_attendance, estimates, marketplace_requirements, marketplace_unlocks, proposals, plans, subscriptions, credit_wallets, credit_transactions.
- Create `supabase/migrations/0005_rls.sql` — RLS enable and policies per the spec §3 matrix.
- Create `supabase/migrations/0006_functions_billing_marketplace.sql` — `unlock_requirement`, `submit_proposal`, `select_proposal`.
- Create `supabase/migrations/0007_functions_workforce.sql` — `create_worker_onboarding`, `accept_worker_onboarding`, `accept_own_worker_onboarding`, `mark_worker_joined`, `end_worker_project_assignment`.
- Create `supabase/migrations/0008_functions_attendance_progress.sql` — `check_in_worker`, `check_out_worker`, `record_attendance`, `set_attendance_policy`, `publish_daily_progress`.
- Create `supabase/migrations/0009_storage.sql` — private buckets and storage policies.
- Create `supabase/tests/` — pgTAP or SQL test scripts for RLS and functions (run with `supabase test db`).
- Create `src/data/supabaseClient.ts`, `src/data/rows.ts` (row ↔ domain mappers), `src/data/adapter.ts` (repository), `src/data/session.ts` (OTP sign-in and session resolution).
- Modify `src/mock/ConstructionDataProvider.tsx`: choose the adapter behind `VITE_DATA_SOURCE` (`memory` default, `supabase`).
- Modify `src/session/SessionProvider.tsx` and sign-in screens: phone OTP for all account types; remove demo buttons from production builds.
- Modify `src/domain/attendanceCommands.ts` and `src/domain/workforceOnboarding.ts`: keep the rules, remove the phone-argument identity checks where the database now derives the worker from the session (the in-memory path keeps working through the session's person).
- Tests: `src/data/rows.test.ts`, `src/data/adapter.test.ts` (local stack), and the SQL tests above.

---

### Task 1: Supabase project scaffold and local stack

**Files:**
- Create: `supabase/config.toml`, `supabase/seed.sql`, `.env.example`
- Modify: `.gitignore` (add `.env`, `.env.*.local`, `supabase/.branches`, `supabase/.temp`)
- Modify: `package.json` (add `@supabase/supabase-js`, a `db:start`, `db:reset`, `db:test` script)

- [ ] **Step 1: Check the CLI.** Run `npx supabase --version`. If the CLI is missing, install it as a dev dependency (`npm i -D supabase`) and re-run.
- [ ] **Step 2: Init and start the local stack.** Run `npx supabase init` (creates `supabase/config.toml`), then `npx supabase start`. Expected: local API URL and anon key printed. Record them in `.env.local` (git-ignored), never in committed files.
- [ ] **Step 3: Add `.env.example`** with `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=` (empty values) and `VITE_DATA_SOURCE=memory`.
- [ ] **Step 4: Add the client dependency** `npm i @supabase/supabase-js`.
- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml .env.example .gitignore package.json package-lock.json pnpm-lock.yaml
git commit -m "chore: add supabase local stack and client dependency"
```

Stage only the lockfile that changed.

---

### Task 2: Identity migration

**Files:**
- Create: `supabase/migrations/0001_identity.sql`
- Test: `supabase/tests/0001_identity.sql`

**Interfaces:** Produces tables `organizations`, `people`, `memberships`, `workers`, `worker_onboardings` and `current_person_id() returns uuid` (returns `people.id` for `auth.uid()`).

- [ ] **Step 1: Write the failing SQL test.** In `supabase/tests/0001_identity.sql`, assert the tables exist and `current_person_id()` returns null with no JWT. Run `npx supabase test db` and confirm it fails (tables missing).
- [ ] **Step 2: Write the migration.** Create the five tables with `uuid` primary keys, `legacy_id text unique` (the domain id during migration), `organization_id` where scoped, `people.phone text unique`, `people.auth_user_id uuid unique`, `memberships(person_id, organization_id, project_id nullable, role, permissions text[], scope jsonb, status)`, `workers(organization_id, user_id uuid references people, phone text, name, trade_ids text[], languages text[], onboarding_method, status)` with unique `(organization_id, phone)`, and `worker_onboardings(worker_id, organization_id, method, status, join_code, invited_by_membership_id, invited_at, accepted_at, expires_at)`. Add the partial unique index: at most one open onboarding per worker (`status in ('invited','accepted')`). Create `current_person_id()` as `security definer`, reading `people` by `auth_user_id = auth.uid()`.
- [ ] **Step 3: Run the test** (`npx supabase db reset` then `npx supabase test db`). Expected: pass.
- [ ] **Step 4: Commit** `feat: add identity tables and current person helper`.

---

### Task 3: Projects, scope and permission helpers

**Files:**
- Create: `supabase/migrations/0002_projects.sql`
- Test: `supabase/tests/0002_projects.sql`

**Interfaces:** Produces `projects` (with `require_checkout boolean not null default false`), `project_units`, `stages`, `trades`, `work_types`, `task_templates`, `work_plan_items`, `tasks`, `task_assignments`, `worker_project_assignments` (`started_at`, `ended_at`, `end_reason`, `status`), and `has_permission(project uuid, perm text) returns boolean` and `in_scope(project uuid, unit uuid, stage uuid, trade uuid) returns boolean` (both `security definer`, reading the caller's memberships; an empty scope array means unrestricted, as in `readScope.ts`).

- [ ] **Step 1: Failing test** asserting `has_permission` is false with no membership and true for a membership with the permission; `in_scope` treats an empty array as unrestricted and a non-empty array as a filter.
- [ ] **Step 2: Migration** with the tables above and the two helpers. Permissions are the `text` values from `src/domain/permissions.ts` (`project.read`, `project.manage`, `task.manage`, `progress.submit`, `progress.review`, `issue.manage`, `customer.publish`, `workforce.manage`).
- [ ] **Step 3: Run tests** (`npx supabase db reset && npx supabase test db`). Expected: pass.
- [ ] **Step 4: Commit** `feat: add project tables, scope and permission helpers`.

---

### Task 4: Progress, issues and conversations migration

**Files:**
- Create: `supabase/migrations/0003_progress.sql`
- Test: `supabase/tests/0003_progress.sql`

**Interfaces:** Produces `daily_progress` (`version int`, `supersedes_id`, `superseded_by_id`, `review_status`), `progress_reviews` (`decision`, `note`, `reviewer_membership_id`, `reviewed_at`), `progress_publications` (`published_by_membership_id`, `published_at`), `evidence`, `documents` (with `shared_with_homeowner boolean`), `issues` (with `customer_visible boolean`), `threads` (`audience` in `('internal','homeowner')`, `participant_membership_ids uuid[]`), `messages`, `thread_reads`, `call_logs`.

- [ ] **Step 1: Failing test** that a corrected daily progress creates a new version row and leaves the old row's content unchanged.
- [ ] **Step 2: Migration** with the tables and the versioning columns. Corrections insert a new row with `version + 1` and set `superseded_by_id` on the old row (the only update allowed on the old row).
- [ ] **Step 3: Run tests.** Expected: pass.
- [ ] **Step 4: Commit** `feat: add progress, evidence, issue and conversation tables`.

---

### Task 5: Attendance, marketplace and billing migration

**Files:**
- Create: `supabase/migrations/0004_attendance_marketplace_billing.sql`
- Test: `supabase/tests/0004_attendance_marketplace_billing.sql`

**Interfaces:** Produces `worker_attendance` (`unique (worker_id, project_id, date)`, `status` in `('present','absent','half-day')` or null, `check_in_at`, `check_out_at`, `recorded_by`, `assignment_id`, `date date`), `estimates` (`homeowner_person_id`), `marketplace_requirements` (`homeowner_person_id`, `status`), `marketplace_unlocks` (`unique (requirement_id, partner_organization_id)`), `proposals` (`unique (requirement_id, partner_organization_id)`), `plans`, `subscriptions`, `credit_wallets` (`balance integer check (balance >= 0)`), `credit_transactions` (`kind`, `amount`, `balance_after`, `requirement_id`).

- [ ] **Step 1: Failing test:** a wallet cannot go negative (check constraint); a second unlock for the same requirement and organization is refused by the unique constraint.
- [ ] **Step 2: Migration.**
- [ ] **Step 3: Run tests.** Expected: pass.
- [ ] **Step 4: Commit** `feat: add attendance, marketplace and billing tables`.

---

### Task 6: RLS policies

**Files:**
- Create: `supabase/migrations/0005_rls.sql`
- Test: `supabase/tests/0005_rls.sql`

**Interfaces:** Enables RLS on every table and adds policies implementing the spec §3 matrix, including customer visibility (homeowners see only published evidence and documents, customer-visible issues, and published daily progress; never `progress_reviews.note`, voice notes, or internal threads), membership scope (`in_scope`), worker self-access (own worker row, assignments and attendance via `current_person_id()`), and person-owned data (`estimates`, `marketplace_requirements`) and thread participation.

- [ ] **Step 1: Failing tests, one per matrix row** that the spec lists: a worker reads only their own attendance; a cross-organization user is refused; a homeowner cannot read an unpublished evidence row or the review note of a published progress row; a scoped supervisor cannot read a task outside their stage; a partner cannot read a requirement's full columns without an unlock row. Confirm they fail before the policies exist.
- [ ] **Step 2: Migration** enabling RLS on all tables (the migration fails if a table lacks RLS) and the policies. Writes that a B4 rule governs get no direct write policy; the functions in Tasks 7–9 perform them as `security definer`.
- [ ] **Step 3: Run tests.** Expected: all pass.
- [ ] **Step 4: Commit** `feat: add row-level security policies for the permission matrix`.

---

### Task 7: Marketplace and billing functions

**Files:**
- Create: `supabase/migrations/0006_functions_billing_marketplace.sql`
- Test: `supabase/tests/0006_functions.sql`

**Interfaces:** Produces `unlock_requirement(requirement_id uuid, organization_id uuid)`, `submit_proposal(requirement_id uuid, organization_id uuid, assumptions text[], exclusions text[])`, `select_proposal(proposal_id uuid)`. Each returns the created row as JSON and raises `P0001` with message `conflict:<text>` or `permission:<text>` using the domain's exact messages.

- [ ] **Step 1: Failing tests:** unlock debits exactly 10 credits; unlock at 9 credits raises the conflict message and writes nothing; unlock without the entitlement raises before any debit; select creates the project and two memberships and rejects other proposals.
- [ ] **Step 2: Implement** each function as `security definer` with an explicit `search_path`, reading the caller through `current_person_id()`, doing every check before any write, and writing in one transaction (function bodies are atomic).
- [ ] **Step 3: Run tests.** Expected: pass.
- [ ] **Step 4: Commit** `feat: add unlock, proposal and selection functions`.

---

### Task 8: Workforce functions

**Files:**
- Create: `supabase/migrations/0007_functions_workforce.sql`
- Test: `supabase/tests/0007_functions.sql`

**Interfaces:** Produces `create_worker_onboarding(worker_id uuid, method text)`, `accept_worker_onboarding(onboarding_id uuid, join_code text)` (QR), `accept_own_worker_onboarding(onboarding_id uuid)` (the invited worker's own OTP session; the session's person must be the worker's `user_id`), `mark_worker_joined(onboarding_id uuid)` (supervisor; `workforce.manage`), `end_worker_project_assignment(assignment_id uuid, reason text)` (sets ended and inactive, deactivates the worker's project membership).

- [ ] **Step 1: Failing tests:** one open onboarding per worker; a wrong join code changes nothing; a worker session cannot call `mark_worker_joined`; `accept_own_worker_onboarding` refuses a session whose person is not the worker; ending an assignment keeps the worker active.
- [ ] **Step 2: Implement** the five functions with the same messages as the domain (`ConflictError` texts from `constructionCommands.ts`).
- [ ] **Step 3: Run tests.** Expected: pass.
- [ ] **Step 4: Commit** `feat: add workforce onboarding and assignment functions`.

---

### Task 9: Attendance and progress publication functions

**Files:**
- Create: `supabase/migrations/0008_functions_attendance_progress.sql`
- Test: `supabase/tests/0008_functions.sql`

**Interfaces:** Produces `check_in_worker(project_id uuid)`, `check_out_worker(project_id uuid)` (worker resolved from the session; date and time from the database, Asia/Kolkata), `record_attendance(project_id uuid, worker_id uuid, day date, status text, check_in_at timestamptz, check_out_at timestamptz)` (`workforce.manage`; refuses a fully ended covering assignment), `set_attendance_policy(project_id uuid, require_checkout boolean)` (`project.manage`), `publish_daily_progress(progress_id uuid, decision text, note text)` (`progress.review`; `customer.publish` for publication).

- [ ] **Step 1: Failing tests:** check-in refuses a second check-in the same day; check-out needs a check-in and is allowed after assignment end; the date is Asia/Kolkata for a check-in just after midnight UTC; a supervisor write for a fully ended assignment is refused; a worker cannot call `record_attendance`.
- [ ] **Step 2: Implement** the five functions using the domain messages from `attendance.ts` and `attendanceCommands.ts`.
- [ ] **Step 3: Run tests.** Expected: pass.
- [ ] **Step 4: Commit** `feat: add attendance and progress publication functions`.

---

### Task 10: Storage buckets and policies

**Files:**
- Create: `supabase/migrations/0009_storage.sql`
- Test: `supabase/tests/0009_storage.sql`

**Interfaces:** Creates private buckets `evidence` and `documents`, and storage policies that allow a path only when the caller can read the matching row (spec §6). Object paths follow `{organization_id}/{project_id}/{kind}/{id}`.

- [ ] **Step 1: Failing tests:** a homeowner cannot read an unpublished evidence object's path; a member with `project.read` can read it.
- [ ] **Step 2: Migration** creating the buckets (not public) and policies that look up the owning row by path.
- [ ] **Step 3: Run tests.** Expected: pass.
- [ ] **Step 4: Commit** `feat: add private storage buckets and access policies`.

---

### Task 11: Seed data for local and staging

**Files:**
- Modify: `supabase/seed.sql`
- Create: `scripts/seed-supabase.ts` (loads the same demo scenario as `src/mock/seed.ts` into the local stack through the admin API; staging uses the Supabase test phone numbers)

**Interfaces:** Creates the demo organization `org-buildright`, the demo worker `person-ravi` with the test phone, the demo business user `person-arjun`, and the demo homeowner, all with test OTPs.

- [ ] **Step 1: Failing check:** `scripts/seed-supabase.ts --check` reports the demo users and rows missing before the seed, and passes after it.
- [ ] **Step 2: Implement** the seed (SQL for rows; the admin API for auth users).
- [ ] **Step 3: Run** `npx supabase db reset` then the seed script. Expected: check passes.
- [ ] **Step 4: Commit** `chore: seed local and staging demo data`.

---

### Task 12: Repository adapter and row mappers

**Files:**
- Create: `src/data/supabaseClient.ts`, `src/data/rows.ts`, `src/data/adapter.ts`
- Test: `src/data/rows.test.ts`, `src/data/adapter.test.ts`

**Interfaces:** `rows.ts` exposes pure mappers (`workerFromRow`, `workerToRow`, and one pair per table) so they can be tested without a database. `adapter.ts` exposes `loadState(): Promise<ConstructionDataState>` and one write per B4 function (`unlockRequirement`, `submitProposal`, …), each returning the same result shape as the domain command and mapping `P0001` messages to `ConflictError`/`PermissionError`.

- [ ] **Step 1: Failing mapper tests** (`rows.test.ts`): a worker row maps to `Worker` with `languages` and `tradeIds` arrays; a round trip keeps every field.
- [ ] **Step 2: Implement the mappers** (pure, no Supabase import).
- [ ] **Step 3: Implement the adapter** using `supabase-js` (`rpc` for B4 functions, `from(table).select` for loads). Keep it free of domain logic.
- [ ] **Step 4: Adapter test** against the local stack: `loadState` returns the seeded demo organization; `unlockRequirement` debits and maps a refusal to `ConflictError`.
- [ ] **Step 5: Run** `npx vitest run` (domain tests unchanged and passing), `npx tsc --noEmit`.
- [ ] **Step 6: Commit** `feat: add supabase repository adapter and row mappers`.

---

### Task 13: Phone OTP sign-in and session

**Files:**
- Create: `src/data/session.ts`
- Modify: `src/session/SessionProvider.tsx`, `src/screens/WorkerOnboardingScreen.tsx`, `src/screens/BusinessOnboardingScreen.tsx`, `src/screens/HomeownerOnboardingScreen.tsx` (sign-in step only)

**Interfaces:** `signInWithPhone(phone)` (sends OTP), `verifyOtp(phone, code)` (returns the resolved `Session`: account type, person id, organization id, and worker phone when the person is a worker). The domain `Session` type is built from the resolved person.

- [ ] **Step 1: Failing test** for session resolution: a person with a worker row in one organization resolves to a worker session; a person with a business membership resolves to a business session; an unknown phone resolves to no session.
- [ ] **Step 2: Implement** `session.ts` and switch `SessionProvider` to the Supabase session when `VITE_DATA_SOURCE=supabase`. Keep the in-memory path unchanged when the flag is `memory`.
- [ ] **Step 3: Replace the sign-in steps** with the OTP flow. In `supabase` mode, remove the demo buttons from production builds (keep them behind `import.meta.env.DEV` and the `memory` flag).
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat: phone OTP sign-in and session resolution`.

---

### Task 14: Switch the provider and remove phone-argument identity

**Files:**
- Modify: `src/mock/ConstructionDataProvider.tsx` (choose adapter or memory store behind `VITE_DATA_SOURCE`)
- Modify: `src/domain/attendanceCommands.ts`, `src/domain/workforceOnboarding.ts`, `src/domain/constructionCommands.ts` only where a phone-argument identity check is removed for the supabase path (keep the in-memory rules intact, as the session supplies the person)
- Modify: the worker screens to call the session-derived commands (`checkInWorker` without a phone argument)

**Interfaces:** The provider exposes the same command names. In supabase mode each name calls the adapter; in memory mode it runs the domain command.

- [ ] **Step 1: Failing test:** with `VITE_DATA_SOURCE=supabase`, the provider exposes the same command names as the memory mode (a shape test).
- [ ] **Step 2: Implement** the switch and remove the phone argument from the worker check-in and check-out calls (the session supplies the person).
- [ ] **Step 3: Run** `npx vitest run` (memory-mode tests unchanged), `npx tsc --noEmit`, `npm run build`.
- [ ] **Step 4: Commit** `feat: provider switches to the supabase adapter behind a flag`.

---

### Task 15: Parity check and final verification

- [ ] **Step 1: Parity test:** a scripted scenario (post, unlock, propose, select; onboard a worker, accept, assign, check in, check out, record attendance, publish progress) runs against the memory store and the adapter on the local stack; the resulting domain state matches on the fields the screens read.
- [ ] **Step 2: Full run:** `npx supabase db reset`, `npx supabase test db` (all SQL tests pass), `npx vitest run` (all pass), `npx tsc --noEmit`, `npm run build`.
- [ ] **Step 3: Scope check:** `git diff --stat main..HEAD` shows only the files in File Structure plus docs.
- [ ] **Step 4: Report** the test counts (domain and SQL), the parity result, and the commit list. Browser walkthrough against the local stack follows the merge.
