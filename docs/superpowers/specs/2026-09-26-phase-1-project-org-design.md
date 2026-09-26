# Phase 1 — Project & Organization Core

**Date:** 2026-09-26  
**Branch:** `feature/project-core`  
**Status:** Approved

## Goal

Make company project setup coherent for single-house and multi-unit projects using the shared mock domain (no UI redesign, router, backend, or worker screens).

## Approach

Smallest domain patch on existing ConstructionDataProvider + screens:

1. Bootstrap a root unit (and creator PM membership) when creating `individual-house` projects.
2. Allow invite scope via optional `projectUnitIds` on `inviteProjectMember`.
3. Batch `addProjectUnits` + Structure UI “add N children under parent” for multi-unit kinds.
4. Seed a small `villa-development` demo hierarchy.
5. Minor consistency: overview/team membership visibility, dashboard project badge from data.

## Acceptance

```
Business Onboarding → Company Dashboard → Create Project → Structure → Team → Overview
```

Same engine for single house and multi-villa (bulk add for scale).

## Out of scope

UI redesign, worker app, React Router, real auth/backend, unit edit/delete, Hozie copy polish.
