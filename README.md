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
