# Phase 8 (Homeowner AI, Slice 2) — Estimate Flow Ant Design Modernization

**Date:** 2026-09-29
**Branch:** `feature/estimate-antd-modernization` (from `main`)
**Status:** Approved — ready for planning
**Source:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` → §10 Phase 8 — AI Construction Advisor, §10.1 Homeowner AI
**Follows:** Slice 1 — `docs/superpowers/specs/2026-09-29-phase-8-homeowner-estimate-modernization-design.md` (data wiring; explicitly deferred this visual work)

## Goal

Slice 1 wired the homeowner's estimate flow (`CreateProjectScreen` → `EstimateLoadingScreen` → `EstimateDashboardScreen` → `CostBreakdownScreen`) to real, computed `Estimate` data but deliberately left all four screens on their original hand-rolled Tailwind/inline-style markup (~2,000 lines, no Ant Design at all) to avoid rewiring and redesigning the same code at once. This slice does the deferred visual rebuild: the same four screens, the same user journey, the same real data — rebuilt on Ant Design 6, matching how every company-side screen (and the homeowner's own `CustomerDailyUpdateScreen`, built in Phase 7) is already built in this app.

| Scope | Included |
|---|---|
| **This spec** | Rebuild `CreateProjectScreen`, `EstimateLoadingScreen`, `EstimateDashboardScreen`, `CostBreakdownScreen` on Ant Design; extract their duplicated sidebar/nav chrome into one shared layout |
| Out of scope | Any data/logic change — `generateEstimate`, selectors, navigation param semantics, and every empty/error-state condition stay exactly as Slice 1 left them |
| Out of scope | `HomeDashboardScreen`, `AIAdvisorScreen`, `HomeownerMobileMenu` — not rebuilt; the new shared layout is scoped to these 4 screens only |
| Out of scope | Phase 8's other sub-areas (Partner AI, Site AI, Project AI) |

## Locked decisions (from brainstorming — do not revisit)

1. **Keep the personality, rebuild the structure.** The ambient purple-blur background, the pulsing Hozie mascot icon during loading, and the page-load fade/reveal animations all survive. What changes is the underlying component: custom-built cards/buttons/inputs/step-lists become Ant Design `Card`/`Button`/`Form`/`Steps` components, styled through the theme, not raw hex values.
2. **One shared `HomeownerLayout` component**, not four duplicated copies. Each of the 4 screens currently hand-rolls its own ~150-line sidebar/nav-icon/mobile-header block (confirmed via `grep -rln "id: 'estimates'"`: `CreateProjectScreen.tsx`, `EstimateDashboardScreen.tsx`, `CostBreakdownScreen.tsx` each have their own copy, plus `HomeDashboardScreen.tsx`/`AIAdvisorScreen.tsx` outside this slice's scope). This slice builds it once, mirroring how `CompanyLayout.tsx` already serves every company screen.

## 1. Shared components

### `src/components/homeowner/homeownerNav.ts` (new)

Single source of truth for the homeowner side-menu, mirroring `src/components/company/companyNav.tsx`'s role exactly:

```ts
export type HomeownerNavKey = "home" | "advisor" | "projects" | "estimates" | "boq" | "plan"
export type HomeownerToolKey = "calc" | "reports"
export type HomeownerBottomKey = "help" | "settings"

export interface HomeownerNavItem<K extends string> {
  key: K
  label: string
  icon: ReactNode
  /** Where it goes. Omitted = planned, not built yet ("Soon"). */
  to?: string
}

export const HOMEOWNER_NAV: HomeownerNavItem<HomeownerNavKey>[] = [
  { key: "home", label: "Dashboard", icon: <IcoHome />, to: "dashboard-home" },
  { key: "advisor", label: "AI Advisor", icon: <IcoAdvisor />, to: "ai-advisor" },
  { key: "projects", label: "Projects", icon: <IcoProjects /> },
  { key: "estimates", label: "Estimates", icon: <IcoEstimates />, to: "estimate-dashboard" },
  { key: "boq", label: "BOQ", icon: <IcoBOQ /> },
  { key: "plan", label: "Plan Analysis", icon: <IcoPlan /> },
]
export const HOMEOWNER_TOOLS_NAV: HomeownerNavItem<HomeownerToolKey>[] = [
  { key: "calc", label: "Material Calculator", icon: <IcoCalc /> },
  { key: "reports", label: "Reports", icon: <IcoReports /> },
]
export const HOMEOWNER_BOTTOM_NAV: HomeownerNavItem<HomeownerBottomKey>[] = [
  { key: "help", label: "Help", icon: <IcoHelp /> },
  { key: "settings", label: "Settings", icon: <IcoSettings /> },
]
```

(Icon components are the existing inline SVGs already duplicated across the 4 screens — consolidated here, kept visually identical, not redrawn.) `"estimates"` is `"estimate-dashboard"` in every entry — this closes out Slice 1's own nav-consistency work permanently; no screen can drift back to a disabled `""` destination since there's only one array left to edit.

### `src/components/homeowner/HomeownerLayout.tsx` (new)

Mirrors `CompanyLayout.tsx`'s role: shared chrome so no screen builds its own sidebar.

```ts
export default function HomeownerLayout({
  active,
  onNavigate,
  children,
}: {
  active: HomeownerNavKey
  onNavigate: (screen: string, data?: Record<string, string>) => void
  children: ReactNode
}): JSX.Element
```

Renders: desktop sidebar (Ant `Menu`, `selectedKeys={[active]}`, items from `HOMEOWNER_NAV`/`HOMEOWNER_TOOLS_NAV`/`HOMEOWNER_BOTTOM_NAV`, disabled for entries with no `to`), the existing `HomeownerMobileMenu` component unchanged for the phone drawer, and a content `<main>` slot. Wrapped internally in the existing `CompanyThemeProvider` (already homeowner-compatible — `colorBgLayout: "#FBF9F7"` matches these screens' current background exactly, and it's what `CustomerDailyUpdateScreen.tsx` already uses despite the provider's company-sounding name; not renamed here — that would touch every company screen, out of scope).

### `src/components/homeowner/AmbientBg.tsx` (new, extracted)

The purple-blur ambient background, currently duplicated with genuinely different values per screen (confirmed by reading all four — blur sizes, positions, and opacities differ, not just copy-paste drift). Extracted as one component with a `variant` prop, preserving each screen's exact existing values rather than unifying them:

```ts
export type AmbientBgVariant = "create-project" | "estimate-loading" | "estimate-dashboard" | "cost-breakdown"
export default function AmbientBg({ variant }: { variant: AmbientBgVariant }): JSX.Element
```

Each variant's three blur-circle definitions (position, size, color, blur radius) are copied verbatim from that screen's current inline `AmbientBg` function — a lookup table inside the component, not a redesign.

## 2. Screen-by-screen mapping

### `CreateProjectScreen`

- Project name, location → Ant `Form.Item` + `Input`.
- Built-up area, floors → Ant `Form.Item` + `InputNumber` (min 1).
- Property type, stage, construction level pickers → stay a group of clickable cards (bordered, purple-filled when selected, checkmark badge — today's exact visual), rebuilt as Ant `Card` (`hoverable`, `styles={{ body: ... }}`) in a controlled group rather than raw `<button>`s.
- The 01/02/03 "PROJECT / DETAILS / ESTIMATE" strip → Ant `Steps` (`size="small"`, horizontal).
- "Continue to project details →" → Ant `Button type="primary" size="large"`, `disabled={!canContinue}` (the `canContinue` logic itself is unchanged from Slice 1).
- Wrapped in `HomeownerLayout active="estimates"`.

### `EstimateLoadingScreen`

- `ProcessingIcon` (pulsing Hozie tile + expanding rings) → unchanged, custom, not an AntD component.
- The 5-item step checklist (`STEP_LABELS`, done/active/pending) → Ant `Steps` (`direction="vertical"`, `size="small"`, `status` per item).
- The progress bar → Ant `Progress` (`percent={phase.progress}`, `showInfo={false}`, `strokeColor="#722ED1"`).
- The honest failure state (added in Slice 1) → Ant `Result status="error"` with a "Start over" `Button`.
- "View estimate →" → `Button type="primary" size="large"`.
- No `HomeownerLayout` wrapper — this screen has no sidebar today (a focused, full-bleed processing screen) and stays that way.

### `EstimateDashboardScreen`

- Hero total card → Ant `Card` (gradient background kept via `style`), with the total range and per-sq-ft range as `Typography.Title`/`Text` (not `Statistic`, since `Statistic` expects one number and this shows a range — a legitimate case where the current custom rendering is more correct than forcing an AntD primitive that doesn't fit).
- The 4 summary metric cards → Ant `Card` + `Statistic` (`title`, `value`, `valueStyle={{ color }}`).
- The multi-color segmented breakdown bar (Materials/Labour/Finishing/Contingency in one bar) → stays a small bespoke component (no direct AntD equivalent for a single multi-segment bar); styled through the theme's color tokens, not raw hex.
- The construction-level badge (replacing Slice 1's already-removed fake confidence badge) → Ant `Tag color="purple"`.
- Empty state ("You haven't created an estimate yet.") and not-found state ("We couldn't find that estimate.") → Ant `Empty` with a `Button` action, or `Result` — pick one consistently for both, since they're the same shape (message + single CTA).
- Next-action cards (View BOQ, Material Calculator, Analyze Plan, Find Contractors) → Ant `Card` (`hoverable`) in a `Row`/`Col` grid.
- Wrapped in `HomeownerLayout active="estimates"`.

### `CostBreakdownScreen`

- Total card (same numbers as the dashboard's hero) → shares the dashboard's total-card sub-component rather than a second hand-written copy, since both screens render the literal same `estimate.totalLow`/`totalHigh`/`breakdown` — extract one `EstimateTotalSummary` component used by both screens.
- The 4 category rows → Ant `Card` per category, each with a single-value Ant `Progress` bar (`percent={cat.pct}`, `strokeColor={cat.color}`) — this one has a direct, correct AntD fit (unlike the dashboard's multi-segment bar).
- The right-column summary panel → Ant `Card` + a simple list (`Flex`/`Typography`, or `Descriptions` if it reads more cleanly) totalling to the same average shown elsewhere.
- Not-found state → same `Empty`/`Result` pattern as the dashboard.
- Wrapped in `HomeownerLayout active="estimates"`.

## 3. Rules

- No change to `generateEstimate`, `getEstimate`, `getLatestEstimate`, or any navigation param (`estimate_id`, `SCOPED_PARAMS`) — this slice is presentation-only.
- Every empty/error-state *condition* from Slice 1 (missing estimate, stale id, zero estimates) renders through the identical logic; only the rendered component changes.
- `HomeownerLayout`/`homeownerNav` are scoped to these 4 screens; not retrofitted onto `HomeDashboardScreen`/`AIAdvisorScreen` in this slice.
- The Houzeify purple (`#722ED1`) and the existing `#FBF9F7` background stay the visual identity — this must not read as a generic Ant Design admin dashboard, matching the same non-negotiable from Slice 1's original reference prompt.
- Ambient background, Hozie icon, and CSS keyframe animations (`estimatePulse`, `estimateReveal`, `welcomeFadeUp`, etc., already in `src/index.css`) are preserved, not replaced with AntD's own motion primitives.

## 4. Testing

No new domain tests — no domain logic changes. Verification is a browser walkthrough covering every state each screen already handles:

- `CreateProjectScreen`: empty form (Continue disabled), filled form (Continue enabled), each picker's selected/unselected visual.
- `EstimateLoadingScreen`: in-progress animation plays fully, success path ("View estimate →" appears and works), honest failure path (bad `estimate_id` → `Result status="error"`).
- `EstimateDashboardScreen`: populated (real numbers, matching the same formula-verified figures from Slice 1), "no estimate yet" empty state, "couldn't find that estimate" not-found state, `getLatestEstimate` fallback via the side-menu "Estimates" link.
- `CostBreakdownScreen`: populated (numbers matching the dashboard exactly, since they share the new `EstimateTotalSummary` component), not-found state.
- Responsive check: at a narrow viewport, `HomeownerMobileMenu`'s drawer still opens correctly from within the new `HomeownerLayout`, and every screen's cards/forms reflow sanely (no horizontal scroll, no cut-off text).

Existing checks still pass: `pnpm run typecheck`, `pnpm run test`, `pnpm run build`.

### Out of scope

Any data/logic change. `HomeDashboardScreen`, `AIAdvisorScreen`, `HomeownerMobileMenu` internals (reused, not rebuilt). `CustomerDailyUpdateScreen` (already Ant Design). Renaming `CompanyThemeProvider`. Company-side screens. Phase 8's Partner AI / Site AI / Project AI sub-areas. Building a general-purpose multi-segment AntD progress primitive (the bespoke bar stays bespoke).

## Acceptance

```text
The same 4-screen flow, the same real Estimate data, the same empty/error states
— but built on Ant Design: Form/Button/Card/Steps/Progress/Statistic/Result/Empty,
one shared HomeownerLayout instead of 4 duplicated sidebars, Houzeify purple and
the existing ambient/Hozie personality intact throughout.
```

Existing checks still pass: `pnpm run typecheck`, `pnpm run test`, `pnpm run build`.
