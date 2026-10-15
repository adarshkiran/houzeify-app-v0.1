# Site AI — Weekly Site Summary Design

**Status:** Approved direction, implementing

**Source:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` §10.3 "Site AI": `Voice → Task → Progress → Issue → Summary`; master plan §11 AI capability table: "Progress summarization — Company / Homeowner — Yesterday / Today / Tomorrow **and weekly summary**". The Yesterday/Today/Tomorrow cards (`src/mock/dayStory.ts`) exist; the weekly summary does not.

Decisions (brainstorming): company and homeowner both get it; the homeowner's is built only from published data; the period is a rolling 7 days ending on a chosen date, with previous/next week controls.

## Goal

A deterministic, on-demand summary of one project's week, computed from data the viewer is already allowed to read, in the same spirit as the day cards. No LLM, nothing stored.

## Function — `src/mock/weeklySummary.ts`

Lives beside `dayStory.ts`, which it reuses for date arithmetic (`addDays`, `formatDay`).

```ts
summarizeWeek(state, projectId, weekEnd: ISODate, options: { audience: "company" | "homeowner"; today: ISODate; generatedAt?: ISODateTime }): WeeklySummary | undefined
```

The window is `weekEnd - 6 … weekEnd` inclusive. Returns `undefined` for an unknown project.

### What each audience may be built from

| Input | Company | Homeowner |
|---|---|---|
| Daily updates | live versions (not superseded or rejected, not drafts) | `approved` and `published` only (`getPublishedForCustomer`) |
| Evidence | evidence attached to those updates | only `customer-visible` evidence the update's publication selected (`getPublishedEvidence`) |
| Issues | all project issues | only `customerVisibility = "customer-visible"` |
| Blockers (`blockerSummary`) | included | never included |
| Tasks completed, attendance | included | never included |

Anything in the "never" cells must not be computed for a homeowner, not merely hidden afterwards.

### Output

```ts
interface WeeklySummary {
  projectId; from: ISODate; to: ISODate; audience
  days: { date; notes: string[]; workersPresent?: number }[]   // 7 entries, oldest first
  totals: {
    updates: number
    daysReported: number
    peakWorkers: number                      // max workersPresent
    evidence: number
    issuesRaised: number; issuesResolved: number; issuesOpen: number
    // company only:
    tasksCompleted?: number
    workerDays?: number                      // attendance with status present / half-day
    awaitingReview?: number                  // submitted, not yet approved
  }
  blockers?: string[]                        // company only, de-duplicated
  lines: string[]                            // templated sentences, in reading order
  // AI governance (derived view, not a stored record, so no review fields)
  source: "ai"; createdBy: "ai"; engine: "rules-v1"
  confidence: "low" | "medium" | "high"
  assumptions: string[]
  generatedAt: ISODateTime
}
```

### Rules

- `daysReported` = distinct dates in the window with at least one counted update.
- `issuesRaised` = issues created in the window; `issuesResolved` = issues now `resolved`/`closed` whose `updatedAt` falls in the window; `issuesOpen` = open/in-progress now.
- `tasksCompleted` (company) = tasks in a done status (`approved`/`completed`) whose `updatedAt` falls in the window. The model does not store a completion date, so this is an approximation and says so in `assumptions`.
- Confidence: `low` with no counted updates, `high` with updates on at least 5 of the 7 days, `medium` otherwise.
- With no updates in the window the summary says so plainly instead of showing zeros as findings.
- Homeowner issue wording reuses the existing customer words ("Fixed", "Being looked into").

## UI

- `WeeklySummaryCard` (`src/components/progress/`): 7-day strip with report dots, the templated lines, stat chips, blockers (company), the assumptions, and "Automatic summary" labelling. Previous / next week buttons; next is disabled at the current week.
- Company: on the project overview (`project.read`), below the day cards.
- Homeowner: on the customer update screen, as "This week".

## Tests

- Window boundaries (first and last day in, day before/after out).
- **Audience isolation:** a draft, a submitted-not-published update, a private issue, private evidence, a blocker and a completed task are all present in state; the homeowner summary contains none of them in any field or line, while the company summary does.
- Counts per rule; confidence thresholds; empty week; unknown project; determinism.
- Navigation arithmetic for the week controls.
- Live check as business and homeowner users.

## Out of scope

LLM wording, stored/approved summaries, emailing or exporting the summary, and comparisons with previous weeks.
