# Phase 4 Workforce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Workers become real project participants: a `Worker` identity record, a traceable `WorkerOnboarding` invitation lifecycle, project assignments that keep history, and languages as a list. All in the in-memory mock.

**Architecture:** Three separate lifecycles in `ConstructionDataState`: `workers` (identity), `workerOnboardings` (invitation), `workerProjectAssignments` (project work, now with `startedAt`, `endedAt`, `endReason`). Domain commands in `src/domain/constructionCommands.ts` own every transition and refuse invalid ones with `ConflictError`. The Workforce screen and the worker sign-in screen call those commands through the provider.

**Tech Stack:** TypeScript, React 19, Ant Design 6, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-phase-4-workforce-design.md`

## Global Constraints

- `src/domain/*.ts` production code never imports `src/mock/*`. Test files may import `../mock/seed`.
- Legacy-style files keep single quotes and no semicolons. New files use double quotes and no semicolons.
- Refusals are `ConflictError` with a plain message.
- `Worker.languages` is `string[]` of language codes. `preferredLanguage` is removed everywhere.
- A worker is never deleted by onboarding cancel or expiry, nor by assignment end.
- Ending a project assignment never changes the worker's status.
- QR join codes are generated now; no camera scanning.
- Attendance, bulk import, real OTP, skills/certifications, worker profile, and a separate My Tasks screen are out of scope.
- Every changed screen keeps its Hozie insight card with factual copy only.

## File Structure

- Modify `src/domain/models.ts`: `Worker` (`languages`), `WorkerProjectAssignment` (`startedAt`, `endedAt`, `endReason`), new `WorkerOnboarding`, `OnboardingStatus`, `ConstructionDataState.workerOnboardings`.
- Modify `src/mock/seed.ts`: workers use `languages`; `workerOnboardings: []`; assignments get `startedAt`.
- Modify `src/domain/constructionCommands.ts`: `addWorker`, `inviteProjectMember`, `assignWorkerToProject`; new `createWorkerOnboarding`, `acceptWorkerOnboarding`, `cancelWorkerOnboarding`, `expireWorkerOnboarding`, `endWorkerProjectAssignment`.
- Create `src/domain/workforceOnboarding.ts`: pure helpers `openOnboardingFor(state, workerId)`, `generateJoinCode(ctx)` (keeps `constructionCommands.ts` from growing further).
- Modify `src/mock/ConstructionDataProvider.tsx`: expose the new commands.
- Modify `src/screens/WorkforceScreen.tsx`: languages multi-select, status and onboarding columns, actions.
- Modify `src/screens/WorkerOnboardingScreen.tsx`: join-code input for QR onboardings.
- Tests: `src/domain/workforceOnboarding.test.ts`, `src/domain/workforceCommands.test.ts`, `src/mock/seed.test.ts` (append).

---

### Task 1: Languages as a list

**Files:**
- Modify: `src/domain/models.ts` (`Worker`)
- Modify: `src/mock/seed.ts` (line ~491 area)
- Modify: `src/domain/constructionCommands.ts` (`AddWorkerInput` and `addWorker`, if they carry `preferredLanguage`)
- Modify: `src/screens/WorkforceScreen.tsx` (lines ~57, 144, 172, 257, 405, 434)
- Test: `src/mock/seed.test.ts` (append)

**Interfaces:**
- Produces: `Worker.languages: string[]`. Used by Tasks 4 and 7.

- [ ] **Step 1: Write the failing test**

Append to `src/mock/seed.test.ts`:

```ts
describe("worker languages", () => {
  it("every seeded worker has a languages list and no preferredLanguage", () => {
    for (const worker of seedConstructionData.workers) {
      expect(Array.isArray(worker.languages)).toBe(true)
      expect(worker.languages.length).toBeGreaterThan(0)
      expect("preferredLanguage" in worker).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/mock/seed.test.ts`
Expected: FAIL (`languages` undefined).

- [ ] **Step 3: Change the model**

In `src/domain/models.ts`, in `Worker`, replace `preferredLanguage: string` with `languages: string[]`.

- [ ] **Step 4: Update the seed**

In `src/mock/seed.ts` near line 491, replace the `preferredLanguage` expression with a list:

```ts
  languages: index % 3 === 0 ? ["te", "en"] : index % 3 === 1 ? ["hi", "en"] : ["en"],
```

- [ ] **Step 5: Update the add-worker input and the Workforce form**

Read `AddWorkerInput` in `src/domain/constructionCommands.ts`. Replace any `preferredLanguage: string` with `languages: string[]`, and make `addWorker` write `languages: input.languages` (default `["en"]` when empty).

In `src/screens/WorkforceScreen.tsx`:
- Form values type (line ~57): `languages: string[]`.
- Initial values (lines ~144, ~405): `languages: ["en"]`.
- Submit (line ~172): pass `languages: values.languages`.
- Table column (lines ~257–258): `dataIndex: "languages"`, `key: "languages"`, and render `languages.join(", ")` (use `render` so the array is not shown raw).
- Form item (line ~434): `<Form.Item label="Languages" name="languages">` with an Ant Design `Select mode="tags"` whose options are `en`, `hi`, `te`.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run` (all pass) and `npx tsc --noEmit` (clean). Fix any other `preferredLanguage` reference the typecheck finds.

- [ ] **Step 7: Commit**

```bash
git add src/domain/models.ts src/mock/seed.ts src/domain/constructionCommands.ts src/screens/WorkforceScreen.tsx src/mock/seed.test.ts
git commit -m "feat: workers carry a languages list instead of one preferred language"
```

---

### Task 2: WorkerOnboarding record and state

**Files:**
- Modify: `src/domain/models.ts`
- Modify: `src/mock/seed.ts` (state literal)
- Test: `src/mock/seed.test.ts` (append)

**Interfaces:**
- Produces: `OnboardingMethod`, `OnboardingStatus`, `WorkerOnboarding`, `ConstructionDataState.workerOnboardings`. Used by Tasks 4–6.

- [ ] **Step 1: Write the failing test**

Append to `src/mock/seed.test.ts`:

```ts
describe("worker onboarding state", () => {
  it("seeds an empty onboarding list", () => {
    expect(seedConstructionData.workerOnboardings).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/mock/seed.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the types**

In `src/domain/models.ts`, next to the `Worker` interface, add:

```ts
export type OnboardingMethod = "manual" | "otp" | "qr" | "supervisor-assisted"
export type OnboardingStatus = "invited" | "accepted" | "expired" | "cancelled"

export interface WorkerOnboarding {
  id: EntityId
  workerId: EntityId
  organizationId: EntityId
  method: OnboardingMethod
  status: OnboardingStatus
  /** Set for qr joins: the code the worker enters to accept. */
  joinCode?: string
  invitedByMembershipId?: EntityId
  invitedAt: ISODateTime
  acceptedAt?: ISODateTime
  expiresAt?: ISODateTime
}
```

Add `workerOnboardings: WorkerOnboarding[]` to `ConstructionDataState`, after `workerProjectAssignments`.

- [ ] **Step 4: Seed it**

In `src/mock/seed.ts`, add `workerOnboardings: [],` to the state literal.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/mock/seed.test.ts` (pass) and `npx tsc --noEmit`. Fixture states elsewhere that build a full `ConstructionDataState` will need `workerOnboardings: []`; add it wherever typecheck reports.

- [ ] **Step 6: Commit**

```bash
git add src/domain/models.ts src/mock/seed.ts src/mock/seed.test.ts
git commit -m "feat: add the worker onboarding record and state"
```

---

### Task 3: Assignment history (startedAt, endedAt, endReason) and end command

**Files:**
- Modify: `src/domain/models.ts` (`WorkerProjectAssignment`)
- Modify: `src/mock/seed.ts` (existing assignments get `startedAt`)
- Modify: `src/domain/constructionCommands.ts` (`assignWorkerToProject`, new `endWorkerProjectAssignment`)
- Test: `src/domain/workforceCommands.test.ts` (create)

**Interfaces:**
- Consumes: `WorkerProjectAssignment` (existing), `authorizeProject`/`WORKFORCE_MANAGE` pattern used by `assignWorkerToProject`.
- Produces: `endWorkerProjectAssignment(assignmentId: EntityId, reason: AssignmentEndReason): Command<WorkerProjectAssignment>`.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/workforceCommands.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { ConflictError } from "./errors"
import { endWorkerProjectAssignment } from "./constructionCommands"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import type { Session } from "./session"

const ORG = "org-buildright"
const manager: Session = { accountType: "business", personId: "person-arjun", organizationId: ORG }
const clock: Clock = { now: () => new Date("2026-10-06T10:00:00.000Z") }
const ids = (): IdGenerator => {
  let n = 0
  return { next: (p) => `${p}-new-${++n}`, short: () => `s${++n}` }
}
const as = (actor: Session | null): CommandContext => ({ actor, clock, ids: ids() })

/** A seeded active assignment to end. Built in the test so it doesn't depend on fixture ids. */
function withAssignment(): { state: ConstructionDataState; assignmentId: string } {
  const worker = seed.workers[0]
  const project = seed.projects[0]
  const assignment = {
    id: "assignment-test",
    workerId: worker.id,
    projectId: project.id,
    projectUnitIds: [],
    tradeIds: worker.tradeIds.slice(0, 1),
    role: "worker" as const,
    status: "active" as const,
    startedAt: "2026-09-01T09:00:00.000Z",
    assignedAt: "2026-09-01T09:00:00.000Z",
  }
  return {
    state: { ...seed, workerProjectAssignments: [...seed.workerProjectAssignments, assignment] },
    assignmentId: assignment.id,
  }
}

describe("endWorkerProjectAssignment", () => {
  it("sets endedAt and endReason and keeps the record", () => {
    const { state, assignmentId } = withAssignment()
    const { state: next, result } = endWorkerProjectAssignment(assignmentId, "left-project")(state, as(manager))
    expect(result.endedAt).toBe("2026-10-06T10:00:00.000Z")
    expect(result.endReason).toBe("left-project")
    expect(next.workerProjectAssignments.find((a) => a.id === assignmentId)).toBeDefined()
  })

  it("does not change the worker's status", () => {
    const { state, assignmentId } = withAssignment()
    const workerId = state.workerProjectAssignments.find((a) => a.id === assignmentId)!.workerId
    const before = state.workers.find((w) => w.id === workerId)!.status
    const { state: next } = endWorkerProjectAssignment(assignmentId, "reassigned")(state, as(manager))
    expect(next.workers.find((w) => w.id === workerId)!.status).toBe(before)
  })

  it("refuses to end an assignment twice", () => {
    const { state, assignmentId } = withAssignment()
    const once = endWorkerProjectAssignment(assignmentId, "removed")(state, as(manager)).state
    expect(() => endWorkerProjectAssignment(assignmentId, "removed")(once, as(manager))).toThrow(ConflictError)
  })

  it("refuses an unknown assignment", () => {
    expect(() => endWorkerProjectAssignment("assignment-nope", "removed")(seed, as(manager))).toThrow(ConflictError)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/domain/workforceCommands.test.ts`
Expected: FAIL (`endWorkerProjectAssignment` is not exported).

- [ ] **Step 3: Add the model fields**

In `src/domain/models.ts`, in `WorkerProjectAssignment`, add:

```ts
  startedAt: ISODateTime
  endedAt?: ISODateTime
  endReason?: AssignmentEndReason
```

and export the type above the interface:

```ts
export type AssignmentEndReason = "reassigned" | "left-project" | "removed"
```

- [ ] **Step 4: Seed `startedAt`**

In `src/mock/seed.ts`, every existing `WorkerProjectAssignment` literal gets `startedAt` equal to its `assignedAt`. If the seed has none, nothing to change.

- [ ] **Step 5: Set `startedAt` in `assignWorkerToProject`**

In `assignWorkerToProject` (around line 827), when it creates the assignment, set `startedAt` to the same timestamp as `assignedAt`.

- [ ] **Step 6: Implement `endWorkerProjectAssignment`**

Add to `src/domain/constructionCommands.ts`, after `assignWorkerToProject`:

```ts
export const endWorkerProjectAssignment =
  (assignmentId: EntityId, reason: AssignmentEndReason): Command<WorkerProjectAssignment> =>
  (state, ctx) => {
    const assignment = state.workerProjectAssignments.find((a) => a.id === assignmentId)
    if (!assignment) throw new ConflictError("That assignment no longer exists.")
    authorizeOrganization(ctx, state.projects.find((p) => p.id === assignment.projectId)!.organizationId, Permissions.WORKFORCE_MANAGE)
    if (assignment.endedAt) throw new ConflictError("This assignment has already ended.")
    const ended: WorkerProjectAssignment = { ...assignment, endedAt: iso(ctx), endReason: reason }
    return {
      state: {
        ...state,
        workerProjectAssignments: state.workerProjectAssignments.map((a) => (a.id === assignmentId ? ended : a)),
      },
      result: ended,
    }
  }
```

Import `AssignmentEndReason` in the models import. If `authorizeOrganization` has a different signature in this file, follow the call pattern in `addWorker` (around line 862).

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run src/domain/workforceCommands.test.ts` (4 pass), then `npx vitest run` (all pass), then `npx tsc --noEmit` (clean).

- [ ] **Step 8: Commit**

```bash
git add src/domain/models.ts src/mock/seed.ts src/domain/constructionCommands.ts src/domain/workforceCommands.test.ts
git commit -m "feat: keep assignment history with start, end and end reason"
```

---

### Task 4: Onboarding helpers and manual onboarding on addWorker

**Files:**
- Create: `src/domain/workforceOnboarding.ts`
- Modify: `src/domain/constructionCommands.ts` (`addWorker`)
- Test: `src/domain/workforceOnboarding.test.ts` (create)

**Interfaces:**
- Consumes: `WorkerOnboarding`, `OnboardingMethod` (Task 2); `CommandContext` from `./ports`.
- Produces: `openOnboardingFor(state, workerId): WorkerOnboarding | undefined` (the open `invited` or `accepted` one), `generateJoinCode(ctx): string` (6 uppercase letters or digits, from `ctx.ids.short()` for determinism in tests).

- [ ] **Step 1: Write the failing tests**

Create `src/domain/workforceOnboarding.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { addWorker } from "./constructionCommands"
import { generateJoinCode, openOnboardingFor } from "./workforceOnboarding"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import type { Session } from "./session"

const ORG = "org-buildright"
const manager: Session = { accountType: "business", personId: "person-arjun", organizationId: ORG }
const clock: Clock = { now: () => new Date("2026-10-06T10:00:00.000Z") }
const ids = (): IdGenerator => {
  let n = 0
  return { next: (p) => `${p}-new-${++n}`, short: () => `ab${++n}cd` }
}
const as = (actor: Session | null): CommandContext => ({ actor, clock, ids: ids() })

describe("generateJoinCode", () => {
  it("returns a 6-character uppercase code", () => {
    const code = generateJoinCode(as(manager))
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
  })
})

describe("addWorker creates an invited worker and a manual onboarding", () => {
  const input = { organizationId: ORG, name: "Test Mason", phone: "+91 90000 00001", tradeIds: [], languages: ["en"] }

  it("creates a worker in invited status and one manual onboarding", () => {
    const { state, result } = addWorker(input as never)(seed, as(manager))
    expect(result.worker.status).toBe("invited")
    const onboarding = state.workerOnboardings.find((o) => o.workerId === result.worker.id)!
    expect(onboarding.method).toBe("manual")
    expect(onboarding.status).toBe("invited")
    expect(openOnboardingFor(state, result.worker.id)).toEqual(onboarding)
  })

  it("never creates two open onboardings for one worker", () => {
    const { state, result } = addWorker(input as never)(seed, as(manager))
    const open = state.workerOnboardings.filter(
      (o) => o.workerId === result.worker.id && (o.status === "invited" || o.status === "accepted"),
    )
    expect(open).toHaveLength(1)
  })
})
```

If `AddWorkerInput` requires fields beyond those shown, check its definition and add the minimum needed in the test, not in production code.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/domain/workforceOnboarding.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create the helpers**

Create `src/domain/workforceOnboarding.ts`:

```ts
import type { ConstructionDataState, EntityId, WorkerOnboarding } from "./models"
import type { CommandContext } from "./ports"

const JOIN_CODE_LENGTH = 6

/** The worker's open onboarding: the invited or accepted record, if any. */
export function openOnboardingFor(
  state: ConstructionDataState,
  workerId: EntityId,
): WorkerOnboarding | undefined {
  return state.workerOnboardings.find(
    (o) => o.workerId === workerId && (o.status === "invited" || o.status === "accepted"),
  )
}

/** A short code a worker enters to accept a QR join. */
export function generateJoinCode(ctx: CommandContext): string {
  return ctx.ids.short().replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, JOIN_CODE_LENGTH).padEnd(JOIN_CODE_LENGTH, "X")
}
```

- [ ] **Step 4: Make `addWorker` create the onboarding**

In `addWorker` (`src/domain/constructionCommands.ts` around line 862), after the `Worker` is created with `status: "invited"`, also create:

```ts
const onboarding: WorkerOnboarding = {
  id: ctx.ids.next("onboarding"),
  workerId: worker.id,
  organizationId: input.organizationId,
  method: "manual",
  status: "invited",
  invitedByMembershipId: undefined,
  invitedAt: iso(ctx),
}
```

Add it to the returned state as `workerOnboardings: [...state.workerOnboardings, onboarding]`. Set `Worker.onboardingMethod` to `"manual"`. Return value stays `{ worker, assignment? }`. Import `WorkerOnboarding` in the models import.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/domain/workforceOnboarding.test.ts` (pass), `npx vitest run` (all pass), `npx tsc --noEmit` (clean).

- [ ] **Step 6: Commit**

```bash
git add src/domain/workforceOnboarding.ts src/domain/workforceOnboarding.test.ts src/domain/constructionCommands.ts
git commit -m "feat: manual worker invite records a worker onboarding"
```

---

### Task 5: QR and supervisor-assisted onboarding, cancel and expire

**Files:**
- Modify: `src/domain/constructionCommands.ts` (new `createWorkerOnboarding`, `cancelWorkerOnboarding`, `expireWorkerOnboarding`)
- Test: `src/domain/workforceCommands.test.ts` (append)

**Interfaces:**
- Consumes: `openOnboardingFor`, `generateJoinCode` (Task 4).
- Produces: `createWorkerOnboarding(input: { workerId; method: "qr" | "supervisor-assisted" }): Command<WorkerOnboarding>`, `cancelWorkerOnboarding(onboardingId): Command<WorkerOnboarding>`, `expireWorkerOnboarding(onboardingId): Command<WorkerOnboarding>`.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/workforceCommands.test.ts`:

```ts
import { cancelWorkerOnboarding, createWorkerOnboarding, expireWorkerOnboarding } from "./constructionCommands"
import { openOnboardingFor } from "./workforceOnboarding"

function withWorker(): { state: ConstructionDataState; workerId: string } {
  const worker = seed.workers[0]
  return { state: seed, workerId: worker.id }
}

describe("createWorkerOnboarding", () => {
  it("creates a qr onboarding with a join code", () => {
    const { state, workerId } = withWorker()
    const { state: next, result } = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    expect(result.method).toBe("qr")
    expect(result.joinCode).toMatch(/^[A-Z0-9]{6}$/)
    expect(openOnboardingFor(next, workerId)).toEqual(result)
  })

  it("records the supervisor for a supervisor-assisted onboarding", () => {
    const { state, workerId } = withWorker()
    const { result } = createWorkerOnboarding({ workerId, method: "supervisor-assisted" })(state, as(manager))
    expect(result.method).toBe("supervisor-assisted")
    expect(result.joinCode).toBeUndefined()
  })

  it("refuses when the worker already has an open onboarding", () => {
    const { state, workerId } = withWorker()
    const once = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager)).state
    expect(() => createWorkerOnboarding({ workerId, method: "qr" })(once, as(manager))).toThrow(ConflictError)
  })
})

describe("cancelWorkerOnboarding and expireWorkerOnboarding", () => {
  it("cancel keeps the worker and marks the onboarding cancelled", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    const { state: next, result } = cancelWorkerOnboarding(created.result.id)(created.state, as(manager))
    expect(result.status).toBe("cancelled")
    expect(next.workers.find((w) => w.id === workerId)).toBeDefined()
  })

  it("expire marks the onboarding expired and keeps the worker", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    const { state: next, result } = expireWorkerOnboarding(created.result.id)(created.state, as(manager))
    expect(result.status).toBe("expired")
    expect(next.workers.find((w) => w.id === workerId)).toBeDefined()
  })

  it("refuses to cancel an onboarding that is no longer invited", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    const cancelled = cancelWorkerOnboarding(created.result.id)(created.state, as(manager)).state
    expect(() => cancelWorkerOnboarding(created.result.id)(cancelled, as(manager))).toThrow(ConflictError)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/domain/workforceCommands.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement the three commands**

Add to `src/domain/constructionCommands.ts`. Each command resolves the worker's organization, checks `WORKFORCE_MANAGE` with `authorizeOrganization`, and refuses with `ConflictError`:

- `createWorkerOnboarding({ workerId, method })`: refuses an unknown worker and a worker with an open onboarding (`openOnboardingFor`). Sets `joinCode` only for `qr` (`generateJoinCode(ctx)`). Sets `invitedByMembershipId` from the actor's membership when there is one. Appends the record.
- `cancelWorkerOnboarding(onboardingId)`: refuses unless the status is `invited`. Sets status `cancelled`.
- `expireWorkerOnboarding(onboardingId)`: refuses unless the status is `invited`. Sets status `expired` and `expiresAt` to now.

Worker status is not changed by any of these.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/domain/workforceCommands.test.ts` (pass), `npx vitest run`, `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/constructionCommands.ts src/domain/workforceCommands.test.ts
git commit -m "feat: create qr and supervisor-assisted onboarding; cancel and expire keep the worker"
```

---

### Task 6: Accept onboarding and project-team worker invite

**Files:**
- Modify: `src/domain/constructionCommands.ts` (new `acceptWorkerOnboarding`; `inviteProjectMember` for the worker role)
- Test: `src/domain/workforceCommands.test.ts` (append)

**Interfaces:**
- Consumes: `openOnboardingFor`, `generateJoinCode` (Task 4); `createWorkerOnboarding` (Task 5).
- Produces: `acceptWorkerOnboarding(onboardingId, joinCode?): Command<Worker>`.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/workforceCommands.test.ts`:

```ts
import { acceptWorkerOnboarding, inviteProjectMember } from "./constructionCommands"

describe("acceptWorkerOnboarding", () => {
  it("activates the worker and marks the onboarding accepted", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "supervisor-assisted" })(state, as(manager))
    const { state: next, result } = acceptWorkerOnboarding(created.result.id)(created.state, as(manager))
    expect(result.status).toBe("active")
    expect(next.workerOnboardings.find((o) => o.id === created.result.id)!.status).toBe("accepted")
    expect(next.workerOnboardings.find((o) => o.id === created.result.id)!.acceptedAt).toBeDefined()
  })

  it("requires the matching join code for a qr onboarding", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    expect(() => acceptWorkerOnboarding(created.result.id, "WRONG1")(created.state, as(manager))).toThrow(ConflictError)
    expect(() => acceptWorkerOnboarding(created.result.id)(created.state, as(manager))).toThrow(ConflictError)
  })

  it("a wrong join code changes nothing", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    try {
      acceptWorkerOnboarding(created.result.id, "WRONG1")(created.state, as(manager))
    } catch {
      /* expected */
    }
    expect(created.state.workerOnboardings.find((o) => o.id === created.result.id)!.status).toBe("invited")
  })

  it("accepts with the correct join code", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "qr" })(state, as(manager))
    const code = created.result.joinCode!
    const { result } = acceptWorkerOnboarding(created.result.id, code)(created.state, as(manager))
    expect(result.status).toBe("active")
  })

  it("refuses an onboarding that is not invited", () => {
    const { state, workerId } = withWorker()
    const created = createWorkerOnboarding({ workerId, method: "supervisor-assisted" })(state, as(manager))
    const accepted = acceptWorkerOnboarding(created.result.id)(created.state, as(manager)).state
    expect(() => acceptWorkerOnboarding(created.result.id)(accepted, as(manager))).toThrow(ConflictError)
  })
})

describe("inviteProjectMember for the worker role", () => {
  it("creates a worker in invited status and links the person to it", () => {
    const { state, result } = inviteProjectMember({
      projectId: seed.projects[0].id,
      name: "New Worker",
      phone: "+91 90000 00099",
      role: "worker",
      projectUnitIds: [],
    } as never)(seed, as(manager))
    const worker = state.workers.find((w) => w.userId === result.principalId)
    expect(worker).toBeDefined()
    expect(worker!.status).toBe("invited")
    expect(state.workerOnboardings.some((o) => o.workerId === worker!.id && o.method === "manual")).toBe(true)
  })

  it("does not create a worker for a non-worker role", () => {
    const before = seed.workers.length
    const { state } = inviteProjectMember({
      projectId: seed.projects[0].id,
      name: "Site Engineer",
      phone: "+91 90000 00098",
      role: "project-manager",
      projectUnitIds: [],
    } as never)(seed, as(manager))
    expect(state.workers.length).toBe(before)
  })
})
```

If `InviteProjectMemberInput` requires other fields, add them in the test input.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/domain/workforceCommands.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `acceptWorkerOnboarding`**

Add to `src/domain/constructionCommands.ts`. Refuse unless the onboarding status is `invited` (`ConflictError`). For `qr`, require `joinCode` to equal the stored `joinCode` (`ConflictError` "That join code doesn't match this invitation."). Then, in one returned state:
- onboarding: status `accepted`, `acceptedAt` now.
- worker: status `active`.
- every assignment for that worker with no `endedAt` and status `invited`: status `active`, `startedAt` now.

Return the updated worker.

- [ ] **Step 4: Change `inviteProjectMember` for the worker role**

In `inviteProjectMember` (around line 424), when `input.role === "worker"`:
- create the `Person` as today;
- create a `Worker` with `name`, `phone`, `tradeIds: []`, `languages: ["en"]`, `onboardingMethod: "manual"`, `status: "invited"`, `organizationId` from the project, and `userId: person.id`;
- create the manual `WorkerOnboarding` record (same shape as `addWorker`);
- create the `ProjectMembership` as today.

Non-worker roles are unchanged. Keep the existing duplicate-phone check.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/domain/workforceCommands.test.ts` (pass), `npx vitest run` (all pass), `npx tsc --noEmit` (clean).

- [ ] **Step 6: Commit**

```bash
git add src/domain/constructionCommands.ts src/domain/workforceCommands.test.ts
git commit -m "feat: accept worker onboarding activates the worker; project-team worker invite creates a worker"
```

---

### Task 7: Provider wiring and Workforce screen

**Files:**
- Modify: `src/mock/ConstructionDataProvider.tsx` (expose `createWorkerOnboarding`, `acceptWorkerOnboarding`, `cancelWorkerOnboarding`, `endWorkerProjectAssignment`)
- Modify: `src/screens/WorkforceScreen.tsx`

**Interfaces:**
- Consumes: the commands from Tasks 3, 5, 6, using the provider's `run(commands.x(...))` pattern (match `unlockRequirement` wiring).

- [ ] **Step 1: Read the reference files**

Read `src/mock/ConstructionDataProvider.tsx` (the command wiring pattern) and `src/screens/WorkforceScreen.tsx` in full. Copy their patterns exactly.

- [ ] **Step 2: Expose the commands**

Add the four commands to the provider's context using the same `run(commands.x(...))` shape as existing commands.

- [ ] **Step 3: Update the Workforce screen**

- Status column: show `worker.status` as a tag (`invited` gold, `active` green, `inactive` default).
- Onboarding column: show `onboardingMethod` plus the open onboarding status, if any.
- Row action "Send QR join": calls `createWorkerOnboarding({ workerId, method: "qr" })`, then shows the join code in a modal the supervisor can read out.
- Row action "Cancel invite" (only for an open `invited` onboarding): calls `cancelWorkerOnboarding`.
- Row action "End assignment" per active assignment: opens a small select for the reason (`reassigned`, `left-project`, `removed`), then calls `endWorkerProjectAssignment`.
- Keep the Hozie insight card. Copy stays factual.
- Use `useCommand`-style toasts through the existing `run` helper.

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit` (clean) and `npx vitest run` (all pass). Then check the Workforce screen in the running app as the business demo account: invite a worker from Workforce and confirm it shows `invited`; send a QR join and confirm the code appears; end an assignment and confirm the worker stays `active`. Take one screenshot.

- [ ] **Step 5: Commit**

```bash
git add src/mock/ConstructionDataProvider.tsx src/screens/WorkforceScreen.tsx
git commit -m "feat: workforce screen shows worker status, onboarding, and join and end actions"
```

---

### Task 8: Worker sign-in accepts a QR join

**Files:**
- Modify: `src/screens/WorkerOnboardingScreen.tsx`

**Interfaces:**
- Consumes: `acceptWorkerOnboarding` (Task 6) through the provider (Task 7).

- [ ] **Step 1: Read the screen**

Read `src/screens/WorkerOnboardingScreen.tsx` in full. Keep its phone sign-in and its Hozie card.

- [ ] **Step 2: Add the join-code step**

When the phone matches a worker with an open `qr` onboarding, show a join-code field. Submitting calls `acceptWorkerOnboarding(onboardingId, code)`. A wrong code shows the refusal message. For `manual` and `supervisor-assisted` onboardings, accept by phone as today, calling `acceptWorkerOnboarding(onboardingId)`. Do not add OTP.

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit` and `npx vitest run`. In the running app, send a QR join from Workforce, open the worker sign-in, enter the code, and confirm the worker becomes active. Take one screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/screens/WorkerOnboardingScreen.tsx
git commit -m "feat: worker sign-in accepts a qr join code"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full suite and build**

Run: `npx vitest run` (all pass; report the count), `npx tsc --noEmit` (clean), `npm run build` (succeeds; the chunk-size warning is expected).

- [ ] **Step 2: Scope check**

Run `git diff --stat main..HEAD`. Confirm changes are limited to the files in File Structure plus the spec and this plan. Confirm `preferredLanguage` no longer appears in `src/`: `grep -rn preferredLanguage src` returns nothing.

- [ ] **Step 3: Report**

State the test count, typecheck and build results, the browser checks from Tasks 7 and 8, and the commit list.
