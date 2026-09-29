# Phase 8 (Homeowner AI, Slice 1) — Estimate Data Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded numbers in the homeowner's 4-screen estimate flow (`CreateProjectScreen` → `EstimateLoadingScreen` → `EstimateDashboardScreen` → `CostBreakdownScreen`) with a real, computed `Estimate` record that every screen reads through — no literal costs left in JSX. Visual modernization to Ant Design is a separate, later plan; this plan keeps today's existing look.

**Architecture:** One new pure domain command (`generateEstimate`) in a new `src/domain/estimateCommands.ts`, one new record type (`Estimate`) in state, two new selectors (`getEstimate`, `getLatestEstimate`), a seeded ₹/sq-ft rate table standing in for a pricing engine — the same command → mock-state → selector shape every other feature in this codebase already uses (Work Library, Issues, Documents).

**Tech Stack:** React 19, TypeScript 5.7, Vite, Vitest. Package manager pnpm. (No Ant Design in this plan — the 4 screens stay on their existing raw Tailwind styling; Ant Design modernization is deferred to a follow-up plan.)

**Spec:** `docs/superpowers/specs/2026-09-29-phase-8-homeowner-estimate-modernization-design.md`

## Global Constraints

- Checks: `pnpm run typecheck`, `pnpm run test`, `pnpm run build` must pass after every task.
- **Never run `pnpm run format`** (oxfmt 0.2.0 strips `;` in TypeScript types and breaks the build).
- Git commands need `export PATH="/opt/homebrew/bin:$PATH"` first (git-lfs hooks).
- Domain files (`src/domain/*.ts`, `src/mock/*.ts`) use double quotes, no semicolons — match `src/domain/constructionCommands.ts`'s style exactly.
- The 4 legacy screen files (`CreateProjectScreen.tsx`, `EstimateLoadingScreen.tsx`, `EstimateDashboardScreen.tsx`, `CostBreakdownScreen.tsx`) use **single quotes, no semicolons** — match their own existing style exactly, do not convert to double quotes.
- `Estimate` has no dependency on `Project`, `organizationId`, or `ConstructionStage` — it is a standalone record owned by `homeownerPersonId`.
- Every number shown on these 4 screens must be read from an `Estimate` record via `getEstimate`/`getLatestEstimate` — never a literal in JSX. Where an existing hardcoded number (e.g. the "86% confidence" badge) has no corresponding field in the approved `Estimate` model, it is deleted, not faked with an invented field.
- A missing/invalid `estimate_id` always shows an honest empty/error state, never a default project name or location.
- Breakdown split (fixed, from the spec): Materials 56%, Labour 26%, Finishing 13%, Contingency 5% — applied to the midpoint of `totalLow`/`totalHigh`.
- Rate table (₹/sq-ft, from the spec): `basic: { low: 1450, high: 1650 }`, `standard: { low: 1650, high: 1950 }`, `premium: { low: 1950, high: 2400 }`.

## File Structure

| File | Responsibility |
|---|---|
| `src/domain/models.ts` (modify) | `ConstructionLevel`, `Estimate` types; `estimates: Estimate[]` on `ConstructionDataState` |
| `src/domain/estimateCommands.ts` (create) | `GenerateEstimateInput`, `generateEstimate` command |
| `src/domain/estimateCommands.test.ts` (create) | `generateEstimate` tests |
| `src/mock/seed.ts` (modify) | `ESTIMATE_RATES` table; `estimates: Estimate[]` seed array (empty) and state field |
| `src/mock/selectors.ts` (modify) | `getEstimate`, `getLatestEstimate` |
| `src/domain/visibility.test.ts` (modify) | Selector tests, alongside the existing published-record tests |
| `src/mock/ConstructionDataProvider.tsx` (modify) | `generateEstimate` exposed on the context |
| `src/screens/CreateProjectScreen.tsx` (modify) | Built-up area / floors / construction-level fields; calls `generateEstimate`; nav dest fix |
| `src/screens/EstimateLoadingScreen.tsx` (modify) | Takes `estimateId`; honest failure state |
| `src/screens/EstimateDashboardScreen.tsx` (modify) | Takes `estimateId`; real numbers; drops fake confidence badge; nav dest fix |
| `src/screens/CostBreakdownScreen.tsx` (modify) | Takes `estimateId`; real 4-category breakdown; drops fake confidence badge |
| `src/screens/HomeDashboardScreen.tsx` (modify) | Nav dest fix |
| `src/screens/AIAdvisorScreen.tsx` (modify) | Nav dest fix |
| `src/App.tsx` (modify) | Passes `estimateId` (not `projectName`/`projectLocation`) to the 3 downstream screens |

---

### Task 1: `Estimate` model and seed rate table

**Files:**
- Modify: `src/domain/models.ts` (near `Document`, ~line 319-328)
- Modify: `src/mock/seed.ts` (imports ~line 1-19; new array + rate table before `export const seedConstructionData`; state object ~line 1433)

**Interfaces:**
- Produces:
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
  `ConstructionDataState` gains `estimates: Estimate[]`. Task 2 (command) builds `Estimate` records. Task 3 (selectors) reads them.

- [ ] **Step 1: Add `ConstructionLevel` and `Estimate` to `models.ts`**

In `src/domain/models.ts`, immediately after the `Document` interface's closing `}` (before the `/** What a conversation is attached to. */` comment), add:

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

- [ ] **Step 2: Add `estimates` to `ConstructionDataState`**

In `src/domain/models.ts`, add `estimates: Estimate[]` to `ConstructionDataState`, next to `documents: Document[]`:

```ts
  documents: Document[]
  estimates: Estimate[]
  issues: Issue[]
```

- [ ] **Step 3: Add the seed rate table and empty estimates array**

In `src/mock/seed.ts`, add `Estimate` to the `import type { ... } from "../domain/models"` block (alongside `Document`).

Add, right before `export const seedConstructionData` (near the `documents`/`callLogs` arrays):

```ts
export const ESTIMATE_RATES: Record<Estimate["constructionLevel"], { low: number; high: number }> = {
  basic: { low: 1450, high: 1650 },
  standard: { low: 1650, high: 1950 },
  premium: { low: 1950, high: 2400 },
}

const estimates: Estimate[] = []
```

Add `estimates,` to the `seedConstructionData` object literal, next to `documents,` (~line 1433):

```ts
  documents,
  estimates,
  issues,
```

- [ ] **Step 4: Verify**

Run: `pnpm run typecheck && pnpm run test`
Expected: PASS. (A missed `Estimate`-consuming site would fail typecheck — there are none yet, this task only adds the type.)

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/domain/models.ts src/mock/seed.ts
git commit -m "feat: add Estimate model and seed rate table"
```

---

### Task 2: `generateEstimate` command

**Files:**
- Create: `src/domain/estimateCommands.ts`
- Create: `src/domain/estimateCommands.test.ts`

**Interfaces:**
- Consumes: `Estimate`, `ConstructionLevel`, `ConstructionDataState`, `EntityId`, `ISODateTime` from `./models`; `ConflictError` from `./errors`; `Command`, `CommandContext` from `./ports`; `ESTIMATE_RATES` — **not** imported from seed (seed is mock-only, domain must stay seed-independent) — instead the rate table is **duplicated** as a private constant in this file, matching the constraint that `src/domain` never imports from `src/mock`. Keep the two tables' numbers identical (both come from the spec's fixed figures); a future task could hoist a single shared constant, out of scope here.
- Produces:
  ```ts
  export interface GenerateEstimateInput {
    projectName: string
    propertyType: string
    location: string
    builtUpAreaSqft: number
    floors: number
    constructionLevel: ConstructionLevel
  }
  export const generateEstimate: (input: GenerateEstimateInput) => Command<Estimate>
  ```
  Task 4 (provider) exposes this. Task 5 (`CreateProjectScreen`) calls it.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/estimateCommands.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { generateEstimate } from "./estimateCommands"
import { ConflictError } from "./errors"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import type { Session } from "./session"

const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }
const business: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const clock: Clock = { now: () => new Date("2026-09-29T10:00:00.000Z") }
const ids = (): IdGenerator => {
  let n = 0
  return { next: (p) => `${p}-new-${++n}`, short: () => `s${++n}` }
}
const as = (actor: Session | null): CommandContext => ({ actor, clock, ids: ids() })
const run = <T,>(state: ConstructionDataState, actor: Session | null, command: (s: ConstructionDataState, c: CommandContext) => { state: ConstructionDataState; result: T }) =>
  command(state, as(actor))

const input = {
  projectName: "My New Home",
  propertyType: "House",
  location: "Hyderabad, Telangana",
  builtUpAreaSqft: 2000,
  floors: 2,
  constructionLevel: "standard" as const,
}

describe("generateEstimate", () => {
  it("computes totalLow/totalHigh from the rate table and area", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    expect(result.totalLow).toBe(1650 * 2000)
    expect(result.totalHigh).toBe(1950 * 2000)
  })

  it("computes the breakdown as 56/26/13/5 of the midpoint total", () => {
    const { result } = run(seed, homeowner, generateEstimate(input))
    const midpoint = (result.totalLow + result.totalHigh) / 2
    expect(result.breakdown.materials).toBe(midpoint * 0.56)
    expect(result.breakdown.labour).toBe(midpoint * 0.26)
    expect(result.breakdown.finishing).toBe(midpoint * 0.13)
    expect(result.breakdown.contingency).toBe(midpoint * 0.05)
  })

  it("uses the correct rate tier for basic and premium", () => {
    const basic = run(seed, homeowner, generateEstimate({ ...input, constructionLevel: "basic" })).result
    expect(basic.totalLow).toBe(1450 * 2000)
    expect(basic.totalHigh).toBe(1650 * 2000)
    const premium = run(seed, homeowner, generateEstimate({ ...input, constructionLevel: "premium" })).result
    expect(premium.totalLow).toBe(1950 * 2000)
    expect(premium.totalHigh).toBe(2400 * 2000)
  })

  it("attributes the estimate to the caller and stores it", () => {
    const { state, result } = run(seed, homeowner, generateEstimate(input))
    expect(result.homeownerPersonId).toBe("person-demo-homeowner")
    expect(state.estimates).toContainEqual(result)
  })

  it("refuses a non-homeowner caller", () => {
    expect(() => run(seed, business, generateEstimate(input))).toThrow(/homeowner/i)
    expect(() => run(seed, null, generateEstimate(input))).toThrow(/homeowner/i)
  })

  it("requires a non-empty project name and location", () => {
    expect(() => run(seed, homeowner, generateEstimate({ ...input, projectName: "   " }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, location: "" }))).toThrow(ConflictError)
  })

  it("requires a positive built-up area", () => {
    expect(() => run(seed, homeowner, generateEstimate({ ...input, builtUpAreaSqft: 0 }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, builtUpAreaSqft: -5 }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, builtUpAreaSqft: 1.5 }))).toThrow(ConflictError)
  })

  it("requires at least 1 floor", () => {
    expect(() => run(seed, homeowner, generateEstimate({ ...input, floors: 0 }))).toThrow(ConflictError)
    expect(() => run(seed, homeowner, generateEstimate({ ...input, floors: 1.5 }))).toThrow(ConflictError)
  })
})
```

- [ ] **Step 2: Run and see it fail**

Run: `pnpm vitest run src/domain/estimateCommands.test.ts`
Expected: FAIL (`estimateCommands` module does not exist).

- [ ] **Step 3: Implement**

Create `src/domain/estimateCommands.ts`:

```ts
import { ConflictError } from "./errors"
import type { ConstructionLevel, Estimate } from "./models"
import type { Command, CommandContext } from "./ports"

const iso = (ctx: CommandContext) => ctx.clock.now().toISOString()

/** ₹/sq-ft. Kept in sync with the identical table in src/mock/seed.ts — domain code never imports from mock. */
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

export interface GenerateEstimateInput {
  projectName: string
  propertyType: string
  location: string
  builtUpAreaSqft: number
  floors: number
  constructionLevel: ConstructionLevel
}

/**
 * Computes a self-serve homeowner estimate: rate table x built-up area, split
 * into the standard four cost buckets. Not a Project — no company involved yet.
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

    const rate = ESTIMATE_RATES[input.constructionLevel]
    const totalLow = rate.low * input.builtUpAreaSqft
    const totalHigh = rate.high * input.builtUpAreaSqft
    const midpoint = (totalLow + totalHigh) / 2

    const estimate: Estimate = {
      id: ctx.ids.next("estimate"),
      homeownerPersonId: ctx.actor.personId,
      projectName,
      propertyType: input.propertyType,
      location,
      builtUpAreaSqft: input.builtUpAreaSqft,
      floors: input.floors,
      constructionLevel: input.constructionLevel,
      totalLow,
      totalHigh,
      breakdown: {
        materials: midpoint * BREAKDOWN_SHARE.materials,
        labour: midpoint * BREAKDOWN_SHARE.labour,
        finishing: midpoint * BREAKDOWN_SHARE.finishing,
        contingency: midpoint * BREAKDOWN_SHARE.contingency,
      },
      createdAt: iso(ctx),
    }
    return { state: { ...state, estimates: [...state.estimates, estimate] }, result: estimate }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/domain/estimateCommands.test.ts && pnpm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/domain/estimateCommands.ts src/domain/estimateCommands.test.ts
git commit -m "feat: generateEstimate command"
```

---

### Task 3: Selectors — `getEstimate`, `getLatestEstimate`

**Files:**
- Modify: `src/mock/selectors.ts`
- Modify: `src/domain/visibility.test.ts`

**Interfaces:**
- Consumes: `Estimate` from `../domain/models`.
- Produces:
  ```ts
  export function getEstimate(state: ConstructionDataState, estimateId: EntityId): Estimate | undefined
  export function getLatestEstimate(state: ConstructionDataState, homeownerPersonId: EntityId): Estimate | undefined
  ```
  Tasks 6-8 (screens) consume both.

- [ ] **Step 1: Write the failing tests**

In `src/domain/visibility.test.ts`, add `getEstimate` and `getLatestEstimate` to the existing import from `"../mock/selectors"`, and append a new `describe` block:

```ts
describe("estimate selectors", () => {
  const withEstimates = {
    ...seedConstructionData,
    estimates: [
      {
        id: "estimate-1",
        homeownerPersonId: "person-demo-homeowner",
        projectName: "First House",
        propertyType: "House",
        location: "Hyderabad",
        builtUpAreaSqft: 2000,
        floors: 2,
        constructionLevel: "standard" as const,
        totalLow: 3300000,
        totalHigh: 3900000,
        breakdown: { materials: 2016000, labour: 936000, finishing: 468000, contingency: 180000 },
        createdAt: "2026-09-20T10:00:00.000Z",
      },
      {
        id: "estimate-2",
        homeownerPersonId: "person-demo-homeowner",
        projectName: "Second House",
        propertyType: "Villa",
        location: "Hyderabad",
        builtUpAreaSqft: 2500,
        floors: 3,
        constructionLevel: "premium" as const,
        totalLow: 4875000,
        totalHigh: 6000000,
        breakdown: { materials: 3045000, labour: 1413000, finishing: 706500, contingency: 271500 },
        createdAt: "2026-09-28T10:00:00.000Z",
      },
      {
        id: "estimate-other",
        homeownerPersonId: "person-someone-else",
        projectName: "Not mine",
        propertyType: "House",
        location: "Chennai",
        builtUpAreaSqft: 1000,
        floors: 1,
        constructionLevel: "basic" as const,
        totalLow: 1450000,
        totalHigh: 1650000,
        breakdown: { materials: 868000, labour: 403000, finishing: 201500, contingency: 77500 },
        createdAt: "2026-09-29T10:00:00.000Z",
      },
    ],
  }

  it("getEstimate returns the matching record", () => {
    expect(getEstimate(withEstimates, "estimate-1")?.projectName).toBe("First House")
    expect(getEstimate(withEstimates, "nope")).toBeUndefined()
  })

  it("getLatestEstimate returns the newest for that homeowner, ignoring others", () => {
    const latest = getLatestEstimate(withEstimates, "person-demo-homeowner")
    expect(latest?.id).toBe("estimate-2")
  })

  it("getLatestEstimate returns undefined when the homeowner has none", () => {
    expect(getLatestEstimate(withEstimates, "person-nobody")).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run and see it fail**

Run: `pnpm vitest run src/domain/visibility.test.ts`
Expected: FAIL (`getEstimate`, `getLatestEstimate` do not exist).

- [ ] **Step 3: Implement**

In `src/mock/selectors.ts`, add `Estimate` to the `import type { ... } from "../domain/models"` block. Append at the end of the file:

```ts

export function getEstimate(state: ConstructionDataState, estimateId: EntityId) {
  return state.estimates.find((item) => item.id === estimateId)
}

/** A homeowner's most recent estimate, newest first, or undefined if they have none. */
export function getLatestEstimate(state: ConstructionDataState, homeownerPersonId: EntityId) {
  return state.estimates
    .filter((item) => item.homeownerPersonId === homeownerPersonId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/domain/visibility.test.ts && pnpm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/mock/selectors.ts src/domain/visibility.test.ts
git commit -m "feat: getEstimate and getLatestEstimate selectors"
```

---

### Task 4: Wire `generateEstimate` into the data provider

**Files:**
- Modify: `src/mock/ConstructionDataProvider.tsx`

**Interfaces:**
- Consumes: `generateEstimate`, `GenerateEstimateInput` (Task 2).
- Produces: `generateEstimate: (input: GenerateEstimateInput) => Estimate` on the context.

- [ ] **Step 1: Add imports**

In `src/mock/ConstructionDataProvider.tsx`:

Add a new import line, alongside the existing `import * as conversationCommands from "../domain/conversationCommands"`:

```ts
import * as estimateCommands from "../domain/estimateCommands"
import type { GenerateEstimateInput } from "../domain/estimateCommands"
```

Add `Estimate` to the `import type { ... } from "../domain/models"` block (alongside `Document`, `Issue`, ...).

- [ ] **Step 2: Add to the context type**

Add directly below `publishDocument: (documentId: EntityId, visible: boolean) => Document` (~line 136):

```ts
  generateEstimate: (input: GenerateEstimateInput) => Estimate
```

- [ ] **Step 3: Add to the provider's `useMemo` value**

Add directly below `publishDocument: (id, visible) => run(commands.publishDocument(id, visible)),` (~line 238):

```ts
      generateEstimate: (input) => run(estimateCommands.generateEstimate(input)),
```

- [ ] **Step 4: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: all PASS (nothing calls this from the UI yet).

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/mock/ConstructionDataProvider.tsx
git commit -m "feat: expose generateEstimate on the data provider"
```

---

### Task 5: `CreateProjectScreen` — collect real inputs, generate the estimate

**Files:**
- Modify: `src/screens/CreateProjectScreen.tsx`

**Interfaces:**
- Consumes: `generateEstimate` from `useConstructionData()` (Task 4); `useCommand()` (existing `run(action)` pattern — see `src/screens/IssueDetailScreen.tsx` for usage, though that file uses double quotes; here match this file's single-quote style while using the identical hook).
- Produces: on "Continue," an `Estimate` is created and `estimate_id` is the only param passed to `estimate-loading`.

- [ ] **Step 1: Add imports and state for the three new fields**

In `src/screens/CreateProjectScreen.tsx`, change the top import line:

```ts
import { useState } from 'react'
import HIcon from '../components/HIcon'
import LogoHorizontal from '../components/LogoHorizontal'
```

to:

```ts
import { useState } from 'react'
import HIcon from '../components/HIcon'
import LogoHorizontal from '../components/LogoHorizontal'
import type { ConstructionLevel } from '../domain/models'
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { useCommand } from '../session/useCommand'
```

- [ ] **Step 2: Add the construction-level card list and component**

Add near the `stages`/`StageCard` section (after the `StageCard` function, before `// ─── Form Input ───`):

```tsx
// ─── Construction Level ───────────────────────────────────────────────────────

interface LevelOption {
  id: ConstructionLevel
  title: string
  desc: string
}

const levels: LevelOption[] = [
  { id: 'basic', title: 'Basic', desc: 'Functional finishes, standard materials.' },
  { id: 'standard', title: 'Standard', desc: 'Good quality finishes, popular choice.' },
  { id: 'premium', title: 'Premium', desc: 'High-end finishes, premium materials.' },
]

function LevelCard({ level, selected, onSelect }: { level: LevelOption; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={[
        'relative flex flex-col gap-1 p-4 rounded-[12px] text-left cursor-pointer transition-all duration-150 border outline-none',
        selected
          ? 'bg-[#F3EAFF] border-[#722ED1] border-2'
          : 'bg-white border-[#E3DDD7] hover:bg-[#F3EAFF] hover:border-[#722ED1]',
      ].join(' ')}
    >
      {selected && (
        <div
          className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#722ED1] flex items-center justify-center"
          style={{ animation: 'successBadgePop 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      <span
        className={`text-[13px] font-semibold leading-tight ${selected ? 'text-[#722ED1]' : 'text-[#242326]'}`}
        style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
      >
        {level.title}
      </span>
      <span className="text-[12px] text-[#68636D] leading-[1.5]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
        {level.desc}
      </span>
    </button>
  )
}
```

- [ ] **Step 3: Add state, wire `generateEstimate`, extend `canContinue`**

Change:

```ts
  const [projectName, setProjectName] = useState('')
  const [propertyType, setPropertyType] = useState(initialPropertyType)
  const [location, setLocation] = useState(initialLocation)
  const [stage, setStage] = useState<string | null>(null)
  const [changingType, setChangingType] = useState(false)
  const [editingLocation, setEditingLocation] = useState(false)

  const canContinue = projectName.trim().length > 0 && stage !== null

  const handleContinue = () => {
    if (!canContinue) return
    onNavigate('estimate-loading', {
      project_name: projectName.trim(),
      property_type: propertyType,
      location,
      project_stage: stage!,
      user_role: 'homeowner',
    })
  }
```

to:

```ts
  const [projectName, setProjectName] = useState('')
  const [propertyType, setPropertyType] = useState(initialPropertyType)
  const [location, setLocation] = useState(initialLocation)
  const [stage, setStage] = useState<string | null>(null)
  const [changingType, setChangingType] = useState(false)
  const [editingLocation, setEditingLocation] = useState(false)
  const [builtUpArea, setBuiltUpArea] = useState('')
  const [floors, setFloors] = useState('1')
  const [constructionLevel, setConstructionLevel] = useState<ConstructionLevel>('standard')

  const { generateEstimate } = useConstructionData()
  const run = useCommand()

  const builtUpAreaNum = Number(builtUpArea)
  const floorsNum = Number(floors)
  const canContinue =
    projectName.trim().length > 0 &&
    stage !== null &&
    Number.isInteger(builtUpAreaNum) &&
    builtUpAreaNum > 0 &&
    Number.isInteger(floorsNum) &&
    floorsNum > 0

  const handleContinue = () => {
    if (!canContinue) return
    const outcome = run(() =>
      generateEstimate({
        projectName: projectName.trim(),
        propertyType,
        location,
        builtUpAreaSqft: builtUpAreaNum,
        floors: floorsNum,
        constructionLevel,
      }),
    )
    if (!outcome.ok) return
    onNavigate('estimate-loading', { estimate_id: outcome.value.id })
  }
```

- [ ] **Step 4: Add the two `InputNumber`-equivalent fields and the level picker to the form**

After the "Field 4: Stage" block's closing `</div>` (right before the form card's closing `</div>`), add:

```tsx
                {/* Divider */}
                <div className="border-t border-[#F4F0EC]" />

                {/* Field 5: Built-up area + floors */}
                <div className="flex flex-col sm:flex-row gap-5">
                  <div className="flex flex-col gap-2 flex-1">
                    <FormLabel>Built-up area (sq.ft)</FormLabel>
                    <input
                      type="number"
                      min={1}
                      placeholder="e.g. 2000"
                      value={builtUpArea}
                      onChange={e => setBuiltUpArea(e.target.value)}
                      className="w-full h-[52px] px-4 rounded-[12px] border border-[#E3DDD7] bg-white text-[15px] text-[#242326] outline-none transition-all placeholder-[#C4BFC8]"
                      style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#722ED1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(114,46,209,0.08)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E3DDD7'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <FormLabel>Floors</FormLabel>
                    <input
                      type="number"
                      min={1}
                      value={floors}
                      onChange={e => setFloors(e.target.value)}
                      className="w-full h-[52px] px-4 rounded-[12px] border border-[#E3DDD7] bg-white text-[15px] text-[#242326] outline-none transition-all placeholder-[#C4BFC8]"
                      style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#722ED1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(114,46,209,0.08)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E3DDD7'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-[#F4F0EC]" />

                {/* Field 6: Construction level */}
                <div className="flex flex-col gap-3">
                  <FormLabel>Construction level</FormLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {levels.map(l => (
                      <LevelCard
                        key={l.id}
                        level={l}
                        selected={constructionLevel === l.id}
                        onSelect={() => setConstructionLevel(l.id)}
                      />
                    ))}
                  </div>
                </div>
```

- [ ] **Step 5: Fix the disabled "Estimates" nav item**

Change:

```ts
    { id: 'estimates', icon: <IcoEstimates />, label: 'Estimates', dest: '' },
```

to:

```ts
    { id: 'estimates', icon: <IcoEstimates />, label: 'Estimates', dest: 'estimate-dashboard' },
```

- [ ] **Step 6: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

Browser check (http://localhost:5174, homeowner demo sign-in — `localStorage.setItem("houzeify:session", JSON.stringify({accountType:"homeowner",personId:"person-demo-homeowner"}))`): open `#create-project`, fill in project name, pick a stage, enter a built-up area (e.g. 2000) and floors, pick a construction level, click "Continue to project details →" — confirm it navigates to `estimate-loading` with an `estimate_id` in the URL hash. Confirm "Continue" stays disabled until area/floors are valid positive integers. Confirm the side-menu "Estimates" item is no longer greyed out.

- [ ] **Step 7: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/screens/CreateProjectScreen.tsx
git commit -m "feat: collect built-up area, floors, construction level and generate a real estimate"
```

---

### Task 6: `EstimateLoadingScreen` — take a real `estimateId`, honest failure state

**Files:**
- Modify: `src/screens/EstimateLoadingScreen.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `getEstimate` from `../mock/selectors` (Task 3); `useConstructionData()` for `state`.
- Produces: `EstimateLoadingScreen` takes `estimateId: string` instead of `projectName`/`location`/`area` string props.

- [ ] **Step 1: Change the props and resolve the estimate**

Change:

```ts
export default function EstimateLoadingScreen({
  onNavigate,
  projectName = '3 BHK G+1 House',
  location = 'Hyderabad',
  area = '2,400 SQ FT',
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  projectName?: string
  location?: string
  area?: string
}) {
  const [phaseIdx, setPhaseIdx] = useState(0)
```

to:

```ts
export default function EstimateLoadingScreen({
  onNavigate,
  estimateId,
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  estimateId?: string
}) {
  const { state } = useConstructionData()
  const estimate = estimateId ? getEstimate(state, estimateId) : undefined
  const [phaseIdx, setPhaseIdx] = useState(0)
```

Add the import at the top of the file:

```ts
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { getEstimate } from '../mock/selectors'
```

- [ ] **Step 2: Use the real project name/location/area in the project-context card**

Change:

```tsx
          <div className="flex flex-col gap-1">
            <span
              className="text-[13px] font-semibold text-[#242326]"
              style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
            >
              {projectName}
            </span>
            <span
              className="text-[11px] text-[#68636D]"
              style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
            >
              {location} · {area}
            </span>
          </div>
```

to:

```tsx
          <div className="flex flex-col gap-1">
            <span
              className="text-[13px] font-semibold text-[#242326]"
              style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
            >
              {estimate?.projectName ?? 'Your project'}
            </span>
            <span
              className="text-[11px] text-[#68636D]"
              style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
            >
              {estimate ? `${estimate.location} · ${estimate.builtUpAreaSqft.toLocaleString('en-IN')} sq ft` : ''}
            </span>
          </div>
```

- [ ] **Step 3: Forward `estimate_id` and add the honest failure state**

Change:

```tsx
        {/* View estimate button — appears only on complete */}
        {complete && (
          <button
            onClick={() => onNavigate('estimate-dashboard')}
            className="h-[52px] px-8 rounded-[12px] bg-[#722ED1] text-white text-[15px] font-semibold cursor-pointer hover:brightness-90 active:scale-[0.98] transition-all border-0"
            style={{
              fontFamily: '"Google Sans Flex:SemiBold", sans-serif',
              animation: 'estimateButtonPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both',
              minWidth: 220,
            }}
          >
            View estimate →
          </button>
        )}
```

to:

```tsx
        {/* View estimate button — appears only on complete, and only if the estimate really exists */}
        {complete && estimate && (
          <button
            onClick={() => onNavigate('estimate-dashboard', { estimate_id: estimate.id })}
            className="h-[52px] px-8 rounded-[12px] bg-[#722ED1] text-white text-[15px] font-semibold cursor-pointer hover:brightness-90 active:scale-[0.98] transition-all border-0"
            style={{
              fontFamily: '"Google Sans Flex:SemiBold", sans-serif',
              animation: 'estimateButtonPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both',
              minWidth: 220,
            }}
          >
            View estimate →
          </button>
        )}
        {complete && !estimate && (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-[13px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
              We couldn&apos;t find that estimate.
            </span>
            <button
              onClick={() => onNavigate('create-project')}
              className="h-[44px] px-6 rounded-[12px] bg-[#722ED1] text-white text-[14px] font-semibold cursor-pointer hover:brightness-90 transition-all border-0"
              style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
            >
              Start over
            </button>
          </div>
        )}
```

- [ ] **Step 4: Wire `App.tsx`**

In `src/App.tsx`, change the `estimate-loading` mount block:

```tsx
      {screen === 'estimate-loading' && (
        <div style={{ ...slide }}>
          <EstimateLoadingScreen
            onNavigate={navigateTo}
            projectName={projectName}
            location={projectLocation}
          />
        </div>
      )}
```

to:

```tsx
      {screen === 'estimate-loading' && (
        <div style={{ ...slide }}>
          <EstimateLoadingScreen
            onNavigate={navigateTo}
            estimateId={params.estimate_id}
          />
        </div>
      )}
```

(Leave the `projectName`/`projectLocation` local variables at the top of `App.tsx` in place for now — Tasks 7 and 8 remove the last two usages and then that declaration.)

- [ ] **Step 5: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

Browser check: continue from Task 5's walkthrough — on `estimate-loading`, confirm the project-context card shows the real project name/location/area you entered, and after the animation completes, "View estimate →" navigates to `estimate-dashboard` with the same `estimate_id`. Then manually navigate to `#estimate-loading` with no `estimate_id` param (or a fake one) and confirm the animation completes to the "We couldn't find that estimate." honest failure state, not a default project.

- [ ] **Step 6: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/screens/EstimateLoadingScreen.tsx src/App.tsx
git commit -m "feat: EstimateLoadingScreen resolves a real estimate, with an honest failure state"
```

---

### Task 7: `EstimateDashboardScreen` — real numbers, drop the fake confidence badge

**Files:**
- Modify: `src/screens/EstimateDashboardScreen.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `getEstimate`, `getLatestEstimate` from `../mock/selectors` (Task 3); `useSession` for the current homeowner's `personId`.
- Produces: `EstimateDashboardScreen` takes `estimateId?: string` instead of `projectName`/`location`/`area`. When `estimateId` is omitted, falls back to `getLatestEstimate` for the signed-in homeowner (the "Estimates" nav item's use case).

- [ ] **Step 1: Change the props and resolve the estimate**

Change:

```ts
export default function EstimateDashboardScreen({
  onNavigate,
  projectName = '3 BHK G+1 House',
  location = 'Hyderabad',
  area = '2,400 sq ft',
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  projectName?: string
  location?: string
  area?: string
}) {
  const nextActions = [
```

to:

```ts
export default function EstimateDashboardScreen({
  onNavigate,
  estimateId,
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  estimateId?: string
}) {
  const { state } = useConstructionData()
  const { session } = useSession()
  const estimate = estimateId
    ? getEstimate(state, estimateId)
    : session?.personId
      ? getLatestEstimate(state, session.personId)
      : undefined

  if (!estimate) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center px-6" style={{ height: '100%', backgroundColor: '#FBF9F7' }}>
        <span className="text-[18px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
          You haven&apos;t created an estimate yet.
        </span>
        <button
          onClick={() => onNavigate('create-project')}
          className="h-[48px] px-6 rounded-[12px] bg-[#722ED1] text-white text-[14px] font-semibold cursor-pointer hover:brightness-90 transition-all border-0"
          style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
        >
          Start an estimate
        </button>
      </div>
    )
  }

  const areaLabel = `${estimate.builtUpAreaSqft.toLocaleString('en-IN')} sq ft`
  const formatRupees = (value: number) => `₹${(value / 100000).toFixed(1)}L`
  const perSqftLow = Math.round(estimate.totalLow / estimate.builtUpAreaSqft)
  const perSqftHigh = Math.round(estimate.totalHigh / estimate.builtUpAreaSqft)

  const nextActions = [
```

Add the imports at the top of the file:

```ts
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { getEstimate, getLatestEstimate } from '../mock/selectors'
import { useSession } from '../session/SessionProvider'
```

- [ ] **Step 2: Wire the header line**

Change:

```tsx
              <span className="text-[13px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                {projectName} · {location} · {area}
              </span>
```

to:

```tsx
              <span className="text-[13px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                {estimate.projectName} · {estimate.location} · {areaLabel}
              </span>
```

- [ ] **Step 3: Wire the hero total, remove the fake confidence badge**

Change:

```tsx
                  {/* Right: confidence */}
                  <div className="flex flex-col items-start sm:items-end gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F3EAFF]" style={{ border: '1px solid rgba(114,46,209,0.18)' }}>
                      <span
                        className="w-2 h-2 rounded-full bg-[#722ED1] shrink-0"
                        style={{ animation: 'hozieStatusPulse 2.5s ease-in-out infinite' }}
                      />
                      <span className="text-[12px] font-medium text-[#722ED1]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                        86% confidence
                      </span>
                    </div>
                    {/* Confidence bar */}
                    <div className="flex flex-col gap-1 w-full sm:w-[160px]">
                      <div className="h-1.5 bg-[#E3DDD7] rounded-full overflow-hidden">
                        <div className="h-full bg-[#722ED1] rounded-full" style={{ width: '86%' }} />
                      </div>
                      <span className="text-[10px] text-[#9A949D] sm:text-right" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>AI CONFIDENCE SCORE</span>
                    </div>
                  </div>
```

to:

```tsx
                  {/* Right: construction level badge */}
                  <div className="flex flex-col items-start sm:items-end gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F3EAFF]" style={{ border: '1px solid rgba(114,46,209,0.18)' }}>
                      <span className="text-[12px] font-medium text-[#722ED1] capitalize" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                        {estimate.constructionLevel} finish
                      </span>
                    </div>
                  </div>
```

Change:

```tsx
                      <div className="text-[36px] sm:text-[42px] font-semibold text-[#722ED1] leading-none" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
                        ₹29.8L — ₹35.2L
                      </div>
                      <div className="text-[13px] text-[#68636D] mt-1.5" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                        Estimated construction cost
                      </div>
                    </div>
                    <div className="text-[16px] sm:text-[18px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
                      ₹1,240 — ₹1,467 / sq ft
                    </div>
```

to:

```tsx
                      <div className="text-[36px] sm:text-[42px] font-semibold text-[#722ED1] leading-none" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
                        {formatRupees(estimate.totalLow)} — {formatRupees(estimate.totalHigh)}
                      </div>
                      <div className="text-[13px] text-[#68636D] mt-1.5" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                        Estimated construction cost
                      </div>
                    </div>
                    <div className="text-[16px] sm:text-[18px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
                      ₹{perSqftLow.toLocaleString('en-IN')} — ₹{perSqftHigh.toLocaleString('en-IN')} / sq ft
                    </div>
```

Change:

```tsx
                <p className="text-[12px] text-[#9A949D] leading-[1.6] m-0" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                  Based on current project details and regional construction assumptions for {location}. Final cost depends on design, materials, and contractor rates.
                </p>
```

to:

```tsx
                <p className="text-[12px] text-[#9A949D] leading-[1.6] m-0" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                  Based on current project details and regional construction assumptions for {estimate.location}. Final cost depends on design, materials, and contractor rates.
                </p>
```

- [ ] **Step 4: Wire the summary metric cards**

Change:

```tsx
                <MetricCard label="Built-up Area" value="2,400 sq ft" />
                <MetricCard label="Materials" value="₹18.2L" sub="56% of total" color="#E14B19" />
                <MetricCard label="Labour" value="₹8.4L" sub="26% of total" color="#E19C12" />
                <MetricCard label="Finishing" value="₹4.1L" sub="13% of total" color="#4AB017" />
```

to:

```tsx
                <MetricCard label="Built-up Area" value={areaLabel} />
                <MetricCard label="Materials" value={formatRupees(estimate.breakdown.materials)} sub="56% of total" color="#E14B19" />
                <MetricCard label="Labour" value={formatRupees(estimate.breakdown.labour)} sub="26% of total" color="#E19C12" />
                <MetricCard label="Finishing" value={formatRupees(estimate.breakdown.finishing)} sub="13% of total" color="#4AB017" />
```

- [ ] **Step 5: Wire the Cost Breakdown segmented bar (`breakdownItems`)**

Change the module-level constant:

```tsx
const breakdownItems = [
  { label: 'Materials',   percent: 56, amount: '₹18.2L', color: '#E14B19' },
  { label: 'Labour',      percent: 26, amount: '₹8.4L',  color: '#E19C12' },
  { label: 'Finishing',   percent: 13, amount: '₹4.1L',  color: '#4AB017' },
  { label: 'Contingency', percent:  5, amount: '₹1.7L',  color: '#7E7E7E' },
]

function CostBreakdownCard() {
```

to:

```tsx
interface BreakdownItem { label: string; percent: number; amount: string; color: string }

function CostBreakdownCard({ items }: { items: BreakdownItem[] }) {
```

Change every reference to `breakdownItems` inside `CostBreakdownCard`'s body to `items` (the segmented bar's `.map` and the legend's `.map`).

Change the call site:

```tsx
              {/* Cost Breakdown */}
              <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.18s both' }}>
                <CostBreakdownCard />
              </div>
```

to:

```tsx
              {/* Cost Breakdown */}
              <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.18s both' }}>
                <CostBreakdownCard
                  items={[
                    { label: 'Materials', percent: 56, amount: formatRupees(estimate.breakdown.materials), color: '#E14B19' },
                    { label: 'Labour', percent: 26, amount: formatRupees(estimate.breakdown.labour), color: '#E19C12' },
                    { label: 'Finishing', percent: 13, amount: formatRupees(estimate.breakdown.finishing), color: '#4AB017' },
                    { label: 'Contingency', percent: 5, amount: formatRupees(estimate.breakdown.contingency), color: '#7E7E7E' },
                  ]}
                />
              </div>
```

- [ ] **Step 6: Fix the disabled "Estimates" nav item**

Change:

```ts
    { id: 'estimates', icon: <IcoEstimates />, label: 'Estimates', dest: '' },
```

to:

```ts
    { id: 'estimates', icon: <IcoEstimates />, label: 'Estimates', dest: 'estimate-dashboard' },
```

- [ ] **Step 7: Wire `App.tsx`**

Change:

```tsx
      {screen === 'estimate-dashboard' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <EstimateDashboardScreen
            onNavigate={navigateTo}
            projectName={projectName}
            location={projectLocation}
          />
        </div>
      )}
```

to:

```tsx
      {screen === 'estimate-dashboard' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <EstimateDashboardScreen
            onNavigate={navigateTo}
            estimateId={params.estimate_id}
          />
        </div>
      )}
```

- [ ] **Step 8: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

Browser check: continuing the walkthrough, on `estimate-dashboard` confirm the hero total/per-sq-ft range and all four metric cards match the formula for the level/area you entered on `create-project` (e.g. standard, 2000 sq ft → total ₹33.0L–₹39.0L). Confirm no "confidence" badge/bar appears anywhere. Then navigate to `#estimate-dashboard` with no `estimate_id` — confirm it shows your just-created estimate (via `getLatestEstimate`) rather than a "not found" state (since you have one); then in a session with no estimates at all, confirm the "You haven't created an estimate yet." empty state shows instead.

- [ ] **Step 9: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/screens/EstimateDashboardScreen.tsx src/App.tsx
git commit -m "feat: EstimateDashboardScreen shows real computed numbers"
```

---

### Task 8: `CostBreakdownScreen` — real 4-category breakdown, drop the fake confidence badge

**Files:**
- Modify: `src/screens/CostBreakdownScreen.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `getEstimate` from `../mock/selectors` (Task 3).
- Produces: `CostBreakdownScreen` takes `estimateId?: string` instead of `projectName`/`location`/`area`.

**Note on scope:** the file's current `categories` constant has 5 entries (Materials/Labour/Finishing/**Services**/Contingency) with percentages that don't sum to 100 (61+28+14+7+6 = 116) and per-category `dest` links to screens that don't exist (`material-estimate`, `services-details`, etc. — confirmed not present anywhere in this repo). The approved spec's `Estimate.breakdown` has exactly 4 buckets (Materials/Labour/Finishing/Contingency), matching `EstimateDashboardScreen`. This task reduces `categories` to those 4, computed from `estimate.breakdown`, and removes the dead `dest`/"View details →" links (they pointed nowhere real).

- [ ] **Step 1: Convert `categories` from a module constant to a computed value, remove `dest`**

Change the `Category` interface and constant:

```tsx
interface Category {
  id: string
  label: string
  amount: string
  pct: number
  icon: React.ReactNode
  dest: string
  detail: string
  color: string
  bg: string
}

const categories: Category[] = [
  { id: 'materials',   label: 'Materials',   amount: '₹18.2L', pct: 61, icon: <IcoMaterials />,   dest: 'material-estimate',       detail: 'Cement, steel, bricks, aggregates and other raw materials.',  color: '#E14B19', bg: '#FFF2E8' },
  { id: 'labour',      label: 'Labour',      amount: '₹8.4L',  pct: 28, icon: <IcoLabour />,      dest: 'labour-estimate',         detail: 'Civil, plumbing, electrical and finishing labour charges.',    color: '#E19C12', bg: '#FFFBE6' },
  { id: 'finishing',   label: 'Finishing',   amount: '₹4.1L',  pct: 14, icon: <IcoFinishing />,   dest: 'finishing-details',       detail: 'Flooring, painting, doors, windows and interior finishes.',   color: '#4AB017', bg: '#F6FFED' },
  { id: 'services',    label: 'Services',    amount: '₹2.2L',  pct:  7, icon: <IcoServices />,    dest: 'services-details',        detail: 'Electrical, plumbing, HVAC and sanitation installations.',    color: '#136BE6', bg: '#E6F4FF' },
  { id: 'contingency', label: 'Contingency', amount: '₹1.7L',  pct:  6, icon: <IcoContingency />, dest: 'contingency-assumptions', detail: 'Buffer for unforeseen costs and estimation variance.',        color: '#7E7E7E', bg: '#F5F5F5' },
]
```

to:

```tsx
interface Category {
  id: string
  label: string
  amount: string
  pct: number
  icon: React.ReactNode
  detail: string
  color: string
  bg: string
}
```

(The `categories` array is now built inside the main component from the real `Estimate`, in Step 5 below — the module-level constant is removed entirely.)

- [ ] **Step 2: Thread `categories` as a prop into `TotalCard`, `CategoryCard`'s caller, and `EstimateSummaryPanel`**

Change `TotalCard`'s signature and its stacked-bar section:

```tsx
function TotalCard() {
  return (
```

to:

```tsx
function TotalCard({ categories, totalLabel, averageLabel }: { categories: Category[]; totalLabel: string; averageLabel: string }) {
  return (
```

Inside `TotalCard`, change:

```tsx
          <div className="text-[34px] sm:text-[40px] font-semibold leading-none" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif', color: 'rgb(40, 40, 40)' }}>
            ₹29.8L — ₹35.2L
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[13px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
              Estimated average:
            </span>
            <span className="text-[15px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
              ₹32.5L
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#F3EAFF]" style={{ border: '1px solid rgba(114,46,209,0.16)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#722ED1]" style={{ animation: 'hozieStatusPulse 2.5s ease-in-out infinite' }} />
            <span className="text-[11px] font-medium text-[#722ED1]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>86% confidence</span>
          </div>
          <div className="flex flex-col gap-1 w-[140px]">
            <div className="h-1.5 bg-[#F3EAFF] rounded-full overflow-hidden">
              <div className="h-full bg-[#722ED1] rounded-full" style={{ width: '86%' }} />
            </div>
            <span className="text-[9px] text-[#9A949D] text-right" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>AI CONFIDENCE</span>
          </div>
        </div>
      </div>
```

to:

```tsx
          <div className="text-[34px] sm:text-[40px] font-semibold leading-none" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif', color: 'rgb(40, 40, 40)' }}>
            {totalLabel}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[13px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
              Estimated average:
            </span>
            <span className="text-[15px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
              {averageLabel}
            </span>
          </div>
        </div>
      </div>
```

(The stacked-bar/legend section further down `TotalCard` already reads from its local `categories` parameter — no change needed there beyond the signature, since it already used the name `categories`.)

Change the `CategoryCard` list call site:

```tsx
                  <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.1s both' }}>
                    <TotalCard />
                  </div>
```

to:

```tsx
                  <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.1s both' }}>
                    <TotalCard categories={categories} totalLabel={totalLabel} averageLabel={averageLabel} />
                  </div>
```

(`categories`, `totalLabel`, `averageLabel` are local variables computed inside the main component — added in Step 5.)

Change `CategoryCard`'s "View details →" button — since `dest` no longer exists, drop the button entirely:

```tsx
          {/* Detail text + link */}
          <div className="flex items-center justify-between gap-3">
            <span
              className="text-[12px] text-[#9A949D] leading-[1.5]"
              style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
            >
              {cat.detail}
            </span>
            <button
              onClick={() => cat.dest && onNavigate(cat.dest)}
              className="shrink-0 text-[12px] hover:underline cursor-pointer border-0 bg-transparent p-0 whitespace-nowrap"
              style={{ fontFamily: '"Open Sans:Regular", sans-serif', color: cat.color }}
            >
              View details →
            </button>
          </div>
```

to:

```tsx
          {/* Detail text */}
          <span
            className="text-[12px] text-[#9A949D] leading-[1.5]"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            {cat.detail}
          </span>
```

Update `CategoryCard`'s props (it no longer needs `onNavigate`):

```tsx
function CategoryCard({ cat, onNavigate }: { cat: Category; onNavigate: (s: string) => void }) {
```

to:

```tsx
function CategoryCard({ cat }: { cat: Category }) {
```

And its call site:

```tsx
                    {categories.map((cat, i) => (
                      <div key={cat.id} style={{ animation: `welcomeFadeUp 0.4s ease-out ${0.15 + i * 0.06}s both` }}>
                        <CategoryCard cat={cat} onNavigate={onNavigate} />
                      </div>
                    ))}
```

to:

```tsx
                    {categories.map((cat, i) => (
                      <div key={cat.id} style={{ animation: `welcomeFadeUp 0.4s ease-out ${0.15 + i * 0.06}s both` }}>
                        <CategoryCard cat={cat} />
                      </div>
                    ))}
```

Change `EstimateSummaryPanel`'s signature and total row:

```tsx
function EstimateSummaryPanel() {
  return (
```

to:

```tsx
function EstimateSummaryPanel({ categories, averageLabel }: { categories: Category[]; averageLabel: string }) {
  return (
```

Inside it, change:

```tsx
        <div className="border-t border-[#E3DDD7] pt-2.5 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>Total (avg)</span>
          <span className="text-[14px] font-semibold text-[#722ED1]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>₹32.5L</span>
        </div>
```

to:

```tsx
        <div className="border-t border-[#E3DDD7] pt-2.5 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>Total (avg)</span>
          <span className="text-[14px] font-semibold text-[#722ED1]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>{averageLabel}</span>
        </div>
```

And its call site:

```tsx
                  <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.24s both' }}>
                    <EstimateSummaryPanel />
                  </div>
```

to:

```tsx
                  <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.24s both' }}>
                    <EstimateSummaryPanel categories={categories} averageLabel={averageLabel} />
                  </div>
```

- [ ] **Step 3: Remove the four now-unused category icon components' `dest`-only usage is fine to leave (icons are still used); no icon component changes needed.**

(No action — `IcoMaterials`, `IcoLabour`, `IcoFinishing`, `IcoServices`, `IcoContingency` stay defined; `IcoServices` and `IcoContingency` are simply not referenced in the new 4-item `categories` array, which is fine — TypeScript won't flag unused top-level function declarations as an error, only unused local variables/imports. If typecheck or a linter DOES flag `IcoServices` as unused after this change, delete that one icon function — check in Step 6's verification.)

- [ ] **Step 4: Change the main component's props and resolve the estimate**

Change:

```ts
export default function CostBreakdownScreen({
  onNavigate,
  projectName = '3 BHK G+1 House',
  location = 'Hyderabad',
  area = '2,400 sq ft',
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  projectName?: string
  location?: string
  area?: string
}) {
  return (
```

to:

```ts
export default function CostBreakdownScreen({
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
      <div className="flex flex-col items-center justify-center gap-4 text-center px-6" style={{ height: '100%', backgroundColor: '#FBF9F7' }}>
        <span className="text-[18px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
          We couldn&apos;t find that estimate.
        </span>
        <button
          onClick={() => onNavigate('estimate-dashboard')}
          className="h-[48px] px-6 rounded-[12px] bg-[#722ED1] text-white text-[14px] font-semibold cursor-pointer hover:brightness-90 transition-all border-0"
          style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
        >
          Back to estimate
        </button>
      </div>
    )
  }

  const areaLabel = `${estimate.builtUpAreaSqft.toLocaleString('en-IN')} sq ft`
  const formatRupees = (value: number) => `₹${(value / 100000).toFixed(1)}L`
  const midpoint = (estimate.totalLow + estimate.totalHigh) / 2
  const totalLabel = `${formatRupees(estimate.totalLow)} — ${formatRupees(estimate.totalHigh)}`
  const averageLabel = formatRupees(midpoint)
  const categories: Category[] = [
    { id: 'materials', label: 'Materials', amount: formatRupees(estimate.breakdown.materials), pct: 56, icon: <IcoMaterials />, detail: 'Cement, steel, bricks, aggregates and other raw materials.', color: '#E14B19', bg: '#FFF2E8' },
    { id: 'labour', label: 'Labour', amount: formatRupees(estimate.breakdown.labour), pct: 26, icon: <IcoLabour />, detail: 'Civil, plumbing, electrical and finishing labour charges.', color: '#E19C12', bg: '#FFFBE6' },
    { id: 'finishing', label: 'Finishing', amount: formatRupees(estimate.breakdown.finishing), pct: 13, icon: <IcoFinishing />, detail: 'Flooring, painting, doors, windows and interior finishes.', color: '#4AB017', bg: '#F6FFED' },
    { id: 'contingency', label: 'Contingency', amount: formatRupees(estimate.breakdown.contingency), pct: 5, icon: <IcoContingency />, detail: 'Buffer for unforeseen costs and estimation variance.', color: '#7E7E7E', bg: '#F5F5F5' },
  ]

  return (
```

Add the imports at the top of the file:

```ts
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { getEstimate } from '../mock/selectors'
```

- [ ] **Step 5: Wire the header line**

Change:

```tsx
              <span className="text-[13px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                {projectName} · {location} · {area}
              </span>
```

to:

```tsx
              <span className="text-[13px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                {estimate.projectName} · {estimate.location} · {areaLabel}
              </span>
```

- [ ] **Step 6: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS. If typecheck flags `IcoServices` as an unused declaration, delete that one function (per Step 3's note) and re-run.

Browser check: continuing the walkthrough, from `estimate-dashboard` navigate to Cost Breakdown — confirm exactly 4 categories (Materials/Labour/Finishing/Contingency), no "Services" card, no "View details →" links, no confidence badge, and every amount matches `estimate-dashboard`'s numbers exactly (same underlying `estimate.breakdown`). Confirm "Total Estimated Cost" and "Estimated average" match the dashboard's total/midpoint. Then navigate to `#cost-breakdown` with a bogus `estimate_id` and confirm the honest "We couldn't find that estimate." state.

- [ ] **Step 7: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/screens/CostBreakdownScreen.tsx src/App.tsx
git commit -m "feat: CostBreakdownScreen shows the real 4-category breakdown"
```

---

### Task 9: Remaining side-nav wiring, `App.tsx` cleanup, full walkthrough, spec status

**Files:**
- Modify: `src/screens/HomeDashboardScreen.tsx`
- Modify: `src/screens/AIAdvisorScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `docs/superpowers/specs/2026-09-29-phase-8-homeowner-estimate-modernization-design.md`

- [ ] **Step 1: Fix the two remaining disabled "Estimates" nav items**

In `src/screens/HomeDashboardScreen.tsx`, change:

```ts
    { id: 'estimates', icon: <IcoEstimates />, label: 'Estimates', dest: '' },
```

to:

```ts
    { id: 'estimates', icon: <IcoEstimates />, label: 'Estimates', dest: 'estimate-dashboard' },
```

In `src/screens/AIAdvisorScreen.tsx`, change the same line the same way.

(`src/screens/CostBreakdownScreen.tsx` and `src/components/HomeownerMobileMenu.tsx` already had this correctly wired before this plan — no change needed there.)

- [ ] **Step 2: Remove the now-unused `projectName`/`projectLocation` derivation in `App.tsx`**

All three consumers (`EstimateLoadingScreen`, `EstimateDashboardScreen`, `CostBreakdownScreen`) were switched to `estimateId` in Tasks 6-8. Confirm with a search that nothing else in `App.tsx` still reads `projectName`/`projectLocation`, then remove:

```ts
  const projectName = params.project_name ?? '3 BHK G+1 House'
  const projectLocation = params.location ?? 'Hyderabad'
```

Run `grep -n "projectName\|projectLocation" src/App.tsx` first — if anything else still references them, stop and report it rather than deleting (a stray reference would mean an earlier task's edit was incomplete).

- [ ] **Step 3: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

- [ ] **Step 4: Full browser walkthrough**

Using http://localhost:5174, homeowner demo sign-in (`localStorage.setItem("houzeify:session", JSON.stringify({accountType:"homeowner",personId:"person-demo-homeowner"}))`):

1. From the homeowner dashboard, open the side menu — confirm "Estimates" is no longer greyed out (check both the desktop sidebar in each of the 4 screens you'll visit, and the phone drawer via `HomeownerMobileMenu` at a narrow viewport).
2. Go to `#create-project`. Fill in a project name, pick "Ready to estimate," enter built-up area 1800 and floors 2, pick "Premium." Click Continue.
3. On `estimate-loading`, confirm the project-context card shows your real project name/location/area, and after the animation, "View estimate →" appears.
4. Click through to `estimate-dashboard` — confirm the total range is `1950×1800`–`2400×1800` (₹35.1L–₹43.2L), the per-sq-ft range and all four metric cards match, and there is no confidence badge.
5. Click "Explore cost drivers →" into `cost-breakdown` — confirm exactly 4 categories, amounts matching the dashboard, no confidence badge, no dead "View details" links.
6. Click the side menu "Estimates" item from anywhere — confirm it reopens this same estimate (via `getLatestEstimate`).
7. Manually edit the URL hash to remove `estimate_id` from `#cost-breakdown` and reload — confirm the honest "not found" state, not a default project.

- [ ] **Step 5: Update spec status**

In `docs/superpowers/specs/2026-09-29-phase-8-homeowner-estimate-modernization-design.md`, change:

```
**Status:** Approved — ready for planning
```

to:

```
**Status:** Implemented
```

- [ ] **Step 6: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/screens/HomeDashboardScreen.tsx src/screens/AIAdvisorScreen.tsx src/App.tsx docs/superpowers/specs/2026-09-29-phase-8-homeowner-estimate-modernization-design.md
git commit -m "feat: wire remaining Estimates nav links; Phase 8 slice 1 spec implemented"
```
