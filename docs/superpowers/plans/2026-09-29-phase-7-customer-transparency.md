# Phase 7 — Customer Transparency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the homeowner a single "My Project" home (stage, timeline, photos, issues, documents, messages) built entirely from what staff explicitly publish, and give staff the controls to publish it: a `customerVisibility` toggle on issues, and a new project-scoped Documents area with its own publish toggle.

**Architecture:** Two new pure domain commands (`publishIssue`, `publishDocument`) plus one new command (`uploadDocument`) alongside the existing construction commands; a new `Document` record type in state; `Issue` gains a `customerVisibility` field, same shape as `Evidence`'s; two new selectors (`getPublishedIssues`, `getPublishedDocuments`) mirroring `getPublishedEvidence`; a new company screen (`ProjectDocumentsScreen`) activating the already-present but disabled "Documents" nav item; a toggle added to the existing `IssueDetailScreen`; and the existing `CustomerDailyUpdateScreen` extended with a Current Stage line and two new sections, reusing its existing `DayTimeline`/`EvidenceGrid`/`ThreadPanel` pieces unchanged.

**Tech Stack:** React 19, TypeScript 5.7, Ant Design 6, Vitest. Package manager pnpm.

**Spec:** `docs/superpowers/specs/2026-09-29-phase-7-customer-transparency-design.md`

## Global Constraints

- Checks: `pnpm run typecheck`, `pnpm run test`, `pnpm run build` must pass after every task.
- **Never run `pnpm run format`** (oxfmt 0.2.0 strips `;` in TypeScript types and breaks the build).
- Git commands need `export PATH="/opt/homebrew/bin:$PATH"` first (git-lfs hooks).
- **Never kill processes by pattern** (`pkill -f …`).
- Domain commands are pure `(state, ctx) => { state, result }`, authorize first; errors: `PermissionError` (from `./session`), `IntegrityError` / `ConflictError` (from `./errors`).
- `customerVisibility` is a two-state field on `Issue` and `Document`: `"private" | "customer-visible"` — not `Evidence`'s three-state union. Defaults to `"private"` wherever built.
- Nothing customer-visible without an explicit staff action gated on `Permissions.CUSTOMER_PUBLISH` — never automatic, never derived from status or severity.
- `CUSTOMER_PUBLISH` (already granted to `project-manager` and `supervisor` in `src/domain/permissions.ts`) is reused unchanged — no new permission is introduced.
- The homeowner screen (`CustomerDailyUpdateScreen.tsx`) reads issues/documents only through `getPublishedIssues`/`getPublishedDocuments` — never `state.issues`/`state.documents` directly.
- Copy (exact): `"Give the document a title."`
- Code style: double quotes, no semicolons, match surrounding comment density; default exports for components.

## File Structure

| File | Responsibility |
|---|---|
| `src/domain/models.ts` (modify) | `Issue.customerVisibility`; `Document` interface; `documents: Document[]` on `ConstructionDataState` |
| `src/domain/commandInputs.ts` (modify) | `UploadDocumentInput` |
| `src/domain/constructionCommands.ts` (modify) | `publishIssue`, `uploadDocument`, `publishDocument` commands |
| `src/domain/readScope.test.ts` (modify) | `issueIn` test helper gains the new required field |
| `src/domain/customerTransparency.test.ts` (create) | Tests for the three new commands |
| `src/mock/seed.ts` (modify) | `customerVisibility` on seeded issues; `documents: Document[]` seed array and state field |
| `src/mock/selectors.ts` (modify) | `getPublishedIssues`, `getPublishedDocuments` |
| `src/domain/visibility.test.ts` (modify) | Tests for the two new selectors |
| `src/mock/ConstructionDataProvider.tsx` (modify) | `publishIssue`, `uploadDocument`, `publishDocument` exposed on the context |
| `src/components/documents/DocumentViewerModal.tsx` (create) | Read-only look at one document (title, category, date, open link) |
| `src/components/company/companyNav.tsx` (modify) | `projectNav()`'s `documents` item gets a `to` |
| `src/domain/navigation.ts` (modify) | `project-documents` route |
| `src/screens/ProjectDocumentsScreen.tsx` (create) | Company Documents page: list, upload, publish toggle |
| `src/App.tsx` (modify) | Mount `ProjectDocumentsScreen` for `screen === 'project-documents'` |
| `src/screens/IssueDetailScreen.tsx` (modify) | "Share with homeowner" toggle |
| `src/screens/CustomerDailyUpdateScreen.tsx` (modify) | Current Stage line; Issues section; Documents section |
| `src/screens/HomeDashboardScreen.tsx` (modify) | Side-menu label "Site update" → "My Project" |
| `src/components/HomeownerMobileMenu.tsx` (modify) | Same label change, phone drawer |
| `docs/superpowers/specs/2026-09-29-phase-7-customer-transparency-design.md` (modify) | Status → Implemented |

---

### Task 1: Data model — `Issue.customerVisibility` and the `Document` record

**Files:**
- Modify: `src/domain/models.ts` (`Issue` interface ~line 290-313; `ConstructionDataState` ~line 370-392)
- Modify: `src/domain/constructionCommands.ts` (`reportIssue`'s issue literal, ~line 1512-1528)
- Modify: `src/mock/seed.ts` (`issues` array ~line 982-1024; state object ~line 1406-1411)
- Modify: `src/domain/readScope.test.ts` (`issueIn` helper, ~line 25-29)

**Interfaces:**
- Produces:
  ```ts
  export interface Document {
    id: EntityId
    projectId: EntityId
    title: string
    category: "approval" | "contract" | "drawing" | "other"
    url: string
    uploadedByMembershipId: EntityId
    customerVisibility: "private" | "customer-visible"
    createdAt: ISODateTime
  }
  ```
  `Issue` gains `customerVisibility: "private" | "customer-visible"`. `ConstructionDataState` gains `documents: Document[]`.
  Task 2 (commands) builds `Document` records and reads/writes `Issue.customerVisibility`. Task 3 (selectors) filters both by `customerVisibility`.

- [ ] **Step 1: Add `customerVisibility` to `Issue`**

In `src/domain/models.ts`, in the `Issue` interface, add the field right after `evidenceIds: EntityId[]`:

```ts
  evidenceIds: EntityId[]
  /** Two states, not Evidence's three — a staff member either has shared this with the homeowner or hasn't. */
  customerVisibility: "private" | "customer-visible"
```

- [ ] **Step 2: Add the `Document` interface**

In `src/domain/models.ts`, immediately after the `Issue` interface's closing `}` (before `/** What a conversation is attached to. */`), add:

```ts
/** A file shared with staff and, once published, the homeowner — an approval, contract or drawing. */
export interface Document {
  id: EntityId
  projectId: EntityId
  title: string
  category: "approval" | "contract" | "drawing" | "other"
  url: string
  uploadedByMembershipId: EntityId
  customerVisibility: "private" | "customer-visible"
  createdAt: ISODateTime
}
```

- [ ] **Step 3: Add `documents` to `ConstructionDataState`**

In `src/domain/models.ts`, add `documents: Document[]` to `ConstructionDataState`, next to `evidence: Evidence[]`:

```ts
  evidence: Evidence[]
  documents: Document[]
  issues: Issue[]
```

- [ ] **Step 4: Default `reportIssue`'s new issues to private**

In `src/domain/constructionCommands.ts`, in `reportIssue`'s `issue` object literal (~line 1512), add the field next to `evidenceIds`:

```ts
      evidenceIds: evidence.map((item) => item.id),
      customerVisibility: "private",
      createdByMembershipId: reporter.id,
```

- [ ] **Step 5: Update seed data**

In `src/mock/seed.ts`, add `Document` to the `import type { ... } from "../domain/models"` block (alongside `Issue`).

Add `customerVisibility: "private",` to each of the three seeded issues (~line 982-1024: `issue-1`, `issue-2`, `issue-3`), right after each one's `evidenceIds: [],` line. Example for `issue-3` (the only one on `project-sharma` — Tasks 6-8's walkthroughs publish it live to demonstrate the flow, rather than seeding it pre-published):

```ts
  {
    id: "issue-3",
    projectId: "project-sharma",
    taskId: "task-9",
    title: "Material wastage above 8% threshold",
    description: "Review cut lengths and storage before the next steel order.",
    severity: "low",
    status: "open",
    assignedMembershipId: "membership-manager-1",
    evidenceIds: [],
    customerVisibility: "private",
    createdByMembershipId: "membership-manager-1",
    createdAt: "2026-09-15T11:30:00+05:30",
  },
```

(`issue-1` and `issue-2` each get the identical `customerVisibility: "private",` line added the same way.)

Add a new `documents` array right before `export const seedConstructionData` (near the `callLogs`/`issues` arrays):

```ts
const documents: Document[] = [
  {
    id: "document-sharma-1",
    projectId: "project-sharma",
    title: "Municipal building approval",
    category: "approval",
    url: "/mock-evidence/sharma-approval.pdf",
    uploadedByMembershipId: "membership-manager-1",
    customerVisibility: "customer-visible",
    createdAt: "2026-09-10T10:00:00+05:30",
  },
  {
    id: "document-sharma-2",
    projectId: "project-sharma",
    title: "Construction contract — Sharma Residence",
    category: "contract",
    url: "/mock-evidence/sharma-contract.pdf",
    uploadedByMembershipId: "membership-manager-1",
    customerVisibility: "private",
    createdAt: "2026-09-11T09:30:00+05:30",
  },
]
```

Add `documents,` to the `seedConstructionData` object literal (~line 1406), next to `evidence:`:

```ts
  evidence: [
    // ...unchanged...
  ],
  documents,
  issues,
```

- [ ] **Step 6: Fix the other `Issue`-literal test helper**

In `src/domain/readScope.test.ts`, the `issueIn` helper (~line 25-29) builds a full `Issue` object and needs the new required field:

```ts
const issueIn = (id: string, projectUnitId?: string, taskId?: string): Issue => ({
  id, projectId: P, projectUnitId, taskId, stageId: template.stageId, tradeId: template.tradeId,
  title: id, description: "", severity: "low", status: "open", evidenceIds: [],
  customerVisibility: "private",
  createdByMembershipId: "m", createdAt: "2026-01-01T00:00:00Z",
})
```

- [ ] **Step 7: Verify**

Run: `pnpm run typecheck && pnpm run test`
Expected: PASS. (This confirms every existing `Issue`-literal site was found — a missed one fails typecheck with "Property 'customerVisibility' is missing".)

- [ ] **Step 8: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/domain/models.ts src/domain/constructionCommands.ts src/mock/seed.ts src/domain/readScope.test.ts
git commit -m "feat: add customerVisibility to Issue and a new Document record"
```

---

### Task 2: Commands — `publishIssue`, `uploadDocument`, `publishDocument`

**Files:**
- Modify: `src/domain/commandInputs.ts`
- Modify: `src/domain/constructionCommands.ts`
- Create: `src/domain/customerTransparency.test.ts`

**Interfaces:**
- Consumes: `Document` from `./models` (Task 1); `authorizeProject`, `withIssue` (existing helpers in `constructionCommands.ts`); `Permissions.CUSTOMER_PUBLISH`, `Permissions.EVIDENCE_CAPTURE`.
- Produces:
  ```ts
  export interface UploadDocumentInput {
    projectId: EntityId
    title: string
    category: Document["category"]
    url: string
  }
  export const publishIssue: (issueId: EntityId, visible: boolean) => Command<Issue>
  export const uploadDocument: (input: UploadDocumentInput) => Command<Document>
  export const publishDocument: (documentId: EntityId, visible: boolean) => Command<Document>
  ```
  Task 4 (provider) exposes all three on the context. Task 5 (`ProjectDocumentsScreen`) calls `uploadDocument`/`publishDocument`. Task 6 (`IssueDetailScreen`) calls `publishIssue`.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/customerTransparency.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { publishDocument, publishIssue, uploadDocument } from "./constructionCommands"
import { ConflictError } from "./errors"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import { PermissionError, type Session } from "./session"

// membership-manager-1: project-manager on project-sharma (CUSTOMER_PUBLISH + EVIDENCE_CAPTURE).
const manager: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
// membership-worker-ravi-sharma: worker on project-sharma (EVIDENCE_CAPTURE, no CUSTOMER_PUBLISH).
const worker: Session = { accountType: "worker", personId: "person-ravi", organizationId: "org-buildright" }
const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }
const clock: Clock = { now: () => new Date("2026-09-29T10:00:00.000Z") }
const ids = (): IdGenerator => {
  let n = 0
  return { next: (p) => `${p}-new-${++n}`, short: () => `s${++n}` }
}
const as = (actor: Session): CommandContext => ({ actor, clock, ids: ids() })
const run = <T,>(state: ConstructionDataState, actor: Session, command: (s: ConstructionDataState, c: CommandContext) => { state: ConstructionDataState; result: T }) =>
  command(state, as(actor))

describe("publishIssue", () => {
  // All seeded issues default to private; issue-3 is the only one on project-sharma
  // (membership-manager-1's project), so it's the fixture these tests publish/hide.
  const published = {
    ...seed,
    issues: seed.issues.map((item) =>
      item.id === "issue-3" ? { ...item, customerVisibility: "customer-visible" as const } : item,
    ),
  }

  it("shares a private issue with the homeowner", () => {
    const { result } = run(seed, manager, publishIssue("issue-3", true))
    expect(result.customerVisibility).toBe("customer-visible")
  })

  it("can hide an already-shared issue again", () => {
    const { result } = run(published, manager, publishIssue("issue-3", false))
    expect(result.customerVisibility).toBe("private")
  })

  it("is a no-op when already in that state", () => {
    const { state, result } = run(seed, manager, publishIssue("issue-3", false))
    expect(result.customerVisibility).toBe("private")
    expect(state).toBe(seed)
  })

  it("refuses a caller without CUSTOMER_PUBLISH", () => {
    expect(() => run(seed, worker, publishIssue("issue-3", true))).toThrow(PermissionError)
    expect(() => run(seed, homeowner, publishIssue("issue-3", true))).toThrow(PermissionError)
  })

  it("refuses a missing issue", () => {
    expect(() => run(seed, manager, publishIssue("nope", true))).toThrow(PermissionError)
  })
})

describe("uploadDocument", () => {
  const input = { projectId: "project-sharma", title: "Site plan v2", category: "drawing" as const, url: "blob:x" }

  it("uploads a document, defaulting to private", () => {
    const { result, state } = run(seed, manager, uploadDocument(input))
    expect(result).toMatchObject({ projectId: "project-sharma", title: "Site plan v2", category: "drawing", customerVisibility: "private", uploadedByMembershipId: "membership-manager-1" })
    expect(state.documents).toContainEqual(result)
  })

  it("allows any EVIDENCE_CAPTURE holder, not only publishers", () => {
    expect(() => run(seed, worker, uploadDocument(input))).not.toThrow()
  })

  it("refuses a caller without EVIDENCE_CAPTURE", () => {
    expect(() => run(seed, homeowner, uploadDocument(input))).toThrow(PermissionError)
  })

  it("requires a non-empty title", () => {
    expect(() => run(seed, manager, uploadDocument({ ...input, title: "   " }))).toThrow(ConflictError)
    expect(() => run(seed, manager, uploadDocument({ ...input, title: "   " }))).toThrow(/title/i)
  })
})

describe("publishDocument", () => {
  it("shares a private document with the homeowner", () => {
    const { result } = run(seed, manager, publishDocument("document-sharma-2", true))
    expect(result.customerVisibility).toBe("customer-visible")
  })

  it("can hide a document again", () => {
    const { result } = run(seed, manager, publishDocument("document-sharma-1", false))
    expect(result.customerVisibility).toBe("private")
  })

  it("refuses a caller without CUSTOMER_PUBLISH", () => {
    expect(() => run(seed, worker, publishDocument("document-sharma-2", true))).toThrow(PermissionError)
  })

  it("refuses a missing document", () => {
    expect(() => run(seed, manager, publishDocument("nope", true))).toThrow(PermissionError)
  })
})
```

- [ ] **Step 2: Run and see it fail**

Run: `pnpm vitest run src/domain/customerTransparency.test.ts`
Expected: FAIL (`publishIssue`, `uploadDocument`, `publishDocument` do not exist; `state.documents` is `undefined` until Task 1's seed change — Task 1 must already be committed before this task starts).

- [ ] **Step 3: Add `UploadDocumentInput`**

In `src/domain/commandInputs.ts`, add `Document` to the `import type { ... } from "./models"` block, and append at the end of the file:

```ts

export interface UploadDocumentInput {
  projectId: EntityId
  title: string
  category: Document["category"]
  url: string
}
```

- [ ] **Step 4: Implement `publishIssue`**

In `src/domain/constructionCommands.ts`, append after `addIssueEvidence` (end of the `─── Issues ───` section, end of file so far):

```ts

/** Shares (or hides) one issue with the homeowner. Independent of status — an open issue can be shared, a resolved one can stay private. */
export const publishIssue =
  (issueId: EntityId, visible: boolean): Command<Issue> =>
  (state, ctx) => {
    const issue = state.issues.find((item) => item.id === issueId)
    if (!issue) throw new PermissionError(Permissions.CUSTOMER_PUBLISH)
    authorizeProject(state, ctx, issue.projectId, [Permissions.CUSTOMER_PUBLISH], issue)
    const customerVisibility = visible ? "customer-visible" : "private"
    if (issue.customerVisibility === customerVisibility) return { state, result: issue }
    const next = withIssue(state, issueId, (item) => ({ ...item, customerVisibility }))
    return { state: next, result: next.issues.find((item) => item.id === issueId)! }
  }
```

- [ ] **Step 5: Implement `uploadDocument` and `publishDocument`**

In `src/domain/constructionCommands.ts`, add `Document` to the `import type { ... } from "./models"` block (alongside `Issue`, `Evidence`, ...) and `UploadDocumentInput` to the `import type { ... } from "./commandInputs"` block. Append a new section at the very end of the file:

```ts

// ─── Documents ─────────────────────────────────────────────────────────────────

export const uploadDocument =
  (input: UploadDocumentInput): Command<Document> =>
  (state, ctx) => {
    const uploader = authorizeProject(state, ctx, input.projectId, [Permissions.EVIDENCE_CAPTURE])
    const title = input.title.trim()
    if (!title) throw new ConflictError("Give the document a title.")
    const document: Document = {
      id: ctx.ids.next("document"),
      projectId: input.projectId,
      title,
      category: input.category,
      url: input.url,
      uploadedByMembershipId: uploader.id,
      customerVisibility: "private",
      createdAt: iso(ctx),
    }
    return { state: { ...state, documents: [...state.documents, document] }, result: document }
  }

/** Shares (or hides) one document with the homeowner. */
export const publishDocument =
  (documentId: EntityId, visible: boolean): Command<Document> =>
  (state, ctx) => {
    const document = state.documents.find((item) => item.id === documentId)
    if (!document) throw new PermissionError(Permissions.CUSTOMER_PUBLISH)
    authorizeProject(state, ctx, document.projectId, [Permissions.CUSTOMER_PUBLISH], document)
    const customerVisibility = visible ? "customer-visible" : "private"
    if (document.customerVisibility === customerVisibility) return { state, result: document }
    const documents = state.documents.map((item) =>
      item.id === documentId ? { ...item, customerVisibility } : item,
    )
    return { state: { ...state, documents }, result: documents.find((item) => item.id === documentId)! }
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/domain/customerTransparency.test.ts && pnpm run typecheck`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/domain/commandInputs.ts src/domain/constructionCommands.ts src/domain/customerTransparency.test.ts
git commit -m "feat: publishIssue, uploadDocument, publishDocument commands"
```

---

### Task 3: Selectors — `getPublishedIssues`, `getPublishedDocuments`

**Files:**
- Modify: `src/mock/selectors.ts`
- Modify: `src/domain/visibility.test.ts`

**Interfaces:**
- Consumes: `Document` from `../domain/models` (Task 1).
- Produces:
  ```ts
  export function getPublishedIssues(state: ConstructionDataState, projectId: EntityId): Issue[]
  export function getPublishedDocuments(state: ConstructionDataState, projectId: EntityId): Document[]
  ```
  Task 7 (`CustomerDailyUpdateScreen`) consumes both.

- [ ] **Step 1: Write the failing tests**

In `src/domain/visibility.test.ts`, add `getPublishedDocuments` and `getPublishedIssues` to the existing import from `"../mock/selectors"`, and append a new `describe` block before the closing of the file:

```ts
describe("published issues and documents", () => {
  // All seeded issues default to private (Task 1) — build a local override with
  // issue-3 published, the same way the "shows the homeowner only what was chosen
  // at publishing" test above overrides state rather than relying on a seeded default.
  const issuePublished = {
    ...seedConstructionData,
    issues: seedConstructionData.issues.map((item) =>
      item.id === "issue-3" ? { ...item, customerVisibility: "customer-visible" as const } : item,
    ),
  }

  it("returns only customer-visible issues for the project", () => {
    const published = getPublishedIssues(issuePublished, "project-sharma")
    expect(published.every((item) => item.customerVisibility === "customer-visible")).toBe(true)
    expect(published.some((item) => item.id === "issue-3")).toBe(true)
  })

  it("excludes private issues", () => {
    const published = getPublishedIssues(seedConstructionData, "project-sharma")
    expect(published).toHaveLength(0)
  })

  it("returns only customer-visible documents for the project", () => {
    const published = getPublishedDocuments(seedConstructionData, "project-sharma")
    expect(published.every((item) => item.customerVisibility === "customer-visible")).toBe(true)
    expect(published.some((item) => item.id === "document-sharma-1")).toBe(true)
    expect(published.some((item) => item.id === "document-sharma-2")).toBe(false) // private
  })
})
```

- [ ] **Step 2: Run and see it fail**

Run: `pnpm vitest run src/domain/visibility.test.ts`
Expected: FAIL (`getPublishedIssues`, `getPublishedDocuments` do not exist).

- [ ] **Step 3: Implement**

In `src/mock/selectors.ts`, add `Document` to the `import type { ... } from "../domain/models"` block. Append at the end of the file:

```ts

/** Issues a staff member has shared with the homeowner, newest first. */
export function getPublishedIssues(state: ConstructionDataState, projectId: EntityId) {
  return state.issues
    .filter((issue) => issue.projectId === projectId && issue.customerVisibility === "customer-visible")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

/** Documents a staff member has shared with the homeowner, newest first. */
export function getPublishedDocuments(state: ConstructionDataState, projectId: EntityId) {
  return state.documents
    .filter((doc) => doc.projectId === projectId && doc.customerVisibility === "customer-visible")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/domain/visibility.test.ts && pnpm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/mock/selectors.ts src/domain/visibility.test.ts
git commit -m "feat: getPublishedIssues and getPublishedDocuments selectors"
```

---

### Task 4: Wire the three commands into the data provider

**Files:**
- Modify: `src/mock/ConstructionDataProvider.tsx`

**Interfaces:**
- Consumes: `publishIssue`, `uploadDocument`, `publishDocument`, `UploadDocumentInput` (Task 2).
- Produces: all three exposed on the context value, alongside `reportIssue`/`addIssueEvidence`.

- [ ] **Step 1: Add imports**

In `src/mock/ConstructionDataProvider.tsx`, add `Document` to the `import type { ... } from "../domain/models"` block (alongside `Issue`, `Evidence`, ...).

- [ ] **Step 2: Add to the context type**

Add directly below `addIssueEvidence: (...) => Evidence[]` (~line 132):

```ts
  publishIssue: (issueId: EntityId, visible: boolean) => Issue
  uploadDocument: (input: Inputs.UploadDocumentInput) => Document
  publishDocument: (documentId: EntityId, visible: boolean) => Document
```

- [ ] **Step 3: Add to the provider's `useMemo` value**

Add directly below `addIssueEvidence: (id, items) => run(commands.addIssueEvidence(id, items)),` (~line 231):

```ts
      publishIssue: (id, visible) => run(commands.publishIssue(id, visible)),
      uploadDocument: (input) => run(commands.uploadDocument(input)),
      publishDocument: (id, visible) => run(commands.publishDocument(id, visible)),
```

- [ ] **Step 4: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: all PASS (nothing calls these from the UI yet, so this only proves the wiring compiles).

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/mock/ConstructionDataProvider.tsx
git commit -m "feat: expose publishIssue, uploadDocument, publishDocument on the data provider"
```

---

### Task 5: Company — Documents page

**Files:**
- Modify: `src/components/company/companyNav.tsx`
- Modify: `src/domain/navigation.ts`
- Create: `src/screens/ProjectDocumentsScreen.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `uploadDocument`, `publishDocument` from `useConstructionData()` (Task 4); `useCommand`, `useAccess`, `Gated`, `CompanyLayout`, `CompanyThemeProvider` (all existing — see `IssuesScreen.tsx` for the exact pattern).
- Produces: `ProjectDocumentsScreen` component, mounted at the `project-documents` route.

- [ ] **Step 1: Activate the nav item**

In `src/components/company/companyNav.tsx`, in `projectNav()`, change:

```ts
    { key: "documents", label: "Documents", icon: <FileTextOutlined /> },
```

to:

```ts
    { key: "documents", label: "Documents", icon: <FileTextOutlined />, to: { screen: "project-documents", params: p } },
```

(Leave `COMPANY_NAV`'s workspace-level `documents` item, line 81, untouched — it stays a disabled "Soon" item; only the project-scoped one is built.)

- [ ] **Step 2: Add the route**

In `src/domain/navigation.ts`, in the `routes` object, add right after `issues`:

```ts
  "project-documents": {
    access: project(Permissions.PROJECT_READ),
    requires: ["project_id"],
  },
```

- [ ] **Step 3: Build the screen**

Create `src/screens/ProjectDocumentsScreen.tsx`:

```tsx
import { FileTextOutlined, UploadOutlined } from "@ant-design/icons"
import { Button, Card, Flex, Form, Input, Modal, Select, Space, Switch, Table, Typography, Upload } from "antd"
import type { TableProps, UploadProps } from "antd"
import { useState } from "react"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import Gated from "../components/Gated"
import { countLabel } from "../components/countLabel"
import type { Document, EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { Permissions } from "../domain/permissions"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getMembershipName } from "../mock/selectors"
import { useAccess } from "../session/useCan"
import { useCommand } from "../session/useCommand"
import { useScopedData } from "../session/useScopedData"

const { Text, Title } = Typography

const categoryOptions: Array<{ value: Document["category"]; label: string }> = [
  { value: "approval", label: "Approval" },
  { value: "contract", label: "Contract" },
  { value: "drawing", label: "Drawing" },
  { value: "other", label: "Other" },
]

interface UploadFormValues {
  title: string
  category: Document["category"]
}

function UploadDocumentModal({
  open,
  onClose,
  projectId,
}: {
  open: boolean
  onClose: () => void
  projectId: EntityId
}) {
  const { uploadDocument } = useConstructionData()
  const run = useCommand()
  const [form] = Form.useForm<UploadFormValues>()
  const [file, setFile] = useState<File>()

  const close = () => {
    form.resetFields()
    setFile(undefined)
    onClose()
  }

  const handleFinish = (values: UploadFormValues) => {
    if (!file) return
    const outcome = run(
      () =>
        uploadDocument({
          projectId,
          title: values.title,
          category: values.category,
          url: URL.createObjectURL(file),
        }),
      { success: "Document uploaded" },
    )
    if (outcome.ok) close()
  }

  const beforeUpload: UploadProps["beforeUpload"] = (picked) => {
    setFile(picked)
    if (!form.getFieldValue("title")) form.setFieldsValue({ title: picked.name })
    return false
  }

  return (
    <Modal title="Upload document" open={open} onCancel={close} footer={null} destroyOnHidden>
      <Form<UploadFormValues> form={form} layout="vertical" requiredMark={false} onFinish={handleFinish}>
        <Form.Item label="File" required>
          <Upload maxCount={1} beforeUpload={beforeUpload} onRemove={() => setFile(undefined)}>
            <Button icon={<UploadOutlined />}>Choose file</Button>
          </Upload>
        </Form.Item>
        <Form.Item label="Title" name="title" rules={[{ required: true, message: "Give the document a title." }]}>
          <Input placeholder="e.g. Municipal building approval" />
        </Form.Item>
        <Form.Item label="Category" name="category" initialValue="other" rules={[{ required: true }]}>
          <Select options={categoryOptions} />
        </Form.Item>
        <Flex justify="flex-end" gap="small">
          <Button onClick={close}>Cancel</Button>
          <Button type="primary" htmlType="submit" disabled={!file}>Upload</Button>
        </Flex>
      </Form>
    </Modal>
  )
}

function ProjectDocuments({ onNavigate, projectId }: { onNavigate: Navigate; projectId: EntityId }) {
  const { state, publishDocument } = useConstructionData()
  const scoped = useScopedData()
  const can = useAccess()
  const run = useCommand()
  const [uploadOpen, setUploadOpen] = useState(false)

  const canUpload = can(Permissions.EVIDENCE_CAPTURE, projectId)
  const canPublish = can(Permissions.CUSTOMER_PUBLISH, projectId)

  const documents = scoped.documents
    .filter((doc) => doc.projectId === projectId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  const columns: TableProps<Document>["columns"] = [
    {
      title: "Document",
      key: "title",
      render: (_, doc) => (
        <a href={doc.url} target="_blank" rel="noreferrer">
          <Space><FileTextOutlined />{doc.title}</Space>
        </a>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      render: (value: Document["category"]) => categoryOptions.find((opt) => opt.value === value)?.label ?? value,
    },
    {
      title: "Uploaded by",
      key: "uploadedBy",
      responsive: ["md"],
      render: (_, doc) => <Text>{getMembershipName(state, doc.uploadedByMembershipId) ?? "Unknown"}</Text>,
    },
    {
      title: "Uploaded",
      dataIndex: "createdAt",
      key: "createdAt",
      responsive: ["lg"],
      render: (value: string) => <Text type="secondary">{value.slice(0, 10)}</Text>,
    },
    {
      title: "Shared with homeowner",
      key: "visibility",
      render: (_, doc) => (
        <Gated allowed={canPublish} reason="Publishing needs customer-publish access on this project.">
          <Switch
            checked={doc.customerVisibility === "customer-visible"}
            onChange={(checked) => run(() => publishDocument(doc.id, checked))}
          />
        </Gated>
      ),
    },
  ]

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "documents" }}
      onNavigate={onNavigate}
      description="Approvals, contracts and drawings — share what the homeowner should see"
      actions={
        <Gated allowed={canUpload} reason="You can't upload documents on this project.">
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
            Upload document
          </Button>
        </Gated>
      }
    >
      <Flex vertical gap="large" className="company-content">
        <Card
          title={<Title level={5} className="company-heading! m-0!">Documents</Title>}
          extra={<Text type="secondary">{countLabel(documents.length, "document")}</Text>}
          classNames={{ body: "company-table-card-body" }}
        >
          <Table rowKey="id" columns={columns} dataSource={documents} pagination={{ pageSize: 10, showSizeChanger: false }} />
        </Card>
      </Flex>

      <UploadDocumentModal open={uploadOpen} onClose={() => setUploadOpen(false)} projectId={projectId} />
    </CompanyLayout>
  )
}

export default function ProjectDocumentsScreen({ onNavigate, projectId }: { onNavigate: Navigate; projectId: EntityId }) {
  return (
    <CompanyThemeProvider>
      <ProjectDocuments onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
```

- [ ] **Step 4: Mount the screen**

In `src/App.tsx`, add the lazy import near `IssuesScreen`'s (~line 43):

```ts
const ProjectDocumentsScreen = lazy(() => import('./screens/ProjectDocumentsScreen'))
```

Add the route block right after the `screen === 'issues'` block (~line 414):

```tsx
      {screen === 'project-documents' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <ProjectDocumentsScreen onNavigate={navigateTo} projectId={projectId} />
          </Suspense>
        </div>
      )}
```

- [ ] **Step 5: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

Browser check (http://localhost:5174, business demo sign-in for Arjun — `localStorage.setItem("houzeify:session", JSON.stringify({accountType:"business",personId:"person-arjun",organizationId:"org-buildright"}))`): open `#project-documents?project_id=project-sharma` (or click Documents in the project side menu — it's no longer "Soon"). Confirm two seeded documents appear, one already marked shared, one private. Toggle the private one on, confirm it flips. Click "Upload document", pick any local file, fill a title, submit — the new document appears, private by default.

- [ ] **Step 6: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/components/company/companyNav.tsx src/domain/navigation.ts src/screens/ProjectDocumentsScreen.tsx src/App.tsx
git commit -m "feat: company Documents page (upload, categorize, publish to homeowner)"
```

---

### Task 6: Company — "Share with homeowner" toggle on Issue detail

**Files:**
- Modify: `src/screens/IssueDetailScreen.tsx`

**Interfaces:**
- Consumes: `publishIssue` from `useConstructionData()` (Task 4).

- [ ] **Step 1: Destructure `publishIssue` and import `Switch`**

In `src/screens/IssueDetailScreen.tsx`, change:

```ts
  const { state, assignIssue, transitionIssue, addIssueEvidence } = useConstructionData()
```

to:

```ts
  const { state, assignIssue, transitionIssue, addIssueEvidence, publishIssue } = useConstructionData()
```

Change the `antd` import line:

```ts
import { Alert, Button, Card, Col, Empty, Flex, Input, Modal, Row, Select, Space, Tag, Timeline, Typography, Upload } from "antd"
```

to:

```ts
import { Alert, Button, Card, Col, Empty, Flex, Input, Modal, Row, Select, Space, Switch, Tag, Timeline, Typography, Upload } from "antd"
```

(`Permissions` is already imported from `"../domain/permissions"` at the top of this file — no change needed there.)

- [ ] **Step 2: Add the toggle to the Details card**

In the "Details" `Card` (~line 209-233), add a row after the "Raised" row, before the card's closing `</Flex></Card>`:

```tsx
                  <Flex justify="space-between" align="center">
                    <Text type="secondary">Share with homeowner</Text>
                    <Gated allowed={can(Permissions.CUSTOMER_PUBLISH, projectId, issue)} reason="Publishing needs customer-publish access on this project.">
                      <Switch
                        checked={issue.customerVisibility === "customer-visible"}
                        onChange={(checked) => run(() => publishIssue(issue.id, checked), { success: checked ? "Shared with the homeowner" : "Hidden from the homeowner" })}
                      />
                    </Gated>
                  </Flex>
```

- [ ] **Step 3: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

Browser check: open `#issue-detail?project_id=project-sharma&issue_id=issue-3` as Arjun. Confirm the "Share with homeowner" switch starts off (issues default to private). Toggle it on, confirm it flips. Toggle it back off, confirm it flips again.

- [ ] **Step 4: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/screens/IssueDetailScreen.tsx
git commit -m "feat: share an issue with the homeowner from Issue detail"
```

---

### Task 7: Homeowner — "My Project" home (Current Stage, Issues, Documents)

**Files:**
- Create: `src/components/documents/DocumentViewerModal.tsx`
- Modify: `src/screens/CustomerDailyUpdateScreen.tsx`

**Interfaces:**
- Consumes: `getPublishedIssues`, `getPublishedDocuments`, `getStageName` (Task 3, and existing `getStageName` at `src/mock/selectors.ts:36`).
- Produces:
  ```ts
  export default function DocumentViewerModal(props: {
    document: Document | undefined
    onClose: () => void
  }): JSX.Element | null
  ```

- [ ] **Step 1: Build the document viewer**

Create `src/components/documents/DocumentViewerModal.tsx`:

```tsx
import { FileOutlined } from "@ant-design/icons"
import { Descriptions, Flex, Modal, Typography } from "antd"
import type { Document } from "../../domain/models"

const { Text } = Typography

const categoryLabel: Record<Document["category"], string> = {
  approval: "Approval",
  contract: "Contract",
  drawing: "Drawing",
  other: "Other",
}

/** Read-only look at one shared document: what it is and a link to open it. */
export default function DocumentViewerModal({
  document,
  onClose,
}: {
  document: Document | undefined
  onClose: () => void
}) {
  if (!document) return null
  return (
    <Modal open width={480} footer={null} title={document.title} onCancel={onClose} destroyOnHidden>
      <Flex vertical gap="middle">
        <Flex align="center" justify="center" gap="small" className="evidence-viewer-media" style={{ minHeight: 160 }}>
          <FileOutlined style={{ fontSize: 40 }} />
          <a href={document.url} target="_blank" rel="noreferrer">Open document</a>
        </Flex>
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: "category", label: "Category", children: categoryLabel[document.category] },
            { key: "date", label: "Date", children: document.createdAt.slice(0, 10) },
          ]}
        />
      </Flex>
    </Modal>
  )
}
```

- [ ] **Step 2: Add Current Stage, Issues and Documents to the homeowner screen**

In `src/screens/CustomerDailyUpdateScreen.tsx`, the file currently opens with:

```ts
import { ArrowLeftOutlined } from "@ant-design/icons"
import { Button, Card, Flex, Progress, Typography } from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import LogoHorizontal from "../components/LogoHorizontal"
import ThreadPanel from "../components/conversations/ThreadPanel"
import DayTimeline from "../components/progress/DayTimeline"
import EvidenceGrid from "../components/progress/EvidenceGrid"
import { findThread, readerMembership } from "../domain/conversations"
import type { EntityId, Thread } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getProject,
  getPublishedEvidence,
  getPublishedForCustomer,
  getWorkTypeName,
} from "../mock/selectors"
import { useSession } from "../session/SessionProvider"
```

Replace it with:

```ts
import { useState } from "react"
import { ArrowLeftOutlined, FileTextOutlined } from "@ant-design/icons"
import { Button, Card, Flex, List, Progress, Tag, Typography } from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import DocumentViewerModal from "../components/documents/DocumentViewerModal"
import LogoHorizontal from "../components/LogoHorizontal"
import ThreadPanel from "../components/conversations/ThreadPanel"
import DayTimeline from "../components/progress/DayTimeline"
import EvidenceGrid from "../components/progress/EvidenceGrid"
import { findThread, readerMembership } from "../domain/conversations"
import type { Document, EntityId, Issue, Thread } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getProject,
  getPublishedDocuments,
  getPublishedEvidence,
  getPublishedForCustomer,
  getPublishedIssues,
  getStageName,
  getWorkTypeName,
} from "../mock/selectors"
import { useSession } from "../session/SessionProvider"
```

Inside the `CustomerUpdate` function, after `const project = ...` line, add:

```ts
  const [openDocument, setOpenDocument] = useState<Document>()
  const publishedIssues = project ? getPublishedIssues(state, project.id) : []
  const publishedDocuments = project ? getPublishedDocuments(state, project.id) : []
  const stageName = project?.currentStageId ? getStageName(state, project.currentStageId) : undefined

  const issueStatusWord = (status: Issue["status"]) =>
    status === "resolved" || status === "closed" ? "Fixed" : "Being looked into"
```

In the header `Text type="secondary"` line (currently showing `{latest ? ... : "Published updates..."}`), add the stage as a `Flex` line right below the existing `<Text type="secondary">` block (inside the same `Flex vertical gap="small"`, after that `<Text>`):

```tsx
          {stageName && (
            <Text>
              Current stage: <Text strong>{stageName}</Text>
            </Text>
          )}
```

After the existing "Latest photos from site" `Card` (right before the closing `</>` of the `{latest ? (<>...</>)` block), add two new `Card`s:

```tsx
            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Issues
                </Title>
              }
            >
              {publishedIssues.length ? (
                <List
                  dataSource={publishedIssues}
                  renderItem={(issue) => (
                    <List.Item>
                      <Flex vertical gap={2} className="w-full">
                        <Flex align="center" justify="space-between" gap="small">
                          <Text strong>{issue.title}</Text>
                          <Tag color={issueStatusWord(issue.status) === "Fixed" ? "success" : "warning"}>
                            {issueStatusWord(issue.status)}
                          </Tag>
                        </Flex>
                        <Text type="secondary" className="text-[12px]!">
                          {(issue.status === "resolved" || issue.status === "closed"
                            ? issue.resolvedAt ?? issue.createdAt
                            : issue.createdAt
                          ).slice(0, 10)}
                        </Text>
                      </Flex>
                    </List.Item>
                  )}
                />
              ) : (
                <Paragraph className="m-0!" type="secondary">
                  No issues have been shared for this project yet.
                </Paragraph>
              )}
            </Card>

            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Documents
                </Title>
              }
            >
              {publishedDocuments.length ? (
                <List
                  dataSource={publishedDocuments}
                  renderItem={(document) => (
                    <List.Item>
                      <Button type="link" className="p-0! h-auto!" icon={<FileTextOutlined />} onClick={() => setOpenDocument(document)}>
                        {document.title}
                      </Button>
                      <Text type="secondary" className="text-[12px]!">{document.createdAt.slice(0, 10)}</Text>
                    </List.Item>
                  )}
                />
              ) : (
                <Paragraph className="m-0!" type="secondary">
                  No documents have been shared for this project yet.
                </Paragraph>
              )}
            </Card>
```

Right before the closing `</Flex>` of the outer `Flex vertical gap="large" className="company-form-content"` (after the "Message your project team" card, still inside the same parent `Flex`), add:

```tsx
        <DocumentViewerModal document={openDocument} onClose={() => setOpenDocument(undefined)} />
```

(Note: `Paragraph` is already imported/destructured at the top of the file via `const { Paragraph, Text, Title } = Typography` — no change needed there.)

- [ ] **Step 3: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

Browser check, in two parts (issues default to private, so this task's own walkthrough publishes one first rather than relying on another task's runtime state — the mock data is in-memory only and resets on reload):

1. Business sign-in for Arjun (`localStorage.setItem("houzeify:session", JSON.stringify({accountType:"business",personId:"person-arjun",organizationId:"org-buildright"}))`): open `#issue-detail?project_id=project-sharma&issue_id=issue-3` and toggle "Share with homeowner" on (built in Task 6).
2. Homeowner demo sign-in (`localStorage.setItem("houzeify:session", JSON.stringify({accountType:"homeowner",personId:"person-demo-homeowner"}))`): open `#customer-daily-update?project_id=project-sharma`. Confirm: "Current stage" shows under the project name; an Issues card shows `issue-3` ("Material wastage above 8% threshold") as "Being looked into"; a Documents card shows "Municipal building approval"; clicking it opens the viewer with category "Approval", a date, and a working "Open document" link; "Construction contract" (private) does NOT appear.

- [ ] **Step 4: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/components/documents/DocumentViewerModal.tsx src/screens/CustomerDailyUpdateScreen.tsx
git commit -m "feat: homeowner My Project home shows current stage, shared issues and documents"
```

---

### Task 8: Homeowner side menu rename, full walkthrough, spec status

**Files:**
- Modify: `src/screens/HomeDashboardScreen.tsx`
- Modify: `src/components/HomeownerMobileMenu.tsx`
- Modify: `docs/superpowers/specs/2026-09-29-phase-7-customer-transparency-design.md`

- [ ] **Step 1: Rename the desktop side-menu item**

In `src/screens/HomeDashboardScreen.tsx`, change the `navMain` entry:

```ts
    { id: 'site-update', icon: <IcoPlan />, label: 'Site update', dest: 'customer-daily-update' },
```

to:

```ts
    { id: 'site-update', icon: <IcoPlan />, label: 'My Project', dest: 'customer-daily-update' },
```

(`id` and `dest` stay unchanged — only the label changes, per the locked decision to repoint the existing entry, not add a new one.)

- [ ] **Step 2: Rename the phone drawer menu item**

In `src/components/HomeownerMobileMenu.tsx`, change:

```ts
  { id: 'site-update', label: 'Site update', go: (nav) => nav('customer-daily-update', { project_id: 'project-sharma' }) },
```

to:

```ts
  { id: 'site-update', label: 'My Project', go: (nav) => nav('customer-daily-update', { project_id: 'project-sharma' }) },
```

- [ ] **Step 3: Full checks**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: all PASS.

- [ ] **Step 4: Full browser walkthrough**

Using http://localhost:5174:

1. Sign in as Arjun (business — see Task 5's `localStorage` snippet). Open the homeowner-facing "My Project" preview via `DailyProgressReviewScreen`'s existing "preview as homeowner" link, or navigate directly.
2. Go to `#project-documents?project_id=project-sharma`. Upload a new document titled "Site photos release form", category Other. Confirm it lists as private.
3. Toggle it customer-visible.
4. Go to `#issue-detail?project_id=project-sharma&issue_id=issue-3` (private by default) — toggle "Share with homeowner" on, confirming the switch updates.
5. Sign out, sign in as homeowner (`localStorage.setItem("houzeify:session", JSON.stringify({accountType:"homeowner",personId:"person-demo-homeowner"}))`).
6. Click **My Project** in the side menu (desktop) — confirm the label changed from "Site update". On a narrow viewport, open the phone drawer and confirm the same label there.
7. On the "My Project" page, confirm: Current stage shows; the newly published document ("Site photos release form") appears and opens; the private "Construction contract" document does not appear; the shared issue appears with plain-language status; the timeline, photos and "Message your project team" sections render exactly as before this phase.

- [ ] **Step 5: Update spec status**

In `docs/superpowers/specs/2026-09-29-phase-7-customer-transparency-design.md`, change:

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
git add src/screens/HomeDashboardScreen.tsx src/components/HomeownerMobileMenu.tsx docs/superpowers/specs/2026-09-29-phase-7-customer-transparency-design.md
git commit -m "feat: rename homeowner Site update to My Project; Phase 7 spec implemented"
```
