# Phase 8 (Homeowner AI, Slice 2) — Estimate Flow Ant Design Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homeowner's 4-screen estimate flow (`CreateProjectScreen`, `EstimateLoadingScreen`, `EstimateDashboardScreen`, `CostBreakdownScreen`) on Ant Design components, consolidating their duplicated sidebar/nav chrome into one shared `HomeownerLayout`, while preserving the ambient background, Hozie mascot animation, and page-load motion that give these screens their identity. Presentation-only — no data, command, selector, or navigation-param changes.

**Architecture:** Two new small shared components (`homeownerNav.ts`, `HomeownerLayout.tsx`, mirroring `CompanyLayout.tsx`'s established role) plus an extracted `AmbientBg.tsx`, then each screen rebuilt one at a time on top of them using Ant `Form`/`Card`/`Steps`/`Progress`/`Statistic`/`Result`/`Empty`, following this codebase's existing company-screen idioms (`KpiCard.tsx`'s `Card`+`Statistic` pattern, `CompanyLayout.tsx`'s `Layout`/`Sider`/`Drawer`/`Menu` pattern).

**Tech Stack:** React 19, TypeScript 5.7, Ant Design 6.6.5, `@ant-design/icons`, Vite, Vitest. Package manager pnpm.

**Spec:** `docs/superpowers/specs/2026-09-29-phase-8-estimate-flow-antd-modernization-design.md`

## Global Constraints

- Checks: `pnpm run typecheck`, `pnpm run test`, `pnpm run build` must pass after every task.
- **Never run `pnpm run format`** (oxfmt 0.2.0 strips `;` in TypeScript types and breaks the build).
- Git commands need `export PATH="/opt/homebrew/bin:$PATH"` first (git-lfs hooks).
- All four screen files (`CreateProjectScreen.tsx`, `EstimateLoadingScreen.tsx`, `EstimateDashboardScreen.tsx`, `CostBreakdownScreen.tsx`) currently use single quotes, no semicolons. The new shared components (`homeownerNav.ts`, `HomeownerLayout.tsx`, `AmbientBg.tsx`) follow the same convention every other file under `src/components/` uses: double quotes, no semicolons (matching `CompanyLayout.tsx`, `companyNav.tsx`, `KpiCard.tsx`).
- **No data/logic changes**: `generateEstimate`, `getEstimate`, `getLatestEstimate`, and `SCOPED_PARAMS` (already includes `"estimate_id"` from Slice 1's final fix wave) are not touched by this plan. Every empty/error-state *condition* (missing estimate, stale id, zero estimates) stays exactly as Slice 1 left it — only the rendered component changes.
- Houzeify purple `#722ED1` and the existing `#FBF9F7` background stay the visual identity — this must read as "the same screens, polished," not a generic Ant Design admin dashboard.
- Ambient background, Hozie mascot icon usage, and the CSS keyframe animations already in `src/index.css` (`welcomeFadeUp`, `estimatePulse`, `estimateReveal`, `estimateButtonPop`, `estimateRingExpand`, `hozieStatusPulse`, `successBadgePop`) are preserved unchanged — do not replace them with AntD's own motion.
- `CompanyThemeProvider` (`src/components/company/CompanyThemeProvider.tsx`) is reused as-is for these homeowner screens (already used by `CustomerDailyUpdateScreen.tsx`) — it is not renamed or modified.
- `HomeownerMobileMenu.tsx` is reused unchanged for the phone drawer — not rebuilt. `HomeDashboardScreen.tsx`, `AIAdvisorScreen.tsx` are not touched by this plan.

## File Structure

| File | Responsibility |
|---|---|
| `src/components/homeowner/homeownerNav.ts` (create) | Single source of truth for the homeowner desktop side-menu's items/icons/destinations |
| `src/components/homeowner/AmbientBg.tsx` (create) | The purple-blur ambient background, one component with a `variant` per screen |
| `src/components/homeowner/HomeownerLayout.tsx` (create) | Shared chrome: desktop sidebar (`Menu`), mobile drawer (reuses `HomeownerMobileMenu`), content slot |
| `src/screens/CreateProjectScreen.tsx` (rewrite) | Ant Design form: project name, property type, location, stage, built-up area, floors, construction level |
| `src/screens/EstimateLoadingScreen.tsx` (rewrite) | Ant `Steps`/`Progress`/`Result` for the loading/success/failure states |
| `src/components/homeowner/EstimateTotalSummary.tsx` (create) | Shared "total cost" card used identically by the Dashboard and Cost Breakdown screens |
| `src/screens/EstimateDashboardScreen.tsx` (rewrite) | Ant `Card`/`Statistic`/`Empty`/`Result` for the estimate workspace |
| `src/screens/CostBreakdownScreen.tsx` (rewrite) | Ant `Card`/`Progress` per category, reusing `EstimateTotalSummary` |

---

### Task 1: Shared nav data and ambient background

**Files:**
- Create: `src/components/homeowner/homeownerNav.ts`
- Create: `src/components/homeowner/AmbientBg.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type HomeownerNavKey = "home" | "advisor" | "projects" | "estimates" | "boq" | "plan"
  export interface HomeownerNavItem {
    key: HomeownerNavKey
    label: string
    icon: ReactNode
    to?: string
  }
  export const HOMEOWNER_NAV: HomeownerNavItem[]
  export const HOMEOWNER_TOOLS_NAV: { key: string; label: string; icon: ReactNode }[]
  export const HOMEOWNER_BOTTOM_NAV: { key: string; label: string; icon: ReactNode }[]
  ```
  ```ts
  export type AmbientBgVariant = "create-project" | "estimate-loading" | "estimate-dashboard" | "cost-breakdown"
  export default function AmbientBg({ variant }: { variant: AmbientBgVariant }): JSX.Element
  ```
  Task 3 (`HomeownerLayout`) consumes `HOMEOWNER_NAV`/`HOMEOWNER_TOOLS_NAV`/`HOMEOWNER_BOTTOM_NAV`. Tasks 4, 5, 7, 8 (the four screens) each consume `AmbientBg`.

- [ ] **Step 1: Create `homeownerNav.ts`**

The icons below are copied verbatim from the SVG definitions already duplicated identically across `CreateProjectScreen.tsx`, `EstimateDashboardScreen.tsx`, and `CostBreakdownScreen.tsx` (each file's `IcoHome`/`IcoAdvisor`/`IcoProjects`/`IcoEstimates`/`IcoBOQ`/`IcoPlan`/`IcoCalc`/`IcoReports`/`IcoHelp`/`IcoSettings` functions are byte-identical across all three files — confirmed during planning). Create `src/components/homeowner/homeownerNav.ts`:

```ts
import type { ReactNode } from "react"

const IcoHome = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9L9 3l7 6" /><path d="M4 8v8h3.5v-4h3v4H14V8" />
  </svg>
)
const IcoAdvisor = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 1.5L10.6 5.4L14.5 7 10.6 8.6 9 12.5 7.4 8.6 3.5 7l3.9-1.6L9 1.5z" />
    <path d="M14 12l.9 1.9 1.6.6-1.6.6-.9 1.9-.9-1.9-1.6-.6 1.6-.6.9-1.9z" strokeWidth="1.2" />
  </svg>
)
const IcoProjects = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 6a1.5 1.5 0 011.5-1.5H7l1.5 2H16a1.5 1.5 0 011.5 1.5V14A1.5 1.5 0 0116 15.5H2A1.5 1.5 0 01.5 14V6z" />
  </svg>
)
const IcoEstimates = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="2" width="12" height="14" rx="1.5" />
    <line x1="6" y1="6.5" x2="12" y2="6.5" /><line x1="6" y1="9.5" x2="12" y2="9.5" /><line x1="6" y1="12.5" x2="10" y2="12.5" />
  </svg>
)
const IcoBOQ = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="3.5" cy="5" r="0.8" fill="currentColor" stroke="none" />
    <line x1="6.5" y1="5" x2="15" y2="5" />
    <circle cx="3.5" cy="9" r="0.8" fill="currentColor" stroke="none" />
    <line x1="6.5" y1="9" x2="15" y2="9" />
    <circle cx="3.5" cy="13" r="0.8" fill="currentColor" stroke="none" />
    <line x1="6.5" y1="13" x2="15" y2="13" />
  </svg>
)
const IcoPlan = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="14" height="14" rx="2" />
    <line x1="2" y1="7.5" x2="16" y2="7.5" />
    <line x1="7.5" y1="7.5" x2="7.5" y2="16" />
  </svg>
)
const IcoCalc = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="2" width="12" height="14" rx="1.5" />
    <rect x="5.5" y="4.5" width="7" height="2.5" rx="0.5" />
    <circle cx="6" cy="10" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="9" cy="10" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="12" cy="10" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="6" cy="13" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="9" cy="13" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="12" cy="13" r="0.7" fill="currentColor" stroke="none" />
  </svg>
)
const IcoReports = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="15.5" x2="15" y2="15.5" />
    <line x1="4" y1="15.5" x2="4" y2="9" /><line x1="7.5" y1="15.5" x2="7.5" y2="5" />
    <line x1="11" y1="15.5" x2="11" y2="8" /><line x1="14.5" y1="15.5" x2="14.5" y2="3" />
  </svg>
)
const IcoHelp = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="7" />
    <path d="M6.5 6.5a2.5 2.5 0 015 0c0 2-2.5 2.5-2.5 3.5" />
    <circle cx="9" cy="14" r="0.6" fill="currentColor" stroke="none" />
  </svg>
)
const IcoSettings = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="2.5" />
    <path d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M4.1 4.1l1.06 1.06M12.84 12.84l1.06 1.06M4.1 13.9l1.06-1.06M12.84 5.16l1.06-1.06" />
  </svg>
)

export type HomeownerNavKey = "home" | "advisor" | "projects" | "estimates" | "boq" | "plan"

export interface HomeownerNavItem {
  key: HomeownerNavKey | string
  label: string
  icon: ReactNode
  /** Where it goes. Omitted = planned, not built yet ("Soon"). */
  to?: string
}

/** The homeowner desktop side-menu, defined once so every screen stays in sync. */
export const HOMEOWNER_NAV: HomeownerNavItem[] = [
  { key: "home", label: "Dashboard", icon: <IcoHome />, to: "dashboard-home" },
  { key: "advisor", label: "AI Advisor", icon: <IcoAdvisor />, to: "ai-advisor" },
  { key: "projects", label: "Projects", icon: <IcoProjects /> },
  { key: "estimates", label: "Estimates", icon: <IcoEstimates />, to: "estimate-dashboard" },
  { key: "boq", label: "BOQ", icon: <IcoBOQ /> },
  { key: "plan", label: "Plan Analysis", icon: <IcoPlan /> },
]

export const HOMEOWNER_TOOLS_NAV: HomeownerNavItem[] = [
  { key: "calc", label: "Material Calculator", icon: <IcoCalc /> },
  { key: "reports", label: "Reports", icon: <IcoReports /> },
]

export const HOMEOWNER_BOTTOM_NAV: HomeownerNavItem[] = [
  { key: "help", label: "Help", icon: <IcoHelp /> },
  { key: "settings", label: "Settings", icon: <IcoSettings /> },
]
```

Note: this file has a `.ts` extension but contains JSX — it must actually be named `homeownerNav.tsx` (matching `companyNav.tsx`'s own extension, which also holds JSX icon definitions). Use `.tsx`, not `.ts`, for this file despite the "Files" table above — that table's `.ts` is a shorthand, the real file is `homeownerNav.tsx`.

- [ ] **Step 2: Create `AmbientBg.tsx`**

The four variants below are copied verbatim from each screen's current inline `AmbientBg` function (confirmed by reading all four during planning — the values genuinely differ per screen, not copy-paste drift). Create `src/components/homeowner/AmbientBg.tsx`:

```tsx
export type AmbientBgVariant = "create-project" | "estimate-loading" | "estimate-dashboard" | "cost-breakdown"

interface Blob {
  top?: number | string
  right?: number | string
  bottom?: number | string
  left?: number | string
  transform?: string
  width: number
  height: number
  backgroundColor: string
  filter: string
}

const VARIANTS: Record<AmbientBgVariant, Blob[]> = {
  "create-project": [
    { top: -80, right: -200, width: 580, height: 580, backgroundColor: "rgba(114,46,209,0.05)", filter: "blur(130px)" },
    { bottom: -150, left: -100, width: 500, height: 500, backgroundColor: "rgba(243,234,255,0.60)", filter: "blur(120px)" },
    { top: "60%", right: "10%", width: 340, height: 340, backgroundColor: "rgba(243,234,255,0.45)", filter: "blur(90px)" },
  ],
  "estimate-loading": [
    { top: -120, right: -180, width: 600, height: 600, backgroundColor: "rgba(114,46,209,0.048)", filter: "blur(130px)" },
    { bottom: -160, left: -120, width: 680, height: 680, backgroundColor: "rgba(243,234,255,0.55)", filter: "blur(140px)" },
    { top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 520, height: 520, backgroundColor: "rgba(114,46,209,0.028)", filter: "blur(110px)" },
  ],
  "estimate-dashboard": [
    { top: -100, right: -180, width: 560, height: 560, backgroundColor: "rgba(114,46,209,0.045)", filter: "blur(120px)" },
    { bottom: -160, left: -100, width: 620, height: 620, backgroundColor: "rgba(243,234,255,0.52)", filter: "blur(140px)" },
    { top: "40%", left: "42%", transform: "translate(-50%,-50%)", width: 480, height: 480, backgroundColor: "rgba(114,46,209,0.026)", filter: "blur(100px)" },
  ],
  "cost-breakdown": [
    { top: -100, right: -180, width: 560, height: 560, backgroundColor: "rgba(114,46,209,0.042)", filter: "blur(130px)" },
    { bottom: -160, left: -100, width: 640, height: 640, backgroundColor: "rgba(243,234,255,0.50)", filter: "blur(140px)" },
    { top: "55%", right: "15%", width: 380, height: 380, backgroundColor: "rgba(243,234,255,0.38)", filter: "blur(90px)" },
  ],
}

/** The purple-blur ambient background behind every estimate-flow screen. Same idea, different sizing per screen — kept exact, not unified. */
export default function AmbientBg({ variant }: { variant: AmbientBgVariant }) {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
      {VARIANTS[variant].map((blob, i) => (
        <div key={i} className="absolute rounded-full" style={blob} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS. (Nothing imports these yet — this only proves both files compile standalone.)

- [ ] **Step 4: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/components/homeowner/homeownerNav.tsx src/components/homeowner/AmbientBg.tsx
git commit -m "feat: shared homeowner nav data and ambient background component"
```

---

### Task 2: `HomeownerLayout` shared chrome

**Files:**
- Create: `src/components/homeowner/HomeownerLayout.tsx`

**Interfaces:**
- Consumes: `HOMEOWNER_NAV`, `HOMEOWNER_TOOLS_NAV`, `HOMEOWNER_BOTTOM_NAV`, `HomeownerNavKey` (Task 1); `HomeownerMobileMenu` (existing, `src/components/HomeownerMobileMenu.tsx`, unchanged); `CompanyThemeProvider` (existing, `src/components/company/CompanyThemeProvider.tsx`, unchanged).
- Produces:
  ```ts
  export default function HomeownerLayout(props: {
    active: HomeownerNavKey
    onNavigate: (screen: string, data?: Record<string, string>) => void
    children: ReactNode
  }): JSX.Element
  ```
  Tasks 4, 6, 7 (`CreateProjectScreen`, `EstimateDashboardScreen`, `CostBreakdownScreen`) wrap their content in this. `EstimateLoadingScreen` (Task 5) does NOT use it — that screen has no sidebar today and stays that way (a focused, full-bleed processing screen, per the spec).

- [ ] **Step 1: Implement**

Create `src/components/homeowner/HomeownerLayout.tsx`, following `src/components/company/CompanyLayout.tsx`'s exact structural pattern (`Layout`/`Sider`/`Drawer`/`Menu`), but simplified since the homeowner nav is flat (no company/project menu split) and the mobile drawer reuses the existing `HomeownerMobileMenu` rather than building a new one:

```tsx
import type { ReactNode } from "react"
import { Flex, Layout, Menu, Tag, type MenuProps } from "antd"
import HIcon from "../HIcon"
import LogoHorizontal from "../LogoHorizontal"
import HomeownerMobileMenu from "../HomeownerMobileMenu"
import CompanyThemeProvider from "../company/CompanyThemeProvider"
import {
  HOMEOWNER_BOTTOM_NAV,
  HOMEOWNER_NAV,
  HOMEOWNER_TOOLS_NAV,
  type HomeownerNavKey,
} from "./homeownerNav"

const { Content, Header, Sider } = Layout

function SoonLabel({ label }: { label: string }) {
  return (
    <Flex align="center" justify="space-between" gap="small">
      <span>{label}</span>
      <Tag className="m-0!">Soon</Tag>
    </Flex>
  )
}

function toMenuItem(item: { key: string; label: string; icon: ReactNode; to?: string }): NonNullable<MenuProps["items"]>[number] {
  if (!item.to) {
    return { key: item.key, icon: item.icon, label: <SoonLabel label={item.label} />, disabled: true }
  }
  return { key: item.key, icon: item.icon, label: item.label }
}

/**
 * Frame for the homeowner's estimate-flow screens: the shared side navigation
 * (a drawer on phones, via HomeownerMobileMenu), a 64px header and a scrolling
 * content area. Screens pass only their body; they never build their own sidebar.
 */
function Layout_({
  active,
  onNavigate,
  children,
}: {
  active: HomeownerNavKey
  onNavigate: (screen: string, data?: Record<string, string>) => void
  children: ReactNode
}) {
  const targets = Object.fromEntries(
    [...HOMEOWNER_NAV, ...HOMEOWNER_TOOLS_NAV, ...HOMEOWNER_BOTTOM_NAV].map((item) => [item.key, item.to]),
  )

  const go = (key: string) => {
    const to = targets[key]
    if (to) onNavigate(to)
  }

  const mainMenu = (
    <Menu
      mode="inline"
      selectedKeys={[active]}
      items={HOMEOWNER_NAV.map(toMenuItem)}
      inlineIndent={18}
      className="flex-1 border-0! overflow-y-auto"
      onClick={({ key }) => go(key)}
    />
  )
  const toolsMenu = (
    <Menu
      mode="inline"
      selectable={false}
      inlineIndent={18}
      items={[
        { type: "group", key: "tools-group", label: "Tools", children: HOMEOWNER_TOOLS_NAV.map(toMenuItem) },
      ]}
    />
  )
  const bottomMenu = (
    <Menu mode="inline" selectable={false} inlineIndent={18} items={HOMEOWNER_BOTTOM_NAV.map(toMenuItem)} />
  )

  return (
    <Layout className="h-full">
      <Sider breakpoint="lg" collapsedWidth={72} width={240} theme="light" trigger={null} className="hidden md:block">
        <Flex vertical className="h-full">
          <Flex align="center" gap="small" className="h-16 px-5 border-b border-[#F0F0F0]">
            <LogoHorizontal height={24} className="hidden lg:block" />
            <span className="lg:hidden"><HIcon size={28} /></span>
          </Flex>
          {mainMenu}
          {toolsMenu}
          {bottomMenu}
        </Flex>
      </Sider>

      <Layout className="min-w-0">
        <Header className="bg-white! flex items-center px-4 md:px-6 h-16!" style={{ borderBottom: "1px solid #F0F0F0" }}>
          <Flex align="center" gap="middle" className="h-full w-full md:hidden">
            <HomeownerMobileMenu active={active} onNavigate={onNavigate} />
            <Flex align="center" gap="small" className="flex-1">
              <HIcon size={24} />
              <span className="text-[15px] font-semibold text-[#242326]">Houzeify</span>
            </Flex>
          </Flex>
        </Header>
        <Content className="overflow-y-auto">{children}</Content>
      </Layout>
    </Layout>
  )
}

export default function HomeownerLayout(props: {
  active: HomeownerNavKey
  onNavigate: (screen: string, data?: Record<string, string>) => void
  children: ReactNode
}) {
  return (
    <CompanyThemeProvider>
      <Layout_ {...props} />
    </CompanyThemeProvider>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/components/homeowner/HomeownerLayout.tsx
git commit -m "feat: shared HomeownerLayout component"
```

---

### Task 3: `CreateProjectScreen` on Ant Design

**Files:**
- Rewrite: `src/screens/CreateProjectScreen.tsx`

**Interfaces:**
- Consumes: `HomeownerLayout` (Task 2), `AmbientBg` (Task 1), `generateEstimate`/`useCommand` (existing, from Slice 1 — unchanged).
- Produces: same default export signature as today: `CreateProjectScreen({ onNavigate, initialPropertyType, initialLocation })`.

This task replaces the entire file. Read the current file first (`src/screens/CreateProjectScreen.tsx`) to confirm you're starting from the Slice-1 state (it should already have `builtUpArea`/`floors`/`constructionLevel` state and call `generateEstimate` on Continue — if it doesn't, STOP and report BLOCKED, something is wrong with the branch).

- [ ] **Step 1: Rewrite the file**

Replace `src/screens/CreateProjectScreen.tsx` in full with:

```tsx
import { useState } from 'react'
import { CheckCircleFilled } from '@ant-design/icons'
import { Button, Card, Flex, Form, Input, InputNumber, Steps, Typography } from 'antd'
import type { ConstructionLevel } from '../domain/models'
import AmbientBg from '../components/homeowner/AmbientBg'
import HIcon from '../components/HIcon'
import HomeownerLayout from '../components/homeowner/HomeownerLayout'
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { useCommand } from '../session/useCommand'

const { Text, Title } = Typography

const propertyTypes = ['House', 'Villa', 'Farmhouse', 'Apartment', 'Other']

interface StageOption {
  id: string
  title: string
  desc: string
}
const stages: StageOption[] = [
  { id: 'planning', title: 'Planning', desc: 'Just exploring ideas.' },
  { id: 'have-plan', title: 'Have a plan', desc: 'I already have drawings.' },
  { id: 'ready-estimate', title: 'Ready to estimate', desc: 'I know the basic requirements.' },
  { id: 'ready-build', title: 'Ready to build', desc: 'Looking for contractors soon.' },
]

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

/** One selectable card in a small labelled group (property type / stage / construction level). */
function PickCard({ title, desc, selected, onSelect }: { title: string; desc?: string; selected: boolean; onSelect: () => void }) {
  return (
    <Card
      hoverable
      onClick={onSelect}
      className={selected ? 'border-[#722ED1]! bg-[#F3EAFF]!' : ''}
      styles={{ body: { padding: 16, position: 'relative' } }}
    >
      {selected && <CheckCircleFilled className="absolute top-3 right-3 text-[#722ED1]" />}
      <Flex vertical gap={2}>
        <Text strong className={selected ? 'text-[#722ED1]!' : undefined}>{title}</Text>
        {desc && <Text type="secondary" className="text-[12px]!">{desc}</Text>}
      </Flex>
    </Card>
  )
}

export default function CreateProjectScreen({
  onNavigate,
  initialPropertyType = 'House',
  initialLocation = 'Hyderabad, Telangana',
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  initialPropertyType?: string
  initialLocation?: string
}) {
  const [projectName, setProjectName] = useState('')
  const [propertyType, setPropertyType] = useState(initialPropertyType)
  const [location, setLocation] = useState(initialLocation)
  const [stage, setStage] = useState<string | null>(null)
  const [builtUpArea, setBuiltUpArea] = useState<number | null>(null)
  const [floors, setFloors] = useState<number | null>(1)
  const [constructionLevel, setConstructionLevel] = useState<ConstructionLevel>('standard')

  const { generateEstimate } = useConstructionData()
  const run = useCommand()

  const canContinue =
    projectName.trim().length > 0 &&
    stage !== null &&
    Number.isInteger(builtUpArea) &&
    (builtUpArea ?? 0) > 0 &&
    Number.isInteger(floors) &&
    (floors ?? 0) > 0

  const handleContinue = () => {
    if (!canContinue) return
    const outcome = run(() =>
      generateEstimate({
        projectName: projectName.trim(),
        propertyType,
        location,
        builtUpAreaSqft: builtUpArea!,
        floors: floors!,
        constructionLevel,
      }),
    )
    if (!outcome.ok) return
    onNavigate('estimate-loading', { estimate_id: outcome.value.id })
  }

  return (
    <HomeownerLayout active="estimates" onNavigate={onNavigate}>
      <div className="relative min-h-full" style={{ backgroundColor: '#FBF9F7' }}>
        <AmbientBg variant="create-project" />
        <Flex vertical gap="large" className="relative z-10 max-w-[900px] mx-auto px-5 sm:px-8 lg:px-10 pt-8 pb-12">
          <Flex vertical gap={16}>
            <Steps
              size="small"
              current={0}
              items={[{ title: 'Project' }, { title: 'Details' }, { title: 'Estimate' }]}
            />
            <Flex vertical gap={4}>
              <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">New Construction Project</Text>
              <Title level={2} className="m-0!">Let&apos;s create your project.</Title>
              <Text type="secondary">Hozie will use these details to build your construction estimate.</Text>
            </Flex>
          </Flex>

          <Card>
            <Form layout="vertical" requiredMark={false}>
              <Form.Item label="Project name">
                <Input
                  size="large"
                  placeholder="My New Home"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </Form.Item>

              <Form.Item label="What are you building?">
                <Flex gap={8} wrap>
                  {propertyTypes.map((pt) => (
                    <Button
                      key={pt}
                      type={propertyType === pt ? 'primary' : 'default'}
                      shape="round"
                      onClick={() => setPropertyType(pt)}
                    >
                      {pt}
                    </Button>
                  ))}
                </Flex>
              </Form.Item>

              <Form.Item label="Where are you building?">
                <Input size="large" value={location} onChange={(e) => setLocation(e.target.value)} />
              </Form.Item>

              <Form.Item label="What stage are you at?">
                <Flex gap={12} wrap>
                  {stages.map((s) => (
                    <div key={s.id} style={{ flex: '1 1 240px', minWidth: 220 }}>
                      <PickCard title={s.title} desc={s.desc} selected={stage === s.id} onSelect={() => setStage(s.id)} />
                    </div>
                  ))}
                </Flex>
              </Form.Item>

              <Flex gap={16}>
                <Form.Item label="Built-up area (sq.ft)" className="flex-1">
                  <InputNumber
                    size="large"
                    min={1}
                    style={{ width: '100%' }}
                    placeholder="e.g. 2000"
                    value={builtUpArea}
                    onChange={(v) => setBuiltUpArea(v)}
                  />
                </Form.Item>
                <Form.Item label="Floors" className="flex-1">
                  <InputNumber size="large" min={1} style={{ width: '100%' }} value={floors} onChange={(v) => setFloors(v)} />
                </Form.Item>
              </Flex>

              <Form.Item label="Construction level">
                <Flex gap={12} wrap>
                  {levels.map((l) => (
                    <div key={l.id} style={{ flex: '1 1 200px', minWidth: 180 }}>
                      <PickCard
                        title={l.title}
                        desc={l.desc}
                        selected={constructionLevel === l.id}
                        onSelect={() => setConstructionLevel(l.id)}
                      />
                    </div>
                  ))}
                </Flex>
              </Form.Item>
            </Form>
          </Card>

          <Card className="bg-[#F3EAFF]! border-0!">
            <Flex gap={12} align="flex-start">
              <div className="shrink-0 w-8 h-8 rounded-[10px] bg-white flex items-center justify-center">
                <HIcon size={20} />
              </div>
              <Flex vertical gap={2}>
                <Text className="text-[10px] tracking-[0.08em] uppercase text-[#722ED1]!">Hozie Tip</Text>
                <Text>You don&apos;t need everything ready. We can start with what you know and fill in the details later.</Text>
              </Flex>
            </Flex>
          </Card>

          <Flex gap={16} align="center" wrap>
            <Button type="primary" size="large" disabled={!canContinue} onClick={handleContinue}>
              Continue to project details →
            </Button>
            <Button type="link" onClick={() => onNavigate('ai-advisor')}>← Back to Hozie</Button>
          </Flex>
        </Flex>
      </div>
    </HomeownerLayout>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

Browser check (http://localhost:5174, homeowner demo sign-in — `localStorage.setItem("houzeify:session", JSON.stringify({accountType:"homeowner",personId:"person-demo-homeowner"}))`): open `#create-project`. Confirm: the sidebar renders via `HomeownerLayout` with "Estimates" highlighted, the ambient background is visible, the property-type/stage/construction-level pickers show purple selection state with a checkmark, "Continue" is disabled until name + stage + valid area + valid floors are all set, and clicking it navigates to `estimate-loading` with a real `estimate_id` (same behavior as Slice 1 — only the visuals changed).

- [ ] **Step 3: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/screens/CreateProjectScreen.tsx
git commit -m "feat: rebuild CreateProjectScreen on Ant Design"
```

---

### Task 4: `EstimateLoadingScreen` on Ant Design

**Files:**
- Rewrite: `src/screens/EstimateLoadingScreen.tsx`

**Interfaces:**
- Consumes: `AmbientBg` (Task 1); `getEstimate` (existing, from Slice 1 — unchanged).
- Produces: same default export signature as today: `EstimateLoadingScreen({ onNavigate, estimateId })`.

Read the current file first to confirm the Slice-1 `estimateId`/honest-failure-state shape is present (if not, STOP and report BLOCKED).

- [ ] **Step 1: Rewrite the file**

Replace `src/screens/EstimateLoadingScreen.tsx` in full with:

```tsx
import { useState, useEffect } from 'react'
import { Button, Flex, Progress, Result, Steps, Typography } from 'antd'
import AmbientBg from '../components/homeowner/AmbientBg'
import HIcon from '../components/HIcon'
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { getEstimate } from '../mock/selectors'

const { Text, Title } = Typography

interface ProcessingPhase {
  stateLabel: string
  statusSub: string
  progress: number
  doneCount: number
}

const phases: ProcessingPhase[] = [
  { stateLabel: 'PREPARING PROJECT DATA', statusSub: 'Initialising estimate generation', progress: 14, doneCount: 0 },
  { stateLabel: 'CALCULATING CONSTRUCTION QUANTITIES', statusSub: 'Analysing structural parameters and floor layout', progress: 38, doneCount: 1 },
  { stateLabel: 'ESTIMATING MATERIALS + LABOUR', statusSub: 'Analysing your project details', progress: 72, doneCount: 2 },
  { stateLabel: 'PREPARING YOUR ESTIMATE', statusSub: 'Compiling cost breakdown and contingency values', progress: 92, doneCount: 3 },
  { stateLabel: 'ESTIMATE READY', statusSub: 'Your construction estimate has been generated', progress: 100, doneCount: 5 },
]

const STEP_LABELS = [
  'Understanding project requirements',
  'Calculating construction quantities',
  'Estimating materials and labour',
  'Preparing cost breakdown',
  'Preparing your estimate',
]

const PHASE_TIMINGS = [1800, 3800, 6400, 8600]

/** Pulsing Hozie tile with expanding rings — kept custom, not an AntD component. */
function ProcessingIcon({ complete }: { complete: boolean }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 192, height: 192 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            inset: 0,
            border: `1.5px solid rgba(114,46,209,${0.22 - i * 0.05})`,
            animation: complete ? undefined : `estimateRingExpand 3s ease-out ${i * 1}s infinite`,
            opacity: complete ? 0 : undefined,
            transition: 'opacity 0.6s ease',
          }}
        />
      ))}
      <div className="absolute rounded-full bg-[#F3EAFF]" style={{ width: 120, height: 120, filter: 'blur(16px)', opacity: 0.85 }} />
      <div
        className="relative flex items-center justify-center rounded-[24px] bg-[#F3EAFF] z-10"
        style={{
          width: 88,
          height: 88,
          boxShadow: complete ? '0 0 0 4px #722ED1, 0 0 40px rgba(114,46,209,0.28)' : '0 0 32px rgba(114,46,209,0.18)',
          animation: complete ? undefined : 'estimatePulse 2.8s ease-in-out infinite',
          transition: 'box-shadow 0.6s ease',
        }}
      >
        <HIcon size={52} />
      </div>
      {complete && (
        <div
          className="absolute bottom-8 right-8 w-7 h-7 rounded-full bg-[#722ED1] flex items-center justify-center z-20"
          style={{ animation: 'estimateButtonPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2.5 6.5l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  )
}

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

  useEffect(() => {
    const timers = PHASE_TIMINGS.map((delay, i) => setTimeout(() => setPhaseIdx(i + 1), delay))
    return () => timers.forEach(clearTimeout)
  }, [])

  const phase = phases[phaseIdx]
  const complete = phaseIdx === phases.length - 1

  if (complete && !estimate) {
    return (
      <div className="relative min-h-full flex items-center justify-center" style={{ backgroundColor: '#FBF9F7' }}>
        <AmbientBg variant="estimate-loading" />
        <div className="relative z-10">
          <Result
            status="error"
            title="We couldn't find that estimate."
            extra={<Button type="primary" onClick={() => onNavigate('create-project')}>Start over</Button>}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-full flex flex-col items-center justify-center" style={{ backgroundColor: '#FBF9F7' }}>
      <AmbientBg variant="estimate-loading" />
      <Flex vertical align="center" gap={32} className="relative z-10 px-5 sm:px-8 w-full py-12" style={{ maxWidth: 600 }}>
        <ProcessingIcon complete={complete} />

        <Text className="text-[10px] tracking-[0.10em] text-[#722ED1]!">HOZIE · AI CONSTRUCTION ADVISOR</Text>

        <Flex vertical align="center" gap={12} className="text-center">
          <Title level={1} className="m-0!">{complete ? 'Estimate ready.' : 'Building your estimate.'}</Title>
          <Text type="secondary" style={{ maxWidth: 480 }}>
            {complete
              ? 'Hozie has finished analysing your project. Your initial construction estimate is ready to view.'
              : 'Hozie is analysing your project and preparing an initial construction estimate.'}
          </Text>
        </Flex>

        {estimate && (
          <Flex align="center" justify="space-between" gap={16} className="w-full bg-white rounded-[16px] border border-[#E3DDD7] px-5 py-4">
            <Flex vertical gap={2}>
              <Text strong>{estimate.projectName}</Text>
              <Text type="secondary" className="text-[11px]!">
                {estimate.location} · {estimate.builtUpAreaSqft.toLocaleString('en-IN')} sq ft
              </Text>
            </Flex>
            <Text className={complete ? 'text-[#722ED1]!' : 'text-[#9A949D]!'} style={{ fontSize: 10 }}>
              {complete ? 'ESTIMATE READY' : 'GENERATING ESTIMATE'}
            </Text>
          </Flex>
        )}

        <Steps
          direction="vertical"
          size="small"
          className="w-full"
          current={phase.doneCount}
          status={complete ? 'finish' : 'process'}
          items={STEP_LABELS.map((label, i) => ({
            title: label,
            status: i < phase.doneCount ? 'finish' : i === phase.doneCount && !complete ? 'process' : 'wait',
          }))}
        />

        <Flex vertical align="center" gap={4} className="text-center">
          <Text className="text-[10px] tracking-[0.10em] text-[#722ED1]!">{phase.stateLabel}</Text>
          <Text type="secondary" className="text-[12px]!">{phase.statusSub}</Text>
        </Flex>

        <Progress percent={phase.progress} showInfo={false} strokeColor="#722ED1" className="w-full" />

        {complete && estimate && (
          <Button type="primary" size="large" onClick={() => onNavigate('estimate-dashboard', { estimate_id: estimate.id })}>
            View estimate →
          </Button>
        )}

        <Flex align="flex-start" gap={12} className="w-full bg-white border border-[#E3DDD7] rounded-[12px] px-4 py-3.5">
          <div className="shrink-0 w-7 h-7 rounded-[8px] bg-[#F3EAFF] flex items-center justify-center">
            <HIcon size={18} />
          </div>
          <Text className="text-[13px]!">
            Your estimate will include materials, labour, finishing and contingency — covering all major cost categories.
          </Text>
        </Flex>
      </Flex>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

Browser check: continue from Task 3's flow — confirm the loading animation plays with the vertical `Steps` list advancing, the project card shows real details, "View estimate →" appears on completion and navigates with the real `estimate_id`. Then navigate directly to `#estimate-loading` with a bogus `estimate_id` and confirm it plays the full animation, then shows `Result status="error"` with "We couldn't find that estimate." and a working "Start over" button.

- [ ] **Step 3: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/screens/EstimateLoadingScreen.tsx
git commit -m "feat: rebuild EstimateLoadingScreen on Ant Design"
```

---

### Task 5: `EstimateTotalSummary` shared component

**Files:**
- Create: `src/components/homeowner/EstimateTotalSummary.tsx`

**Interfaces:**
- Consumes: `Estimate` type (existing, `src/domain/models.ts`).
- Produces:
  ```ts
  export default function EstimateTotalSummary(props: { estimate: Estimate }): JSX.Element
  export function formatRupees(value: number): string
  ```
  Task 6 (`EstimateDashboardScreen`) and Task 7 (`CostBreakdownScreen`) both render the identical total-cost figure from the identical `estimate.breakdown` — this component is the one place that computes and formats it, so the two screens cannot silently drift (the exact risk the Slice 1 final review flagged and confirmed was not yet a problem — this task removes the possibility going forward).

- [ ] **Step 1: Implement**

Create `src/components/homeowner/EstimateTotalSummary.tsx`:

```tsx
import { Card, Flex, Tag, Typography } from "antd"
import type { Estimate } from "../../domain/models"

const { Text, Title } = Typography

export function formatRupees(value: number): string {
  return `₹${(value / 100000).toFixed(1)}L`
}

/**
 * The estimate's headline total range, per-sq-ft range and construction-level
 * badge — the exact same figures on both the Dashboard and Cost Breakdown
 * screens, computed once here so the two can never disagree.
 */
export default function EstimateTotalSummary({ estimate }: { estimate: Estimate }) {
  const perSqftLow = Math.round(estimate.totalLow / estimate.builtUpAreaSqft)
  const perSqftHigh = Math.round(estimate.totalHigh / estimate.builtUpAreaSqft)

  return (
    <Card style={{ background: "linear-gradient(135deg, rgba(243,234,255,0.3) 0%, #ffffff 50%)" }}>
      <Flex justify="space-between" align="flex-start" gap={16} wrap>
        <Flex vertical gap={4}>
          <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">AI Estimate</Text>
          <Title level={2} className="m-0! text-[#722ED1]!">
            {formatRupees(estimate.totalLow)} — {formatRupees(estimate.totalHigh)}
          </Title>
          <Text type="secondary">Estimated construction cost</Text>
          <Title level={4} className="m-0!">
            ₹{perSqftLow.toLocaleString("en-IN")} — ₹{perSqftHigh.toLocaleString("en-IN")} / sq ft
          </Title>
        </Flex>
        <Tag color="purple" className="capitalize">{estimate.constructionLevel} finish</Tag>
      </Flex>
      <Text type="secondary" className="text-[12px]! block mt-3">
        Based on current project details and regional construction assumptions for {estimate.location}. Final cost
        depends on design, materials, and contractor rates.
      </Text>
    </Card>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS. (Not consumed by any screen yet — this only proves the component compiles standalone.)

- [ ] **Step 3: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/components/homeowner/EstimateTotalSummary.tsx
git commit -m "feat: shared EstimateTotalSummary component"
```

---

### Task 6: `EstimateDashboardScreen` on Ant Design

**Files:**
- Rewrite: `src/screens/EstimateDashboardScreen.tsx`

**Interfaces:**
- Consumes: `HomeownerLayout` (Task 2), `AmbientBg` (Task 1), `EstimateTotalSummary`/`formatRupees` (Task 5); `getEstimate`/`getLatestEstimate`/`useSession` (existing, from Slice 1 — unchanged).
- Produces: same default export signature as today: `EstimateDashboardScreen({ onNavigate, estimateId })`.

Read the current file first to confirm the Slice-1 `estimateId`/empty-state/not-found shape is present (if not, STOP and report BLOCKED).

- [ ] **Step 1: Rewrite the file**

Replace `src/screens/EstimateDashboardScreen.tsx` in full with:

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
import { Button, Card, Col, Empty, Flex, Row, Statistic, Typography } from 'antd'
import AmbientBg from '../components/homeowner/AmbientBg'
import EstimateTotalSummary, { formatRupees } from '../components/homeowner/EstimateTotalSummary'
import HIcon from '../components/HIcon'
import HomeownerLayout from '../components/homeowner/HomeownerLayout'
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { getEstimate, getLatestEstimate } from '../mock/selectors'
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

const nextActions = [
  { icon: <FileOutlined />, title: 'View BOQ', desc: 'See materials and quantities.' },
  { icon: <ToolOutlined />, title: 'Material Calculator', desc: 'Check material requirements.' },
  { icon: <ProjectOutlined />, title: 'Analyze Plan', desc: 'Upload your floor plan.' },
  { icon: <TeamOutlined />, title: 'Find Contractors', desc: 'Get project bids.' },
]

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

  return (
    <HomeownerLayout active="estimates" onNavigate={onNavigate}>
      <div className="relative min-h-full" style={{ backgroundColor: '#FBF9F7' }}>
        <AmbientBg variant="estimate-dashboard" />
        <Flex vertical gap={20} className="relative z-10 max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <Flex align="center" justify="space-between" wrap gap={12}>
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

          <EstimateTotalSummary estimate={estimate} />

          <Row gutter={[12, 12]}>
            <Col xs={12} lg={6}><Card><Statistic title="Built-up Area" value={areaLabel} /></Card></Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Materials" value={formatRupees(estimate.breakdown.materials)} valueStyle={{ color: '#E14B19' }} />
                <Text type="secondary" className="text-[11px]!">56% of total</Text>
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Labour" value={formatRupees(estimate.breakdown.labour)} valueStyle={{ color: '#E19C12' }} />
                <Text type="secondary" className="text-[11px]!">26% of total</Text>
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Finishing" value={formatRupees(estimate.breakdown.finishing)} valueStyle={{ color: '#4AB017' }} />
                <Text type="secondary" className="text-[11px]!">13% of total</Text>
              </Card>
            </Col>
          </Row>

          <CostBreakdownCard
            items={[
              { label: 'Materials', percent: 56, amount: formatRupees(estimate.breakdown.materials), color: '#E14B19' },
              { label: 'Labour', percent: 26, amount: formatRupees(estimate.breakdown.labour), color: '#E19C12' },
              { label: 'Finishing', percent: 13, amount: formatRupees(estimate.breakdown.finishing), color: '#4AB017' },
              { label: 'Contingency', percent: 5, amount: formatRupees(estimate.breakdown.contingency), color: '#7E7E7E' },
            ]}
          />

          <HozieInsightCard onNavigate={onNavigate} estimateId={estimate.id} />

          <Flex vertical gap={12}>
            <Text className="text-[10px] tracking-[0.10em] uppercase text-[#9A949D]!">Next Steps</Text>
            <Row gutter={[12, 12]}>
              {nextActions.map((a) => (
                <Col key={a.title} xs={12} lg={6}>
                  <Card hoverable>
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

(`RobotOutlined` is imported but unused in this listing — DELETE that import before committing; it was left over from an earlier icon choice and typecheck/lint would flag it as dead.)

- [ ] **Step 2: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

Browser check: continue the flow from Task 4 — confirm the hero total (via `EstimateTotalSummary`), the four metric cards, and the cost-breakdown bar all show the same real numbers as Slice 1's formula-verified figures, with no "confidence" anything anywhere. Then check the empty state (no `estimate_id`, a homeowner session with zero estimates) and the not-found state (a bogus `estimate_id`) — confirm the two show visibly different messages via `Empty`.

- [ ] **Step 3: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/screens/EstimateDashboardScreen.tsx
git commit -m "feat: rebuild EstimateDashboardScreen on Ant Design"
```

---

### Task 7: `CostBreakdownScreen` on Ant Design

**Files:**
- Rewrite: `src/screens/CostBreakdownScreen.tsx`

**Interfaces:**
- Consumes: `HomeownerLayout` (Task 2), `AmbientBg` (Task 1), `EstimateTotalSummary`/`formatRupees` (Task 5); `getEstimate` (existing, from Slice 1 — unchanged).
- Produces: same default export signature as today: `CostBreakdownScreen({ onNavigate, estimateId })`.

Read the current file first to confirm the Slice-1 `estimateId`/4-category/not-found shape is present (if not, STOP and report BLOCKED).

- [ ] **Step 1: Rewrite the file**

Replace `src/screens/CostBreakdownScreen.tsx` in full with:

```tsx
import {
  FileOutlined,
  TeamOutlined,
  BgColorsOutlined,
  SafetyOutlined,
} from '@ant-design/icons'
import { Button, Card, Col, Empty, Flex, Progress, Row, Typography } from 'antd'
import AmbientBg from '../components/homeowner/AmbientBg'
import EstimateTotalSummary, { formatRupees } from '../components/homeowner/EstimateTotalSummary'
import HIcon from '../components/HIcon'
import HomeownerLayout from '../components/homeowner/HomeownerLayout'
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { getEstimate } from '../mock/selectors'

const { Text, Title } = Typography

interface Category {
  id: string
  label: string
  amount: string
  pct: number
  icon: React.ReactNode
  detail: string
  color: string
}

function CategoryCard({ cat }: { cat: Category }) {
  return (
    <Card>
      <Flex vertical gap={8}>
        <Flex align="center" justify="space-between" gap={12}>
          <Flex align="center" gap={10}>
            <div className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.color}1A`, color: cat.color }}>
              {cat.icon}
            </div>
            <Text strong>{cat.label}</Text>
          </Flex>
          <Flex align="center" gap={12}>
            <Text strong className="text-[18px]!">{cat.amount}</Text>
            <Text style={{ color: cat.color }}>{cat.pct}%</Text>
          </Flex>
        </Flex>
        <Progress percent={cat.pct} showInfo={false} strokeColor={cat.color} />
        <Text type="secondary" className="text-[12px]!">{cat.detail}</Text>
      </Flex>
    </Card>
  )
}

function EstimateSummaryPanel({ categories, averageLabel }: { categories: Category[]; averageLabel: string }) {
  return (
    <Card title={<Text className="text-[10px] tracking-[0.10em] uppercase text-[#9A949D]!">Summary</Text>}>
      <Flex vertical gap={10}>
        {categories.map((cat) => (
          <Flex key={cat.id} align="center" justify="space-between" gap={8}>
            <Flex align="center" gap={8}>
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: cat.color }} />
              <Text type="secondary" className="text-[13px]!">{cat.label}</Text>
            </Flex>
            <Flex align="center" gap={8}>
              <Text strong className="text-[13px]!">{cat.amount}</Text>
              <Text style={{ color: cat.color, fontSize: 10 }}>{cat.pct}%</Text>
            </Flex>
          </Flex>
        ))}
        <Flex justify="space-between" className="pt-2 border-t border-[#E3DDD7]">
          <Text strong>Total (avg)</Text>
          <Text strong className="text-[#722ED1]!">{averageLabel}</Text>
        </Flex>
      </Flex>
    </Card>
  )
}

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
      <HomeownerLayout active="estimates" onNavigate={onNavigate}>
        <Flex align="center" justify="center" className="min-h-full">
          <Empty description="We couldn't find that estimate.">
            <Button type="primary" onClick={() => onNavigate('estimate-dashboard')}>Back to estimate</Button>
          </Empty>
        </Flex>
      </HomeownerLayout>
    )
  }

  const midpoint = (estimate.totalLow + estimate.totalHigh) / 2
  const averageLabel = formatRupees(midpoint)
  const categories: Category[] = [
    { id: 'materials', label: 'Materials', amount: formatRupees(estimate.breakdown.materials), pct: 56, icon: <FileOutlined />, detail: 'Cement, steel, bricks, aggregates and other raw materials.', color: '#E14B19' },
    { id: 'labour', label: 'Labour', amount: formatRupees(estimate.breakdown.labour), pct: 26, icon: <TeamOutlined />, detail: 'Civil, plumbing, electrical and finishing labour charges.', color: '#E19C12' },
    { id: 'finishing', label: 'Finishing', amount: formatRupees(estimate.breakdown.finishing), pct: 13, icon: <BgColorsOutlined />, detail: 'Flooring, painting, doors, windows and interior finishes.', color: '#4AB017' },
    { id: 'contingency', label: 'Contingency', amount: formatRupees(estimate.breakdown.contingency), pct: 5, icon: <SafetyOutlined />, detail: 'Buffer for unforeseen costs and estimation variance.', color: '#7E7E7E' },
  ]

  return (
    <HomeownerLayout active="estimates" onNavigate={onNavigate}>
      <div className="relative min-h-full" style={{ backgroundColor: '#FBF9F7' }}>
        <AmbientBg variant="cost-breakdown" />
        <Flex vertical gap={24} className="relative z-10 max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <Flex vertical gap={4}>
            <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]! block">Estimate Breakdown</Text>
            <Title level={2} className="m-0!">Where your money goes.</Title>
            <Text type="secondary">Hozie has grouped your estimated construction cost into the major areas of work.</Text>
            <Text type="secondary">{estimate.projectName} · {estimate.location} · {estimate.builtUpAreaSqft.toLocaleString('en-IN')} sq ft</Text>
          </Flex>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={14}>
              <Flex vertical gap={16}>
                <EstimateTotalSummary estimate={estimate} />
                {categories.map((cat) => <CategoryCard key={cat.id} cat={cat} />)}
              </Flex>
            </Col>
            <Col xs={24} lg={10}>
              <Flex vertical gap={16}>
                <Card className="bg-[#F3EAFF]! border-0!">
                  <Flex vertical gap={12}>
                    <Flex align="center" gap={10}>
                      <div className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center shrink-0">
                        <HIcon size={20} />
                      </div>
                      <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">Hozie Insight</Text>
                    </Flex>
                    <Text>
                      &ldquo;Materials are currently the largest cost driver. Changes in steel, cement and finishing
                      specifications can significantly affect your final estimate.&rdquo;
                    </Text>
                  </Flex>
                </Card>
                <EstimateSummaryPanel categories={categories} averageLabel={averageLabel} />
                <Button type="primary" block onClick={() => onNavigate('estimate-dashboard', { estimate_id: estimate.id })}>
                  ← Back to Estimate
                </Button>
                <Text type="secondary" className="text-[10px]!">
                  AI-generated estimate based on the information provided. Actual costs may vary based on design,
                  specifications, site conditions and contractor pricing.
                </Text>
              </Flex>
            </Col>
          </Row>
        </Flex>
      </div>
    </HomeownerLayout>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

Browser check: from `estimate-dashboard`, click "Explore cost drivers →" — confirm it lands on `cost-breakdown` showing the SAME estimate (the `EstimateTotalSummary` total must be pixel-identical to the dashboard's, since both now render from the same shared component), exactly 4 categories with `Progress` bars, and a working "← Back to Estimate" button. Then check the not-found state with a bogus `estimate_id`.

- [ ] **Step 3: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/screens/CostBreakdownScreen.tsx
git commit -m "feat: rebuild CostBreakdownScreen on Ant Design"
```

---

### Task 8: Full walkthrough, responsive check, spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-phase-8-estimate-flow-antd-modernization-design.md`

- [ ] **Step 1: Full checks** — `pnpm run typecheck && pnpm run test && pnpm run build` (all pass).

- [ ] **Step 2: Full browser walkthrough**

Using http://localhost:5174, homeowner demo sign-in (`localStorage.setItem("houzeify:session", JSON.stringify({accountType:"homeowner",personId:"person-demo-homeowner"}))`):

1. From the homeowner dashboard, open the desktop sidebar and confirm it's the new `HomeownerLayout` (Ant `Menu`, not the old duplicated sidebar) with "Estimates" correctly highlighted whenever you're on any of the 4 screens.
2. Go through the full flow: `#create-project` (fill in a project, stage, built-up area 2200, floors 3, "Standard") → Continue → `estimate-loading` (animation plays, real project card, "View estimate →") → `estimate-dashboard` (real total ₹36.3L–₹42.9L for 1650/1950 × 2200, matching the formula) → "Explore cost drivers →" → `cost-breakdown` (same total, 4 categories, numbers matching the dashboard exactly).
3. Confirm the ambient background and Hozie icon/animations are visibly present on every screen (not lost in the rebuild).
4. At a narrow viewport (resize to mobile width), confirm `HomeownerMobileMenu`'s drawer still opens from the header and every screen's cards/forms reflow without horizontal scroll or cut-off text.
5. Confirm the empty state (`#estimate-dashboard` with no `estimate_id`, for a homeowner with zero estimates) and the not-found state (a bogus `estimate_id` on both the dashboard and cost-breakdown) both render via `Empty`/`Result` with working recovery buttons.

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-09-29-phase-8-estimate-flow-antd-modernization-design.md`, change:

```
**Status:** Approved — ready for planning
```

to:

```
**Status:** Implemented
```

- [ ] **Step 4: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add docs/superpowers/specs/2026-09-29-phase-8-estimate-flow-antd-modernization-design.md
git commit -m "docs: Phase 8 estimate flow Ant Design modernization spec implemented"
```
