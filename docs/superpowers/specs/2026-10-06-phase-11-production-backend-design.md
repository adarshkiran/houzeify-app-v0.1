# Phase 11 — Production Backend Design

**Status:** Draft for review

**Source of truth:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` §Phase 11 (line 1334) and §Phase 11 architecture. `Houzeify_Master_Plan_v0_2_FINAL.md` §Billing and §Security (entities, payments, access rules).

## Goal

Move the prototype's in-memory state to a production backend on Supabase, without changing what the screens do. The domain commands stay the single source of rules. Supabase provides the database, phone OTP sign-in, row-level security, file storage, and the Postgres functions that run multi-step rules atomically.

## Explicitly out of scope

- Real payments. Razorpay and invoices stay simulated (Phase 10 credits). A later phase connects the provider.
- Mobile worker app and offline mode (Phases 12 and 13). The API serves them later.
- Real-time updates. The screens keep their current refresh behaviour.
- Email sign-in. Phone OTP is the only method in this phase.
- Search, reporting and exports.
- Migrating the mock seed data to production. A separate seed script loads demo data for development only.

## Decisions

- **B1. Supabase is the backend:** managed Postgres, Supabase Auth (phone OTP), Row-Level Security, Supabase Storage, and Postgres functions. No separate application server in this phase.
- **B2. Domain commands remain the single source of rules.** `src/domain/*` keeps its pure command functions. A repository adapter reads and writes Supabase tables. Screens and the provider do not change their calls.
- **B3. Access is enforced in RLS, not only in the UI or the domain.** The domain checks remain (they drive error messages); RLS is the backstop for every table.
- **B4. Multi-step rules run as Postgres functions in one transaction.** These are: the credit debit and unlock (Phase 10), one open onboarding per worker and the join-code check (Phase 4), check-in and check-out day rules (Phase 4 attendance), and proposal selection that creates the project and memberships (Phase 9). Each function either commits everything or nothing.
- **B5. Phone OTP for every account type** (decided). Worker identity is the verified phone. The Phase 4 and attendance stand-ins are removed: a worker's check-in is authorized by the session, not by a phone match in the browser.
- **B6. Schema is managed as versioned SQL migrations** in `supabase/migrations/`, applied with the Supabase CLI. Every migration is reviewed and committed.
- **B7. Files (evidence, documents, plans) go to Supabase Storage**, with signed URLs and a per-project bucket path. Metadata lives in tables.
- **B8. Environments:** a local Supabase stack for development (`supabase start`), and one hosted project for staging. Production is a later decision; nothing in this phase deploys to production.
- **B9. Secrets stay out of git.** Keys are read from environment variables; `.env` files are ignored.

## 1. Architecture

```text
React app (screens, provider)
   │  calls the same command shapes
   ▼
Repository adapter (src/data/)        ← new; replaces the in-memory store
   │  supabase-js
   ▼
Supabase
   ├─ Auth (phone OTP) → session JWT with user id
   ├─ Postgres tables + RLS policies
   ├─ Postgres functions (multi-step rules, B4)
   └─ Storage (evidence and documents, B7)
```

The domain layer does not import Supabase. The adapter translates between the domain state shape and table rows, and calls the Postgres functions for B4 rules.

## 2. Data model

Tables mirror `ConstructionDataState` (one table per collection), with these conventions:

- Primary keys are `uuid`. The domain's string ids map to a `text` id column during migration, so existing ids survive.
- Every row has `organization_id` where the data is organization-scoped, and `project_id` where it is project-scoped.
- Timestamps are `timestamptz`. Dates for attendance are `date` in Asia/Kolkata (Phase 4 attendance decision A5).
- Money is `numeric(12,2)` in rupees. Credits are `integer`.
- A `person` row is linked to an auth user through `auth_user_id uuid unique`, set on first sign-in with the verified phone.

Tables (grouped):

- **Identity:** `organizations`, `people`, `memberships` (project and organization roles, permission lists as `text[]`), `workers` (phone, status, `languages text[]`, `trade_ids text[]`, `user_id`), `worker_onboardings`.
- **Projects:** `projects` (including `require_checkout boolean`), `project_units`, `stages`, `trades`, `work_types`, `task_templates`, `work_plan_items`, `tasks`, `task_assignments`, `worker_project_assignments` (with `started_at`, `ended_at`, `end_reason`).
- **Progress:** `daily_progress`, `evidence`, `documents`, `issues`, `threads`, `messages`, `thread_reads`, `call_logs`.
- **Attendance:** `worker_attendance` (unique on worker, project, date).
- **Marketplace and billing:** `estimates`, `marketplace_requirements`, `marketplace_unlocks`, `proposals`, `plans`, `subscriptions`, `credit_wallets`, `credit_transactions`.

## 3. Row-level security

- Every table has RLS enabled. A table with no policy denies everything.
- A signed-in person can read rows of organizations and projects where a membership exists with the matching permission. The policy reads memberships through a `security definer` helper function, to avoid recursive policies.
- Writes go through the Postgres functions in §4 wherever a B4 rule applies. Other writes are allowed only where a policy grants the matching permission.
- Worker rows: a worker reads only their own worker row, their own assignments, and their own attendance. A supervisor with `WORKFORCE_MANAGE` on the project reads the project's worker rows.
- Credit wallets and transactions: readable and writable only through the debit and purchase functions.
- Marketplace: a partner reads a requirement's preview columns through a view; full columns only where an unlock row exists for that partner.

RLS tests run against the local stack for each policy (see §7).

## 4. Postgres functions (B4)

Each function runs in one transaction, checks the caller's permission from the session, and returns the same result shape the domain command returns:

- `unlock_requirement(requirement_id, org_id)` — checks the plan entitlement, the partner kind, the requirement status and the prior unlock; debits the wallet; inserts the unlock; links the credit transaction. Refuses with the domain's messages.
- `submit_proposal(...)`, `select_proposal(proposal_id)` — select creates the project, the homeowner membership and the partner's project-manager membership, and marks the other proposals rejected.
- `create_worker_onboarding(worker_id, method)`, `accept_worker_onboarding(onboarding_id, join_code)` — enforce one open onboarding per worker and the exact join-code match, and activate the worker's memberships and invited assignments.
- `check_in_worker(project_id, at)`, `check_out_worker(project_id, at)` — the Phase 4 attendance rules. `at` is set by the database (`now()`), never by the client.
- `record_attendance(...)` — the supervisor write rules, including the ended-assignment refusal.

Each function raises an error with a stable code (`conflict`, `permission`) that the adapter maps back to the domain's `ConflictError` and `PermissionError`, so screens show the same messages.

## 5. Authentication and sessions

- Sign-in is phone OTP through Supabase Auth. The user enters a phone number, receives a code, and enters it.
- On first verified sign-in, a `people` row is created or linked by phone. A worker's `people` row is linked to its `workers` row by phone within the organization that invited them.
- The session holds the auth user and the resolved person. The domain's `Session` type is built from that, so `parseStoredSession` and the role routes keep working.
- The demo sign-in buttons and the stand-in phone checks are removed in this phase. Demo accounts are seeded as real auth users in local and staging environments only.
- A worker's own check-in, check-out and reads rely on the verified session, not on a phone number typed into the app.

## 6. Storage

- Buckets are private. Object paths are `{organization_id}/{project_id}/{kind}/{id}`.
- Uploads go directly from the browser with a short-lived signed upload URL created by a function that checks the caller's permission.
- Reads use signed download URLs with an expiry, created only for rows the caller can read.

## 7. Testing

- **Domain tests stay as they are** (568 tests run without Supabase).
- **Adapter tests** run against the local Supabase stack: each table maps to the domain shape and back.
- **RLS tests** (SQL or Vitest against the local stack): for each policy, an allowed read or write succeeds and a disallowed one is refused. This includes the worker-only and cross-organization cases from Phases 4 and 8–10.
- **Function tests**: each B4 function is called in both success and refusal cases, and a refusal leaves no partial rows.
- **Parity check**: the same scripted scenario runs against the in-memory store and the Supabase adapter, and the resulting state matches.

## 8. Build-plan alignment

- Phase 11 in the build plan says the backend starts only after prototype workflows are stable. Phases 0–10 are built and merged, so this is the next step.
- The domain-first design keeps the prototype's rules and tests as the contract for the backend.
- Mobile (Phase 12) and offline (Phase 13) will use the same adapter and RLS.
