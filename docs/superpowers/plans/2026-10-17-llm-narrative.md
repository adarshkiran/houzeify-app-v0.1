# LLM Narrative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a business user click "Rewrite with AI" on a Project Report or a company Weekly Summary and get Claude-written prose built only from computed, anonymised facts, with the rules text always available and the existing human approval unchanged.

**Architecture:** A pure facts builder (client) feeds a Supabase Edge Function (`narrate-report`) that authorizes and meters through two Postgres RPCs, calls Claude with a fixed prompt, and runs a deterministic output guard before returning text. All function logic lives in plain TypeScript modules under `supabase/functions/` that vitest tests with fakes; only `index.ts` and `anthropicModel.ts` touch Deno/the SDK. The UI keeps an AI draft in local state and embeds it in the existing `approve_project_report` payload only when the user chose it.

**Tech Stack:** TypeScript, vitest, React 19 + antd 6, Supabase (Postgres/pgTAP, Edge Functions on Deno 2), `@anthropic-ai/sdk` via `npm:` specifier in the function only.

**Spec:** `docs/superpowers/specs/2026-10-17-llm-narrative-design.md`

## Global Constraints

- The service-role key is never used by this feature, in the browser or in the function ("It bypasses RLS and is appropriate only for trusted server-side operations and controlled diagnostics").
- `ANTHROPIC_API_KEY` and `NARRATIVE_MODEL` exist only as Supabase function secrets / untracked `supabase/.env.local`. No key is committed, logged, sent to the browser, or echoed in chat.
- Only computed facts leave the system: no person names or ids, phone numbers, organization or customer names, task or issue titles, free text, or entity ids.
- Default model `claude-opus-5-5`, read from `NARRATIVE_MODEL`. Refusal fallbacks are enabled (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) per the Claude API guidance; tell the user it is on.
- No homeowner-visible AI text. Homeowner weekly summaries stay rules-only; only kinds `report` and `weekly-company` exist.
- AI text is never saved or shared without the existing approve step; the rules text is the fallback for every failure.
- Raises added to SQL use the `conflict:` / `permission:` prefixes (so `USER_FACING_RAISES` needs no change).
- Double quotes for strings containing apostrophes; default exports for React components; tests next to code as `*.test.ts`.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. PRs are opened before merging; the assistant never merges.
- Do not delete or alter `.claude/`, `Houzeify_Master_Plan_v0_2_FINAL.md`, or uncommitted/ignored files.

## Deviations from the spec (all deliberate, all stricter or more testable)

1. Function tests are vitest, not Deno (Deno is not installed here): logic is in DI modules; `index.ts` is verified by a local `supabase functions serve` smoke test (Task 8) and the live check (Task 12).
2. `consume_ai_narrative` / `refund_ai_narrative` take a **project id** and a **ticket** (not an organization id). Authorization is identical to `approve_project_report`; a ticket row per use replaces the counter table so a refund cannot be forged: a user can only refund a ticket they own, once, and ticket ids are never sent to the browser. Usage is the count of `consumed` ticket rows in the Kolkata calendar month.
3. Signals are sent as `{kind, severity}` only (the analyzer's `DelaySignal` carries no day count).
4. `ai_usage_events` replaces the spec's `ai_usage` table name.

## Delivery

Four PRs, each branched from `main` after the previous one is merged (the spec and this plan merge first as a docs PR):

| PR | Tasks | Branch |
|---|---|---|
| 1 | 1–4: facts, guard, prompt, service port + fake, domain fields | `feature/llm-narrative-core` |
| 2 | 5–6: migration, pgTAP, plan limits, seed | `feature/llm-narrative-metering` |
| 3 | 7–8: handler, Deno entry, config | `feature/llm-narrative-function` |
| 4 | 9–12: adapter, UI, approval, live verification | `feature/llm-narrative-ui` |

## File Structure

| File | Responsibility |
|---|---|
| `supabase/functions/_shared/narrative/types.ts` | Shared contract: facts, request/response, `Narrative`. No imports. |
| `supabase/functions/_shared/narrative/hash.ts` | `canonicalJson`, `hashFacts` (SHA-256 hex). |
| `supabase/functions/_shared/narrative/guard.ts` | `checkNarrative` output guard. Pure. |
| `supabase/functions/_shared/narrative/prompt.ts` | `SYSTEM_PROMPT`, `buildUserMessage`, `NARRATIVE_SCHEMA`. |
| `supabase/functions/_shared/narrative/testFacts.ts` | Sample facts used by tests. |
| `supabase/functions/narrate-report/handler.ts` | `handleRequest(req, deps)` — auth header, validation, metering, model call, guard, refund. No Deno globals. |
| `supabase/functions/narrate-report/index.ts` | Deno entry: wires real Supabase client + model. Not unit tested. |
| `supabase/functions/narrate-report/anthropicModel.ts` | `ModelClient` over the Anthropic SDK. Not unit tested. |
| `src/mock/narrativeFacts.ts` | `buildNarrativeFacts(report | weeklySummary)` allowlist builder. |
| `src/domain/narrative/service.ts` | `NarrativeService` port. |
| `src/domain/narrative/fake.ts` | Deterministic fake service for memory mode and tests. |
| `src/domain/narrative/messages.ts` | `narrativeErrorMessage(code)`. |
| `supabase/migrations/0031_ai_narrative_metering.sql` | `plans.limits`, `ai_usage_events`, consume/refund, `approve_project_report` narrative check. |
| `supabase/tests/0031_ai_narrative.sql` | pgTAP for the above. |
| `src/components/narrative/useNarrativeDraft.ts` | Draft + choice + staleness state. |
| `src/components/narrative/NarrativePanel.tsx` | Button, AI tag, toggle, summary rendering. |

---

## PR 1 — Core (no network, no schema)

### Task 1: Test wiring, shared types, hashing

**Files:**
- Modify: `vite.config.ts` (test include), `tsconfig.json` (include)
- Create: `supabase/functions/_shared/narrative/types.ts`, `supabase/functions/_shared/narrative/hash.ts`
- Test: `supabase/functions/_shared/narrative/hash.test.ts`

**Interfaces:**
- Produces (used by every later task): `NarrativeKind`, `ReportFacts`, `WeeklyFacts`, `NarrativeFacts`, `Narrative`, `NarrativeErrorCode`, `NarrativeRequest`, `NarrativeResponse`, `canonicalJson(value: unknown): string`, `hashFacts(facts: NarrativeFacts): Promise<string>`.

- [ ] **Step 1: Create the branch and extend test and type-check scope**

```bash
git checkout main && git pull && git checkout -b feature/llm-narrative-core
```

In `vite.config.ts` change the `test.include` line to:

```ts
      include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
```

In `tsconfig.json` change `include` to:

```json
  "include": ["src", "vite.config.ts", "supabase/functions/_shared", "supabase/functions/narrate-report/handler.ts"],
```

- [ ] **Step 2: Write the types**

Create `supabase/functions/_shared/narrative/types.ts`:

```ts
// The contract between the client, the edge function and the output guard.
// No imports: this file is shared by the browser bundle and the Deno function.

export type NarrativeKind = "report" | "weekly-company"

type Confidence = "low" | "medium" | "high"

/** Anonymised, computed facts about one project report. Nothing typed by a person. */
export interface ReportFacts {
  kind: "report"
  asOf: string
  status: "on-track" | "at-risk" | "behind" | "not-enough-data"
  confidence: Confidence
  overallPercent: number
  stages: {
    name: string
    percent: number
    baselinePercent: number
    dueByToday: number
    doneOfDue: number
  }[]
  plannedVsActual: {
    dueByToday: number
    doneOfDue: number
    expectedPercent?: number
    actualPercent: number
    variancePoints?: number
  }
  issues: {
    open: number
    bySeverity: Record<"low" | "medium" | "high" | "critical", number>
    byStatus: Record<"open" | "in-progress" | "resolved" | "closed", number>
    oldestSeriousAgeDays?: number
  }
  signals: { kind: string; severity: "medium" | "high" }[]
  daysSinceLastUpdate?: number
  assumptionCount: number
}

/** Anonymised, computed facts about one company-audience weekly summary. */
export interface WeeklyFacts {
  kind: "weekly-company"
  from: string
  to: string
  windowDays: number
  confidence: Confidence
  daysReported: number
  updates: number
  peakWorkers: number
  evidence: number
  issuesRaised: number
  issuesResolved: number
  issuesOpen: number
  tasksCompleted: number
  workerDays: number
  awaitingReview: number
  blockerCount: number
}

export type NarrativeFacts = ReportFacts | WeeklyFacts

/** AI-written prose plus the provenance a reviewer needs. */
export interface Narrative {
  text: string
  /** `claude:<model id>` for the real writer. */
  engine: string
  generatedAt: string
  /** SHA-256 hex of the canonical facts the text was written from. */
  factsHash: string
}

export type NarrativeErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not-included"
  | "limit-reached"
  | "unavailable"
  | "rejected"

export interface NarrativeRequest {
  /** The project's database uuid. */
  projectId: string
  kind: NarrativeKind
  facts: NarrativeFacts
}

export type NarrativeResponse = { narrative: Narrative } | { error: NarrativeErrorCode }
```

- [ ] **Step 3: Write the failing hash test**

Create `supabase/functions/_shared/narrative/hash.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { canonicalJson, hashFacts } from "./hash.ts"
import { sampleReportFacts } from "./testFacts.ts"

describe("canonicalJson", () => {
  it("sorts keys and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [2, { z: 1, y: 2 }] } })).toBe(
      '{"a":{"c":[2,{"y":2,"z":1}]},"b":1}',
    )
  })
})

describe("hashFacts", () => {
  it("is a stable 64-char hex digest regardless of key order", async () => {
    const facts = sampleReportFacts()
    const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(facts).reverse())))
    const hash = await hashFacts(facts)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashFacts(reordered)).toBe(hash)
  })

  it("changes when a fact changes", async () => {
    const facts = sampleReportFacts()
    expect(await hashFacts({ ...facts, overallPercent: facts.overallPercent + 1 })).not.toBe(await hashFacts(facts))
  })
})
```

Create `supabase/functions/_shared/narrative/testFacts.ts`:

```ts
import type { ReportFacts, WeeklyFacts } from "./types.ts"

export function sampleReportFacts(overrides: Partial<ReportFacts> = {}): ReportFacts {
  return {
    kind: "report",
    asOf: "2026-10-15",
    status: "at-risk",
    confidence: "medium",
    overallPercent: 42,
    stages: [
      { name: "Foundation", percent: 80, baselinePercent: 20, dueByToday: 5, doneOfDue: 4 },
      { name: "Brickwork", percent: 10, baselinePercent: 0, dueByToday: 3, doneOfDue: 1 },
    ],
    plannedVsActual: { dueByToday: 8, doneOfDue: 5, expectedPercent: 55, actualPercent: 42, variancePoints: 13 },
    issues: {
      open: 3,
      bySeverity: { low: 1, medium: 1, high: 1, critical: 0 },
      byStatus: { open: 2, "in-progress": 1, resolved: 4, closed: 0 },
      oldestSeriousAgeDays: 9,
    },
    signals: [
      { kind: "overdue-task", severity: "high" },
      { kind: "stale-updates", severity: "medium" },
    ],
    daysSinceLastUpdate: 4,
    assumptionCount: 2,
    ...overrides,
  }
}

export function sampleWeeklyFacts(overrides: Partial<WeeklyFacts> = {}): WeeklyFacts {
  return {
    kind: "weekly-company",
    from: "2026-10-10",
    to: "2026-10-16",
    windowDays: 7,
    confidence: "high",
    daysReported: 6,
    updates: 9,
    peakWorkers: 14,
    evidence: 12,
    issuesRaised: 2,
    issuesResolved: 1,
    issuesOpen: 3,
    tasksCompleted: 5,
    workerDays: 61,
    awaitingReview: 2,
    blockerCount: 1,
    ...overrides,
  }
}
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run supabase/functions/_shared/narrative/hash.test.ts`
Expected: FAIL (`./hash.ts` not found).

- [ ] **Step 5: Implement**

Create `supabase/functions/_shared/narrative/hash.ts`:

```ts
import type { NarrativeFacts } from "./types.ts"

/** JSON with sorted keys and no undefined members, so equal facts hash equally. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, member]) => member !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

export async function hashFacts(facts: NarrativeFacts): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(facts))
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
```

- [ ] **Step 6: Run to verify it passes, plus typecheck**

Run: `npx vitest run supabase/functions/_shared/narrative/hash.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts tsconfig.json supabase/functions/_shared/narrative
git commit -m "feat: narrative contract types and facts hashing

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 2: Facts builder (the privacy boundary)

**Files:**
- Create: `src/mock/narrativeFacts.ts`
- Test: `src/mock/narrativeFacts.test.ts`

**Interfaces:**
- Consumes: `ProjectReport` from `src/domain/projectAnalysis.ts`; `WeeklySummary` from `src/mock/weeklySummary.ts`; `NarrativeFacts` from Task 1.
- Produces: `buildNarrativeFacts(input: ProjectReport | WeeklySummary): NarrativeFacts | undefined` (undefined for a homeowner-audience weekly summary).

- [ ] **Step 1: Write the failing test**

Create `src/mock/narrativeFacts.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { analyzeProject } from "../domain/projectAnalysis"
import { seedConstructionData as seed } from "./seed"
import { buildNarrativeFacts } from "./narrativeFacts"
import { summarizeWeek } from "./weeklySummary"

const TODAY = "2026-10-15"

describe("buildNarrativeFacts", () => {
  const report = analyzeProject(seed, "project-sharma", TODAY, "2026-10-15T09:00:00.000Z")!

  it("builds report facts from the analyzer output", () => {
    const facts = buildNarrativeFacts(report)
    expect(facts).toMatchObject({
      kind: "report",
      asOf: TODAY,
      status: report.status,
      overallPercent: report.progress.overall,
      confidence: report.confidence,
      assumptionCount: report.assumptions.length,
    })
    expect(facts?.kind === "report" && facts.signals).toEqual(
      report.signals.map((s) => ({ kind: s.kind, severity: s.severity })),
    )
  })

  it("never carries names, titles, ids, messages or free text", () => {
    const poisoned = structuredClone(report)
    poisoned.signals = poisoned.signals.map((s) => ({
      ...s,
      message: "Ravi Kumar +919876543210 is late",
      taskId: "task-secret-id",
      issueId: "issue-secret-id",
      stageId: "stage-secret-id",
    }))
    poisoned.summary = ["Ravi Kumar said call +919876543210"]
    poisoned.assumptions = ["Contact priya@example.com"]
    poisoned.issues.oldestSerious = { issueId: "issue-secret-id", title: "Leak at Sharma house", ageDays: 9 }
    const text = JSON.stringify(buildNarrativeFacts(poisoned))
    for (const leak of ["Ravi", "Kumar", "9876543210", "priya", "secret-id", "Leak at", "Sharma house", "message"]) {
      expect(text).not.toContain(leak)
    }
    expect(text).toContain('"oldestSeriousAgeDays":9')
  })

  it("builds company weekly facts and refuses the homeowner audience", () => {
    const company = summarizeWeek(seed, "project-sharma", TODAY, { audience: "company", today: TODAY })!
    const facts = buildNarrativeFacts(company)
    expect(facts).toMatchObject({
      kind: "weekly-company",
      from: company.from,
      to: company.to,
      windowDays: 7,
      updates: company.totals.updates,
      blockerCount: company.blockers?.length ?? 0,
    })
    const text = JSON.stringify(facts)
    for (const note of company.days.flatMap((d) => d.notes)) expect(text).not.toContain(note)

    const homeowner = summarizeWeek(seed, "project-sharma", TODAY, { audience: "homeowner", today: TODAY })!
    expect(buildNarrativeFacts(homeowner)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/mock/narrativeFacts.test.ts`
Expected: FAIL (`./narrativeFacts` not found).

- [ ] **Step 3: Implement**

Create `src/mock/narrativeFacts.ts`:

```ts
import type { ProjectReport } from "../domain/projectAnalysis"
import type {
  NarrativeFacts,
  ReportFacts,
  WeeklyFacts,
} from "../../supabase/functions/_shared/narrative/types"
import { SUMMARY_WINDOW_DAYS, type WeeklySummary } from "./weeklySummary"

// The privacy boundary for the LLM narrative (spec §2). Every field is copied
// explicitly: anything not listed here is never sent. Do not spread inputs.

const oneDecimal = (value: number) => Math.round(value * 10) / 10

function reportFacts(report: ProjectReport): ReportFacts {
  const { plannedVsActual, issues, progress } = report
  return {
    kind: "report",
    asOf: report.asOf,
    status: report.status,
    confidence: report.confidence,
    overallPercent: oneDecimal(progress.overall),
    stages: progress.stages.map((stage) => ({
      name: stage.name,
      percent: oneDecimal(stage.percent),
      baselinePercent: oneDecimal(stage.baseline),
      dueByToday: stage.dueByToday,
      doneOfDue: stage.doneOfDue,
    })),
    plannedVsActual: {
      dueByToday: plannedVsActual.dueByToday,
      doneOfDue: plannedVsActual.doneOfDue,
      expectedPercent: plannedVsActual.expectedPercent === undefined ? undefined : oneDecimal(plannedVsActual.expectedPercent),
      actualPercent: oneDecimal(plannedVsActual.actualPercent),
      variancePoints: plannedVsActual.variancePoints === undefined ? undefined : oneDecimal(plannedVsActual.variancePoints),
    },
    issues: {
      open: issues.open,
      bySeverity: {
        low: issues.bySeverity.low,
        medium: issues.bySeverity.medium,
        high: issues.bySeverity.high,
        critical: issues.bySeverity.critical,
      },
      byStatus: {
        open: issues.byStatus.open,
        "in-progress": issues.byStatus["in-progress"],
        resolved: issues.byStatus.resolved,
        closed: issues.byStatus.closed,
      },
      oldestSeriousAgeDays: issues.oldestSerious?.ageDays,
    },
    signals: report.signals.map((signal) => ({ kind: signal.kind, severity: signal.severity })),
    daysSinceLastUpdate: progress.daysSinceLastUpdate,
    assumptionCount: report.assumptions.length,
  }
}

function weeklyFacts(summary: WeeklySummary): WeeklyFacts {
  const { totals } = summary
  return {
    kind: "weekly-company",
    from: summary.from,
    to: summary.to,
    windowDays: SUMMARY_WINDOW_DAYS,
    confidence: summary.confidence,
    daysReported: totals.daysReported,
    updates: totals.updates,
    peakWorkers: totals.peakWorkers,
    evidence: totals.evidence,
    issuesRaised: totals.issuesRaised,
    issuesResolved: totals.issuesResolved,
    issuesOpen: totals.issuesOpen,
    tasksCompleted: totals.tasksCompleted ?? 0,
    workerDays: totals.workerDays ?? 0,
    awaitingReview: totals.awaitingReview ?? 0,
    blockerCount: summary.blockers?.length ?? 0,
  }
}

/** Anonymised facts for the narrative writer; undefined where AI text is not allowed (homeowner audience). */
export function buildNarrativeFacts(input: ProjectReport | WeeklySummary): NarrativeFacts | undefined {
  if ("signals" in input) return reportFacts(input)
  return input.audience === "company" ? weeklyFacts(input) : undefined
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/mock/narrativeFacts.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mock/narrativeFacts.ts src/mock/narrativeFacts.test.ts
git commit -m "feat: anonymised narrative facts builder

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 3: Output guard

**Files:**
- Create: `supabase/functions/_shared/narrative/guard.ts`
- Test: `supabase/functions/_shared/narrative/guard.test.ts`

**Interfaces:**
- Consumes: `NarrativeFacts` (Task 1), `sampleReportFacts` / `sampleWeeklyFacts` (Task 1).
- Produces: `checkNarrative(paragraphs: unknown, facts: NarrativeFacts): GuardResult` where `GuardResult = { ok: true; text: string } | { ok: false; reason: "shape" | "too-long" | "link" | "number" | "name" }`; constants `MAX_PARAGRAPHS = 4`, `MAX_CHARS = 1200`.

Rules (spec §4): reject any digit run not in the facts' number set (every numeric fact, its rounded integer, array lengths, and year/month/day of any `YYYY-MM-DD` string); reject word-numbers two–ten whose value is not in the set (one and zero are exempt, being ordinary words); reject capitalised words that are not sentence-initial and not stage-name words, month/weekday names, or `AI`/`Hozie`/`Houzeify`; reject URLs, emails and phone-like runs; enforce 1–4 non-empty paragraphs and a total length cap.

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/_shared/narrative/guard.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { checkNarrative, MAX_CHARS } from "./guard.ts"
import { sampleReportFacts, sampleWeeklyFacts } from "./testFacts.ts"

const facts = sampleReportFacts()

describe("checkNarrative accepts faithful prose", () => {
  it("joins paragraphs and passes numbers that are in the facts", () => {
    const result = checkNarrative(
      [
        "The project is at risk. Overall progress is 42 percent against an expected 55 percent, a gap of 13 points.",
        "Foundation is 80 percent complete while Brickwork is at 10 percent. Three issues are open and two delay signals need attention. The last update was 4 days ago.",
      ],
      facts,
    )
    expect(result).toEqual({
      ok: true,
      text: expect.stringContaining("Overall progress is 42 percent"),
    })
  })

  it("accepts an ISO date and does not mistake it for a phone number", () => {
    expect(checkNarrative(["The project is at risk as of 2026-10-15 with 42 percent done."], facts).ok).toBe(true)
  })

  it("accepts a date written with a month name", () => {
    expect(checkNarrative(["As of 15 October the project is at risk with 42 percent done."], facts).ok).toBe(true)
  })

  it("accepts a rounded form of a decimal fact", () => {
    const decimal = sampleReportFacts({ overallPercent: 41.6 })
    expect(checkNarrative(["Overall progress is about 42 percent."], decimal).ok).toBe(true)
  })

  it("accepts weekly prose using the window length", () => {
    expect(
      checkNarrative(["Over the past 7 days, 9 updates were filed and 5 tasks were completed."], sampleWeeklyFacts()).ok,
    ).toBe(true)
  })
})

describe("checkNarrative rejects", () => {
  it("a number that is not in the facts", () => {
    expect(checkNarrative(["Overall progress is 43 percent."], facts)).toEqual({ ok: false, reason: "number" })
  })

  it("a spelled-out number that is not in the facts", () => {
    expect(checkNarrative(["Seven issues are open."], facts)).toEqual({ ok: false, reason: "number" })
  })

  it("an invented name", () => {
    expect(checkNarrative(["The project is at risk. Contact Ramesh about the delay."], facts)).toEqual({
      ok: false,
      reason: "name",
    })
  })

  it("links, emails and phone-like numbers", () => {
    for (const text of ["See https://example.com for more.", "Write to a@b.co soon.", "Call 98765 43210 now."]) {
      const result = checkNarrative([text], facts)
      expect(result.ok).toBe(false)
    }
  })

  it("the wrong shape", () => {
    for (const bad of [undefined, "text", [], [""], ["a", "b", "c", "d", "e"], [1], ["  "]]) {
      expect(checkNarrative(bad, facts)).toEqual({ ok: false, reason: "shape" })
    }
  })

  it("text over the length cap", () => {
    expect(checkNarrative(["The project is at risk. ".repeat(Math.ceil(MAX_CHARS / 20))], facts)).toEqual({
      ok: false,
      reason: "too-long",
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run supabase/functions/_shared/narrative/guard.test.ts`
Expected: FAIL (`./guard.ts` not found).

- [ ] **Step 3: Implement**

Create `supabase/functions/_shared/narrative/guard.ts`:

```ts
import type { NarrativeFacts } from "./types.ts"

// Deterministic accuracy check on model output (spec §4). Conservative on
// purpose: a false reject costs one refunded click; a false accept puts an
// invented figure in a report.

export const MAX_PARAGRAPHS = 4
export const MAX_CHARS = 1200

export type GuardResult =
  | { ok: true; text: string }
  | { ok: false; reason: "shape" | "too-long" | "link" | "number" | "name" }

const WORD_NUMBERS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const FIXED_WORDS = ["AI", "Hozie", "Houzeify", ...MONTHS, ...WEEKDAYS].map((word) => word.toLowerCase())

const norm = (value: number) => Number(value.toFixed(6))

function collectNumbers(value: unknown, into: Set<number>): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    into.add(norm(value))
    into.add(norm(Math.round(value)))
  } else if (typeof value === "string") {
    const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    if (date) for (const part of date.slice(1)) into.add(Number(part))
  } else if (Array.isArray(value)) {
    into.add(value.length)
    for (const member of value) collectNumbers(member, into)
  } else if (value && typeof value === "object") {
    for (const member of Object.values(value)) collectNumbers(member, into)
  }
}

function allowedWords(facts: NarrativeFacts): Set<string> {
  const words = new Set(FIXED_WORDS)
  if (facts.kind === "report") {
    for (const stage of facts.stages) {
      for (const word of stage.name.split(/[^A-Za-z]+/)) if (word) words.add(word.toLowerCase())
    }
  }
  return words
}

export function checkNarrative(paragraphs: unknown, facts: NarrativeFacts): GuardResult {
  if (
    !Array.isArray(paragraphs) ||
    paragraphs.length < 1 ||
    paragraphs.length > MAX_PARAGRAPHS ||
    paragraphs.some((p) => typeof p !== "string" || !p.trim())
  ) {
    return { ok: false, reason: "shape" }
  }
  const text = (paragraphs as string[]).map((p) => p.trim()).join("\n\n")
  if (text.length > MAX_CHARS) return { ok: false, reason: "too-long" }

  // ISO dates (2026-10-15) are legitimate; remove them before looking for phone-like digit runs.
  const withoutDates = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
  if (/(https?:\/\/|www\.|\S+@\S+\.\S+)/i.test(text) || /\+?\d(?:[\s().-]?\d){7,}/.test(withoutDates)) {
    return { ok: false, reason: "link" }
  }

  const allowedNumbers = new Set<number>()
  collectNumbers(facts, allowedNumbers)
  for (const match of text.matchAll(/\d+(?:\.\d+)?/g)) {
    if (!allowedNumbers.has(norm(Number(match[0])))) return { ok: false, reason: "number" }
  }
  for (const match of text.matchAll(/\b[A-Za-z]+\b/g)) {
    const value = WORD_NUMBERS[match[0].toLowerCase()]
    if (value !== undefined && !allowedNumbers.has(value)) return { ok: false, reason: "number" }
  }

  const words = allowedWords(facts)
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const tokens = [...sentence.matchAll(/[A-Za-z][A-Za-z'-]*/g)].map((m) => m[0])
    for (const token of tokens.slice(1)) {
      if (token.length > 1 && /^[A-Z]/.test(token) && !words.has(token.toLowerCase())) {
        return { ok: false, reason: "name" }
      }
    }
  }

  return { ok: true, text }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run supabase/functions/_shared/narrative/guard.test.ts && npm run typecheck`
Expected: PASS. If an accepted-prose case fails because of a capitalised word in the sentence, fix the test sentence, not the rule.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/narrative/guard.ts supabase/functions/_shared/narrative/guard.test.ts
git commit -m "feat: deterministic narrative output guard

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 4: Prompt, service port, fake service, domain fields, messages

**Files:**
- Create: `supabase/functions/_shared/narrative/prompt.ts`, `src/domain/narrative/service.ts`, `src/domain/narrative/fake.ts`, `src/domain/narrative/messages.ts`
- Modify: `src/domain/models.ts` (re-export `Narrative`), `src/domain/projectAnalysis.ts` (add `narrative?` to `ProjectReport`), `src/mock/weeklySummary.ts` (add `narrative?` to `WeeklySummary`)
- Test: `src/domain/narrative/fake.test.ts`, `src/domain/narrative/messages.test.ts`, `supabase/functions/_shared/narrative/prompt.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 exports.
- Produces: `SYSTEM_PROMPT: string`, `buildUserMessage(facts): string`, `NARRATIVE_SCHEMA: object`; `interface NarrativeService { narrate(request: NarrativeRequest): Promise<NarrativeResponse> }`; `createFakeNarrativeService(options?: { now?: () => string; failWith?: NarrativeErrorCode }): NarrativeService`; `narrativeErrorMessage(code: NarrativeErrorCode): string`; `Narrative` exported from `src/domain/models.ts`.

- [ ] **Step 1: Write failing tests**

Create `supabase/functions/_shared/narrative/prompt.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { NARRATIVE_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from "./prompt.ts"
import { sampleReportFacts } from "./testFacts.ts"

describe("narrative prompt", () => {
  it("states the hard rules", () => {
    for (const rule of ["only the facts", "No names", "exactly as given", "not enough data"]) {
      expect(SYSTEM_PROMPT.toLowerCase()).toContain(rule.toLowerCase())
    }
  })

  it("puts the facts in the user message as canonical JSON", () => {
    const message = buildUserMessage(sampleReportFacts())
    expect(message).toContain('"overallPercent":42')
    expect(message.indexOf('"asOf"')).toBeLessThan(message.indexOf('"status"'))
  })

  it("asks for a paragraphs array", () => {
    expect(NARRATIVE_SCHEMA).toMatchObject({ required: ["paragraphs"], additionalProperties: false })
  })
})
```

Create `src/domain/narrative/fake.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { sampleReportFacts, sampleWeeklyFacts } from "../../../supabase/functions/_shared/narrative/testFacts"
import { checkNarrative } from "../../../supabase/functions/_shared/narrative/guard"
import { hashFacts } from "../../../supabase/functions/_shared/narrative/hash"
import { createFakeNarrativeService } from "./fake"

const now = () => "2026-10-17T09:00:00.000Z"

describe("fake narrative service", () => {
  it("writes guard-clean, labelled, hashed prose for a report", async () => {
    const facts = sampleReportFacts()
    const result = await createFakeNarrativeService({ now }).narrate({ projectId: "p", kind: "report", facts })
    if (!("narrative" in result)) throw new Error("expected a narrative")
    expect(result.narrative).toEqual({
      text: expect.any(String),
      engine: "claude:fake",
      generatedAt: now(),
      factsHash: await hashFacts(facts),
    })
    expect(checkNarrative(result.narrative.text.split("\n\n"), facts).ok).toBe(true)
  })

  it("writes guard-clean prose for a weekly summary", async () => {
    const facts = sampleWeeklyFacts()
    const result = await createFakeNarrativeService({ now }).narrate({ projectId: "p", kind: "weekly-company", facts })
    if (!("narrative" in result)) throw new Error("expected a narrative")
    expect(checkNarrative(result.narrative.text.split("\n\n"), facts).ok).toBe(true)
  })

  it("can be told to fail", async () => {
    const result = await createFakeNarrativeService({ failWith: "limit-reached" }).narrate({
      projectId: "p",
      kind: "report",
      facts: sampleReportFacts(),
    })
    expect(result).toEqual({ error: "limit-reached" })
  })
})
```

Create `src/domain/narrative/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { NarrativeErrorCode } from "../../../supabase/functions/_shared/narrative/types"
import { narrativeErrorMessage } from "./messages"

describe("narrativeErrorMessage", () => {
  it("has fixed, user-facing text for every code", () => {
    const codes: NarrativeErrorCode[] = ["unauthorized", "forbidden", "not-included", "limit-reached", "unavailable", "rejected"]
    for (const code of codes) {
      const message = narrativeErrorMessage(code)
      expect(message.length).toBeGreaterThan(10)
      expect(message).not.toMatch(/error|exception|\bnull\b|undefined/i)
    }
    expect(narrativeErrorMessage("limit-reached")).toContain("this month")
    expect(narrativeErrorMessage("rejected")).toContain("standard summary")
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run supabase/functions/_shared/narrative/prompt.test.ts src/domain/narrative`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the prompt**

Create `supabase/functions/_shared/narrative/prompt.ts`:

```ts
import { canonicalJson } from "./hash.ts"
import type { NarrativeFacts } from "./types.ts"

export const SYSTEM_PROMPT = `You write the management summary of a construction project for a site manager or project manager in plain, direct English.

Rules:
- Use only the facts in the user message. Do not add anything you were not given.
- Quote every number exactly as given. Never calculate, round, estimate or combine numbers into new ones.
- No names of people, companies or places. Refer to roles generically (for example "the site team").
- Do not speculate about causes and do not give legal or financial advice.
- Where a fact is missing, say there is not enough data for it rather than guessing.
- Describe each delay signal generically from its kind and severity.
- No links, email addresses or phone numbers.
- Write two or three short paragraphs: first the overall position, then what is behind or at risk, then what needs attention. Keep the whole summary under 150 words.`

export function buildUserMessage(facts: NarrativeFacts): string {
  return `Write the summary from these facts only.\n\n${canonicalJson(facts)}`
}

export const NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    paragraphs: { type: "array", items: { type: "string" } },
  },
  required: ["paragraphs"],
  additionalProperties: false,
} as const
```

- [ ] **Step 4: Implement the port, fake and messages**

Create `src/domain/narrative/service.ts`:

```ts
import type { NarrativeRequest, NarrativeResponse } from "../../../supabase/functions/_shared/narrative/types"

/**
 * Writes the prose for a report or weekly summary from anonymised facts. The
 * memory-mode implementation is the fake; Supabase mode calls the edge function.
 */
export interface NarrativeService {
  narrate(request: NarrativeRequest): Promise<NarrativeResponse>
}
```

Create `src/domain/narrative/messages.ts`:

```ts
import type { NarrativeErrorCode } from "../../../supabase/functions/_shared/narrative/types"

const MESSAGES: Record<NarrativeErrorCode, string> = {
  unauthorized: "Please sign in again to use AI summaries.",
  forbidden: "You don't have permission to write AI summaries for this project.",
  "not-included": "AI summaries aren't included in your plan.",
  "limit-reached": "You've used all your AI summaries this month. The standard summary is shown.",
  unavailable: "The AI writer isn't available right now. The standard summary is shown.",
  rejected: "The AI text didn't pass our accuracy check. The standard summary is shown.",
}

export function narrativeErrorMessage(code: NarrativeErrorCode): string {
  return MESSAGES[code]
}
```

Create `src/domain/narrative/fake.ts`:

```ts
import { checkNarrative } from "../../../supabase/functions/_shared/narrative/guard"
import { hashFacts } from "../../../supabase/functions/_shared/narrative/hash"
import type {
  NarrativeErrorCode,
  NarrativeFacts,
  NarrativeResponse,
} from "../../../supabase/functions/_shared/narrative/types"
import type { NarrativeService } from "./service"

const STATUS_WORDS = {
  "on-track": "on track",
  "at-risk": "at risk",
  behind: "behind schedule",
  "not-enough-data": "short of data",
} as const

function paragraphsFor(facts: NarrativeFacts): string[] {
  if (facts.kind === "report") {
    return [
      `The project is ${STATUS_WORDS[facts.status]}, with overall progress at ${facts.overallPercent} percent as of ${facts.asOf}.`,
      `${facts.issues.open} issues are open and ${facts.signals.length} delay signals were raised.`,
    ]
  }
  return [
    `Over the past ${facts.windowDays} days there were ${facts.updates} updates across ${facts.daysReported} days, with up to ${facts.peakWorkers} workers on site.`,
    `${facts.tasksCompleted} tasks were completed and ${facts.issuesOpen} issues remain open.`,
  ]
}

/** Deterministic stand-in for the model: offline, free, and always guard-clean. */
export function createFakeNarrativeService(
  options: { now?: () => string; failWith?: NarrativeErrorCode } = {},
): NarrativeService {
  const now = options.now ?? (() => new Date().toISOString())
  return {
    async narrate({ facts }): Promise<NarrativeResponse> {
      if (options.failWith) return { error: options.failWith }
      const checked = checkNarrative(paragraphsFor(facts), facts)
      if (!checked.ok) return { error: "rejected" }
      return {
        narrative: {
          text: checked.text,
          engine: "claude:fake",
          generatedAt: now(),
          factsHash: await hashFacts(facts),
        },
      }
    },
  }
}
```

- [ ] **Step 5: Add the optional `narrative` fields**

In `src/domain/models.ts`, next to `SavedProjectReport`, add:

```ts
export type { Narrative } from "../../supabase/functions/_shared/narrative/types"
```

In `src/domain/projectAnalysis.ts`, add `Narrative` to the existing `import type { ... } from "./models"` list and add this field to `ProjectReport` after `generatedAt: ISODateTime`:

```ts
  /** AI-written prose the reviewer chose to keep with this report; absent for the rules summary. */
  narrative?: Narrative
```

In `src/mock/weeklySummary.ts`, add `Narrative` to the existing `import type { ... } from "../domain/models"` list and add to `WeeklySummary` after `generatedAt: ISODateTime`:

```ts
  /** Present only when a company user rewrote the summary with AI; never set by summarizeWeek. */
  narrative?: Narrative
```

- [ ] **Step 6: Run the whole suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS (the new optional fields do not affect existing deep-equality tests, which never set `narrative`).

- [ ] **Step 7: Commit and open PR 1**

```bash
git add -A supabase/functions src
git commit -m "feat: narrative prompt, service port and fake, optional narrative fields

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin feature/llm-narrative-core
gh pr create --base main --title "feat: LLM narrative core (facts, guard, prompt, fake service)" --body "Part 1 of 4 of docs/superpowers/specs/2026-10-17-llm-narrative-design.md. Pure code and tests only: no network, no schema.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Then check CI with `gh pr view --json statusCheckRollup` (no polling). Do not merge.

---

## PR 2 — Metering (schema)

### Task 5: Migration and pgTAP

**Files:**
- Create: `supabase/migrations/0031_ai_narrative_metering.sql`, `supabase/tests/0031_ai_narrative.sql`

**Interfaces:**
- Produces (used by Tasks 6, 7, 9): `plans.limits jsonb`; table `ai_usage_events`; `public.consume_ai_narrative(project_id uuid, kind text) returns uuid` (the ticket); `public.refund_ai_narrative(ticket uuid) returns boolean`; `approve_project_report` additionally validating `payload.narrative`. Error texts: `permission:Missing permission "project.manage" on project <id>`, `conflict:AI summaries are not included in your plan.`, `conflict:You have used all AI summaries for this month.`, `conflict:That summary could not be written.`, `conflict:That project no longer exists.`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b feature/llm-narrative-metering
```

- [ ] **Step 2: Write the failing pgTAP test**

Create `supabase/tests/0031_ai_narrative.sql`:

```sql
begin;
select plan(22);

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000031a1', 'org-t31', 'Org T31', 'construction-company'),
  ('00000000-0000-0000-0000-0000000031a2', 'org-t31-free', 'Free Org T31', 'construction-company');

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000031f1', 'proj-t31', '00000000-0000-0000-0000-0000000031a1', 'Project T31', 'active'),
  ('00000000-0000-0000-0000-0000000031f2', 'proj-t31-free', '00000000-0000-0000-0000-0000000031a2', 'Free Project T31', 'active');

insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000031d1', 'person-t31-manager', '+6598031001', 'Manager T31', null),
  ('00000000-0000-0000-0000-0000000031d2', 'person-t31-reader', '+6598031002', 'Reader T31', null),
  ('00000000-0000-0000-0000-0000000031d3', 'person-t31-free-manager', '+6598031003', 'Free Manager T31', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000031e1'), ('00000000-0000-0000-0000-0000000031e2'),
  ('00000000-0000-0000-0000-0000000031e3');
update people set auth_user_id = '00000000-0000-0000-0000-0000000031e1' where id = '00000000-0000-0000-0000-0000000031d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000031e2' where id = '00000000-0000-0000-0000-0000000031d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000031e3' where id = '00000000-0000-0000-0000-0000000031d3';

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope) values
  ('00000000-0000-0000-0000-0000000031b1', 'm-t31-manager', '00000000-0000-0000-0000-0000000031d1', '00000000-0000-0000-0000-0000000031a1',
   '00000000-0000-0000-0000-0000000031f1', 'project-manager', array['project.read', 'project.manage'], '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000031b2', 'm-t31-reader', '00000000-0000-0000-0000-0000000031d2', '00000000-0000-0000-0000-0000000031a1',
   '00000000-0000-0000-0000-0000000031f1', 'supervisor', array['project.read'], '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000031b3', 'm-t31-free', '00000000-0000-0000-0000-0000000031d3', '00000000-0000-0000-0000-0000000031a2',
   '00000000-0000-0000-0000-0000000031f2', 'project-manager', array['project.read', 'project.manage'], '{}'::jsonb);

-- Org 1 has AI with a cap of 2; org 2 has a plan without the entitlement.
insert into plans (id, legacy_id, name, price_label, entitlements, monthly_credits, limits) values
  ('00000000-0000-0000-0000-0000000031c1', 'plan-t31-ai', 'AI Plan T31', '₹1', array['ai.narrative'], 0, '{"ai_narratives_per_month": 2}'::jsonb),
  ('00000000-0000-0000-0000-0000000031c2', 'plan-t31-plain', 'Plain Plan T31', '₹1', array['marketplace.unlock'], 0, '{}'::jsonb);
insert into subscriptions (id, legacy_id, organization_id, plan_id, status, started_at) values
  ('00000000-0000-0000-0000-0000000031c3', 'sub-t31', '00000000-0000-0000-0000-0000000031a1', '00000000-0000-0000-0000-0000000031c1', 'active', now()),
  ('00000000-0000-0000-0000-0000000031c4', 'sub-t31-free', '00000000-0000-0000-0000-0000000031a2', '00000000-0000-0000-0000-0000000031c2', 'active', now());

create temp table t31_tickets (n int primary key, id uuid);
grant all on t31_tickets to authenticated;

select has_table('public', 'ai_usage_events', 'ai_usage_events exists');
select has_column('public', 'plans', 'limits', 'plans.limits exists');
select has_function('public', 'consume_ai_narrative', array['uuid', 'text'], 'consume_ai_narrative exists');
select is_definer('public', 'consume_ai_narrative', array['uuid', 'text'], 'consume_ai_narrative is security definer');
select is_definer('public', 'refund_ai_narrative', array['uuid'], 'refund_ai_narrative is security definer');

-- Refusals
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e2"}', true);
select throws_ok(
  $$select public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f1', 'report')$$,
  'P0001', 'permission:Missing permission "project.manage" on project 00000000-0000-0000-0000-0000000031f1',
  'a member without project.manage cannot consume');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e1"}', true);
select throws_ok(
  $$select public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f2', 'report')$$,
  'P0001', 'permission:Missing permission "project.manage" on project 00000000-0000-0000-0000-0000000031f2',
  'a manager of another organization cannot consume');
select throws_ok(
  $$select public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f1', 'chat')$$,
  'P0001', 'conflict:That summary could not be written.', 'an unknown kind is refused');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e3"}', true);
select throws_ok(
  $$select public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f2', 'report')$$,
  'P0001', 'conflict:AI summaries are not included in your plan.', 'a plan without the entitlement is refused');
select is((select count(*)::int from ai_usage_events), 0, 'refusals wrote nothing');

-- The cap
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e1"}', true);
insert into t31_tickets select 1, public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f1', 'report');
insert into t31_tickets select 2, public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f1', 'weekly-company');
select is((select count(*)::int from ai_usage_events where status = 'consumed'), 2, 'two uses are consumed');
select throws_ok(
  $$select public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f1', 'report')$$,
  'P0001', 'conflict:You have used all AI summaries for this month.', 'the third use is over the cap');

-- Refunds: only the owner, only once, and the unit comes back
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e2"}', true);
select is(public.refund_ai_narrative((select id from t31_tickets where n = 1)), false, 'someone else cannot refund a ticket');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e1"}', true);
select is(public.refund_ai_narrative((select id from t31_tickets where n = 1)), true, 'the owner refunds a ticket');
select is(public.refund_ai_narrative((select id from t31_tickets where n = 1)), false, 'a ticket refunds only once');
select lives_ok(
  $$select public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f1', 'report')$$,
  'a refunded unit can be used again');

-- Usage rows are not readable or writable by clients
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000031e1"}';
create temp table t31_probe (n bigint);
grant all on t31_probe to authenticated;
insert into t31_probe select count(*) from ai_usage_events;
reset role;
select is((select n from t31_probe), 0::bigint, 'a client reads no usage rows directly');

-- approve_project_report validates an embedded narrative
create temp table t31_payload as
select jsonb_build_object(
  'projectId', '00000000-0000-0000-0000-0000000031f1', 'asOf', '2026-10-15', 'status', 'at-risk',
  'summary', jsonb_build_array('At risk.'), 'signals', '[]'::jsonb, 'source', 'ai', 'createdBy', 'ai',
  'engine', 'rules-v1', 'confidence', 'medium', 'assumptions', '[]'::jsonb, 'reviewStatus', 'draft',
  'generatedAt', '2026-10-15T09:00:00.000Z'
) as p;
grant select on t31_payload to authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e1"}', true);
select throws_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000031f1', (select p || '{"narrative": {"text": "x", "engine": "gpt-x", "generatedAt": "2026-10-15T09:00:00Z", "factsHash": "0000000000000000000000000000000000000000000000000000000000000000"}}'::jsonb from t31_payload))$$,
  'P0001', 'conflict:That report could not be saved.', 'a narrative from an unknown engine is refused');
select throws_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000031f1', (select p || '{"narrative": {"text": "x", "engine": "claude:claude-opus-5-5", "generatedAt": "2026-10-15T09:00:00Z", "factsHash": "short"}}'::jsonb from t31_payload))$$,
  'P0001', 'conflict:That report could not be saved.', 'a narrative without a valid facts hash is refused');
select lives_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000031f1', (select p || '{"narrative": {"text": "The project is at risk.", "engine": "claude:claude-opus-5-5", "generatedAt": "2026-10-15T09:00:00Z", "factsHash": "0000000000000000000000000000000000000000000000000000000000000000"}}'::jsonb from t31_payload))$$,
  'a report with a well-formed narrative is approved');
select is(
  (select payload->'narrative'->>'engine' from project_reports where project_id = '00000000-0000-0000-0000-0000000031f1'),
  'claude:claude-opus-5-5', 'the stored snapshot carries the narrative and its engine');
select is(
  (select payload->>'reviewStatus' from project_reports where project_id = '00000000-0000-0000-0000-0000000031f1'),
  'approved', 'and is marked approved');

select * from finish();
rollback;
```

Plan count check: 5 structure + 3 refusals (reader, other org, bad kind) + 1 no-entitlement + 1 "wrote nothing" + 1 consumed count + 1 over-cap + 3 refund + 1 reuse + 1 probe + 3 approve (two throws, one lives) + 2 snapshot = 22. Keep `plan(22)`.

- [ ] **Step 3: Run to verify it fails**

Run: `npm run db:test`
Expected: `0031_ai_narrative.sql` fails (relations/functions missing).

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/0031_ai_narrative_metering.sql`:

```sql
-- LLM narrative metering (docs/superpowers/specs/2026-10-17-llm-narrative-design.md, §5).
-- Plan entitlements are boolean keys (text[]); numeric caps live in plans.limits.
-- Each use is a ticket row so a refund cannot be forged: only the person who
-- consumed a ticket can refund it, once. Ticket ids are never sent to clients.

alter table plans add column limits jsonb not null default '{}'::jsonb;
alter table plans add constraint plans_limits_object_check check (jsonb_typeof(limits) = 'object');

create table ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  person_id uuid not null references people (id) on delete restrict,
  kind text not null,
  period date not null,
  status text not null default 'consumed',
  created_at timestamptz not null default now(),
  refunded_at timestamptz,
  constraint ai_usage_events_kind_check check (kind in ('report', 'weekly-company')),
  constraint ai_usage_events_status_check check (status in ('consumed', 'refunded'))
);

create index ai_usage_events_org_period_idx on ai_usage_events (organization_id, period, status);

-- Written and read only by the security-definer functions below.
alter table ai_usage_events enable row level security;

create or replace function public.consume_ai_narrative(project_id uuid, kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := public.current_person_id();
  org uuid;
  cap integer;
  used integer;
  this_period date := (date_trunc('month', now() at time zone 'Asia/Kolkata'))::date;
  ticket uuid;
begin
  if caller is null
     or not (
       public.has_permission(consume_ai_narrative.project_id, 'project.manage')
       and public.in_scope(consume_ai_narrative.project_id, null, null, null)
     ) then
    raise exception 'permission:Missing permission "project.manage" on project %', consume_ai_narrative.project_id;
  end if;

  if consume_ai_narrative.kind is null or consume_ai_narrative.kind not in ('report', 'weekly-company') then
    raise exception 'conflict:That summary could not be written.';
  end if;

  select p.organization_id into org from projects p where p.id = consume_ai_narrative.project_id;
  if org is null then
    raise exception 'conflict:That project no longer exists.';
  end if;

  if not public.has_entitlement(org, 'ai.narrative') then
    raise exception 'conflict:AI summaries are not included in your plan.';
  end if;

  -- Serialise concurrent uses for one organization so the cap cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended('ai_narrative:' || org::text, 0));

  select coalesce((pl.limits ->> 'ai_narratives_per_month')::integer, 0)
    into cap
  from subscriptions s
  join plans pl on pl.id = s.plan_id
  where s.organization_id = org and s.status = 'active'
  limit 1;

  select count(*)::integer into used
  from ai_usage_events e
  where e.organization_id = org and e.period = this_period and e.status = 'consumed';

  if used >= coalesce(cap, 0) then
    raise exception 'conflict:You have used all AI summaries for this month.';
  end if;

  insert into ai_usage_events (organization_id, project_id, person_id, kind, period)
  values (org, consume_ai_narrative.project_id, caller, consume_ai_narrative.kind, this_period)
  returning id into ticket;

  return ticket;
end;
$$;

-- Gives a unit back after a failed generation. Only the caller's own, still
-- consumed ticket qualifies; anything else is a quiet false.
create or replace function public.refund_ai_narrative(ticket uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update ai_usage_events e
  set status = 'refunded', refunded_at = now()
  where e.id = refund_ai_narrative.ticket
    and e.person_id = public.current_person_id()
    and e.status = 'consumed';
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke execute on function public.consume_ai_narrative(uuid, text) from public, anon;
revoke execute on function public.refund_ai_narrative(uuid) from public, anon;
grant execute on function public.consume_ai_narrative(uuid, text) to authenticated;
grant execute on function public.refund_ai_narrative(uuid) to authenticated;

-- approve_project_report, unchanged except that an embedded AI narrative must
-- be well formed: a claude:* engine, a SHA-256 facts hash and bounded text.
create or replace function public.approve_project_report(project_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := public.current_person_id();
  report_status text;
  report_as_of date;
  report_generated timestamptz;
  stored projects%rowtype;
  result_row project_reports%rowtype;
begin
  if caller is null
     or not (
       public.has_permission(approve_project_report.project_id, 'project.manage')
       and public.in_scope(approve_project_report.project_id, null, null, null)
     ) then
    raise exception 'permission:Missing permission "project.manage" on project %', approve_project_report.project_id;
  end if;

  select p.* into stored from projects p where p.id = approve_project_report.project_id;
  if not found then
    raise exception 'conflict:That project no longer exists.';
  end if;

  if jsonb_typeof(approve_project_report.payload) is distinct from 'object'
     or length(approve_project_report.payload::text) > 200000 then
    raise exception 'conflict:That report could not be saved.';
  end if;
  if approve_project_report.payload->>'projectId' is distinct from approve_project_report.project_id::text then
    raise exception 'conflict:That report belongs to a different project.';
  end if;
  if approve_project_report.payload->>'source' is distinct from 'ai'
     or approve_project_report.payload->>'createdBy' is distinct from 'ai'
     or approve_project_report.payload->>'engine' is distinct from 'rules-v1' then
    raise exception 'conflict:That report was not generated by Hozie.';
  end if;
  if approve_project_report.payload->>'reviewStatus' is distinct from 'draft' then
    raise exception 'conflict:This report is already approved.';
  end if;

  if approve_project_report.payload ? 'narrative' then
    if jsonb_typeof(approve_project_report.payload->'narrative') is distinct from 'object'
       or coalesce(approve_project_report.payload->'narrative'->>'engine', '') not like 'claude:%'
       or coalesce(approve_project_report.payload->'narrative'->>'factsHash', '') !~ '^[0-9a-f]{64}$'
       or length(coalesce(approve_project_report.payload->'narrative'->>'text', '')) not between 1 and 4000 then
      raise exception 'conflict:That report could not be saved.';
    end if;
  end if;

  report_status := approve_project_report.payload->>'status';
  if report_status is null or report_status not in ('on-track', 'at-risk', 'behind', 'not-enough-data') then
    raise exception 'conflict:That report could not be saved.';
  end if;

  begin
    report_as_of := (approve_project_report.payload->>'asOf')::date;
    report_generated := (approve_project_report.payload->>'generatedAt')::timestamptz;
  exception when others then
    raise exception 'conflict:That report could not be saved.';
  end;

  insert into project_reports (project_id, as_of, status, engine, payload, generated_at, approved_by, approved_at)
  values (
    approve_project_report.project_id,
    report_as_of,
    report_status,
    'rules-v1',
    approve_project_report.payload || jsonb_build_object(
      'reviewStatus', 'approved',
      'approvedBy', caller,
      'approvedAt', now()
    ),
    report_generated,
    caller,
    now()
  )
  returning * into result_row;

  return to_jsonb(result_row);
end;
$$;
```

- [ ] **Step 5: Reset the local database and run all database tests**

Run: `npm run db:reset && npm run db:test`
Expected: PASS, including `0031_ai_narrative.sql` (22 asserts) and the unchanged `0025_project_reports.sql`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0031_ai_narrative_metering.sql supabase/tests/0031_ai_narrative.sql
git commit -m "feat: AI narrative metering tickets and plan limits

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 6: Plan limits in the app model and seeds

**Files:**
- Modify: `src/domain/models.ts` (`EntitlementKey`, `Plan`), `src/data/rows.ts` (`PlanRow`, `planFromRow`), `src/mock/seed.ts` (plans), `supabase/seed.sql` (plans)
- Test: `src/data/rows.test.ts`

**Interfaces:**
- Produces: `EntitlementKey` gains `"ai.narrative"`; `Plan` gains `limits?: { aiNarrativesPerMonth?: number }`; seeded Starter plan: `ai.narrative` with 10 per month; Pro: `ai.narrative` with 50.

- [ ] **Step 1: Write the failing test**

Append to `src/data/rows.test.ts` (inside the file's existing import style; add `planFromRow` to its imports from `./rows` if not already imported):

```ts
describe("planFromRow limits", () => {
  const row = { id: "u", legacy_id: "plan-x", name: "X", price_label: "₹1", entitlements: ["ai.narrative"], monthly_credits: 0 }

  it("reads the AI narrative cap", () => {
    expect(planFromRow({ ...row, limits: { ai_narratives_per_month: 10 } }).limits).toEqual({ aiNarrativesPerMonth: 10 })
  })

  it("treats missing limits as none", () => {
    expect(planFromRow({ ...row, limits: {} }).limits).toEqual({})
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/data/rows.test.ts`
Expected: FAIL (type error / `limits` undefined).

- [ ] **Step 3: Implement**

`src/domain/models.ts`:

```ts
export type EntitlementKey = "marketplace.unlock" | "marketplace.propose" | "team.members.unlimited" | "ai.narrative"
```

and in `Plan` add after `monthlyCredits: number`:

```ts
  /** Numeric caps; entitlements stay boolean keys. */
  limits?: { aiNarrativesPerMonth?: number }
```

`src/data/rows.ts`: add `limits: Record<string, unknown>` to `PlanRow` (find the interface near `planFromRow`) and change `planFromRow` to:

```ts
export function planFromRow(row: PlanRow): Plan {
  const cap = row.limits?.ai_narratives_per_month
  return {
    id: ownId(row),
    name: row.name,
    priceLabel: row.price_label,
    entitlements: row.entitlements as EntitlementKey[],
    monthlyCredits: row.monthly_credits,
    limits: typeof cap === "number" ? { aiNarrativesPerMonth: cap } : {},
  }
}
```

`src/mock/seed.ts` plans (around line 1189): add `"ai.narrative"` to both plans' `entitlements` and `limits: { aiNarrativesPerMonth: 10 }` on Starter, `50` on Pro.

`supabase/seed.sql` plans insert (around line 158) becomes:

```sql
insert into plans (legacy_id, name, price_label, entitlements, monthly_credits, limits)
values
  ('plan-contractor-starter', 'Contractor Starter', '₹999 / month', array['marketplace.unlock', 'marketplace.propose', 'ai.narrative'], 30, '{"ai_narratives_per_month": 10}'::jsonb),
  ('plan-contractor-pro', 'Contractor Pro', '₹2,499 / month', array['marketplace.unlock', 'marketplace.propose', 'team.members.unlimited', 'ai.narrative'], 100, '{"ai_narratives_per_month": 50}'::jsonb)
on conflict (legacy_id) do nothing;
```

- [ ] **Step 4: Verify everything, including the mock-vs-database parity tests**

Run: `npm run db:reset && npx vitest run && npm run typecheck && npm run db:test`
Expected: PASS. If `parityCheck` or `seedLibrary` tests compare plan shapes, update their expectations to include `limits`.

- [ ] **Step 5: Commit and open PR 2**

```bash
git add -A src supabase
git commit -m "feat: plan limits and ai.narrative entitlement in app model and seeds

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin feature/llm-narrative-metering
gh pr create --base main --title "feat: AI narrative metering (tickets, plan limits)" --body "Part 2 of 4 of docs/superpowers/specs/2026-10-17-llm-narrative-design.md. Adds plans.limits, ai_usage_events, consume/refund RPCs, narrative validation in approve_project_report, pgTAP (22 asserts).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Check CI via `gh pr view`; do not merge.

---

## PR 3 — Edge function

### Task 7: Request handler (pure, fully tested)

**Files:**
- Create: `supabase/functions/narrate-report/handler.ts`
- Test: `supabase/functions/narrate-report/handler.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `checkNarrative`, `hashFacts`, prompt exports.
- Produces:
  - `type ModelOutcome = { status: "ok"; paragraphs: unknown; model: string } | { status: "refused" } | { status: "failed" }`
  - `interface ModelClient { narrate(input: { system: string; user: string; schema: object }): Promise<ModelOutcome> }`
  - `interface RpcResult { data: unknown; error: { message: string } | null }`
  - `interface HandlerDeps { rpc(fn: "consume_ai_narrative" | "refund_ai_narrative", args: Record<string, unknown>): Promise<RpcResult>; model: ModelClient; now(): string }`
  - `handleRequest(req: Request, deps: HandlerDeps): Promise<Response>`. Always HTTP 200 with `{narrative}` or `{error}` for domain outcomes; 204 for CORS preflight; 405 for non-POST; 400 `{error:"unavailable"}` for a malformed body; 401 `{error:"unauthorized"}` without an Authorization header.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b feature/llm-narrative-function
```

- [ ] **Step 2: Write the failing test**

Create `supabase/functions/narrate-report/handler.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import { sampleReportFacts } from "../_shared/narrative/testFacts.ts"
import { hashFacts } from "../_shared/narrative/hash.ts"
import { handleRequest, type HandlerDeps, type ModelOutcome } from "./handler.ts"

const PROJECT = "00000000-0000-0000-0000-0000000031f1"
const facts = sampleReportFacts()
const goodParagraphs = ["The project is at risk. Overall progress is 42 percent against an expected 55 percent."]

function request(body: unknown, headers: Record<string, string> = { authorization: "Bearer jwt" }, method = "POST") {
  return new Request("http://localhost/narrate-report", {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  })
}

function deps(outcome: ModelOutcome | Error, rpcImpl?: HandlerDeps["rpc"]) {
  const rpc = vi.fn(rpcImpl ?? (async (fn: string) => ({ data: fn === "consume_ai_narrative" ? "ticket-1" : true, error: null })))
  const narrate = vi.fn(async () => {
    if (outcome instanceof Error) throw outcome
    return outcome
  })
  return { rpc, narrate, deps: { rpc, model: { narrate }, now: () => "2026-10-17T09:00:00.000Z" } as HandlerDeps }
}

const body = { projectId: PROJECT, kind: "report", facts }
const json = async (res: Response) => res.json()

describe("handleRequest", () => {
  it("returns a narrative and spends one unit on success", async () => {
    const d = deps({ status: "ok", paragraphs: goodParagraphs, model: "claude-opus-5-5" })
    const res = await handleRequest(request(body), d.deps)
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({
      narrative: {
        text: goodParagraphs[0],
        engine: "claude:claude-opus-5-5",
        generatedAt: "2026-10-17T09:00:00.000Z",
        factsHash: await hashFacts(facts),
      },
    })
    expect(d.rpc).toHaveBeenCalledTimes(1)
    expect(d.rpc).toHaveBeenCalledWith("consume_ai_narrative", { project_id: PROJECT, kind: "report" })
  })

  it("rejects without an Authorization header, before any work", async () => {
    const d = deps({ status: "ok", paragraphs: goodParagraphs, model: "m" })
    const res = await handleRequest(request(body, {}), d.deps)
    expect(res.status).toBe(401)
    expect(await json(res)).toEqual({ error: "unauthorized" })
    expect(d.rpc).not.toHaveBeenCalled()
  })

  it("answers preflight and refuses other methods", async () => {
    const d = deps({ status: "failed" })
    const options = await handleRequest(request(undefined, {}, "OPTIONS"), d.deps)
    expect(options.status).toBe(204)
    expect(options.headers.get("access-control-allow-headers")).toContain("authorization")
    expect((await handleRequest(request(undefined, {}, "GET"), d.deps)).status).toBe(405)
  })

  it("refuses a malformed or mismatched body without metering", async () => {
    const d = deps({ status: "failed" })
    for (const bad of [
      null,
      { projectId: "not-a-uuid", kind: "report", facts },
      { projectId: PROJECT, kind: "chat", facts },
      { projectId: PROJECT, kind: "weekly-company", facts },
      { projectId: PROJECT, kind: "report" },
    ]) {
      const res = await handleRequest(request(bad), d.deps)
      expect(res.status).toBe(400)
    }
    expect(d.rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['permission:Missing permission "project.manage" on project x', "forbidden"],
    ["conflict:AI summaries are not included in your plan.", "not-included"],
    ["conflict:You have used all AI summaries for this month.", "limit-reached"],
    ["boom", "unavailable"],
  ])("maps the metering refusal %s to %s and never calls the model", async (message, code) => {
    const d = deps({ status: "ok", paragraphs: goodParagraphs, model: "m" }, async () => ({ data: null, error: { message } }))
    const res = await handleRequest(request(body), d.deps)
    expect(await json(res)).toEqual({ error: code })
    expect(d.narrate).not.toHaveBeenCalled()
  })

  it.each<[string, ModelOutcome | Error]>([
    ["a refusal", { status: "refused" }],
    ["a model failure", { status: "failed" }],
    ["a thrown error", new Error("network")],
  ])("refunds and reports unavailable on %s", async (_name, outcome) => {
    const d = deps(outcome)
    const res = await handleRequest(request(body), d.deps)
    expect(await json(res)).toEqual({ error: "unavailable" })
    expect(d.rpc).toHaveBeenLastCalledWith("refund_ai_narrative", { ticket: "ticket-1" })
  })

  it("refunds and reports rejected when the guard fails", async () => {
    const d = deps({ status: "ok", paragraphs: ["Overall progress is 99 percent."], model: "m" })
    const res = await handleRequest(request(body), d.deps)
    expect(await json(res)).toEqual({ error: "rejected" })
    expect(d.rpc).toHaveBeenLastCalledWith("refund_ai_narrative", { ticket: "ticket-1" })
  })

  it("still answers when the refund itself fails", async () => {
    const d = deps({ status: "failed" }, async (fn) =>
      fn === "consume_ai_narrative" ? { data: "ticket-1", error: null } : Promise.reject(new Error("down")),
    )
    expect(await json(await handleRequest(request(body), d.deps))).toEqual({ error: "unavailable" })
  })

  it("never puts facts or generated text in an error response", async () => {
    const d = deps({ status: "ok", paragraphs: ["Overall progress is 99 percent."], model: "m" })
    const text = JSON.stringify(await json(await handleRequest(request(body), d.deps)))
    expect(text).not.toContain("percent")
    expect(text).not.toContain("Foundation")
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run supabase/functions/narrate-report/handler.test.ts`
Expected: FAIL (`./handler.ts` not found).

- [ ] **Step 4: Implement**

Create `supabase/functions/narrate-report/handler.ts`:

```ts
import { checkNarrative } from "../_shared/narrative/guard.ts"
import { hashFacts } from "../_shared/narrative/hash.ts"
import { NARRATIVE_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from "../_shared/narrative/prompt.ts"
import type {
  NarrativeErrorCode,
  NarrativeFacts,
  NarrativeKind,
  NarrativeResponse,
} from "../_shared/narrative/types.ts"

// Dependency-injected so every branch is unit tested without Deno, a database
// or the network. index.ts wires the real Supabase client and the model.

export type ModelOutcome =
  | { status: "ok"; paragraphs: unknown; model: string }
  | { status: "refused" }
  | { status: "failed" }

export interface ModelClient {
  narrate(input: { system: string; user: string; schema: object }): Promise<ModelOutcome>
}

export interface RpcResult {
  data: unknown
  error: { message: string } | null
}

export interface HandlerDeps {
  rpc(fn: "consume_ai_narrative" | "refund_ai_narrative", args: Record<string, unknown>): Promise<RpcResult>
  model: ModelClient
  now(): string
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KINDS: readonly NarrativeKind[] = ["report", "weekly-company"]

function reply(body: NarrativeResponse | { error: NarrativeErrorCode }, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } })
}

function parseBody(value: unknown): { projectId: string; kind: NarrativeKind; facts: NarrativeFacts } | undefined {
  if (!value || typeof value !== "object") return undefined
  const { projectId, kind, facts } = value as Record<string, unknown>
  if (typeof projectId !== "string" || !UUID.test(projectId)) return undefined
  if (typeof kind !== "string" || !KINDS.includes(kind as NarrativeKind)) return undefined
  if (!facts || typeof facts !== "object" || (facts as { kind?: unknown }).kind !== kind) return undefined
  return { projectId, kind: kind as NarrativeKind, facts: facts as NarrativeFacts }
}

function metering(message: string): NarrativeErrorCode {
  if (message.startsWith("permission:")) return "forbidden"
  if (message.includes("not included in your plan")) return "not-included"
  if (message.includes("used all AI summaries")) return "limit-reached"
  return "unavailable"
}

export async function handleRequest(req: Request, deps: HandlerDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
  if (req.method !== "POST") return reply({ error: "unavailable" }, 405)
  if (!req.headers.get("authorization")) return reply({ error: "unauthorized" }, 401)

  let parsed: ReturnType<typeof parseBody>
  try {
    parsed = parseBody(await req.json())
  } catch {
    parsed = undefined
  }
  if (!parsed) return reply({ error: "unavailable" }, 400)
  const { projectId, kind, facts } = parsed

  const consumed = await deps.rpc("consume_ai_narrative", { project_id: projectId, kind })
  if (consumed.error) return reply({ error: metering(consumed.error.message) })
  const ticket = String(consumed.data)

  const refund = async () => {
    try {
      await deps.rpc("refund_ai_narrative", { ticket })
    } catch {
      // A failed refund must not turn a handled failure into a crash.
    }
  }

  let outcome: Awaited<ReturnType<ModelClient["narrate"]>>
  try {
    outcome = await deps.model.narrate({ system: SYSTEM_PROMPT, user: buildUserMessage(facts), schema: NARRATIVE_SCHEMA })
  } catch {
    outcome = { status: "failed" }
  }
  if (outcome.status !== "ok") {
    await refund()
    return reply({ error: "unavailable" })
  }

  const checked = checkNarrative(outcome.paragraphs, facts)
  if (!checked.ok) {
    await refund()
    return reply({ error: "rejected" })
  }

  return reply({
    narrative: {
      text: checked.text,
      engine: `claude:${outcome.model}`,
      generatedAt: deps.now(),
      factsHash: await hashFacts(facts),
    },
  })
}
```

- [ ] **Step 5: Run to verify it passes, plus typecheck**

Run: `npx vitest run supabase/functions && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/narrate-report/handler.ts supabase/functions/narrate-report/handler.test.ts
git commit -m "feat: narrate-report request handler

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 8: Deno entry, model client, config, smoke test

**Files:**
- Create: `supabase/functions/narrate-report/index.ts`, `supabase/functions/narrate-report/anthropicModel.ts`, `supabase/.env.example`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `handleRequest`, `ModelClient`, `ModelOutcome` (Task 7); migration 0031 (Task 5, merged).
- Produces: a servable function `narrate-report`. Secrets: `ANTHROPIC_API_KEY`, `NARRATIVE_MODEL` (default `claude-opus-5-5`); `SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided by the Edge runtime.

- [ ] **Step 1: Pin SDK versions**

Run: `npm view @anthropic-ai/sdk version && npm view @supabase/supabase-js version`
Use the printed `@anthropic-ai/sdk` version as `<SDK>` below, and `2.117.2` (this repo's installed version) for supabase-js. If the printed SDK is newer than two weeks, choose the latest version published at least two weeks ago (`npm view @anthropic-ai/sdk time --json`).

- [ ] **Step 2: Write the model client**

Create `supabase/functions/narrate-report/anthropicModel.ts` (replace `<SDK>`):

```ts
import Anthropic from "npm:@anthropic-ai/sdk@<SDK>"
import type { ModelClient, ModelOutcome } from "./handler.ts"

/**
 * The only file that talks to the model. Refusal fallbacks are on ("default"
 * routing, beta server-side-fallback-2026-07-01) per the Claude API guidance.
 * If the pinned SDK's types reject `fallbacks`, bump the SDK; do not drop the
 * fallback without telling the project owner.
 */
export function createAnthropicModel(apiKey: string | undefined, model: string): ModelClient {
  const client = apiKey ? new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 }) : undefined
  return {
    async narrate({ system, user, schema }): Promise<ModelOutcome> {
      if (!client) return { status: "failed" }
      const response = await client.beta.messages.create({
        model,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: { type: "json_schema", schema } },
        system,
        messages: [{ role: "user", content: user }],
      })
      if (response.stop_reason === "refusal") return { status: "refused" }
      if (response.stop_reason !== "end_turn") return { status: "failed" }
      const block = response.content.find((b) => b.type === "text")
      if (!block || block.type !== "text") return { status: "failed" }
      try {
        const parsed = JSON.parse(block.text) as { paragraphs?: unknown }
        return { status: "ok", paragraphs: parsed.paragraphs, model: response.model }
      } catch {
        return { status: "failed" }
      }
    },
  }
}
```

- [ ] **Step 3: Write the entry point**

Create `supabase/functions/narrate-report/index.ts` (version for supabase-js as in Step 1):

```ts
import { createClient } from "npm:@supabase/supabase-js@2.117.2"
import { createAnthropicModel } from "./anthropicModel.ts"
import { handleRequest } from "./handler.ts"

const model = createAnthropicModel(Deno.env.get("ANTHROPIC_API_KEY"), Deno.env.get("NARRATIVE_MODEL") ?? "claude-opus-5-5")

Deno.serve((req) => {
  // A user-scoped client: the caller's JWT travels to Postgres, so RLS and the
  // RPCs' own permission checks apply. The service-role key is never used.
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  })
  return handleRequest(req, {
    rpc: (fn, args) => db.rpc(fn, args),
    model,
    now: () => new Date().toISOString(),
  })
})
```

- [ ] **Step 4: Config and example env**

Append to `supabase/config.toml`:

```toml
[functions.narrate-report]
verify_jwt = true
```

Create `supabase/.env.example`:

```
# Copy to supabase/.env.local (git-ignored) and fill in. Never commit real values.
ANTHROPIC_API_KEY=
NARRATIVE_MODEL=claude-opus-5-5
```

- [ ] **Step 5: Verify ignored secrets and static checks**

Run: `git check-ignore -v supabase/.env.local && npx vitest run && npm run typecheck`
Expected: `supabase/.env.local` reported as ignored (by `.env*`); tests and typecheck PASS (`index.ts` and `anthropicModel.ts` are outside the typecheck scope by design).

- [ ] **Step 6: Local smoke test without spending tokens**

Run in one terminal: `npx supabase functions serve narrate-report --no-verify-jwt` (no secrets needed). In another, with the local anon key (`npx supabase status -o env | grep ANON_KEY`):

```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/narrate-report \
  -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"projectId":"00000000-0000-0000-0000-0000000031f1","kind":"report","facts":{"kind":"report"}}'
```

Expected: `{"error":"forbidden"}` (the anon JWT has no person, so `consume_ai_narrative` raises `permission:`). This proves the function boots, the Deno imports resolve, and metering is reached. No model call occurs. Without `Authorization`: `{"error":"unauthorized"}`.

- [ ] **Step 7: Commit and open PR 3**

```bash
git add supabase/functions/narrate-report supabase/config.toml supabase/.env.example
git commit -m "feat: narrate-report edge function entry and model client

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin feature/llm-narrative-function
gh pr create --base main --title "feat: narrate-report edge function" --body "Part 3 of 4 of docs/superpowers/specs/2026-10-17-llm-narrative-design.md. Handler (fully unit tested), Deno entry, Anthropic client with refusal fallbacks, config. Secrets are never committed; CI makes no model calls.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Check CI via `gh pr view`; do not merge.

---

## PR 4 — UI, approval, live verification

### Task 9: Adapter and command surface

**Files:**
- Modify: `src/data/adapter.ts`, `src/mock/commandSurface.ts`
- Test: `src/data/narrateAdapter.test.ts`, `src/mock/commandSurface.test.ts` (create if absent; otherwise append), `src/domain/projectReportCommands.test.ts`, `src/data/rows.test.ts`

**Interfaces:**
- Consumes: `NarrativeRequest`, `NarrativeResponse` (Task 1), `createFakeNarrativeService` (Task 4).
- Produces: `adapter.narrateReport(client, request): Promise<NarrativeResponse>`; command-surface member `narrateReport: (request: NarrativeRequest) => Promise<NarrativeResponse>` available from `useConstructionData()`.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b feature/llm-narrative-ui
```

- [ ] **Step 2: Write failing tests**

Create `src/data/narrateAdapter.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { sampleReportFacts } from "../../supabase/functions/_shared/narrative/testFacts"
import { narrateReport } from "./adapter"

const request = { projectId: "00000000-0000-0000-0000-0000000031f1", kind: "report" as const, facts: sampleReportFacts() }
const clientWith = (invoke: () => Promise<{ data: unknown; error: unknown }>) =>
  ({ functions: { invoke: vi.fn(invoke) } }) as unknown as SupabaseClient

describe("narrateReport adapter", () => {
  it("passes through a narrative", async () => {
    const narrative = { text: "t", engine: "claude:x", generatedAt: "2026-10-17T09:00:00Z", factsHash: "a".repeat(64) }
    const client = clientWith(async () => ({ data: { narrative }, error: null }))
    expect(await narrateReport(client, request)).toEqual({ narrative })
    expect(client.functions.invoke).toHaveBeenCalledWith("narrate-report", { body: request })
  })

  it("passes through a typed error", async () => {
    expect(await narrateReport(clientWith(async () => ({ data: { error: "limit-reached" }, error: null })), request)).toEqual({
      error: "limit-reached",
    })
  })

  it("maps transport failures and junk to unavailable", async () => {
    expect(await narrateReport(clientWith(async () => ({ data: null, error: new Error("net") })), request)).toEqual({ error: "unavailable" })
    expect(await narrateReport(clientWith(async () => ({ data: { weird: true }, error: null })), request)).toEqual({ error: "unavailable" })
    expect(await narrateReport(clientWith(async () => Promise.reject(new Error("boom"))), request)).toEqual({ error: "unavailable" })
  })
})
```

Append to `src/domain/projectReportCommands.test.ts` (reuse that file's existing helper for building a state, actor and live report — mirror the nearest existing "approves and stores a snapshot" test; shown here with the names that test already uses, adjust to match its setup):

```ts
it("keeps an AI narrative with the approved snapshot", () => {
  const narrative = { text: "The project is at risk.", engine: "claude:claude-opus-5-5", generatedAt: "2026-10-17T09:00:00Z", factsHash: "a".repeat(64) }
  const saved = approveWith({ ...liveReport(), narrative }) // approveWith/liveReport: the file's existing helpers
  expect(saved.report.narrative).toEqual(narrative)
  expect(saved.report.reviewStatus).toBe("approved")
})
```

Append to `src/data/rows.test.ts`:

```ts
it("projectReportFromRow keeps a narrative stored in the payload", () => {
  const narrative = { text: "x", engine: "claude:m", generatedAt: "2026-10-17T09:00:00Z", factsHash: "b".repeat(64) }
  const saved = projectReportFromRow(
    {
      id: "r1",
      project_id: "p1",
      as_of: "2026-10-15",
      status: "at-risk",
      engine: "rules-v1",
      payload: { projectId: "p1", status: "at-risk", asOf: "2026-10-15", narrative },
      generated_at: "2026-10-15T09:00:00Z",
      approved_by: "u1",
      approved_at: "2026-10-15T10:00:00Z",
      created_at: "2026-10-15T10:00:00Z",
    } as never,
    (id) => id,
  )
  expect(saved.report.narrative).toEqual(narrative)
})
```

(If `projectReportFromRow` is not yet imported in that file, add it to the `./rows` import.)

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/data src/domain/projectReportCommands.test.ts`
Expected: FAIL (`narrateReport` not exported). The two snapshot tests may already pass because the payload and report objects pass through unchanged — that confirms the approval path needs no code change; keep the tests as regression guards.

- [ ] **Step 4: Implement the adapter**

Add to `src/data/adapter.ts` (near `approveProjectReport`; add the imports `NarrativeRequest`, `NarrativeResponse` from `../../supabase/functions/_shared/narrative/types`):

```ts
/**
 * Asks the narrate-report edge function to write prose from anonymised facts.
 * Never throws: any transport or shape problem is "unavailable", so the rules
 * summary stays on screen.
 */
export async function narrateReport(client: SupabaseClient, request: NarrativeRequest): Promise<NarrativeResponse> {
  try {
    const { data, error } = await client.functions.invoke("narrate-report", { body: request })
    if (error || !data || typeof data !== "object") return { error: "unavailable" }
    const body = data as { narrative?: unknown; error?: unknown }
    if (body.narrative && typeof body.narrative === "object") return { narrative: body.narrative as never }
    if (typeof body.error === "string") return { error: body.error as never }
    return { error: "unavailable" }
  } catch {
    return { error: "unavailable" }
  }
}
```

Also add to `src/data/adapter.ts` (the edge function needs the database uuid, while the domain uses legacy ids):

```ts
/** The database uuid for a domain id, or the id itself when it is already a uuid. */
export function uuidFor(client: SupabaseClient, id: EntityId): string {
  return uuidOf(client, id)
}
```

- [ ] **Step 5: Implement the command surface**

In `src/mock/commandSurface.ts`:
1. Import `NarrativeRequest`, `NarrativeResponse` types and `createFakeNarrativeService`.
2. Add to the `CommandSurface` interface, beside `approveProjectReport`:

```ts
  /** Rewrites a report or weekly summary as prose from anonymised facts. Never throws. */
  narrateReport: (request: NarrativeRequest) => Promise<NarrativeResponse>
```

3. In the memory-mode surface (beside `approveProjectReport: (report) => run(...)`):

```ts
    narrateReport: (request) => memoryNarrator.narrate(request),
```

with `const memoryNarrator = createFakeNarrativeService()` declared once at the top of that factory function.
4. In the Supabase-mode surface:

```ts
    narrateReport: (request: NarrativeRequest) =>
      adapter.narrateReport(client, { ...request, projectId: adapter.uuidFor(client, request.projectId) }),
```

- [ ] **Step 6: Run to verify**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat: narrateReport adapter and command surface

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 10: Narrative draft state and panel

**Files:**
- Create: `src/components/narrative/useNarrativeDraft.ts`, `src/components/narrative/NarrativePanel.tsx`
- Test: `src/components/narrative/draftState.test.ts` (pure reducer-style helper), no component test (the repo has no DOM test setup)

**Interfaces:**
- Consumes: `hashFacts`, `Narrative`, `NarrativeFacts`, `NarrativeKind`, `narrativeErrorMessage`, `useConstructionData().narrateReport`.
- Produces:
  - `isStale(narrative: Narrative | undefined, currentHash: string | undefined): boolean` (pure; exported from `useNarrativeDraft.ts`)
  - `useNarrativeDraft(facts: NarrativeFacts | undefined): { narrative: Narrative | undefined; useAi: boolean; chosen: Narrative | undefined; set(n: Narrative): void; setUseAi(v: boolean): void; clear(): void }`
  - `<NarrativePanel projectId kind facts fallbackLines allowed draft />` rendering the summary block.

- [ ] **Step 1: Write the failing test**

Create `src/components/narrative/draftState.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { isStale } from "./useNarrativeDraft"

const narrative = { text: "t", engine: "claude:x", generatedAt: "2026-10-17T09:00:00Z", factsHash: "a".repeat(64) }

describe("isStale", () => {
  it("is false with no narrative", () => expect(isStale(undefined, "x")).toBe(false))
  it("is false while the facts hash matches", () => expect(isStale(narrative, "a".repeat(64))).toBe(false))
  it("is true once the facts changed", () => expect(isStale(narrative, "b".repeat(64))).toBe(true))
  it("is true when there are no facts any more", () => expect(isStale(narrative, undefined)).toBe(true))
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/narrative`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook**

Create `src/components/narrative/useNarrativeDraft.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from "react"
import { hashFacts } from "../../../supabase/functions/_shared/narrative/hash"
import type { Narrative, NarrativeFacts } from "../../../supabase/functions/_shared/narrative/types"

/** A narrative is stale once the facts it was written from have changed. */
export function isStale(narrative: Narrative | undefined, currentHash: string | undefined): boolean {
  return !!narrative && narrative.factsHash !== currentHash
}

export interface NarrativeDraft {
  narrative: Narrative | undefined
  useAi: boolean
  /** What should be kept with the report: the AI text only while it is current and chosen. */
  chosen: Narrative | undefined
  set(narrative: Narrative): void
  setUseAi(value: boolean): void
  clear(): void
}

export function useNarrativeDraft(facts: NarrativeFacts | undefined): NarrativeDraft {
  const [narrative, setNarrative] = useState<Narrative>()
  const [useAi, setUseAi] = useState(true)

  useEffect(() => {
    if (!narrative) return
    let cancelled = false
    void (async () => {
      const current = facts ? await hashFacts(facts) : undefined
      if (!cancelled && isStale(narrative, current)) setNarrative(undefined)
    })()
    return () => {
      cancelled = true
    }
  }, [facts, narrative])

  const set = useCallback((next: Narrative) => {
    setNarrative(next)
    setUseAi(true)
  }, [])
  const clear = useCallback(() => setNarrative(undefined), [])

  return useMemo(
    () => ({ narrative, useAi, chosen: narrative && useAi ? narrative : undefined, set, setUseAi, clear }),
    [narrative, useAi, set, clear],
  )
}
```

Note: `facts` must be memoised by the caller (`useMemo`) so the effect does not re-run on every render.

- [ ] **Step 4: Implement the panel**

Create `src/components/narrative/NarrativePanel.tsx`:

```tsx
import { useState } from "react"
import { RobotOutlined } from "@ant-design/icons"
import { Button, Flex, Segmented, Tag, Typography, message } from "antd"
import type { EntityId } from "../../domain/models"
import { narrativeErrorMessage } from "../../domain/narrative/messages"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import type { Narrative, NarrativeFacts, NarrativeKind } from "../../../supabase/functions/_shared/narrative/types"
import type { NarrativeDraft } from "./useNarrativeDraft"

const { Paragraph, Text } = Typography

/**
 * The summary block of a report or weekly card. Shows the standard (rules)
 * text, or the AI draft when one exists and is chosen, and offers the
 * "Rewrite with AI" action. The draft is never saved here: the parent keeps
 * it with the report only through the existing approve step.
 */
export default function NarrativePanel({
  projectId,
  kind,
  facts,
  fallbackLines,
  allowed,
  draft,
}: {
  projectId: EntityId
  kind: NarrativeKind
  facts: NarrativeFacts | undefined
  fallbackLines: string[]
  /** The organization's plan includes AI summaries. */
  allowed: boolean
  draft: NarrativeDraft
}) {
  const { narrateReport } = useConstructionData()
  const [working, setWorking] = useState(false)

  const rewrite = async () => {
    if (!facts || working) return
    setWorking(true)
    const result = await narrateReport({ projectId, kind, facts })
    setWorking(false)
    if ("narrative" in result) draft.set(result.narrative)
    else void message.warning(narrativeErrorMessage(result.error))
  }

  const showingAi = !!draft.narrative && draft.useAi

  return (
    <Flex vertical gap={8}>
      {showingAi && draft.narrative ? (
        <AiText narrative={draft.narrative} />
      ) : (
        <Flex vertical gap={4}>
          {fallbackLines.map((line) => (
            <Text key={line} className={line.startsWith("•") ? "pl-2" : undefined}>
              {line}
            </Text>
          ))}
        </Flex>
      )}

      <Flex gap="small" align="center" wrap>
        {draft.narrative ? (
          <Segmented
            size="small"
            value={draft.useAi ? "ai" : "standard"}
            onChange={(value) => draft.setUseAi(value === "ai")}
            options={[
              { label: "AI summary", value: "ai" },
              { label: "Standard summary", value: "standard" },
            ]}
          />
        ) : null}
        {allowed && facts ? (
          <Button size="small" icon={<RobotOutlined />} loading={working} onClick={() => void rewrite()}>
            {draft.narrative ? "Rewrite again" : "Rewrite with AI"}
          </Button>
        ) : !allowed ? (
          <Text type="secondary" className="text-[12px]!">
            AI summaries aren't included in your plan.
          </Text>
        ) : null}
      </Flex>
    </Flex>
  )
}

/** The AI text with its provenance. Used live (unreviewed) and in saved snapshots (approved). */
export function AiText({ narrative, approved = false }: { narrative: Narrative; approved?: boolean }) {
  return (
    <Flex vertical gap={6}>
      <Flex gap="small" wrap>
        <Tag color={approved ? "green" : "purple"}>{approved ? "AI-written · approved" : "AI-written · not yet reviewed"}</Tag>
        <Tag>{narrative.engine}</Tag>
      </Flex>
      {narrative.text.split("\n\n").map((paragraph) => (
        <Paragraph key={paragraph} className="m-0!">
          {paragraph}
        </Paragraph>
      ))}
    </Flex>
  )
}
```

The panel passes the domain project id; the command surface converts it to the database uuid (Task 9).

- [ ] **Step 5: Run to verify**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat: narrative draft state and panel

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 11: Wire into the report screen and weekly card

**Files:**
- Modify: `src/screens/ProjectReportScreen.tsx`, `src/components/progress/WeeklySummaryCard.tsx`

**Interfaces:**
- Consumes: `NarrativePanel`, `AiText`, `useNarrativeDraft`, `buildNarrativeFacts`, `hasEntitlement` (`src/domain/entitlements.ts`).

- [ ] **Step 1: Report screen**

In `ProjectReportScreen.tsx`:
1. Imports: `NarrativePanel`, `{ AiText }`, `useNarrativeDraft`, `buildNarrativeFacts`, `hasEntitlement`.
2. After the `live` memo, add:

```tsx
  const facts = useMemo(() => (live ? buildNarrativeFacts(live) : undefined), [live])
  const draft = useNarrativeDraft(facts)
  const organizationId = state.projects.find((project) => project.id === projectId)?.organizationId
  const aiAllowed = !!organizationId && hasEntitlement(state, organizationId, "ai.narrative")
```

3. Change `approve` so the chosen AI text travels with the approval and only then:

```tsx
    const outcome = await run(
      () => approveProjectReport(draft.chosen ? { ...live, narrative: draft.chosen } : live),
      { success: "Report approved and saved." },
    )
    setApproving(false)
    if (outcome.ok) {
      draft.clear()
      setViewingId(outcome.value.id)
    }
```

4. Replace the live summary rendering (`report.summary.map(...)` block near line 271) with:

```tsx
{snapshot ? (
  snapshot.report.narrative ? <AiText narrative={snapshot.report.narrative} approved /> : /* existing summary lines */ null
) : (
  <NarrativePanel projectId={projectId} kind="report" facts={facts} fallbackLines={report.summary} allowed={aiAllowed} draft={draft} />
)}
```

Keep the existing summary-line markup as the `snapshot` fallback branch (do not delete it; move it into the `null` slot). Keep the status Alert's `report.summary[0]` description unchanged.

- [ ] **Step 2: Weekly card**

In `WeeklySummaryCard.tsx`: for `audience === "company"` only, build `facts = useMemo(() => buildNarrativeFacts(summary), [summary])` (guard `summary` being undefined as the file already does), `const draft = useNarrativeDraft(facts)`, compute `aiAllowed` from `hasEntitlement(state, organizationId, "ai.narrative")` via the project's `organizationId`, and replace the `summary.lines.map(...)` block with:

```tsx
{audience === "company" ? (
  <NarrativePanel projectId={projectId} kind="weekly-company" facts={facts} fallbackLines={summary.lines} allowed={aiAllowed} draft={draft} />
) : (
  /* existing summary.lines.map block, unchanged */
)}
```

The `useMemo`/`useNarrativeDraft` hooks must be called before the early `if (!summary) return null`; compute `facts` with `summary ? buildNarrativeFacts(summary) : undefined`. Homeowner audience keeps the existing block untouched.

- [ ] **Step 3: Verify**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: PASS and a clean build.

- [ ] **Step 4: Memory-mode browser check**

Start the preview (`preview_start`) in memory mode, open a company project's AI Report: click "Rewrite with AI" (fake writer), confirm the "AI-written · not yet reviewed" tag, the toggle to "Standard summary", approve, and confirm the saved snapshot shows "AI-written · approved". Open the company weekly card: same. Confirm the homeowner weekly card shows no button. Take a screenshot.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: AI summary on project report and weekly card

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 12: Live verification with a real key, then PR 4

**Files:** none (verification), plus an optional note in `docs/`.

This task needs the project owner's `ANTHROPIC_API_KEY`. Do not ask for it in chat: instruct the owner to put it in `supabase/.env.local` themselves, and stop until they confirm.

- [ ] **Step 1: Prepare the stack**

```bash
npm run db:reset
npx supabase functions serve --env-file supabase/.env.local
```

(second terminal) `npm run dev` with the Supabase-mode env the project already uses.

- [ ] **Step 2: Walk the flows as the business user (browser, Supabase mode)**

Verify each, with a screenshot or text capture:
1. Report: "Rewrite with AI" returns prose; numbers in it appear on the page's stat cards; tag shows "AI-written · not yet reviewed" and an engine like `claude:claude-opus-5-5`.
2. Toggle to "Standard summary" and back.
3. Approve with AI chosen: the saved report lists AI text with "approved"; confirm the stored row: `select payload->'narrative'->>'engine' from project_reports order by created_at desc limit 1;` (local `psql` or `npx supabase db query`).
4. Approve with "Standard summary" chosen: the stored payload has no `narrative` key.
5. Weekly card (company): rewrite works; moving to the previous week clears the AI text (staleness).
6. Cap: set the plan cap to 1 (`update plans set limits = '{"ai_narratives_per_month": 1}'::jsonb where legacy_id = 'plan-contractor-starter';`), use one rewrite, confirm the next click shows "You've used all your AI summaries this month." and the standard summary stays. Restore the cap to 10 afterward.
7. Failure path: stop the function, click rewrite, confirm "The AI writer isn't available right now." and that usage did not change (`select status, count(*) from ai_usage_events group by 1;`).
8. Homeowner login: weekly card shows the rules text and no AI controls.
9. Request check: `read_network_requests` for the `narrate-report` call; confirm the body contains no names, titles or ids other than `projectId`.

- [ ] **Step 3: Report honestly**

Write results (passes, anything that failed, the model id actually used, token usage if visible in the function logs) into the PR description. If a numeric guard false-rejected real output, record the rejected text and reason and adjust the prompt or guard in a follow-up commit with a test.

- [ ] **Step 4: Full suites, push, PR**

```bash
npx vitest run && npm run typecheck && npm run db:test
git push -u origin feature/llm-narrative-ui
gh pr create --base main --title "feat: AI summary on reports and weekly cards" --body "Part 4 of 4 of docs/superpowers/specs/2026-10-17-llm-narrative-design.md. Adapter, command surface, draft/panel, report and weekly-card wiring, approval carries the chosen AI text. Live verification results are in the comment below.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Check CI via `gh pr view`; do not merge.

---

## Self-Review

**Spec coverage:**
- §1 flow → Tasks 10–11. §2 facts packet (allowlist, leak test, hash) → Tasks 1–2. §3 edge function steps 1–8 → Tasks 7–8 (auth header, user-scoped client, authorization + entitlement + cap inside `consume_ai_narrative`, model call with adaptive thinking, explicit effort, timeout, `max_tokens`, `stop_reason` handling, guard, refund). §4 guard → Task 3. §5 metering/schema → Tasks 5–6. §6 domain/adapter/UI/approval → Tasks 4, 9–11; homeowner exclusion → Task 2 (`undefined` for homeowner) and Task 11 (untouched branch). §7 secrets → Task 8 (ignored `.env.local`, example file, no committed values). §8 testing → vitest (Tasks 1–4, 6–7, 9–10), pgTAP (Task 5), live check (Task 12). §9 delivery → four PRs.
- Spec items intentionally changed are listed under "Deviations from the spec".

**Placeholder scan:** The only deliberate substitution points are `<SDK>` (resolved in Task 8 Step 1 by a command), and Task 9 Step 2's reuse of the existing helpers in `projectReportCommands.test.ts`, which the implementer must read first because those helper names are file-local.

**Type consistency:** `NarrativeFacts`/`ReportFacts`/`WeeklyFacts`, `Narrative`, `NarrativeRequest`, `NarrativeResponse`, `NarrativeErrorCode` (Task 1) are used with the same names in the guard, prompt, handler, fake, adapter, panel and hook. RPC names/args match the migration: `consume_ai_narrative(project_id, kind)` returns the ticket; `refund_ai_narrative(ticket)`. Error strings in the handler's `metering()` match the SQL raises word for word (`not included in your plan`, `used all AI summaries`, `permission:` prefix). `kind` values `report` / `weekly-company` match SQL check constraints, `NarrativeKind` and the handler's `KINDS`.
