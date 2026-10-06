# Phase 11 — Production Backend Design

**Status:** Revised after spec review; awaiting approval

**Source of truth:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` §Phase 11 (line 1334 onward). `Houzeify_Master_Plan_v0_2_FINAL.md` §Billing and §Security. Domain rules from `src/domain/*` (permissions, scope, visibility, commands).

## Goal

Move the prototype's in-memory state to a production backend on Supabase, without changing what the screens do. The domain commands stay the single source of rules. Supabase provides the database, phone OTP sign-in, row-level security (RLS), file storage, and Postgres functions that run multi-step rules atomically.

## Explicitly out of scope

- Real payments. Razorpay and invoices stay simulated (Phase 10 credits).
- Mobile worker app and offline mode (Phases 12 and 13).
- Real-time updates. Screens keep their refresh behaviour.
- Email sign-in. Phone OTP is the only method.
- Search, reporting and exports.
- Migrating the mock seed data to production. A seed script loads demo data for development and staging only.
- Contractor verification (FR-048 "verify"), the contractor role, and a worker profile screen.
- Queues, S3-style object storage beyond Supabase Storage, and PostGIS. Deferred; see §8.

## Decisions

- **B1. Supabase is the backend:** managed Postgres, Supabase Auth (phone OTP), RLS, Supabase Storage, and Postgres functions. No separate application server in this phase.
- **B2. Domain commands remain the single source of rules.** `src/domain/*` keeps its pure command functions. A repository adapter (`src/data/`) reads and writes Supabase. Screens and the provider keep their calls.
- **B3. Access is enforced in RLS.** Domain checks remain (they produce the user-facing messages). RLS is the backstop for every table, and it enforces the same permission, scope and visibility rules (§3).
- **B4. Multi-step rules run as Postgres functions in one transaction:** `unlock_requirement`, `submit_proposal`, `select_proposal`, `create_worker_onboarding`, `accept_worker_onboarding` (QR join), `accept_own_worker_onboarding` (invited worker, OTP session), `mark_worker_joined` (supervisor), `check_in_worker`, `check_out_worker`, `record_attendance`, `publish_daily_progress` (the review and publication transition). Each commits or fails as a unit.
- **B5. Phone OTP for every account type.** The Phase 4 and attendance phone stand-ins are removed. A worker is identified by the verified session, never by a phone argument.
- **B6. Schema is managed as versioned SQL migrations** in `supabase/migrations/`, applied with the Supabase CLI and committed.
- **B7. Files (evidence, documents, plans) go to Supabase Storage** in private buckets, with signed URLs.
- **B8. Environments:** a local Supabase stack for development, and one hosted staging project. Nothing deploys to production in this phase. Staging demo accounts use Supabase test phone numbers with fixed test OTPs, and are never created in a production project (see §5).
- **B9. Secrets stay out of git.** Keys come from environment variables; `.env` files are ignored.
- **B10. A person may hold memberships in several organizations.** One auth user maps to one `people` row by verified phone; that person can have memberships and worker rows in several organizations. Worker rows are per organization.

## 1. Architecture

```text
React app (screens, provider)
   │  same command shapes
   ▼
Repository adapter (src/data/)        ← replaces the in-memory store
   │  supabase-js (session JWT)
   ▼
Supabase
   ├─ Auth (phone OTP) → JWT with auth user id
   ├─ Postgres tables + RLS policies
   ├─ Postgres functions (B4)
   └─ Storage (B7)
```

The domain layer does not import Supabase. The adapter maps domain state shapes to rows and calls the B4 functions.

## 2. Data model

One table per `ConstructionDataState` collection (all 32 map; `assignments` → `task_assignments`, `wallets` → `credit_wallets`, `unlocks` → `marketplace_unlocks`). Conventions:

- Primary keys are `uuid`. The domain's string ids are kept in a `text` column `legacy_id` during migration so existing ids survive.
- Organization-scoped rows carry `organization_id`; project-scoped rows carry `project_id`.
- Timestamps are `timestamptz`. Attendance `date` is a `date` in Asia/Kolkata. The database derives it as `(now() at time zone 'Asia/Kolkata')::date` inside the functions; it is never accepted from the client.
- Money is `numeric(12,2)` in rupees; credits are `integer`.
- `people.auth_user_id uuid unique` links a person to an auth user on first verified sign-in.
- **Daily progress versioning:** `daily_progress` has `version int`, `supersedes_id uuid null`, `superseded_by_id uuid null`, `review_status`, and a separate `progress_reviews` table (`decision`, `note`, `reviewer_membership_id`, `reviewed_at`) and `progress_publications` (`published_by_membership_id`, `published_at`). Corrections create a new version; old versions are never edited.
- Estimates and marketplace requirements are person-owned (`homeowner_person_id`), with no organization scope.
- Conversations: `threads` with `audience` (`internal` or `homeowner`) and `participant_membership_ids uuid[]` for direct threads; `messages`, `thread_reads`, `call_logs` reference a thread.

## 3. Row-level security

Every table has RLS enabled. A table with no policy denies everything. Policies call `security definer` helpers (`current_person_id()`, `has_permission(project_id, permission)`, `in_scope(project_id, unit_id, stage_id, trade_id)`) so policies do not recurse into memberships.

**Permission matrix (from `src/domain/permissions.ts`):**

| Table or action | Read | Write |
|---|---|---|
| Projects, memberships | `project.read` | `project.manage` |
| Work plan and tasks | `project.read` (scoped) | `task.manage` |
| Task assignments | `project.read` (scoped) | `task.manage` |
| Issues | `project.read` (scoped) | report: `progress.submit` OR `issue.manage`; manage: `issue.manage` |
| Daily progress (drafts, submissions) | `project.read` (scoped) | `progress.submit` |
| Progress review and publication | `progress.review` | `progress.review`; publish: `customer.publish` |
| Evidence and documents (internal) | `project.read` (scoped) | `progress.submit` / `project.manage` |
| Workforce (workers, onboardings, assignments) | `project.read` | `workforce.manage` |
| Attendance | supervisor: `project.read`; worker: own rows | supervisor: `workforce.manage`; worker: own check-in/out via `check_in_worker`/`check_out_worker` |
| Attendance policy | `project.read` | `project.manage` |
| Marketplace requirements | partner: preview columns (view); full only with an unlock row | homeowner owns |
| Credits and transactions | owning organization | only through B4 functions |

**Customer visibility (homeowner role):** a homeowner has `project.read`. Additional policies restrict them to rows that are customer-visible:
- Evidence and documents: only published or shared rows (matching the domain's publication rule).
- Issues: only rows in the customer-visible state.
- Daily progress: only the published version. Review notes (`progress_reviews.note`) are never selectable by a homeowner.
- Voice notes and internal threads: never selectable by a homeowner. Homeowner threads only.

**Membership scope:** scoped roles (`projectUnitIds`, `stageIds`, `tradeIds`) are enforced in RLS with `in_scope(...)`, matching `src/domain/readScope.ts`. An empty scope list means unrestricted, as in the domain.

**Person-owned and conversation data:** estimates and requirements by `homeowner_person_id`; threads by `audience` and participant membership; messages, reads and call logs by their thread.

**Workers:** a worker reads only their own worker row, assignments, and attendance. A supervisor with `workforce.manage` reads the project's worker rows.

**Partners:** a requirement's preview view exposes location, property type, area band and the rounded estimate range (Phase 9, R10). Full columns only where an unlock row exists.

RLS tests run against the local stack (§7).

## 4. Postgres functions (B4)

Each function runs in one transaction, derives the caller from the JWT, checks the permission, and returns the same result shape the domain command returns. Errors carry a stable code (`conflict`, `permission`) that the adapter maps to `ConflictError` and `PermissionError`, so the screens show the same messages.

- `unlock_requirement(requirement_id, organization_id)` — plan entitlement, partner kind, requirement status, prior unlock; debits the wallet; inserts the unlock; links the credit transaction. Refuses with the domain messages.
- `submit_proposal(requirement_id, organization_id, assumptions, exclusions)` — requires an unlock and the propose entitlement; one proposal per organization.
- `select_proposal(proposal_id)` — creates the project, the homeowner membership and the partner's project-manager membership; rejects the other proposals; awards the requirement.
- `create_worker_onboarding(worker_id, method)` — one open onboarding per worker; `qr` generates the join code; `supervisor-assisted` records the supervisor. Requires `workforce.manage`.
- `accept_worker_onboarding(onboarding_id, join_code)` — QR join: exact join-code match. Activates the worker, the onboarding, the invited assignments and the invited worker-role memberships.
- `accept_own_worker_onboarding(onboarding_id)` — the invited worker accepts with their own OTP session. The session's person must be the onboarding's worker (matched through `workers.user_id = person.id`). Replaces the Phase 4 phone-matched self-accept.
- `mark_worker_joined(onboarding_id)` — supervisor path for non-QR invitations (`Mark as joined`). Requires `workforce.manage`.
- `end_worker_project_assignment(assignment_id, reason)` — sets `ended_at`, `end_reason` and inactive status; deactivates that worker's project membership (Phase 4 R9).
- `check_in_worker(project_id)` — the worker is the session's person's worker row in the project's organization; requires an active worker and an active assignment today; date and time from `now()` in Asia/Kolkata; refuses a second check-in that day. Replaces the Phase 4 `requireSelf` phone check (§5).
- `check_out_worker(project_id)` — same worker resolution; requires a check-in that day; no active-status requirement (Phase 4 R5); allowed after assignment end (A8).
- `record_attendance(project_id, worker_id, date, status, check_in_at, check_out_at)` — `workforce.manage` on the project; refuses a covering assignment that has fully ended (Phase 4 R9).
- `set_attendance_policy(project_id, require_checkout)` — `project.manage`.
- `publish_daily_progress(progress_id, decision, note)` — the review transition (approve, request changes, reject) and the publication step, with `progress.review` and `customer.publish` as the domain requires.

## 5. Authentication and sessions

- Sign-in is phone OTP through Supabase Auth. The user enters a phone number, receives a code by SMS, and enters it.
- On first verified sign-in, a `people` row is created or linked by phone (B10). Worker rows are linked by `workers.user_id = people.id` when the worker is invited or accepts.
- The session holds the auth user and the resolved person. The domain's `Session` type is built from that. `parseStoredSession` is replaced by the Supabase session.
- Role routes keep working: a person's account type is derived from their memberships and worker rows for the active organization.
- The demo sign-in buttons and all phone-argument checks (Phase 4 self-accept, Phase 4 and attendance `requireSelf`, `getOwnAttendance` phone matching) are removed. Workers are identified by the session.
- **Demo accounts:** staging only. Seeded as auth users with Supabase test phone numbers and fixed test OTPs. Never created in a production project. Test numbers are not routable to real phones.

## 6. Storage

- Buckets are private. Object paths: `{organization_id}/{project_id}/{kind}/{id}`.
- Uploads use a short-lived signed upload URL created by a function that checks the caller's permission.
- Downloads use signed URLs with an expiry, created only for rows the caller can read under §3, including the customer-visibility rule for homeowners.
- Object metadata lives in the `evidence` and `documents` tables and is written in the same transaction as the upload record.

## 7. Testing

- **Domain tests stay as they are** (they run without Supabase).
- **Migration tests:** migrations apply cleanly to an empty local database, and re-applying the set is a no-op (B6).
- **Adapter tests** run against the local stack: each table maps to the domain shape and back.
- **RLS tests** (SQL or Vitest against the local stack): for each row of the §3 matrix, an allowed read or write succeeds and a disallowed one is refused. Includes: worker-only reads; cross-organization refusal; homeowner visibility of unpublished evidence, issues, drafts and review notes; scoped roles outside their unit, stage or trade.
- **Function tests:** each B4 function succeeds and refuses correctly; a refusal leaves no partial rows.
- **Sign-in tests:** OTP flow against the local auth stack with the test number; session resolves to the right person and account type; an unlinked phone gets no worker or membership access.
- **Storage tests:** signed upload and download URLs; a download URL for a row the caller cannot read is refused; object paths follow §6.
- **Parity check:** a scripted scenario runs against the in-memory store and the Supabase adapter; resulting state matches.

## 8. Build-plan alignment and recorded deviations

- Phase 11 starts now because Phases 0–10 are built and merged.
- **Deviation (recorded):** the build plan (§13) recommends NestJS, Redis/queues, S3 and PostGIS. This phase uses Supabase instead (B1). A queue is not needed yet (no background jobs in the prototype rules). Object storage is Supabase Storage (B7). PostGIS is deferred until location features exist (device location is out of scope for Attendance).
- The domain-first design keeps the prototype's rules and tests as the contract for the backend.
- Mobile (Phase 12) and offline (Phase 13) will use the same adapter and RLS.
