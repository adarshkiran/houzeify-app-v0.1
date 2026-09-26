# Houzeify — Design System

> The Digital Construction Record for Every Project.

---

## Brand

**Product name:** Houzeify (always title-case, never HOUZEIFY or houzeify)
**Tagline:** Construction management and transparency platform

---

## Color System

### Primary

| Token | Hex | Usage |
|---|---|---|
| Primary | `#722ED1` | Buttons, active states, links, progress bars, brand accents |
| Primary Hover | `#5A22A8` | Hover state on primary buttons |
| Primary Light | `#F3EAFF` | Active nav background, Hozie cards, lavender tints |

### Neutrals

| Token | Hex | Usage |
|---|---|---|
| Canvas | `#FBF9F7` | Page background |
| White | `#FFFFFF` | Cards, sidebar, header surfaces |
| Ivory | `#F4F0EC` | Secondary surfaces, hover states |
| Border | `#E3DDD7` | Card borders, dividers, input borders |
| Border Alt | `#E7E5E4` | Sidebar and header borders (construction screens) |

### Text

| Token | Hex | Usage |
|---|---|---|
| Text Primary | `#242326` | Headings and primary content (estimation screens) |
| Text Primary Alt | `#1C1917` | Headings and primary content (construction screens) |
| Text Secondary | `#68636D` | Supporting labels, descriptions |
| Text Muted | `#9A949D` | Captions, timestamps, hints |
| Text Muted Alt | `#9CA3AF` | Captions in construction screens |
| Text Subtle | `#6B7280` | Tertiary labels |

### Semantic

| Token | Hex | Usage |
|---|---|---|
| Build | `#F8E3BD` | Construction/material stage tint |
| AI | `#F3EAFF` | AI features, Hozie cards |
| Progress | `#C6F6D5` | Progress and completion states |
| Services | `#CAEBFF` | Services and utility tints |

### Category Colors (Cost Breakdown)

| Category | Color | Background Tint |
|---|---|---|
| Materials | `#E14B19` | `#FFF2E8` |
| Labour | `#E19C12` | `#FFFBE6` |
| Finishing | `#4AB017` | `#F6FFED` |
| Services | `#136BE6` | `#E6F4FF` |
| Contingency | `#7E7E7E` | `#F5F5F5` |

### Status Colors

| Status | Color | Background |
|---|---|---|
| High priority / Error | `#DC2626` | `#FEE2E2` |
| Medium priority | `#D97706` | `#FEF3C7` |
| Low priority | `#6B7280` | `#F3F4F6` |
| Success | `#16A34A` | `#DCFCE7` |
| Info | `#0284C7` | `#E0F2FE` |

### Construction Stage Colors

| Stage | Color | Background |
|---|---|---|
| Foundation | `#D97706` | `#FEF3C7` |
| Plinth Beam | `#0284C7` | `#E0F2FE` |
| Structure | `#16A34A` | `#DCFCE7` |
| Site Prep / Planning | `#6B7280` | `#F3F4F6` |

---

## Typography

Three fonts form the full type system. All applied via inline `style={{ fontFamily: '...' }}`.

### Geist — Headings & Numbers

```
fontFamily: '"Geist", sans-serif'
```

Use for: Page headings, section headings, card titles, cost figures, KPI values, project names, important numbers.

| Role | Size | Weight |
|---|---|---|
| Page headline | 40px | SemiBold |
| Section heading | 22–24px | SemiBold |
| Card title | 17–20px | SemiBold |
| Body heading | 14–15px | SemiBold |
| KPI value | 28–34px | SemiBold |
| Cost figure | 34–42px | SemiBold |

### Inter — Body & UI

```
fontFamily: '"Inter", sans-serif'
```

Use for: Body copy, descriptions, button labels, form labels, sidebar nav labels, captions, general UI text.

| Role | Size |
|---|---|
| Body copy | 13–14px |
| Button label | 12–13px |
| Caption / meta | 11–12px |
| Nav label | 13px |

### Sometype Mono — Labels & Data

```
fontFamily: '"Sometype Mono:SemiBold", monospace'
```

Use for: Eyebrow labels, status badges, stage tags, percentages, timestamps, KPI category labels, technical metadata.

| Role | Size | Case |
|---|---|---|
| Eyebrow label | 9–10px | UPPERCASE, 0.08–0.10em tracking |
| Status badge | 10px | Title case |
| Percentage | 11–13px | As-is |
| Data label | 9px | UPPERCASE |

---

## Spacing & Layout

### Page Layout

- **Max content width:** 1080px (estimation screens) / 1180px (construction screens)
- **Page padding:** `px-4 sm:px-6 lg:px-8`
- **Section gap:** `gap-6` (24px)
- **Card gap:** `gap-4` (16px)

### Sidebar

| Breakpoint | Width | Behavior |
|---|---|---|
| `< md` | Hidden | Mobile top bar shown instead |
| `md` | 68–72px | Icon-only |
| `lg` | 236–240px | Icon + label |

### Two-Column Layout

```
Left column:  flex: 60 60 0  (projects, breakdown)
Right column: flex: 40 40 0  (insight, summary, actions)
```

Stacks to single column below `xl` (1280px) on construction screens, below `lg` (1024px) on estimation screens.

---

## Border Radius

| Element | Radius |
|---|---|
| Page cards | `20px` |
| Section cards | `14–16px` |
| Nav items | `10–12px` |
| Buttons | `8–12px` |
| Badges / pills | `9999px` (full) |
| Icon containers | `8–10px` |
| Progress bars | `9999px` (full) |

---

## Shadows

```css
/* Card — light */
box-shadow: 0 1px 4px rgba(0,0,0,0.04);

/* Card — medium */
box-shadow: 0 1px 6px rgba(0,0,0,0.04);

/* Hero card */
box-shadow: 0 2px 24px rgba(114,46,209,0.07), 0 1px 4px rgba(0,0,0,0.04);
```

---

## Components

### Buttons

**Primary**
```
bg: #722ED1 | text: white | hover: #5A22A8
height: 36–46px | radius: 8–12px | font: Inter 12–13px semibold
```

**Secondary / Ghost**
```
bg: white | border: #E3DDD7 | text: #242326 | hover: #F4F0EC
height: 32–36px | radius: 8px | font: Inter 12–13px
```

**Dashed add**
```
bg: transparent | border: dashed #D1D5DB | text: #9CA3AF
hover: border-[#722ED1] text-[#722ED1]
height: 36px | radius: 8px
```

### Cards

**Base card**
```
bg: white | border: 1px #E3DDD7 | radius: 14–16px
shadow: 0 1px 6px rgba(0,0,0,0.04)
padding: 16–20px (p-4 to p-5)
```

**Hero card**
```
bg: linear-gradient(135deg, rgba(243,234,255,0.28) 0%, #ffffff 55%)
border: 1px #E3DDD7 | radius: 20px | padding: 24–28px
shadow: 0 2px 24px rgba(114,46,209,0.07), 0 1px 4px rgba(0,0,0,0.04)
```

**Hozie / AI card**
```
bg: #F3EAFF | radius: 16px | padding: 16–20px
No shadow. H icon in white 28–32px rounded container.
```

**Category card (Cost Breakdown)**
```
bg: white | border: 1px #E3DDD7 | radius: 14px | overflow: hidden
Left accent strip: 4px wide, category color at 85% opacity
```

### Status Badges

```
font: Sometype Mono:SemiBold | size: 10px | padding: 2px 8px
border-radius: 9999px
```

Active / confidence badge:
```
bg: #F3EAFF | border: 1px rgba(114,46,209,0.16) | text: #722ED1
Animated dot: hozieStatusPulse
```

### Progress Bars

```
height: 6–10px | track-radius: 9999px | bar-radius: 9999px
track-bg: #F3EAFF (or category bg tint)
bar-color: #722ED1 (or category color)
transition: width 0.9s–1.2s cubic-bezier(0.4,0,0.2,1)
```

### Navigation Items

```
height: 36–40px | radius: 10–12px | padding: 9px 12px | gap: 12px
font: Inter 13px medium
icon: 18×18px

Active:  bg #F3EAFF | text/icon #722ED1
Default: text/icon #68636D | hover bg #F4F0EC | hover text #242326
```

### Sidebar Structure

```
Header: 60–64px tall | logo + H icon
Nav: flex-1 scrollable | p-2 (md) / p-3 (lg) | gap-0.5
Bottom: border-top | Help + Settings
```

---

## Ambient Background

Used on estimation and AI screens. Fixed-position, pointer-events-none, z-index: 0.

```jsx
/* Circle 1 — top right */
top: -100, right: -180 | size: 560×560
bg: rgba(114,46,209,0.042) | blur: 130px

/* Circle 2 — bottom left */
bottom: -160, left: -100 | size: 640×640
bg: rgba(243,234,255,0.50) | blur: 140px

/* Circle 3 — mid right */
top: 55%, right: 15% | size: 380×380
bg: rgba(243,234,255,0.38) | blur: 90px
```

---

## Animations

All defined as `@keyframes` in `src/index.css` and applied via inline `animation` style.

| Name | Description | Usage |
|---|---|---|
| `splashFadeIn` | `opacity 0→1, translateY 8px→0` | Screen transitions |
| `welcomeFadeUp` | `opacity 0→1, translateY 12px→0` | Card/section entrances |
| `hozieStatusPulse` | Scale 1→0.97→1, opacity pulse | AI status dot |
| `aiIconGlow` | Box shadow pulse on purple | Hozie icon |
| `estimateRingExpand` | Scale 0.92→1.60, opacity 0.30→0 | Loading rings |
| `estimatePulse` | Scale + opacity oscillation | Loading state |
| `estimateReveal` | `opacity 0→1, translateY 10px→0` | Estimate content reveal |
| `estimateButtonPop` | Scale 0.92→1.04→1, opacity 0→1 | CTA button entrance |
| `pingRipple` | Scale 1→2.5, opacity 1→0 | Ping effects |
| `successIconReveal` | Stroke dash animation | Success checkmark |
| `successBadgePop` | Scale 0→1.1→1 | Success badge |

Staggered delays: `0.05s`, `0.10s`, `0.15s`, `0.18s`, `0.24s`, `0.30s`, `0.36s` per element row.

---

## Screen Architecture

### Header

```
height: 60–72px | bg: white | border-bottom: 1px #E3DDD7
Left: Page title (Geist 17–22px) + subtitle (Inter 13px #68636D)
Right: Action buttons (secondary) + icon buttons
```

### Page Structure (Dashboard screens)

```
<div className="flex h-full">           ← full viewport
  <Sidebar />
  <div className="flex flex-col flex-1 min-w-0 min-h-0">
    <header />                          ← fixed height
    <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth:'none' }}>
      <div className="max-w-[...] mx-auto px-... py-6 flex flex-col gap-6">
        {/* content */}
      </div>
    </main>
  </div>
</div>
```

### Scrollbars

Always hidden: `style={{ scrollbarWidth: 'none' }}` on scrollable containers.

---

## Navigation — Estimation Flow

```
Sidebar active item: Estimates
Home → dashboard-home
AI Advisor → ai-advisor
Estimates → estimate-dashboard
```

## Navigation — Construction Management

```
Sidebar items: Home, Projects, Progress, Site Operations,
               Workforce, Live Site, Documents, Reports, Team, Hozie AI
Bottom: Settings
Badge counts on: Projects (4), Site Operations (3)
```

---

## Screen Inventory

### Estimation Flow (backup/estimation-flow branch + main)

| Screen | Route | File |
|---|---|---|
| Splash | `splash` | HouzeifySplashPage (import) |
| Welcome | `welcome` | WelcomeScreen |
| Login | `login` | LoginScreen |
| OTP | `otp` | OtpScreen |
| Create Account | `create-account` | CreateAccountScreen |
| Account Created | `account-created` | AccountCreatedScreen |
| Choose Role | `role` | ChooseRoleScreen |
| Homeowner Onboarding | `onboarding-homeowner` | HomeownerOnboardingScreen |
| AI Home Dashboard | `dashboard-home` | HomeDashboardScreen |
| AI Advisor | `ai-advisor` | AIAdvisorScreen |
| Create Project | `create-project` | CreateProjectScreen |
| Estimate Loading | `estimate-loading` | EstimateLoadingScreen |
| Estimate Dashboard | `estimate-dashboard` | EstimateDashboardScreen |
| Cost Breakdown | `cost-breakdown` | CostBreakdownScreen |

### Construction Management Flow (main branch — in progress)

| Screen | Route | File | Phase |
|---|---|---|---|
| Company Dashboard | `company-dashboard` | CompanyDashboardScreen | 1 |
| Project Overview | `project-overview` | — | 2 |
| Daily Progress | `daily-progress` | — | 3 |
| Tasks | `tasks` | — | 3 |
| Issues | `issues` | — | 3 |
| Workforce | `workforce` | — | 3 |

---

## Logo & Icons

**Houzeify logo (horizontal):**
```
src/imports/02HouzeifyScreen002.../7353206a...png
style={{ mixBlendMode: 'multiply' }}
height: 22–24px, width: auto
```

**H icon component:**
```tsx
import HIcon from '../components/HIcon'
<HIcon size={28} />  // uses transform: scale(size/112) on 112px container
```

Never redraw or recreate the logo or H icon.

---

## Key Rules

1. Primary color is always `#722ED1` — never `#4C12A1` or any other purple variant
2. Brand name is always **Houzeify** — never HOUZEIFY, houzeify, or Houzeify AI
3. Never edit files under `src/imports/` — they are Figma-generated and read-only
4. Each screen is self-contained with its own Sidebar copy — no shared Sidebar component
5. All screens accept `onNavigate: (s: string, data?: Record<string, string>) => void`
6. `projectData` state in App.tsx carries shared data between screens
7. Dashboard screens manage their own internal scroll — App.tsx wraps them without `overflowY: auto`
8. Never use inline universal CSS resets (`* { margin: 0 }`)
