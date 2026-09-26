# Phase 5 — Daily Progress v2

**Date:** 2026-09-27  
**Branch:** `feature/daily-progress-v2`  
**Status:** Implemented
**Source:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` → Phase 5, §18 Project Progress Model, §20 Customer Publication Model

## Goal

Submission → Review → Revision → Approval → Selective Publication → Customer Visibility, with calculated project progress.

Four parts, one loop:

1. Separate Publish step
2. Request changes + review notes
3. Evidence viewer
4. Calculated project progress

## Today (what changes)

- Approving an update also publishes it and all its photos/video (`reviewDailyProgress` in `src/domain/constructionCommands.ts`).
- Review is Approve or Reject only; no note, no reviewer, no time.
- Evidence shows as thumbnails only.
- Project % is the last approved submitter-typed `progressAfter` (`calculateProjectProgress` in `src/domain/progress.ts`), so one unit's update can overwrite a multi-unit project.

Already in place and kept: planned/completed quantity, photo/video/voice/document evidence, voice notes private, issues linked to an update, role/scope checks in commands.

## 1. States and data

### Review states

```text
submitted → approved
          → changes-requested  (submitter resubmits → new version; this one → superseded)
          → rejected           (final, private)
```

`reviewStatus: "draft" | "submitted" | "approved" | "changes-requested" | "rejected" | "superseded"`

`draft` stays in the type; no save-as-draft UI in this build.

### Publication states

`publicationStatus: "private" | "published"` (the unused `"ready"` value is removed; "ready to publish" is derived: approved + private).

Only an approved update can be published. Rejected, changes-requested and superseded updates are always private.

### New fields on `DailyProgress`

```ts
version: number                    // 1, 2, 3…
supersedesId?: EntityId            // previous version
supersededById?: EntityId          // next version
review?: {
  decision: "approve" | "request-changes" | "reject"
  note?: string                    // required for request-changes and reject
  reviewedByMembershipId: EntityId // from the session, never from input
  reviewedAt: ISODateTime
}
publication?: {
  publishedByMembershipId: EntityId
  publishedAt: ISODateTime
  evidenceIds: EntityId[]          // exactly what the homeowner can see
}
```

Earlier versions are never overwritten.

### Evidence visibility

Unchanged type: `customerVisibility: "private" | "review-required" | "customer-visible"`.

- Only `publishDailyProgress` sets `customer-visible`, and only on the evidence the reviewer chose.
- Voice notes (`audio`) are always `private`.
- Evidence on rejected or superseded updates stays private.
- Internal review notes are never shown to the homeowner.

### New on `Project`

```ts
stageBaselines: Record<EntityId, number> // stageId → % complete when tracking started (0–100)
```

`project.progress` becomes a stored copy of the calculated value, refreshed after every approval. Nothing sets it directly.

### Permissions

Publishing uses the existing `Permissions.CUSTOMER_PUBLISH` (`"customer.publish"`), which project managers already hold; supervisors are granted it too. Publishing is a customer decision, separate from checking the work (`progress.review`).

## 2. Calculated project progress

A pure function in `src/domain/progress.ts`.

1. **Task %**
   - With a planned quantity: sum of approved completed quantity (same unit) ÷ planned quantity, capped at 100.
   - Without a planned quantity: 100 when the task is `approved` or `completed`, else 0.
   - `cancelled` tasks are excluded.
2. **Stage %** = `baseline + (100 − baseline) × average task % of the stage's tasks`, over tasks in all units. A stage with no tasks = its baseline.
3. **Project %** = Σ (stage weight × stage %) / 100, rounded to a whole number.

Fixed stage weights (sum 100):

| Stage | Weight |
|---|---|
| Site Preparation | 5 |
| Foundation | 12 |
| RCC Structure | 25 |
| Masonry | 12 |
| Plastering | 10 |
| Waterproofing | 5 |
| Services | 13 |
| Flooring | 8 |
| Finishing | 10 |

- The submitter's "Progress after today (%)" stays on the form as their estimate, is shown to the reviewer next to the calculated figure, and never changes `project.progress`.
- Seed projects get stage baselines that reproduce their current % (Sharma ≈ 34, Reddy ≈ 67, Tech Park ≈ 81, Krishna ≈ 8, Lakeside ≈ 4).
- New project: when "Construction has already started" is ticked, the Structure setup step shows each stage with a baseline % input. Otherwise all baselines are 0.
- Known simplification (documented in code): tasks in a stage are assumed to cover its remaining work, so one tracked task at 100% completes a stage with a 40% baseline. A BOQ/cost weighting replaces this later.

## 3. Screens and flows

### Company — Progress page (per project), three tabs

- **Waiting for review (n)** — list + detail (current layout). Detail shows the update, the submitter's estimate vs the calculated project %, clickable evidence, and earlier versions with their review notes. Actions: **Approve** (optional note), **Request changes** (note required), **Reject** (note required, confirm).
- **Ready to publish (n)** — approved, unpublished updates. Photos/videos/documents with checkboxes, all ticked by default; voice notes listed and locked as private. **Publish** opens a preview of what the homeowner will see, then confirms.
- **History** — every update with review and publication status; published ones show exactly what went out.

The company-wide Progress entry (no project) shows the same tabs across the workspace.

### Worker app

- **Worker Today** — a "Changes requested" section at the top with the reviewer's note.
- **Resubmit** — opens Log progress pre-filled from the previous version. Previous photos/videos are kept by default (can be removed, more added). Submitting creates the next version; the previous one becomes superseded. Kept evidence moves to the new version.
- Linked task: after Request changes → back to `in-progress` when allowed; after Reject → `reopened` (as today).

### Company — Task detail and Log today's work

- Task detail progress history lists all versions with status.
- A supervisor's own changes-requested update gets **Resubmit**, which opens Log today's work pre-filled.

### Evidence viewer (shared component)

Modal for photo, video, voice note, document.

- Company: preview on the left; captured by, captured at, project / unit, task, homeowner visibility, review status on the right; previous/next across the update's evidence.
- Homeowner: same viewer, published evidence only, showing date, location and task; no internal details.

Used in: review detail, Ready to publish, History, Task detail, worker screens, homeowner Daily Update.

### Homeowner — Daily Update

Shows only published updates and only `publication.evidenceIds`. Project % is the calculated value.

## 4. Rules, errors and testing

### Commands

- `reviewDailyProgress(id, decision, note?)` — only on `submitted`; note required for request-changes and reject; reviewer from the session. Approve refreshes `project.progress` and advances the task as today. No publication side effects.
- `resubmitDailyProgress(previousId, input)` — only on `changes-requested`; only the original submitter; keeps unit, task and work type; creates `version + 1`, links both ways, marks the previous one `superseded`.
- `publishDailyProgress(id, evidenceIds)` — needs `progress.publish`; update must be approved and private; every id must belong to the update and must not be audio; sets only those to `customer-visible`; records `publication`. Does not change project %.

### Errors

Reuse the existing command feedback, e.g.:

- "Add a note so the worker knows what to fix."
- "This update was already reviewed."
- "Only approved updates can be published."
- "Voice notes can't be shared with the homeowner."

A repeat review of an already-reviewed update is a no-op (as today).

### Invariants (tested)

- Submitted, changes-requested, rejected and superseded updates never reach the homeowner.
- Approved but unpublished updates never reach the homeowner.
- Published updates reach the homeowner with only the chosen evidence.
- Voice notes never reach the homeowner.
- A submitter's typed % never changes `project.progress`.

### Tests (Vitest, written first)

- `progress.ts`: baselines, weights, quantity-based and status-based tasks, multi-unit, cancelled tasks, rounding, seed projects land near their current %.
- Commands: review with notes and required-note errors; resubmission chain and superseded linking; publish with chosen evidence, audio rejection, foreign evidence rejection; permission checks for review vs publish.
- Selectors: review queue, ready-to-publish list, history, homeowner feed.
- Browser check before the PR: Ravi submits → manager requests changes → Ravi resubmits → manager approves → publishes 1 of 2 photos → homeowner view shows exactly that one, and project % follows the calculation.

## Out of scope

AI-generated progress reports, voice → automatic progress extraction, real media storage/upload, realtime notifications, advanced analytics, predictive delay detection, attendance/workforce tracking, backend persistence, unpublishing.

## Acceptance

```text
Worker / Supervisor → Submit Daily Progress → Reviewer queue → Review evidence
→ Approve  OR  Request changes + note (→ resubmit → new version)
→ Publish selected evidence → Customer Daily Update → Calculated project progress
```

Existing checks still pass: `pnpm run typecheck`, `pnpm run test`, `pnpm run build`.
