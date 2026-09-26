# Houzeify (figma-make-app)

Construction project OS prototype — React + Vite + TypeScript + Tailwind CSS v4 + Ant Design 6.

## Local setup

```bash
pnpm install
pnpm run dev
```

Preview defaults to port `8443` (`PORT` env overrides).

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm run dev` | Vite development server |
| `pnpm run build` | Production build |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm run test` | Domain unit tests (Vitest) |
| `pnpm run format` | Format with oxfmt |

## Architecture notes

- **Screens** live in `src/screens/` and navigate via the hash/local screen switcher in `src/App.tsx` (no React Router yet).
- **Construction domain** models are in `src/domain/` (`models`, `permissions`, `taskTransitions`, `progress`).
- **Mock state** is owned by `src/mock/ConstructionDataProvider.tsx` and seeded from `src/mock/seed.ts`.
- **Selectors** in `src/mock/selectors.ts` are the shared read path — screens should not invent local fake project/task arrays.
- **Customer gate**: homeowners only see daily progress with `reviewStatus === "approved"` and `publicationStatus === "published"`.

## Progress aggregation (Phase 0)

Project `%` is recalculated from the latest **approved** daily-progress `progressAfter`. Unapproved submissions do not move the project percentage. Stored project progress is kept when no approved records exist (mid-project bootstrap).

## Permissions (Phase 0)

Typed permission constants live in `src/domain/permissions.ts`. Memberships carry a permission string list derived from role defaults. Real authentication is not implemented yet.

## Worker app (Phase 4)

Site workers use a phone-first app: **Worker Today → Task → Accept → Start → Log progress (quantity, photo/video, voice note) → Supervisor review**.

- **Try it:** Choose role → *Site Worker* → Continue (the demo number for Ravi Naik, civil lead on Sharma Residence, is pre-filled).
- **Sign-in:** a `worker` session belongs to a person linked to a `Worker` record (`Worker.userId`). Phone lookup stands in for OTP until real auth exists.
- **Authority:** workers act through a scoped `worker` project membership (created automatically when a sign-in-capable worker is assigned to a project), so the same scope rules apply as everywhere else. They act only on tasks assigned to them.
- **Task moves:** members with `progress.submit` but not `task.manage` may only make site moves (accept, ready, in progress, blocked). Review outcomes and planning moves need `task.manage`.
- **Publication:** workers report quantity done, not project %, so their updates never move project progress. Voice notes stay private and are never published to the homeowner; photos and video are published on approval.
