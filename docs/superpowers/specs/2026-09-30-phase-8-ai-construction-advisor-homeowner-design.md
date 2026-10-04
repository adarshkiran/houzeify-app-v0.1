# Phase 8 — AI Construction Advisor (Homeowner AI) Design

**Status:** Implemented

**Source of truth:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` §10 ("Phase 8 — AI Construction Advisor"), specifically §10.1 "Homeowner AI":

```
Requirements → Project assumptions → Materials → Labour → Finishing → Quantity → Cost → Estimate → Bill of Quantities
```

with the AI governance requirement: "Every AI-generated record must carry: source, confidence/assumptions where applicable, createdBy = AI, review status, approvedBy, approvedAt."

Secondary reference: `Houzeify_Master_Plan_v0_2_FINAL.md` §11 (AI principles — "AI-generated changes should be drafts until a user confirms them") and §12.3 (pricing entity shapes — Material price, Labour rate, Estimate line, BOQ line).

## Naming note (why this isn't called Phase 8 in the plan file it lives next to)

Two earlier specs in this repo (`2026-09-29-phase-8-estimate-flow-antd-modernization-design.md` and `2026-09-29-phase-8-homeowner-estimate-modernization-design.md`) were mislabeled "Phase 8" — they were a visual/data-wiring pass on the existing estimate screens, not the build plan's actual Phase 8. That work is real and stays merged; it just isn't Phase 8. This spec is the first one that actually implements the build plan's Phase 8 (Homeowner AI slice only — Partner AI, Site AI, and Project AI from build-plan §10.2–10.4 are explicitly out of scope for this pass, decided during brainstorming).

## Goal

Give the existing homeowner estimate (`Estimate` domain record, already wired into 4 screens) the two things the build plan's Phase 8 requires and the master plan's estimation model describes, that it's currently missing:

1. **AI governance fields** — `source`, `confidence`, `createdBy`, `reviewStatus`, `approvedBy`, `approvedAt` — with a real "confirm your estimate" action giving `reviewStatus` actual meaning (an AI-generated estimate is a draft until the homeowner confirms it).
2. **Real line items and a Bill of Quantities** — replace the flat 56/26/13/5 percentage split with an actual seeded catalog of materials/labour lines (quantity × unit × rate), and add the BOQ screen the build plan's Homeowner AI chain ends on.

## Explicitly out of scope for this pass

- Partner AI, Site AI, Project AI (build-plan §10.2–10.4) — separate slices.
- Multi-brand/spec selection per catalog item (e.g. choosing between cement brands at different rates) with editable rates — reserved by the master plan's `specification` field (§12.3) for later; this pass uses one fixed representative rate per item.
- An editable/versioned BOQ independent of its estimate — this pass's BOQ is a read-only view of `Estimate.lines`, not a separate entity a company/contractor edits.
- Real LLM/AI integration — `generateEstimate` remains a deterministic formula, same as today; only the governance *fields* and confirm *workflow* are being added, not real AI reasoning.
- A real regional/live pricing feed — the catalog is a single static seeded rate card, same spirit as the existing `ESTIMATE_RATES` table.

## Global Constraints

- Preserve the "no-fake-data" principle already established in this codebase: every number shown must trace to a real computed value, never a literal in JSX. (This pass also retires a previously-deferred finding: `EstimateDashboardScreen.tsx` and `CostBreakdownScreen.tsx` currently hardcode `percent: 56/26/13/5` as JSX literals — these must become computed from `estimate.lines`/`estimate.breakdown` once line items are real.)
- Follow AGENTS.md style rules: legacy screen files (`CreateProjectScreen.tsx`, `EstimateDashboardScreen.tsx`, `CostBreakdownScreen.tsx`, `EstimateLoadingScreen.tsx`) keep single quotes/no semicolons; new files in `src/components/homeowner/` and any new screen follow the newer double-quote/no-semicolon convention already used there.
- `src/domain/*.ts` never imports from `src/mock/*` (existing architectural boundary) — the new catalog is duplicated between `estimateCommands.ts` (domain) and `seed.ts` (mock), matching the existing `ESTIMATE_RATES` pattern exactly.
- Ambient background, Hozie mascot, and the established CSS keyframe animations are preserved on any touched/new screen, consistent with Phase 8 Slice 2's already-established rule for this codebase.
- `HomeownerLayout` is reused for the new BOQ screen (do not build a new sidebar).

## 1. Data model

`src/domain/models.ts` — extend `Estimate`, add `EstimateLine` and `EstimateReviewStatus`:

```ts
export type EstimateReviewStatus = "draft" | "confirmed"

export type EstimateLineCategory = "materials" | "labour" | "finishing" | "contingency"

export interface EstimateLine {
  id: EntityId
  category: EstimateLineCategory
  item: string
  quantity: number
  unit: string
  rate: number
  amount: number
  source: string
  effectiveDate: ISODateTime
  confidence: "low" | "medium" | "high"
}

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
  lines: EstimateLine[]
  source: "ai"
  confidence: "low" | "medium" | "high"
  createdBy: "ai"
  reviewStatus: EstimateReviewStatus
  approvedBy?: EntityId
  approvedAt?: ISODateTime
  createdAt: ISODateTime
}
```

`totalLow`/`totalHigh`/`breakdown` stay on the record (cheap reads for the 3 existing screens) but become **derived from `lines`**, not from a fixed percentage split. `breakdown.<category>` = sum of `amount` across lines in that category; `totalLow`/`totalHigh` keep their existing ±low/high range meaning (the catalog rates already encode a range the same way `ESTIMATE_RATES` does today — see §2).

The overall `Estimate.confidence` is the lowest confidence among its lines (a chain is only as strong as its weakest link) — simple, defensible, no new aggregation rule to invent.

## 2. Seeded catalog

`src/mock/seed.ts` (mirrored in `src/domain/estimateCommands.ts`, same duplication pattern as today's `ESTIMATE_RATES`): a small fixed catalog, one representative row per item, quantities scaled by `builtUpAreaSqft`. Illustrative shape (exact quantities/rates are an implementation-task detail, not a design decision):

```
materials: cement (bags/sqft), steel (kg/sqft), bricks or blocks (pcs/sqft)
labour: mason (days, workforce-days scale with area), helper (days)
finishing: one aggregate line (kept simple — finishing is already the smallest, most heterogeneous bucket)
contingency: one line, computed as a fixed % of the materials+labour+finishing subtotal (this is the one category that is legitimately a percentage, not a catalog item — matches how contingency is described in both the master plan and the existing code)
```

Each catalog entry carries `source: "Houzeify regional rate card"`, a fixed `effectiveDate`, and a `confidence` level (materials/labour = "medium" — real rates vary by brand/region; contingency = "high" — it's a policy percentage, not a market estimate).

The contingency line still fits the `EstimateLine` shape without a new variant: `quantity: 1`, `unit: "lump sum"`, `rate: amount` (i.e. rate and amount are the same number), `source: "Houzeify policy — 5% contingency"`. This keeps one line interface for all four categories rather than a special-cased type for contingency.

`constructionLevel` (basic/standard/premium) continues to select which rate tier applies, same as today's `ESTIMATE_RATES` — it now selects a rate-per-unit for each catalog item instead of a flat ₹/sqft band.

## 3. Commands

`src/domain/estimateCommands.ts`:

- `generateEstimate` — rewritten to build `lines[]` from the catalog × `builtUpAreaSqft`, sum into `breakdown`/`totalLow`/`totalHigh`, and set `source: "ai"`, `createdBy: "ai"`, `reviewStatus: "draft"`, `confidence` (derived), `approvedBy`/`approvedAt` unset. Validation rules (project name, location, area, floors) are unchanged.
- `confirmEstimate(estimateId)` — new command. Requires the estimate to belong to the calling homeowner (`ctx.actor.personId === estimate.homeownerPersonId`, same actor-check pattern as `generateEstimate`). Sets `reviewStatus: "confirmed"`, `approvedBy: ctx.actor.personId`, `approvedAt: iso(ctx)`. No-op guard: throws `ConflictError` if already confirmed (matches the existing `ConflictError` usage pattern in this file).

`src/mock/ConstructionDataProvider.tsx` exposes `confirmEstimate` on context alongside `generateEstimate`, same wiring pattern.

## 4. Confirm-flow UX

`EstimateDashboardScreen.tsx`: when `estimate.reviewStatus === "draft"`, show a banner above the normal dashboard content (inside `HomeownerLayout`, same screen — no new route) summarizing that this is an AI-generated draft and offering a **"Confirm estimate"** button that calls `confirmEstimate`. Once confirmed, the banner is replaced by a small persistent badge (e.g. "Confirmed by you on <date>") — the rest of the dashboard is unaffected either way.

This is a visibility/trust signal, not a navigation gate: `CostBreakdownScreen` and the new BOQ screen remain reachable regardless of draft/confirmed status (decided during brainstorming — nothing downstream currently depends on `reviewStatus`, so gating navigation on it would be enforcing a rule with no consumer yet).

## 5. Bill of Quantities screen

New `src/screens/BOQScreen.tsx`, reached from `EstimateDashboardScreen`'s existing "View BOQ" next-step card (`nextActions` array, currently decorative with no navigation target — this wires it to `onNavigate('boq', { estimate_id: estimate.id })`).

Content: `estimate.lines` grouped by `category`, rendered as a real quantities table (item / quantity / unit / rate / amount / source), using `HomeownerLayout` + a new `AmbientBg` variant `"boq"`. Same not-found handling pattern as `CostBreakdownScreen` (`getEstimate(state, estimateId)`, `Empty` state if missing). No BOQ-specific domain entity — this screen is a structured read view of `Estimate.lines`, not an independently editable document (see "Explicitly out of scope").

## 6. Navigation & routing

- `src/domain/navigation.ts`: register `"boq": { access: HOMEOWNER }`, same access rule as the other 3 estimate screens.
- `src/App.tsx`: wire the `boq` screen the same way as `cost-breakdown` (pass `onNavigate`, `estimateId: params.estimate_id`).
- `src/components/homeowner/AmbientBg.tsx`: extend `AmbientBgVariant` with `"boq"` and give it its own 3 blob values (new, not copied from another variant — matches how each existing variant has its own tuned values).

## 7. Existing-screen fixes required by this change

- `CostBreakdownScreen.tsx` and `EstimateDashboardScreen.tsx` currently hardcode `percent: 56`, `26`, `13`, `5` as JSX literals next to each category's amount. Once `breakdown` is derived from real lines (§1), these must be computed (`Math.round(estimate.breakdown.materials / (totalLow+totalHigh)/2 * 100)` or equivalent) rather than left as stale literals — this was already flagged as a deferred Minor finding in the prior branch's final review; this change is the natural point to retire it.
- `EstimateTotalSummary.tsx` is unaffected (reads `totalLow`/`totalHigh`/`builtUpAreaSqft`/`constructionLevel`, none of which change shape).

## Testing

- `src/domain/estimateCommands.test.ts` (already exists) gets new cases: `lines[]` sums correctly to `breakdown`/`totalLow`/`totalHigh`; `reviewStatus` starts `"draft"`; `confirmEstimate` sets the three governance fields correctly; `confirmEstimate` rejects a non-owning actor; `confirmEstimate` rejects double-confirmation.
- Browser walkthrough (per this repo's established pattern, no jsdom/testing-library present): full flow through to BOQ, confirm action, re-visit after confirm to see the badge persists (mock state, not page reload — matches how the rest of this prototype is verified).

## Revision 2 (2026-10-04): real per-item rate card

This revision supersedes §1–§3 and the §7 note on percentages. The first implementation
back-computed line items from the flat 56/26/13/5 split; that was rejected in final review.

- **Rate card.** Each catalog item has a fixed unit rate per construction level (basic / standard /
  premium). Values are illustrative placeholders for the Houzeify rate card, not market data.
- **Lines.** `amount = quantity × rate`. The line's `rate` is the card rate, so rate × quantity
  always equals amount exactly.
- **Totals.** `breakdown.<category>` is the sum of that category's line amounts. The total is the
  sum of all lines (materials + labour + finishing + contingency). Contingency is a policy line at 5%
  of materials + labour + finishing.
- **Range.** `totalLow = total × 0.92`, `totalHigh = total × 1.08`.
- **Percentages.** Category percentages are computed from real breakdown values and now vary with
  inputs. They are no longer fixed at 56/26/13/5.
- **Removed.** `ESTIMATE_RATES` (domain and seed) and `BREAKDOWN_SHARE`.
