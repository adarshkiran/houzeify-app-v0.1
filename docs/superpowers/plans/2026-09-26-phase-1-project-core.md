# Phase 1 Project Core Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete company project setup for single-house and multi-unit via shared mock domain.

**Architecture:** Extend ConstructionDataProvider mutations; wire ProjectStructure / ProjectTeam; seed villa-development. No screen redesign.

**Tech Stack:** React 19, existing Ant Design screens, Vitest domain tests.

---

### Task 1: Invite scope + create bootstrap + batch units (provider)

**Files:** `src/mock/ConstructionDataProvider.tsx`, `src/domain/progress` N/A, new `src/domain/projectSetup.ts` helpers optional

1. Extend `InviteProjectMemberInput` with optional `scope?: PermissionScope` (or `projectUnitIds`).
2. `createProject`: for `individual-house`, append root house unit + active PM membership for org person if present.
3. Add `addProjectUnits(inputs: AddProjectUnitInput[])` that creates N siblings under same parent with sequential codes/names.
4. Export helpers; add unit tests for bootstrap kind choice and batch codes.

### Task 2: Wire Structure + Team screens

**Files:** `src/screens/ProjectStructureScreen.tsx`, `src/screens/ProjectTeamScreen.tsx`

1. Structure: for multi kinds, form fields count + name prefix → `addProjectUnits`.
2. Team: unit multi-select → pass scope into invite.

### Task 3: Seed villa-development + polish

**Files:** `src/mock/seed.ts`, `src/mock/selectors.ts`, `src/screens/CompanyDashboardScreen.tsx`, `src/screens/ProjectOverviewScreen.tsx`

1. Seed one villa-development with phase → block → few villas.
2. Membership selector variants if needed; dashboard badge from real project count.

### Task 4: Validate

Run `pnpm run typecheck`, `pnpm run test`, `pnpm run build`.
