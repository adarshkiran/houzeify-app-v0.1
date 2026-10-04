# Phase 8 — AI Construction Advisor (Homeowner AI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the homeowner `Estimate` real AI-governance fields (source/confidence/createdBy/reviewStatus/approvedBy/approvedAt) with a genuine confirm workflow, replace its flat 56/26/13/5 percentage split with real line items, and add the Bill of Quantities screen the build plan's Homeowner AI chain ends on.

**Architecture:** `Estimate.totalLow`/`totalHigh`/`breakdown` computation is unchanged (same `ESTIMATE_RATES` table, same 56/26/13/5 category split) — that math now seeds a small fixed catalog of named line items (`EstimateLine[]`) instead of being the final answer. `breakdown.<category>` becomes the sum of that category's line amounts (which equals the original bucket value exactly, since the catalog's per-item shares within a category sum to 1.0 — no regression in the numbers already on screen). A new `confirmEstimate` command flips a draft estimate to confirmed. A new `BOQScreen` renders `Estimate.lines` as a real quantities table.

**Tech Stack:** React 19, TypeScript, Ant Design 6.6.5, Tailwind v4, Vitest (existing prototype stack — no new dependencies).

**Spec:** `docs/superpowers/specs/2026-09-30-phase-8-ai-construction-advisor-homeowner-design.md`

## Global Constraints

- `src/domain/*.ts` never imports from `src/mock/*` (existing architectural boundary).
- Legacy screen files (`EstimateDashboardScreen.tsx`, `CostBreakdownScreen.tsx`) keep single quotes/no semicolons. New files (`BOQScreen.tsx`) use double quotes/no semicolons, matching `src/components/homeowner/*`.
- No-fake-data: every number on screen must trace to a real computed value — this plan explicitly retires the hardcoded `56`/`26`/`13`/`5` percent literals in `EstimateDashboardScreen.tsx` and `CostBreakdownScreen.tsx`.
- `HomeownerLayout` is reused for `BOQScreen` — no new sidebar.
- Ambient background, Hozie mascot, and existing CSS keyframe animations are preserved on every touched/new screen.
- Multi-brand/spec selection with editable rates, an editable/versioned BOQ, real LLM integration, and a live pricing feed are explicitly out of scope (see spec).

---

### Task 1: Domain model — `Estimate` governance fields and `EstimateLine`

**Files:**
- Modify: `src/domain/models.ts:330-351`
- Modify: `src/domain/visibility.test.ts:136-183`

**Interfaces:**
- Produces: `EstimateLineCategory` (`"materials" | "labour" | "finishing" | "contingency"`), `EstimateLine` interface, `EstimateReviewStatus` (`"draft" | "confirmed"`), and the extended `Estimate` interface — every later task depends on this shape.

- [ ] **Step 1: Extend the domain model**

In `src/domain/models.ts`, replace:

```ts
export type ConstructionLevel = "basic" | "standard" | "premium"

/** A homeowner's self-serve cost estimate. Not a Project — no organizationId, no company engagement yet. */
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

with:

```ts
export type ConstructionLevel = "basic" | "standard" | "premium"

export type EstimateReviewStatus = "draft" | "confirmed"

export type EstimateLineCategory = "materials" | "labour" | "finishing" | "contingency"

/** One priced line in an estimate's Bill of Quantities. */
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

/**
 * A homeowner's self-serve cost estimate. Not a Project — no organizationId,
 * no company engagement yet. generateEstimate produces it as an unconfirmed
 * AI draft (source/createdBy/reviewStatus = "draft"); confirmEstimate marks
 * it reviewed (reviewStatus = "confirmed", approvedBy/approvedAt set).
 */
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

- [ ] **Step 2: Run typecheck to see every place that breaks**

Run: `pnpm run typecheck`
Expected: FAIL. `src/domain/visibility.test.ts` will report missing required properties (`lines`, `source`, `confidence`, `createdBy`, `reviewStatus`) on its three inline `Estimate` fixtures. `src/domain/estimateCommands.ts` will also fail (fixed in Task 2) — that's expected at this point.

- [ ] **Step 3: Fix the `visibility.test.ts` fixtures**

In `src/domain/visibility.test.ts`, the `withEstimates.estimates` array has three inline `Estimate` objects (`estimate-1`, `estimate-2`, `estimate-other`). Add these five fields to **each** of the three objects, right before their `createdAt` line:

```ts
        lines: [],
        source: "ai" as const,
        confidence: "medium" as const,
        createdBy: "ai" as const,
        reviewStatus: "confirmed" as const,
```

(`lines: []` is fine here — these fixtures only exercise `getEstimate`/`getLatestEstimate`, which don't inspect `lines`.)

- [ ] **Step 4: Run typecheck again — should now only fail in estimateCommands.ts**

Run: `pnpm run typecheck`
Expected: FAIL, but the only remaining errors should be inside `src/domain/estimateCommands.ts` (its `Estimate` object literal is now missing the new required fields — that's Task 2's job). If `visibility.test.ts` still shows errors, the Step 3 fix was incomplete — go back and check all three fixtures.

- [ ] **Step 5: Commit**

```bash
git add src/domain/models.ts src/domain/visibility.test.ts
git commit -m "feat: add EstimateLine and AI governance fields to Estimate"
```

---

### Task 2: Real line items in `generateEstimate`; add `confirmEstimate`

**Files:**
- Modify: `src/domain/estimateCommands.ts` (full rewrite)
- Modify: `src/domain/estimateCommands.test.ts` (add new test blocks; existing ones mostly survive unchanged — see Step 4)

**Interfaces:**
- Consumes: `Estimate`, `EstimateLine`, `EstimateLineCategory`, `ConstructionLevel` from `./models` (Task 1). `Command`, `CommandContext` from `./ports`. `ConflictError` from `./errors`.
- Produces: `generateEstimate(input: GenerateEstimateInput): Command<Estimate>` (same signature as before — no caller changes needed elsewhere for this function). `confirmEstimate(estimateId: EntityId): Command<Estimate>` (new — Task 3 wires this into the provider).

- [ ] **Step 1: Replace the full file**

Replace all of `src/domain/estimateCommands.ts` with:

```ts
import { ConflictError } from "./errors"
import type { ConstructionLevel, Estimate, EstimateLine, EstimateLineCategory, EntityId } from "./models"
import type { Command, CommandContext } from "./ports"

const iso = (ctx: CommandContext) => ctx.clock.now().toISOString()

/**
 * ₹/sq-ft. Seeds the generated line items below — not stored on the Estimate
 * record itself (totalLow/totalHigh are, computed directly from this table,
 * unchanged from before line items existed). Kept in sync with the identical
 * table in src/mock/seed.ts — domain code never imports from mock.
 */
const ESTIMATE_RATES: Record<ConstructionLevel, { low: number; high: number }> = {
  basic: { low: 1450, high: 1650 },
  standard: { low: 1650, high: 1950 },
  premium: { low: 1950, high: 2400 },
}

const BREAKDOWN_SHARE = {
  materials: 0.56,
  labour: 0.26,
  finishing: 0.13,
  contingency: 0.05,
}

/**
 * Fixed rate-card catalog: one representative item per line. Multi-brand
 * selection (e.g. choosing between cement brands at different rates) is
 * explicit future scope — see the Phase 8 spec.
 */
const CATALOG_EFFECTIVE_DATE = "2026-09-01T00:00:00.000Z"
const CATALOG_SOURCE = "Houzeify regional rate card"

/** How much of one sq-ft of built-up area each catalog item consumes. Fixed across construction levels — only the rate (derived below) scales with level. */
const QTY_PER_SQFT = {
  cement: 0.93, // bags
  steel: 0.006, // MT
  blocks: 3.6, // AAC blocks
  mason: 0.27, // days
  helper: 0.35, // days
}

/** How a category's bucket amount splits across its catalog items. Each group must sum to 1. */
const MATERIALS_SHARE = { cement: 0.35, steel: 0.4, blocks: 0.25 }
const LABOUR_SHARE = { mason: 0.55, helper: 0.45 }

const CONFIDENCE_RANK: Record<EstimateLine["confidence"], number> = { low: 0, medium: 1, high: 2 }

export interface GenerateEstimateInput {
  projectName: string
  propertyType: string
  location: string
  builtUpAreaSqft: number
  floors: number
  constructionLevel: ConstructionLevel
}

function buildLines(ctx: CommandContext, area: number, midpoint: number): EstimateLine[] {
  const materialsBucket = midpoint * BREAKDOWN_SHARE.materials
  const labourBucket = midpoint * BREAKDOWN_SHARE.labour
  const finishingBucket = midpoint * BREAKDOWN_SHARE.finishing
  const contingencyBucket = midpoint * BREAKDOWN_SHARE.contingency

  const line = (
    category: EstimateLineCategory,
    item: string,
    quantity: number,
    unit: string,
    amount: number,
    confidence: EstimateLine["confidence"],
    source: string = CATALOG_SOURCE,
  ): EstimateLine => ({
    id: ctx.ids.next("estimate-line"),
    category,
    item,
    quantity,
    unit,
    rate: amount / quantity,
    amount,
    source,
    effectiveDate: CATALOG_EFFECTIVE_DATE,
    confidence,
  })

  const cementQty = Math.round(QTY_PER_SQFT.cement * area)
  const steelQty = Math.round(QTY_PER_SQFT.steel * area * 10) / 10
  const blocksQty = Math.round(QTY_PER_SQFT.blocks * area)
  const masonQty = Math.round(QTY_PER_SQFT.mason * area)
  const helperQty = Math.round(QTY_PER_SQFT.helper * area)

  return [
    line("materials", "Cement (OPC 53 Grade)", cementQty, "bags", materialsBucket * MATERIALS_SHARE.cement, "medium"),
    line("materials", "TMT Steel (Fe 500)", steelQty, "MT", materialsBucket * MATERIALS_SHARE.steel, "medium"),
    line("materials", "AAC Blocks", blocksQty, "blocks", materialsBucket * MATERIALS_SHARE.blocks, "medium"),
    line("labour", "Mason (skilled)", masonQty, "days", labourBucket * LABOUR_SHARE.mason, "medium"),
    line("labour", "Helper (unskilled)", helperQty, "days", labourBucket * LABOUR_SHARE.helper, "medium"),
    line("finishing", "Finishing works (flooring, painting, fixtures)", area, "sqft", finishingBucket, "medium"),
    line(
      "contingency",
      "Contingency (5% policy buffer)",
      1,
      "lump sum",
      contingencyBucket,
      "high",
      "Houzeify policy — 5% contingency",
    ),
  ]
}

function sumCategory(lines: EstimateLine[], category: EstimateLineCategory): number {
  return lines.filter((l) => l.category === category).reduce((sum, l) => sum + l.amount, 0)
}

/**
 * Computes a self-serve homeowner estimate: rate table x built-up area,
 * decomposed into real line items under the standard four cost buckets. Not
 * a Project — no company involved yet. Governance fields mark this as an
 * unconfirmed AI-generated draft — see confirmEstimate below.
 */
export const generateEstimate =
  (input: GenerateEstimateInput): Command<Estimate> =>
  (state, ctx) => {
    if (ctx.actor?.accountType !== "homeowner") {
      throw new Error("Only homeowners can generate an estimate.")
    }
    const projectName = input.projectName.trim()
    if (!projectName) throw new ConflictError("Give the project a name.")
    const location = input.location.trim()
    if (!location) throw new ConflictError("Add a location.")
    if (!Number.isInteger(input.builtUpAreaSqft) || input.builtUpAreaSqft <= 0) {
      throw new ConflictError("Enter a built-up area greater than zero.")
    }
    if (!Number.isInteger(input.floors) || input.floors < 1) {
      throw new ConflictError("Enter at least 1 floor.")
    }

    const id = ctx.ids.next("estimate")
    const rate = ESTIMATE_RATES[input.constructionLevel]
    const totalLow = rate.low * input.builtUpAreaSqft
    const totalHigh = rate.high * input.builtUpAreaSqft
    const midpoint = (totalLow + totalHigh) / 2

    const lines = buildLines(ctx, input.builtUpAreaSqft, midpoint)
    const breakdown = {
      materials: sumCategory(lines, "materials"),
      labour: sumCategory(lines, "labour"),
      finishing: sumCategory(lines, "finishing"),
      contingency: sumCategory(lines, "contingency"),
    }
    const confidence = lines.reduce<EstimateLine["confidence"]>(
      (lowest, l) => (CONFIDENCE_RANK[l.confidence] < CONFIDENCE_RANK[lowest] ? l.confidence : lowest),
      "high",
    )

    const estimate: Estimate = {
      id,
      homeownerPersonId: ctx.actor.personId,
      projectName,
      propertyType: input.propertyType,
      location,
      builtUpAreaSqft: input.builtUpAreaSqft,
      floors: input.floors,
      constructionLevel: input.constructionLevel,
      totalLow,
      totalHigh,
      breakdown,
      lines,
      source: "ai",
      confidence,
      createdBy: "ai",
      reviewStatus: "draft",
      createdAt: iso(ctx),
    }
    return { state: { ...state, estimates: [...state.estimates, estimate] }, result: estimate }
  }

/**
 * Marks a draft AI estimate as reviewed by the homeowner it belongs to.
 * Idempotency is deliberately refused (not silently accepted) — confirming
 * twice almost always means the caller lost track of the estimate's state.
 */
export const confirmEstimate =
  (estimateId: EntityId): Command<Estimate> =>
  (state, ctx) => {
    if (ctx.actor?.accountType !== "homeowner") {
      throw new Error("Only homeowners can confirm an estimate.")
    }
    const estimate = state.estimates.find((item) => item.id === estimateId)
    if (!estimate) throw new ConflictError("That estimate no longer exists.")
    if (estimate.homeownerPersonId !== ctx.actor.personId) {
      throw new ConflictError("You can only confirm your own estimate.")
    }
    if (estimate.reviewStatus === "confirmed") {
      throw new ConflictError("This estimate is already confirmed.")
    }

    const confirmed: Estimate = {
      ...estimate,
      reviewStatus: "confirmed",
      approvedBy: ctx.actor.personId,
      approvedAt: iso(ctx),
    }
    return {
      state: {
        ...state,
        estimates: state.estimates.map((item) => (item.id === estimateId ? confirmed : item)),
      },
      result: confirmed,
    }
  }
```

- [ ] **Step 2: Run typecheck — should now pass everywhere except the test file (Step 3 fixes it)**

Run: `pnpm run typecheck`
Expected: FAIL only in `src/domain/estimateCommands.test.ts` (it doesn't reference the new fields yet — that's fine, TypeScript errors there are about unused-import warnings at most, not structural ones, since the test never constructs an `Estimate` literal directly). If you see structural errors elsewhere, stop and report BLOCKED.

- [ ] **Step 3: Add new test coverage**

In `src/domain/estimateCommands.test.ts`, change the import line:

```ts
import { generateEstimate } from "./estimateCommands"
```

to:

```ts
import { confirmEstimate, generateEstimate } from "./estimateCommands"
```

Then add these four new `describe` blocks at the end of the file (after the existing `describe("ESTIMATE_RATES stays in sync with seed", ...)` block — do not remove or modify any existing test, they all still pass unchanged because `totalLow`/`totalHigh`/`breakdown` computation is unchanged):

```ts
describe("generateEstimate line items", () => {
  it("builds 7 lines across materials/labour/finishing/contingency", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    expect(result.lines).toHaveLength(7)
    expect(result.lines.filter((l) => l.category === "materials")).toHaveLength(3)
    expect(result.lines.filter((l) => l.category === "labour")).toHaveLength(2)
    expect(result.lines.filter((l) => l.category === "finishing")).toHaveLength(1)
    expect(result.lines.filter((l) => l.category === "contingency")).toHaveLength(1)
  })

  it("each line's amount equals quantity x rate", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    for (const line of result.lines) {
      expect(line.rate * line.quantity).toBeCloseTo(line.amount, 5)
    }
  })

  it("sums lines per category to the matching breakdown bucket", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    const sumOf = (category: string) =>
      result.lines.filter((l) => l.category === category).reduce((sum, l) => sum + l.amount, 0)
    expect(sumOf("materials")).toBeCloseTo(result.breakdown.materials, 5)
    expect(sumOf("labour")).toBeCloseTo(result.breakdown.labour, 5)
    expect(sumOf("finishing")).toBeCloseTo(result.breakdown.finishing, 5)
    expect(sumOf("contingency")).toBeCloseTo(result.breakdown.contingency, 5)
  })
})

describe("generateEstimate AI governance fields", () => {
  it("marks the estimate as an unconfirmed AI draft", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    expect(result.source).toBe("ai")
    expect(result.createdBy).toBe("ai")
    expect(result.reviewStatus).toBe("draft")
    expect(result.approvedBy).toBeUndefined()
    expect(result.approvedAt).toBeUndefined()
  })

  it("derives overall confidence as the lowest confidence among its lines", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    const ranks = { low: 0, medium: 1, high: 2 } as const
    const lowest = result.lines.reduce(
      (min, l) => (ranks[l.confidence] < ranks[min] ? l.confidence : min),
      "high" as const,
    )
    expect(result.confidence).toBe(lowest)
  })
})

describe("confirmEstimate", () => {
  it("confirms a draft estimate and records who/when", () => {
    const { state: afterGenerate, result: draft } = run(seed, homeowner, generateEstimate(input))
    const { result: confirmed } = run(afterGenerate, homeowner, confirmEstimate(draft.id))
    expect(confirmed.reviewStatus).toBe("confirmed")
    expect(confirmed.approvedBy).toBe("person-demo-homeowner")
    expect(confirmed.approvedAt).toBe("2026-09-29T10:00:00.000Z")
  })

  it("refuses to confirm someone else's estimate", () => {
    const { state: afterGenerate, result: draft } = run(seed, homeowner, generateEstimate(input))
    const otherHomeowner: Session = { accountType: "homeowner", personId: "person-someone-else" }
    expect(() => run(afterGenerate, otherHomeowner, confirmEstimate(draft.id))).toThrow(ConflictError)
  })

  it("refuses to confirm an already-confirmed estimate", () => {
    const { state: afterGenerate, result: draft } = run(seed, homeowner, generateEstimate(input))
    const { state: afterConfirm } = run(afterGenerate, homeowner, confirmEstimate(draft.id))
    expect(() => run(afterConfirm, homeowner, confirmEstimate(draft.id))).toThrow(ConflictError)
  })

  it("refuses an unknown estimate id", () => {
    expect(() => run(seed, homeowner, confirmEstimate("estimate-nope"))).toThrow(ConflictError)
  })
})
```

- [ ] **Step 4: Run the full test suite**

Run: `pnpm run test`
Expected: PASS — all pre-existing `estimateCommands.test.ts` assertions (rate tiers, 56/26/13/5 breakdown, midpoint sum) still hold exactly because `totalLow`/`totalHigh`/`breakdown` computation didn't change, plus the new line-item/governance/confirm tests pass.

- [ ] **Step 5: Run full checks and commit**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: all PASS.

```bash
git add src/domain/estimateCommands.ts src/domain/estimateCommands.test.ts
git commit -m "feat: real line items and confirmEstimate in the homeowner estimate"
```

---

### Task 3: Wire `confirmEstimate` into `ConstructionDataProvider`

**Files:**
- Modify: `src/mock/ConstructionDataProvider.tsx:140` (interface), `:243` (implementation)

**Interfaces:**
- Consumes: `confirmEstimate` from `../domain/estimateCommands` (Task 2), already imported in this file as `import * as estimateCommands from "../domain/estimateCommands"`.
- Produces: `confirmEstimate: (estimateId: EntityId) => Estimate` on the context value returned by `useConstructionData()` — Task 6 (`EstimateDashboardScreen`) consumes this.

- [ ] **Step 1: Add to the context interface**

In `src/mock/ConstructionDataProvider.tsx`, find this line (around line 140):

```ts
  generateEstimate: (input: GenerateEstimateInput) => Estimate
```

Add immediately after it:

```ts
  confirmEstimate: (estimateId: EntityId) => Estimate
```

- [ ] **Step 2: Wire the implementation**

Find this line (around line 243):

```ts
      generateEstimate: (input) => run(estimateCommands.generateEstimate(input)),
```

Add immediately after it:

```ts
      confirmEstimate: (estimateId) => run(estimateCommands.confirmEstimate(estimateId)),
```

- [ ] **Step 3: Run typecheck and build**

Run: `pnpm run typecheck && pnpm run build`
Expected: PASS. (`EntityId` is already imported in this file at line 22, for other context methods — no import changes needed.)

- [ ] **Step 4: Commit**

```bash
git add src/mock/ConstructionDataProvider.tsx
git commit -m "feat: expose confirmEstimate on ConstructionDataProvider"
```

---

### Task 4: Register the `boq` route and its `AmbientBg` variant

**Files:**
- Modify: `src/domain/navigation.ts:77` (add route)
- Modify: `src/components/homeowner/AmbientBg.tsx` (add variant)

**Interfaces:**
- Produces: `"boq"` as a valid `AppScreen` (derived from `routes`) with `HOMEOWNER` access — Task 5 (`BOQScreen`) and Task 6 (the "View BOQ" card) depend on this existing before they can navigate to it. `AmbientBgVariant` gains `"boq"` — Task 5 consumes it.

- [ ] **Step 1: Register the route**

In `src/domain/navigation.ts`, find:

```ts
  "cost-breakdown": { access: HOMEOWNER },
```

Add immediately after it:

```ts
  "boq": { access: HOMEOWNER },
```

- [ ] **Step 2: Add the `boq` ambient background variant**

In `src/components/homeowner/AmbientBg.tsx`, change:

```ts
export type AmbientBgVariant = "create-project" | "estimate-loading" | "estimate-dashboard" | "cost-breakdown"
```

to:

```ts
export type AmbientBgVariant = "create-project" | "estimate-loading" | "estimate-dashboard" | "cost-breakdown" | "boq"
```

Then in the `VARIANTS` object, add a new entry after the `"cost-breakdown"` entry (before the closing `}` of `VARIANTS`):

```ts
  "boq": [
    { top: -90, right: -190, width: 570, height: 570, backgroundColor: "rgba(114,46,209,0.044)", filter: "blur(125px)" },
    { bottom: -170, left: -110, width: 610, height: 610, backgroundColor: "rgba(243,234,255,0.48)", filter: "blur(135px)" },
    { top: "48%", right: "12%", width: 360, height: 360, backgroundColor: "rgba(243,234,255,0.40)", filter: "blur(95px)" },
  ],
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/domain/navigation.ts src/components/homeowner/AmbientBg.tsx
git commit -m "feat: register boq route and ambient background variant"
```

---

### Task 5: `BOQScreen` — the Bill of Quantities view

**Files:**
- Create: `src/screens/BOQScreen.tsx`
- Modify: `src/App.tsx` (import + route wiring)

**Interfaces:**
- Consumes: `HomeownerLayout` (`{ active, onNavigate, children }`), `AmbientBg` (`variant="boq"`, from Task 4), `useConstructionData()` → `{ state }`, `getEstimate(state, estimateId)` from `../mock/selectors`, `EstimateLine`/`EstimateLineCategory` types from `../domain/models` (Task 1).
- Produces: default export `BOQScreen({ onNavigate, estimateId })`, same signature shape as `CostBreakdownScreen`.

Precondition: read the current `src/screens/CostBreakdownScreen.tsx` first to confirm the `getEstimate`/not-found/`HomeownerLayout` pattern this task mirrors is present (it is, per Task 1-8 of the prior Ant Design modernization work) — if that shape isn't there, STOP and report BLOCKED.

- [ ] **Step 1: Create the screen**

Create `src/screens/BOQScreen.tsx`:

```tsx
import { Button, Empty, Flex, Table, Typography } from "antd"
import AmbientBg from "../components/homeowner/AmbientBg"
import HomeownerLayout from "../components/homeowner/HomeownerLayout"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getEstimate } from "../mock/selectors"
import type { EstimateLine, EstimateLineCategory } from "../domain/models"

const { Text, Title } = Typography

const CATEGORY_LABEL: Record<EstimateLineCategory, string> = {
  materials: "Materials",
  labour: "Labour",
  finishing: "Finishing",
  contingency: "Contingency",
}

const CATEGORY_ORDER: EstimateLineCategory[] = ["materials", "labour", "finishing", "contingency"]

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`
}

const columns = [
  { title: "Item", dataIndex: "item", key: "item" },
  {
    title: "Quantity",
    dataIndex: "quantity",
    key: "quantity",
    align: "right" as const,
    render: (value: number, row: EstimateLine) => `${value.toLocaleString("en-IN")} ${row.unit}`,
  },
  { title: "Rate", dataIndex: "rate", key: "rate", align: "right" as const, render: formatCurrency },
  { title: "Amount", dataIndex: "amount", key: "amount", align: "right" as const, render: formatCurrency },
  { title: "Source", dataIndex: "source", key: "source" },
]

export default function BOQScreen({
  onNavigate,
  estimateId,
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  estimateId?: string
}) {
  const { state } = useConstructionData()
  const estimate = estimateId ? getEstimate(state, estimateId) : undefined

  if (!estimate) {
    return (
      <HomeownerLayout active="estimates" onNavigate={onNavigate}>
        <Flex align="center" justify="center" className="min-h-full">
          <Empty description="We couldn't find that estimate.">
            <Button type="primary" onClick={() => onNavigate("estimate-dashboard")}>Back to estimate</Button>
          </Empty>
        </Flex>
      </HomeownerLayout>
    )
  }

  return (
    <HomeownerLayout active="estimates" onNavigate={onNavigate}>
      <div className="relative min-h-full" style={{ backgroundColor: "#FBF9F7" }}>
        <AmbientBg variant="boq" />
        <Flex vertical gap={24} className="relative z-10 max-w-[1080px] mx-auto! px-4! sm:px-6! lg:px-8! py-6! sm:py-8!">
          <Flex vertical gap={4} style={{ animation: "welcomeFadeUp 0.4s ease-out 0.05s both" }}>
            <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]! block">Bill of Quantities</Text>
            <Title level={2} className="m-0!">What&apos;s in your estimate.</Title>
            <Text type="secondary">
              {estimate.projectName} · {estimate.location} · {estimate.builtUpAreaSqft.toLocaleString("en-IN")} sq ft
            </Text>
          </Flex>

          {CATEGORY_ORDER.map((category, i) => {
            const rows = estimate.lines.filter((line) => line.category === category)
            if (rows.length === 0) return null
            return (
              <Flex
                key={category}
                vertical
                gap={8}
                style={{ animation: `welcomeFadeUp 0.4s ease-out ${0.1 + i * 0.06}s both` }}
              >
                <Text strong>{CATEGORY_LABEL[category]}</Text>
                <Table rowKey="id" columns={columns} dataSource={rows} pagination={false} size="small" />
              </Flex>
            )
          })}

          <Text
            type="secondary"
            className="text-[10px]! block"
            style={{ animation: "welcomeFadeUp 0.4s ease-out 0.4s both" }}
          >
            Rates reflect a single representative Houzeify rate card, not brand-specific pricing. Effective date:{" "}
            {new Date(estimate.lines[0]?.effectiveDate ?? estimate.createdAt).toLocaleDateString("en-IN")}.
          </Text>

          <Button
            type="primary"
            block
            onClick={() => onNavigate("estimate-dashboard", { estimate_id: estimate.id })}
            style={{ animation: "welcomeFadeUp 0.4s ease-out 0.46s both" }}
          >
            ← Back to Estimate
          </Button>
        </Flex>
      </div>
    </HomeownerLayout>
  )
}
```

- [ ] **Step 2: Wire the route in `App.tsx`**

In `src/App.tsx`, add the import alongside the other estimate screens:

```tsx
import CostBreakdownScreen from './screens/CostBreakdownScreen'
```

becomes:

```tsx
import CostBreakdownScreen from './screens/CostBreakdownScreen'
import BOQScreen from './screens/BOQScreen'
```

Then find the `cost-breakdown` block:

```tsx
      {screen === 'cost-breakdown' && (
        <div style={{ ...slide }}>
          <CostBreakdownScreen
            onNavigate={navigateTo}
            estimateId={params.estimate_id}
          />
        </div>
      )}
```

Add immediately after it:

```tsx
      {screen === 'boq' && (
        <div style={{ ...slide }}>
          <BOQScreen
            onNavigate={navigateTo}
            estimateId={params.estimate_id}
          />
        </div>
      )}
```

- [ ] **Step 3: Run typecheck, test, build**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: all PASS.

- [ ] **Step 4: Browser check**

Dev server already running (check `.claude/launch.json` for the port). Set a homeowner demo session via `localStorage.setItem("houzeify:session", JSON.stringify({accountType:"homeowner",personId:"person-demo-homeowner"}))`, generate an estimate through `#create-project`, then navigate directly to `#boq?estimate_id=<the generated id>`. Confirm: 4 category sections render (Materials/Labour/Finishing/Contingency), each with a real table of items/quantity/rate/amount/source, ambient background visible, "← Back to Estimate" works. Then check the not-found state with `#boq?estimate_id=bogus`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/BOQScreen.tsx src/App.tsx
git commit -m "feat: add Bill of Quantities screen"
```

---

### Task 6: `EstimateDashboardScreen` — confirm banner, real percentages, wire "View BOQ"

**Files:**
- Modify: `src/screens/EstimateDashboardScreen.tsx` (full rewrite — most content unchanged, see diff below)

**Interfaces:**
- Consumes: `confirmEstimate` from `useConstructionData()` (Task 3), `useCommand` from `../session/useCommand` (existing hook, used elsewhere e.g. `CreateProjectScreen.tsx`), `"boq"` route (Task 4).

Precondition: read the current file first to confirm the `estimateId`/`getEstimate`/`getLatestEstimate`/empty-state shape is present (it is — this is the file as it exists after the Ant Design modernization work). If that shape isn't present, STOP and report BLOCKED.

- [ ] **Step 1: Replace the full file**

Replace all of `src/screens/EstimateDashboardScreen.tsx` with:

```tsx
import {
  DownloadOutlined,
  EditOutlined,
  FileOutlined,
  MoreOutlined,
  ToolOutlined,
  ProjectOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Col, Empty, Flex, Row, Statistic, Typography } from 'antd'
import AmbientBg from '../components/homeowner/AmbientBg'
import EstimateTotalSummary, { formatRupees } from '../components/homeowner/EstimateTotalSummary'
import HIcon from '../components/HIcon'
import HomeownerLayout from '../components/homeowner/HomeownerLayout'
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { getEstimate, getLatestEstimate } from '../mock/selectors'
import { useCommand } from '../session/useCommand'
import { useSession } from '../session/SessionProvider'

const { Text, Title } = Typography

interface BreakdownItem { label: string; percent: number; amount: string; color: string }

/** Segmented multi-colour bar — no direct AntD primitive for this shape, kept bespoke. */
function CostBreakdownCard({ items }: { items: BreakdownItem[] }) {
  return (
    <Card
      title={<Title level={5} className="m-0!">Where Your Money Goes</Title>}
      extra={<Text type="secondary">Mid-range estimate</Text>}
    >
      <Flex vertical gap={16}>
        <div className="flex h-3 rounded-full overflow-hidden gap-px">
          {items.map((item) => (
            <div key={item.label} style={{ flex: item.percent, backgroundColor: item.color }} />
          ))}
        </div>
        <Row gutter={[12, 12]}>
          {items.map((item) => (
            <Col key={item.label} xs={12} sm={6}>
              <Flex vertical gap={4}>
                <Flex align="center" gap={6}>
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                  <Text type="secondary" className="text-[11px]!">{item.label}</Text>
                </Flex>
                <Flex align="baseline" gap={6}>
                  <Text strong className="text-[15px]!">{item.amount}</Text>
                  <Text type="secondary" className="text-[10px]!">{item.percent}%</Text>
                </Flex>
              </Flex>
            </Col>
          ))}
        </Row>
      </Flex>
    </Card>
  )
}

function HozieInsightCard({ onNavigate, estimateId }: { onNavigate: (s: string, data?: Record<string, string>) => void; estimateId: string }) {
  return (
    <Card className="bg-[#F3EAFF]! border-0!">
      <Flex vertical gap={12}>
        <Flex align="center" gap={10}>
          <div className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center shrink-0">
            <HIcon size={20} />
          </div>
          <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">Hozie Insight</Text>
        </Flex>
        <Text>
          &ldquo;Your estimate has the biggest cost sensitivity in materials and finishing. Choosing construction
          quality carefully can significantly change the final budget.&rdquo;
        </Text>
        <Button type="link" className="self-start p-0!" onClick={() => onNavigate('cost-breakdown', { estimate_id: estimateId })}>
          Explore cost drivers →
        </Button>
      </Flex>
    </Card>
  )
}

export default function EstimateDashboardScreen({
  onNavigate,
  estimateId,
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  estimateId?: string
}) {
  const { state, confirmEstimate } = useConstructionData()
  const { session } = useSession()
  const run = useCommand()
  const estimate = estimateId
    ? getEstimate(state, estimateId)
    : session?.personId
      ? getLatestEstimate(state, session.personId)
      : undefined

  if (!estimate) {
    const message = estimateId ? "We couldn't find that estimate." : "You haven't created an estimate yet."
    return (
      <HomeownerLayout active="estimates" onNavigate={onNavigate}>
        <Flex align="center" justify="center" className="min-h-full">
          <Empty description={message}>
            <Button type="primary" onClick={() => onNavigate('create-project')}>Start an estimate</Button>
          </Empty>
        </Flex>
      </HomeownerLayout>
    )
  }

  const areaLabel = `${estimate.builtUpAreaSqft.toLocaleString('en-IN')} sq ft`
  const midpoint = (estimate.totalLow + estimate.totalHigh) / 2
  const pct = (amount: number) => Math.round((amount / midpoint) * 100)
  const nextActions = [
    {
      icon: <FileOutlined />,
      title: 'View BOQ',
      desc: 'See materials and quantities.',
      onClick: () => onNavigate('boq', { estimate_id: estimate.id }),
    },
    { icon: <ToolOutlined />, title: 'Material Calculator', desc: 'Check material requirements.' },
    { icon: <ProjectOutlined />, title: 'Analyze Plan', desc: 'Upload your floor plan.' },
    { icon: <TeamOutlined />, title: 'Find Contractors', desc: 'Get project bids.' },
  ]

  const handleConfirm = () => {
    run(() => confirmEstimate(estimate.id), { success: 'Estimate confirmed.' })
  }

  return (
    <HomeownerLayout active="estimates" onNavigate={onNavigate}>
      <div className="relative min-h-full" style={{ backgroundColor: '#FBF9F7' }}>
        <AmbientBg variant="estimate-dashboard" />
        <Flex vertical gap={20} className="relative z-10 max-w-[1080px] mx-auto! px-4! sm:px-6! lg:px-8! py-6! sm:py-8!">
          <Flex align="center" justify="space-between" wrap gap={12} style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.05s both' }}>
            <Flex vertical gap={2}>
              <Title level={3} className="m-0!">Construction Estimate</Title>
              <Text type="secondary">{estimate.projectName} · {estimate.location} · {areaLabel}</Text>
            </Flex>
            <Flex gap={8}>
              <Button icon={<EditOutlined />}>Edit project</Button>
              <Button icon={<DownloadOutlined />}>Download PDF</Button>
              <Button icon={<MoreOutlined />} />
            </Flex>
          </Flex>

          <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.08s both' }}>
            {estimate.reviewStatus === 'draft' ? (
              <Alert
                type="info"
                showIcon
                message="This is Hozie's AI-generated draft estimate."
                description="Review the numbers below, then confirm the estimate once you're happy with it."
                action={<Button size="small" type="primary" onClick={handleConfirm}>Confirm estimate</Button>}
              />
            ) : (
              <Alert
                type="success"
                showIcon
                message={`Confirmed by you on ${new Date(estimate.approvedAt!).toLocaleDateString('en-IN')}.`}
              />
            )}
          </div>

          <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.12s both' }}>
            <EstimateTotalSummary estimate={estimate} />
          </div>

          <Row gutter={[12, 12]} style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.18s both' }}>
            <Col xs={12} lg={6}><Card><Statistic title="Built-up Area" value={areaLabel} /></Card></Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Materials" value={formatRupees(estimate.breakdown.materials)} valueStyle={{ color: '#E14B19' }} />
                <Text type="secondary" className="text-[11px]!">{pct(estimate.breakdown.materials)}% of total</Text>
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Labour" value={formatRupees(estimate.breakdown.labour)} valueStyle={{ color: '#E19C12' }} />
                <Text type="secondary" className="text-[11px]!">{pct(estimate.breakdown.labour)}% of total</Text>
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Finishing" value={formatRupees(estimate.breakdown.finishing)} valueStyle={{ color: '#4AB017' }} />
                <Text type="secondary" className="text-[11px]!">{pct(estimate.breakdown.finishing)}% of total</Text>
              </Card>
            </Col>
          </Row>

          <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.24s both' }}>
            <CostBreakdownCard
              items={[
                { label: 'Materials', percent: pct(estimate.breakdown.materials), amount: formatRupees(estimate.breakdown.materials), color: '#E14B19' },
                { label: 'Labour', percent: pct(estimate.breakdown.labour), amount: formatRupees(estimate.breakdown.labour), color: '#E19C12' },
                { label: 'Finishing', percent: pct(estimate.breakdown.finishing), amount: formatRupees(estimate.breakdown.finishing), color: '#4AB017' },
                { label: 'Contingency', percent: pct(estimate.breakdown.contingency), amount: formatRupees(estimate.breakdown.contingency), color: '#7E7E7E' },
              ]}
            />
          </div>

          <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.3s both' }}>
            <HozieInsightCard onNavigate={onNavigate} estimateId={estimate.id} />
          </div>

          <Flex vertical gap={12} style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.36s both' }}>
            <Text className="text-[10px] tracking-[0.10em] uppercase text-[#9A949D]!">Next Steps</Text>
            <Row gutter={[12, 12]}>
              {nextActions.map((a) => (
                <Col key={a.title} xs={12} lg={6}>
                  <Card hoverable onClick={a.onClick}>
                    <Flex vertical gap={8}>
                      <span className="text-[#722ED1] text-[20px]">{a.icon}</span>
                      <Text strong>{a.title}</Text>
                      <Text type="secondary" className="text-[12px]!">{a.desc}</Text>
                    </Flex>
                  </Card>
                </Col>
              ))}
            </Row>
          </Flex>
        </Flex>
      </div>
    </HomeownerLayout>
  )
}
```

- [ ] **Step 2: Run typecheck, test, build**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: all PASS.

- [ ] **Step 3: Browser check**

Generate a fresh estimate through `#create-project`. On `#estimate-dashboard`, confirm: the info banner shows with a "Confirm estimate" button; the Materials/Labour/Finishing percentages are computed (should read 56%/26%/13% for a freshly generated estimate — same numbers as before, now computed rather than hardcoded); clicking "Confirm estimate" replaces the banner with a green "Confirmed by you on <date>" message; the "View BOQ" next-step card now navigates to `#boq` with the right `estimate_id`; the other three next-step cards remain inert (no regression).

- [ ] **Step 4: Commit**

```bash
git add src/screens/EstimateDashboardScreen.tsx
git commit -m "feat: confirm-estimate banner and real percentages on EstimateDashboardScreen"
```

---

### Task 7: `CostBreakdownScreen` — retire hardcoded percentages

**Files:**
- Modify: `src/screens/CostBreakdownScreen.tsx:99-104`

**Interfaces:**
- Consumes: `estimate.breakdown`, `estimate.totalLow`, `estimate.totalHigh` (unchanged shape from Task 1/2).

- [ ] **Step 1: Compute percentages instead of hardcoding them**

In `src/screens/CostBreakdownScreen.tsx`, find:

```tsx
  const midpoint = (estimate.totalLow + estimate.totalHigh) / 2
  const averageLabel = formatRupees(midpoint)
  const categories: Category[] = [
    { id: 'materials', label: 'Materials', amount: formatRupees(estimate.breakdown.materials), pct: 56, icon: <FileOutlined />, detail: 'Cement, steel, bricks, aggregates and other raw materials.', color: '#E14B19' },
    { id: 'labour', label: 'Labour', amount: formatRupees(estimate.breakdown.labour), pct: 26, icon: <TeamOutlined />, detail: 'Civil, plumbing, electrical and finishing labour charges.', color: '#E19C12' },
    { id: 'finishing', label: 'Finishing', amount: formatRupees(estimate.breakdown.finishing), pct: 13, icon: <BgColorsOutlined />, detail: 'Flooring, painting, doors, windows and interior finishes.', color: '#4AB017' },
    { id: 'contingency', label: 'Contingency', amount: formatRupees(estimate.breakdown.contingency), pct: 5, icon: <SafetyOutlined />, detail: 'Buffer for unforeseen costs and estimation variance.', color: '#7E7E7E' },
  ]
```

Replace with:

```tsx
  const midpoint = (estimate.totalLow + estimate.totalHigh) / 2
  const pct = (amount: number) => Math.round((amount / midpoint) * 100)
  const averageLabel = formatRupees(midpoint)
  const categories: Category[] = [
    { id: 'materials', label: 'Materials', amount: formatRupees(estimate.breakdown.materials), pct: pct(estimate.breakdown.materials), icon: <FileOutlined />, detail: 'Cement, steel, bricks, aggregates and other raw materials.', color: '#E14B19' },
    { id: 'labour', label: 'Labour', amount: formatRupees(estimate.breakdown.labour), pct: pct(estimate.breakdown.labour), icon: <TeamOutlined />, detail: 'Civil, plumbing, electrical and finishing labour charges.', color: '#E19C12' },
    { id: 'finishing', label: 'Finishing', amount: formatRupees(estimate.breakdown.finishing), pct: pct(estimate.breakdown.finishing), icon: <BgColorsOutlined />, detail: 'Flooring, painting, doors, windows and interior finishes.', color: '#4AB017' },
    { id: 'contingency', label: 'Contingency', amount: formatRupees(estimate.breakdown.contingency), pct: pct(estimate.breakdown.contingency), icon: <SafetyOutlined />, detail: 'Buffer for unforeseen costs and estimation variance.', color: '#7E7E7E' },
  ]
```

Nothing else in this file changes — the JSX below already just reads `cat.pct`.

- [ ] **Step 2: Run typecheck, test, build**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: all PASS.

- [ ] **Step 3: Browser check**

Navigate to `#cost-breakdown?estimate_id=<a real id>`. Confirm the 4 category cards show the same percentages as `EstimateDashboardScreen` (56%/26%/13%/5% for a freshly generated estimate) and the progress bars fill to those percentages.

- [ ] **Step 4: Commit**

```bash
git add src/screens/CostBreakdownScreen.tsx
git commit -m "fix: compute CostBreakdownScreen percentages instead of hardcoding them"
```

---

### Task 8: Full walkthrough and spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-09-30-phase-8-ai-construction-advisor-homeowner-design.md`

- [ ] **Step 1: Full checks**

Run: `pnpm run typecheck && pnpm run test && pnpm run build` — all pass.

- [ ] **Step 2: Full browser walkthrough**

Using the dev server (check `.claude/launch.json` for the port), homeowner demo sign-in:

```js
localStorage.setItem("houzeify:session", JSON.stringify({accountType:"homeowner",personId:"person-demo-homeowner"}))
```

1. `#create-project` → fill in a project (any name, 2000 sq ft, "Standard") → Continue → `estimate-loading` → lands on `estimate-dashboard`.
2. Confirm the info banner appears ("This is Hozie's AI-generated draft estimate.") with a working "Confirm estimate" button.
3. Confirm the estimate. Confirm the banner switches to the green "Confirmed by you on <date>" message. Reload the page (state resets — this is an in-memory mock, expected) and regenerate to confirm a *fresh* estimate starts back in draft state (reviewStatus isn't accidentally persisted as a default of "confirmed").
4. Click "View BOQ" from the Next Steps section. Confirm it lands on `#boq` with the same `estimate_id`, showing 4 category tables with real item/quantity/rate/amount/source data. Confirm "← Back to Estimate" returns to the dashboard.
5. Navigate to `#cost-breakdown?estimate_id=<the id>`. Confirm the percentages match the dashboard exactly (56/26/13/5 for this fresh estimate).
6. Check the BOQ not-found state (`#boq?estimate_id=bogus`) renders `Empty` with a working recovery button.
7. Confirm ambient background and Hozie personality elements are visible on the BOQ screen, consistent with the other 3 estimate screens.

If any step reveals a real regression, stop, do NOT update the spec status, and report DONE_WITH_CONCERNS with the specific problem.

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-09-30-phase-8-ai-construction-advisor-homeowner-design.md`, change:

```
**Status:** Approved — ready for planning
```

to:

```
**Status:** Implemented
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-30-phase-8-ai-construction-advisor-homeowner-design.md
git commit -m "docs: Phase 8 AI Construction Advisor (Homeowner AI) spec implemented"
```
