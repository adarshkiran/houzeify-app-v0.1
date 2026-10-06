# Phase 4 Worker Data Model and Onboarding Audit

**Date:** 2026-10-06
**Scope:** Read-only audit of the worker data model, onboarding paths, and the worker quantity step. No code changed.
**Source:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` §Phase 4 (lines 903–980).

## 1. Entity inventory

| Plan entity | Current form | Verdict | Needs first-class record? |
|---|---|---|---|
| Worker | `Worker` in `src/domain/models.ts` (name, phone, tradeIds, preferredLanguage, onboardingMethod, status) | Built | Yes (already) |
| WorkerProjectAssignment | `WorkerProjectAssignment` (workerId, projectId, projectUnitIds, tradeIds, role, status, assignedAt) | Built, missing an end-of-assignment record | Yes (already); add `endedAt` or an unassign history |
| WorkerSkill / Trade | `Worker.tradeIds` (list of trade IDs) | Partial | **No, not yet.** A trade link has no lifecycle of its own. Promote to a record only if we need per-trade proficiency, certification dates, or history. |
| WorkerLanguage | `Worker.preferredLanguage` (one text value) | Partial | **No.** A single preferred language has no lifecycle. If workers need several languages, store a list of codes on `Worker`. |
| WorkerOnboarding | `Worker.onboardingMethod` (enum only, no record) | Missing | **Yes.** Onboarding has a lifecycle (sent → accepted/expired), an actor (who invited), and a method. It needs its own record. |
| WorkerAttendance | None | Missing | Yes, but deferred until the foundation is stable (per the plan's sequencing). |

## 2. Relationships

```text
Organization
 └── Worker (organizationId)
      ├── tradeIds → Trade            (no separate record today)
      ├── preferredLanguage           (one value today)
      ├── WorkerProjectAssignment     (workerId, projectId)
      │     ├── projectUnitIds → ProjectUnit
      │     └── tradeIds → Trade      (the worker ↔ project ↔ trade link)
      └── WorkerOnboarding            (MISSING: method, status, invitedBy, timestamps)
```

## 3. Onboarding paths: what each actually does

| Plan path | Current behaviour | Creates |
|---|---|---|
| 1. Manual invite (Workforce screen) | `addWorker` (`src/domain/constructionCommands.ts:862`) requires `WORKFORCE_MANAGE`, rejects a duplicate phone in the organization, and creates a `Worker`. An optional project assignment is created when a project is given. | `Worker` (+ optional `WorkerProjectAssignment`). Persisted. |
| 1b. Invite member (Project Team screen) | `inviteProjectMember` (`src/domain/constructionCommands.ts:424`) creates a `Person` and a `ProjectMembership` with status `invited`. It never creates a `Worker` or a `WorkerProjectAssignment`. | `Person` + `ProjectMembership`. **No worker record.** |
| 2. OTP | `WorkerOnboardingScreen` is a phone sign-in that stands in for OTP, per its file comment. No OTP is sent or verified. | Session only. |
| 3. QR-code join | Enum value `"qr"` only. No flow exists. | Nothing. |
| 4. Supervisor-assisted | Enum value `"supervisor-assisted"` only. No flow exists. | Nothing. |
| 5. Bulk import | Deferred by the plan. | — |

**Finding A (confirmed):** The two invite paths are disconnected. Inviting a worker from the Project Team screen does not produce a `Worker`, so that person never appears on the Workforce screen, cannot be assigned work through the worker commands, and has no worker profile. The seeded worker "Ravi Naik" shows a worker role on the Project Team screen, which means the team roster and the worker roster can disagree.

**Finding B (confirmed):** Manual invite via Workforce creates the `Worker` but does not record an onboarding event. There is no invitation status, no expiry, and no record of who invited the worker.

## 4. Worker quantity step (end-to-end)

Traced from the worker submit screen to the task record:

1. **Capture:** `WorkerSubmitScreen` collects `completedQuantity` ("Work done today"). The unit comes from the task's planned quantity, with a fallback.
2. **Validate:** `submitDailyProgress` (`constructionCommands.ts:1009`) rejects a negative or non-finite quantity.
3. **Store:** the quantity is saved on the `DailyProgress` record (`constructionCommands.ts:1045`).
4. **Apply:** on approval, `addQuantity` adds the progress quantity to `task.completedQuantity` (`constructionCommands.ts:1217–1223`).

**Verdict: built end to end.** Two small gaps remain: the fallback unit when a task has no planned quantity is not documented, and I haven't confirmed the approval path on the review screen with a real submission.

## 5. Worker-specific permissions

`Permissions.WORKFORCE_MANAGE` gates `addWorker` and `assignWorkerToProject`. The worker submit path uses `PROGRESS_SUBMIT`. These match the plan's permission vocabulary. I haven't audited whether a worker's own view is restricted to their assignments (the `workerTasks.ts` scope helpers suggest it is).

## 6. Recommended first-class records (decision list)

1. **WorkerOnboarding (new record):** required. Fields: id, workerId, method, status (`invited` | `accepted` | `expired` | `cancelled`), invitedByMembershipId, invitedAt, respondedAt.
2. **Invite unification (fix):** a project-team worker invite should create a `Worker` and link it to the `ProjectMembership`, or redirect to the Workforce flow. Decide which path is canonical.
3. **WorkerProjectAssignment (extend):** add `endedAt` and an end reason so reassignment keeps history.
4. **Skills and languages (keep as fields for now):** no independent lifecycle needed for the prototype. Revisit when matching or certification is required.
5. **Attendance (deferred):** its own focused spec after items 1–3 are settled.

## 7. Open questions for you

1. Should a worker invite from the Project Team screen create a `Worker` immediately, or only when the worker accepts?
2. Are skills needed for matching or certification in the near term? If not, can `tradeIds` stay as they are?
3. Do workers need more than one language?
4. Should the QR and supervisor-assisted paths create an `invited` onboarding record like manual invite does?
