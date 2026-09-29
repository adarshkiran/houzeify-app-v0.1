# Phase 8 (Homeowner AI, Slice 1) — Estimate Flow Modernization

**Date:** 2026-09-29
**Branch:** `feature/estimate-modernization` (from `main`)
**Status:** Implemented
**Source:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` → §10 Phase 8 — AI Construction Advisor, §10.1 Homeowner AI (this spec covers 10.1 only; 10.2 Partner AI, 10.3 Site AI, 10.4 Project AI are separate future phases)

## Goal

The homeowner's estimate flow — `CreateProjectScreen` → `EstimateLoadingScreen` → `EstimateDashboardScreen` → `CostBreakdownScreen` — already has the UX shape worth keeping, but its numbers are hardcoded directly in the components (`EstimateDashboardScreen.tsx:242-245`: `₹18.2L`, `56%`, etc.) with no real computation behind them, and no data actually flows between the four screens (`EstimateLoadingScreen`'s "Continue" button calls `onNavigate('estimate-dashboard')` with zero params; `App.tsx:141-142` falls back to hardcoded defaults `'3 BHK G+1 House'` / `'Hyderabad'` whenever a screen is reached without them). This phase replaces that with a real, traceable `Estimate` record: genuinely computed from user input, carried through the flow by id, rendered with modernized Ant Design components — no screen shows a number that isn't read from that record.

| Scope | Included |
|---|---|
| **This spec** | Modernize the 4 existing screens; real `Estimate` data; Ant Design polish |
| Out of scope, future phases | Material Estimate, Labour Estimate, Comparison, Revision, Final Estimate, Lock, BOQ (none of these screens exist in this repo today) |
| Out of scope, future phases | Partner AI (§10.2), Site AI (§10.3), Project AI (§10.4) |

## Why this scope, and not more

An earlier draft prompt for this phase described a 10-screen flow with a real backend (S22–S27 estimation APIs, a database, BOQ tables, secure share links) — none of which exist in this repository. This repo is a pure front-end mock prototype: no server, no database, no API layer (`package.json` has only React, Ant Design, Vite, Vitest). Every other feature here (Work Library, Evidence, Issues) follows the same pattern — a pure domain command writes to in-memory state, a selector reads it back, nothing is invented per-render — and this phase follows that same pattern rather than assuming infrastructure that isn't here. The 6 downstream screens (Material Estimate onward) don't exist yet; building them is new work, not "reuse," and is explicitly deferred.

## 1. Data

```ts
export type ConstructionLevel = "basic" | "standard" | "premium"

export interface Estimate {
  id: EntityId
  homeownerPersonId: EntityId
  projectName: string
  propertyType: string
  location: string
  builtUpAreaSqft: number
  floors: number
  constructionLevel: ConstructionLevel
  totalLow: number
  totalHigh: number
  breakdown: {
    materials: number
    labour: number
    finishing: number
    contingency: number
  }
  createdAt: ISODateTime
}
```

`ConstructionDataState` gains `estimates: Estimate[]`.

**Not modeled as a `Project`.** `Project` (`src/domain/models.ts:38-55`) requires `organizationId` — it represents a real, company-engaged construction project. A homeowner exploring a self-serve estimate hasn't engaged a company yet and has no `organizationId`. `Estimate` is its own standalone record, owned by `homeownerPersonId`, with no dependency on `Project`/`ConstructionStage`/`organizationId`. (A later phase may add a command that converts an `Estimate` into a real `Project` once a homeowner engages a company — out of scope here.)

### Rate table (seed data)

A new constant in `src/mock/seed.ts`, the pricing equivalent of Work Library's catalog:

```ts
const ESTIMATE_RATES: Record<ConstructionLevel, { low: number; high: number }> = {
  basic: { low: 1450, high: 1650 },
  standard: { low: 1650, high: 1950 },
  premium: { low: 1950, high: 2400 },
}
```

(₹/sq-ft, illustrative — exact figures are a planning-time detail, not a design decision.)

**Breakdown split** (fixed percentages, matching what `EstimateDashboardScreen.tsx:242-245` already displays today, now computed instead of typed): Materials 56%, Labour 26%, Finishing 13%, Contingency 5%.

## 2. Command — `generateEstimate(input)`

New file `src/domain/estimateCommands.ts`, following the codebase's existing pure `(state, ctx) => { state, result }` shape (see `constructionCommands.ts`'s commands for the pattern):

```ts
export interface GenerateEstimateInput {
  projectName: string
  propertyType: string
  location: string
  builtUpAreaSqft: number
  floors: number
  constructionLevel: ConstructionLevel
}
```

1. Caller must be a signed-in homeowner (`ctx.actor?.accountType === "homeowner"`) — else `PermissionError`.
2. `projectName`/`location` trimmed, non-empty — else `ConflictError`, copy: `"Give the project a name."` / `"Add a location."`.
3. `builtUpAreaSqft` must be a positive integer — else `ConflictError`, copy: `"Enter a built-up area greater than zero."`.
4. `floors` must be a positive integer — else `ConflictError`, copy: `"Enter at least 1 floor."`.
5. Look up `ESTIMATE_RATES[input.constructionLevel]`; `totalLow = rate.low * builtUpAreaSqft`, `totalHigh = rate.high * builtUpAreaSqft`.
6. `breakdown` = each of the four percentages applied to the **midpoint** of `totalLow`/`totalHigh` (matches how the existing UI shows one breakdown, not a range, per bucket).
7. Build the `Estimate` with `id` from `ctx.ids.next("estimate")`, `createdAt` from `ctx.clock`, append to `state.estimates`.

## 3. Selectors

`src/mock/selectors.ts`:

- `getEstimate(state, estimateId)` — the matching `Estimate`, or `undefined`.
- `getLatestEstimate(state, homeownerPersonId)` — that homeowner's most recent `Estimate` by `createdAt`, or `undefined`.

## 4. Screens

### `CreateProjectScreen.tsx`

Add three fields to the existing form, next to the existing property-type card picker (`propertyTypes` array, line 126) and stage picker:

- **Built-up area (sq.ft)** — Ant `InputNumber`, min 1.
- **Floors** — Ant `InputNumber`, min 1.
- **Construction level** — Basic / Standard / Premium, styled as cards matching the existing `StageCard` pattern (line ~282-310), not a plain dropdown. Defaults to **Standard** (pre-selected, changeable) — not left blank — so it doesn't become a fourth blocking requirement stacked onto the existing name + stage checks; `canContinue` does NOT need to check it.

`handleContinue` (currently line 373-382) changes from building a param bag to calling `generateEstimate` via `useConstructionData()`, then navigating with just the new id:

```ts
const handleContinue = () => {
  if (!canContinue) return
  const outcome = run(() =>
    generateEstimate({
      projectName: projectName.trim(),
      propertyType,
      location,
      builtUpAreaSqft,
      floors,
      constructionLevel,
    }),
  )
  if (!outcome.ok) return
  onNavigate('estimate-loading', { estimate_id: outcome.value.id })
}
```

`canContinue` extends to also require `builtUpAreaSqft > 0` and `floors > 0`.

### `EstimateLoadingScreen.tsx`

Keeps its existing step-by-step loading animation as-is (already good UX — no generic spinner, matches the pasted reference prompt's own instinct). Receives `estimateId` as a prop, forwards it unchanged: `onNavigate('estimate-dashboard', { estimate_id: estimateId })` (line 317 today calls `onNavigate('estimate-dashboard')` with nothing).

**Honest failure state**: if `estimateId` doesn't resolve to a real record (checked via `useConstructionData()`/`getEstimate`), show an Ant `Result status="error"` with a "Back to start" action — not a silent fallback to defaults.

### `EstimateDashboardScreen.tsx`

Props change from `{ projectName, location }` (both plain strings, currently defaulted in `App.tsx:141-142`) to `{ estimateId }`. Resolves the `Estimate` via `getEstimate`. If not found: Ant `Empty` with a "Start an estimate" button back to `create-project` — never the hardcoded `'3 BHK G+1 House'` fallback.

Rendering: total range (`estimate.totalLow`–`estimate.totalHigh`), per-sq-ft range (derived: `totalLow / builtUpAreaSqft` – `totalHigh / builtUpAreaSqft`), and the four `MetricCard`s (line 471-473 today) from `estimate.breakdown` — all computed, none typed.

### `CostBreakdownScreen.tsx`

Same prop change: `{ estimateId }` instead of `{ projectName, location }`. The hardcoded breakdown array (line 242-245: `{ label: 'Materials', percent: 56, amount: '₹18.2L', ... }`) is replaced with values derived from `estimate.breakdown` (amount) and the fixed percentages (already known constants, not re-derived from the amounts — avoids float-rounding drift between the two).

### Ant Design modernization (all four screens)

Replace hand-rolled Tailwind card/button markup with Ant components: `Card`, `Statistic` (for the headline total and per-category amounts), `Progress` (category percentage bars), `Steps` (loading screen's stage list, already using a step-like pattern — formalize it), `Result`/`Empty` (error/empty states). Keep the existing Houzeify purple (`#722ED1`) and the app's established layout rhythm — this should read as "the same screens, polished," not a generic Ant admin dashboard.

### `App.tsx`

Drop the `projectName`/`projectLocation` derivation (lines 141-142) entirely; pass `params.estimate_id` down to the three screens that need it instead.

### Side menu — "Estimates" (currently disabled)

Two places currently list this nav item with `dest: ''` (unbuilt/"Soon"): `HomeDashboardScreen.tsx:185` and `CreateProjectScreen.tsx:165`. Both get `dest: 'estimate-dashboard'` (no `estimate_id` param — the dashboard screen resolves it itself):

- If `getLatestEstimate(state, session.personId)` returns a record, the dashboard renders it.
- If not, the dashboard's existing "not found" empty state (above) covers this case too — no separate empty state needed.

## 5. Rules

- Every number shown on these four screens is read from an `Estimate` record via `getEstimate`/`getLatestEstimate` — never a literal in JSX.
- `generateEstimate` is the only way an `Estimate` is created; no screen computes totals itself.
- A missing/invalid `estimate_id` always shows an honest empty/error state, never a default project name or location.
- `Estimate` has no dependency on `Project`, `organizationId`, or `ConstructionStage`.

## 6. Testing

### Domain tests (Vitest, written first) — `src/domain/estimateCommands.test.ts`

- `generateEstimate`: correct `totalLow`/`totalHigh` for each `ConstructionLevel`; correct breakdown split (sums to the midpoint total, in the fixed 56/26/13/5 proportions); refused for a non-homeowner caller (`PermissionError`); refused for empty `projectName`/`location`, zero/negative `builtUpAreaSqft`, zero/negative `floors` (`ConflictError`, exact copy); `homeownerPersonId` set from the caller.

### Selector tests — extend `src/domain/visibility.test.ts` or a new file

- `getEstimate`: returns the matching record, `undefined` for an unknown id.
- `getLatestEstimate`: returns the newest `Estimate` for a homeowner by `createdAt`; `undefined` for a homeowner with none; ignores another homeowner's estimates.

### Browser walkthrough

`create-project` (fill in built-up area, floors, construction level) → `estimate-loading` (steps animate, then continues) → `estimate-dashboard` (totals and category cards match the formula for the chosen level/area) → `cost-breakdown` (same totals, broken down) → side menu "Estimates" resolves to the same estimate. Also: an `estimate_id` for an estimate that doesn't exist (e.g. a stale/typed URL) shows the honest empty/error state, not defaults.

Note: this app's mock state is in-memory only and does not persist across a page reload (confirmed in prior phases) — the walkthrough exercises the flow within one session, not reload persistence.

### Out of scope

Material Estimate, Labour Estimate, Comparison, Revision, Final Estimate, Lock, BOQ screens (none exist in this repo; new work, not covered here). Partner AI, Site AI, Project AI. Any real backend, pricing API, or persistence. AI Advisor chat collecting these inputs conversationally (inputs come from the form). Stage- or work-type-level cost granularity (flat-rate formula only). Converting an `Estimate` into a real `Project`.

## Acceptance

```text
Fill in built-up area, floors, construction level on Create Project
→ Continue → a real Estimate is generated and stored
→ Estimate Loading animates, then shows the real dashboard
→ Estimate Dashboard and Cost Breakdown show the same, genuinely computed numbers
→ Side menu "Estimates" (no longer "Soon") reopens the same estimate
→ An unknown/missing estimate shows an honest empty state, never a default project
```

Existing checks still pass: `pnpm run typecheck`, `pnpm run test`, `pnpm run build`.
