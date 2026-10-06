# Phase 4 — Workforce & Worker Experience Design

**Status:** Draft for review

**Source of truth:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` §Phase 4 (lines 903–980). Gaps from `docs/superpowers/audits/2026-10-06-phase-4-worker-audit.md`.

## Goal

Make workers real project participants. A worker has one identity record, joins through a traceable onboarding record, and is assigned to projects through a record that keeps its history. Worker screens already exist; this spec closes the data and onboarding gaps they depend on.

## Explicitly out of scope

- Attendance (`WorkerAttendance`). Its own spec after this one.
- Real OTP delivery and verification. The worker sign-in keeps standing in for OTP.
- A camera-based QR scanner. QR joins create a record and a join code; scanning is later.
- Bulk import (deferred by the plan).
- Skill, certification, and proficiency records (see decision D2).
- Worker profile screen (separate slice after the data is stable).
- My Tasks as a separate screen (the Today screen remains the landing view).

## Decisions

These answer the open questions from the audit.

- **D1. Project Team invite of a worker creates a `Worker` immediately, in status `invited`.** The Workforce screen is the canonical worker roster. A Project Team invite for the worker role delegates to the same worker creation, so one person never has two unlinked records. Acceptance moves the worker to `active`.
- **D2. Skills stay as `Worker.tradeIds`.** No separate skill record in this phase. Revisit when matching or certification is needed.
- **D3. Languages become `Worker.languages: string[]`** (language codes, for example `["en", "te"]`), replacing `preferredLanguage`. No proficiency model and no separate `WorkerLanguage` entity.
- **D4. Every onboarding method creates a `WorkerOnboarding` record**, including QR and supervisor-assisted, not only manual invite.

## 1. Data model

Added to `src/domain/models.ts`:

```ts
export type OnboardingMethod = "manual" | "otp" | "qr" | "supervisor-assisted"
export type OnboardingStatus = "invited" | "accepted" | "expired" | "cancelled"

export interface WorkerOnboarding {
  id: EntityId
  workerId: EntityId
  organizationId: EntityId
  method: OnboardingMethod
  status: OnboardingStatus
  /** Set for qr joins: the code a worker enters or scans to accept. */
  joinCode?: string
  invitedByMembershipId?: EntityId
  invitedAt: ISODateTime
  acceptedAt?: ISODateTime
  expiresAt?: ISODateTime
}
```

Changes to existing types:

- `Worker` changes: `preferredLanguage: string` becomes `languages: string[]`. `status`, `tradeIds`, and `onboardingMethod` stay. `onboardingMethod` is the method of the onboarding record that created the worker.
- `WorkerProjectAssignment` gains `startedAt: ISODateTime` (set when the assignment becomes active), `endedAt?: ISODateTime`, and `endReason?: "reassigned" | "left-project" | "removed"`. An assignment is ended, never deleted, so history is kept. Active means `status === "active"` and no `endedAt`.
- `ConstructionDataState` gains `workerOnboardings: WorkerOnboarding[]`.

**Invariants**

- Each `Worker` has at most one `invited` or `accepted` onboarding record at a time.
- A worker's phone is unique within the organization (already enforced by `addWorker`; keep it).
- An assignment with `endedAt` never counts toward the worker's active project list.

## 2. Lifecycle

The three records have separate lifecycles. Each one answers a different question.

- **Worker (identity):** does this person belong to the organization's workforce?
- **WorkerOnboarding (invitation):** how and when did this person join or get invited?
- **WorkerProjectAssignment (project work):** which project is this worker on, and since when?

```text
Worker:
  invited ──accept──▶ active ──deactivate──▶ inactive

WorkerOnboarding:
  invited ──accept──▶ accepted   (sets acceptedAt; worker becomes active)
  invited ──expire──▶ expired    (sets expiresAt; worker stays invited)
  invited ──cancel──▶ cancelled  (worker stays invited until removed)

WorkerProjectAssignment:
  invited ──activate──▶ active ──end(reason)──▶ ended (endedAt set, startedAt kept)
```

**Rules that keep the records separate**

- A `Worker` is created immediately in `invited` status. Its existence does not depend on onboarding succeeding.
- Accepting an onboarding record sets the worker to `active`.
- Cancelling or expiring an onboarding record never deletes the `Worker`.
- Ending a project assignment never changes the worker's status. A worker who leaves one project stays `active` in the organization and can join another project.
- Only an explicit deactivate action moves a worker to `inactive`. Deactivation does not end assignments on its own; it is a separate, deliberate step.

## 3. Commands

All in `src/domain/constructionCommands.ts` (or a new `workforceCommands.ts` if the file grows; decide during planning).

- `addWorker(input)` (existing). Creates a `Worker` in `invited` status and a `WorkerOnboarding` with method `manual`. Optional project assignment as today.
- `inviteProjectMember(input)` (existing, changed). When `input.role` is the worker role, it calls the same worker creation path (method `manual`), then creates a `Person` and the `ProjectMembership` for that person, and sets `Worker.userId` to the person's id. The worker-to-person link is `Worker.userId` (existing field); no new field on the membership. It no longer creates a `Person` without a worker. Non-worker roles are unchanged.
- `createWorkerOnboarding(input)` (new). Input: `{ workerId, method: "qr" | "supervisor-assisted" }`. For `qr`, generates a `joinCode`. For `supervisor-assisted`, records the supervisor's membership in `invitedByMembershipId`. Permission: `WORKFORCE_MANAGE`.
- `acceptWorkerOnboarding(onboardingId, joinCode?)` (new). For `qr`, requires the matching `joinCode`. Moves the onboarding to `accepted`, the worker to `active`, and the linked assignment to `active`. A refused join changes nothing.
- `cancelWorkerOnboarding(onboardingId)` (new). Permission: `WORKFORCE_MANAGE`.
- `endWorkerProjectAssignment(assignmentId, reason)` (new). Sets `endedAt` and `endReason`. Permission: `WORKFORCE_MANAGE`. Refuses if already ended.

Every refusal is a `ConflictError` with a plain message.

## 4. Screens

- **Workforce** (existing): shows worker status (`invited`, `active`, `inactive`) and the onboarding method for each worker. Adds a row action to cancel a pending invite and to end an assignment. A "Send QR join" action on a worker creates a QR onboarding and shows the join code.
- **Worker sign-in** (existing `WorkerOnboardingScreen`): accepts an invited worker. For a `qr` onboarding, the screen asks for the join code. For a `manual` or `supervisor-assisted` onboarding, it accepts by phone as today. No OTP.
- **Project Team** (existing): the invite form is unchanged for the user. Inviting a worker role creates the worker record behind the scenes.
- **Worker Today / Task / Submit / Messages** (existing): unchanged in this spec.

Each changed screen keeps its Hozie insight card. Copy stays factual.

## 5. Error handling

- A duplicate phone in the organization is refused (existing message kept).
- A wrong or missing join code is refused with "That join code doesn't match this invitation."
- Accepting an expired, cancelled, or already accepted onboarding is refused with a plain message.
- Ending an already-ended assignment is refused.

## 6. Testing

Domain tests (Vitest):

- `addWorker` creates a `Worker` in `invited` status and a `manual` onboarding record.
- `inviteProjectMember` with the worker role creates a `Worker`, a linked membership, and a `manual` onboarding. With a non-worker role it creates no `Worker`.
- Invariant: no worker ever has two open (`invited` or `accepted`) onboarding records.
- `createWorkerOnboarding` with `qr` creates a join code; `supervisor-assisted` records the supervisor.
- `acceptWorkerOnboarding` activates the worker and the assignment; a wrong join code changes nothing.
- `cancelWorkerOnboarding` and `endWorkerProjectAssignment` refuse invalid states and keep history.
- Permission: a worker-role user cannot run `WORKFORCE_MANAGE` commands.

Browser check (partner role): invite from Project Team, confirm the worker appears on Workforce as `invited`; send a QR join and confirm the code; end an assignment and confirm it leaves the active list but stays in history.

## 7. Build-plan alignment

- The plan's first-class entities are Worker, WorkerProjectAssignment, WorkerOnboarding, and WorkerAttendance. Skills, languages, and attendance are handled per D2, D3 and the deferral above.
- Onboarding methods 1–4 each produce a record. Method 5 (bulk import) stays deferred.
- Marketplace identity and project execution remain separate (as in Phase 9).
