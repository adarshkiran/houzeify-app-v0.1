# Phase 7 — Customer Transparency

**Date:** 2026-09-29
**Branch:** `feature/customer-transparency` (from `main`, after Phase 6C)
**Status:** Implemented
**Source:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` → Phase 7 (Customer Transparency)
**Follows:** 6A Conversations, 6B Voice → structured actions, 6C Call Log

## Goal

Give the homeowner one place to see how their project is going, in plain language, with staff in full control of what crosses over. Today's homeowner "Site update" page (`CustomerDailyUpdateScreen.tsx`) shows the date timeline, published photos, and a message card. Phase 7 turns that into the homeowner's project home: same three pieces, plus a plain-language Issues list and a Documents list, both populated only from what staff explicitly publish.

| Build | Scope |
|---|---|
| 6A–6C | Conversations, voice actions, call log |
| **7 (this)** | Homeowner "My Project" home: stage, timeline, photos, issues, documents, messages. Staff-side publish controls and a new Documents area. |
| Later | Real file storage, homeowner-side uploads, a live "Questions" tab beyond Messages |

## Decisions (locked, from brainstorming — do not revisit)

1. **One combined "My Project" home**, replacing today's Daily Update page — not additions bolted onto the existing page.
2. **Issue visibility is a staff-controlled toggle**: open and resolved issues both show, but only once a staff member marks that specific issue customer-visible. Not automatic, not severity-based.
3. **Documents get a real model** in this build: a simple record, shaped like `Evidence`, not skipped.
4. **Homeowner side menu**: rename "Site update" to "My Project" and point it at the new combined screen (replacing today's destination, not adding a second entry).

## 1. Data

### `Issue.customerVisibility` (new field)

```ts
export interface Issue {
  // ...existing fields unchanged...
  customerVisibility: "private" | "customer-visible"
}
```

Two states, not `Evidence`'s three — there is no "review-required" step for issues; a staff member either has shared it with the homeowner or hasn't. Defaults to `"private"` wherever an `Issue` is built (`reportIssue`, and any other issue-creating path in `constructionCommands.ts`).

### `Document` (new model)

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

Modeled directly on `Evidence` (`src/domain/models.ts`, the `Evidence` interface): same `customerVisibility` idea, same session-only `url` (an object URL from a picked file, per the existing mock upload approach — no real storage in this build). Unlike `Evidence`, a `Document` isn't attached to a task or daily-progress record; it belongs to the project as a whole.

`ConstructionDataState` gains `documents: Document[]`. `src/mock/seed.ts` seeds it as `[]` (or with a couple of example documents on `project-sharma`, at the plan's discretion, matching how other project-scoped seed arrays are populated).

## 2. Commands

All three follow the authorize-first, pure `(state, ctx) => { state, result }` shape used throughout `constructionCommands.ts`.

### `publishIssue(issueId, visible)`

```ts
interface PublishIssueInput { issueId: EntityId; visible: boolean }
```

1. Find the issue; missing → `PermissionError(Permissions.CUSTOMER_PUBLISH)` (matches `publishDailyProgress`'s pattern of not distinguishing "not found" from "not allowed" before authorization).
2. `authorizeProject(state, ctx, issue.projectId, [Permissions.CUSTOMER_PUBLISH], issue)` — the same permission Phase 5 already grants to project managers and supervisors (`src/domain/permissions.ts`), reused as-is, not reinvented.
3. Set `issue.customerVisibility` to `"customer-visible"` if `visible`, else `"private"`. No other field changes — publishing is independent of `status` (an issue can be shared while still open, or kept private after being resolved).
4. Idempotent: publishing an already-published issue (or hiding an already-private one) is a no-op state-wise but still returns the current issue.

No new error copy needed — there's no validation beyond authorization and existence.

### `uploadDocument(input)`

```ts
interface UploadDocumentInput {
  projectId: EntityId
  title: string
  category: Document["category"]
  url: string
}
```

1. `authorizeProject(state, ctx, input.projectId, [Permissions.EVIDENCE_CAPTURE], { projectId: input.projectId })` — reuses the same permission `addEvidence` already checks, since uploading a document is the same kind of act (staff attaching a file to the project) and Phase 7 doesn't introduce a new permission for it.
2. `title` must be non-empty after trimming — `ConflictError`, message: `"Give the document a title."`
3. Builds a `Document` with `id` from `ctx.ids.next("document")`, `uploadedByMembershipId` = caller's membership, `customerVisibility: "private"`, `createdAt` from `ctx.clock`.
4. Appends to `state.documents`.

### `publishDocument(documentId, visible)`

```ts
interface PublishDocumentInput { documentId: EntityId; visible: boolean }
```

Same shape as `publishIssue`: find-or-`PermissionError`, `authorizeProject(..., [Permissions.CUSTOMER_PUBLISH], document)`, set `customerVisibility`, idempotent.

## 3. Selectors

- `getPublishedIssues(state, projectId)` (`src/mock/selectors.ts`, alongside `getPublishedEvidence` / `getPublishedForCustomer`): issues where `projectId` matches and `customerVisibility === "customer-visible"`, sorted newest-first by `createdAt` (open issues and resolved issues both included — the homeowner sees both, per Decision 2).
- `getPublishedDocuments(state, projectId)`: documents where `projectId` matches and `customerVisibility === "customer-visible"`, sorted newest-first by `createdAt`.
- Existing `getPublishedForCustomer` (daily progress) and `getPublishedEvidence` are unchanged and reused by the new homeowner screen exactly as `CustomerDailyUpdateScreen.tsx` uses them today.

## 4. Screens

### Homeowner — "My Project" (replaces `CustomerDailyUpdateScreen.tsx`'s content)

Same file, same route (`customer-daily-update` stays the route name — only the side-menu label changes, per Decision 4's exact wording; renaming the route itself is unnecessary churn for a mock-data app with no persisted deep links to worry about). Sections, top to bottom:

1. **Header**: project name and location (as today), plus **Current Stage** — `getProject(state, projectId)?.currentStageId` resolved via the existing `getStageName(state, stageId)` selector (`src/mock/selectors.ts:36`) — and the existing overall progress % card.
2. **Yesterday / Today / Tomorrow**: `DayTimeline`, unchanged.
3. **Photos**: `EvidenceGrid` over `getPublishedEvidence`, unchanged.
4. **Issues** (new): a simple list from `getPublishedIssues`. Each row: `title`, a plain-language status word — **"Being looked into"** for `status` in `"open" | "in-progress"`, **"Fixed"** for `"resolved" | "closed"` — and the relevant date (`createdAt` for open, `resolvedAt ?? createdAt` for resolved). No severity, no assignee, no internal notes, no evidence thumbnails. Empty state: `"No issues have been shared for this project yet."`
5. **Documents** (new): a simple list from `getPublishedDocuments`. Each row: `title`, `category` (capitalized), `createdAt` date. Opens the same viewer pattern `EvidenceGrid`/`EvidenceViewer` already use for photos — since a `Document` isn't an `Evidence`, this is a small dedicated `DocumentViewer` (or a `DocumentGrid` that opens a lightweight `Modal` reusing `EvidenceViewer`'s file-preview `Media` logic for the download/open-in-new-tab case) rather than a literal reuse of `EvidenceViewer`, because `Document` has no `type`/`thumbnailUrl` fields to drive `Media`'s photo/video/audio branching — documents in this build are always the generic "Open document" link case. Empty state: `"No documents have been shared for this project yet."`
6. **Message your project team**: unchanged.

### Company — Documents (new project-menu page)

`companyNav.tsx`'s `projectNav()` already lists a `documents` key (line 98) with no `to`, rendering disabled with a "Soon" tag — Phase 7 activates it: add `to: { screen: "project-documents", params: p }`. New screen `ProjectDocumentsScreen.tsx`, styled like the other project-menu screens (`CompanyLayout` wrapper, same pattern as `DailyProgressReviewScreen.tsx` etc.):

- List of the project's documents (all, not just published — staff need to see private ones too), each row showing title, category, uploaded-by, date, and a **customer-visible** toggle (Switch), visible/enabled only to `CUSTOMER_PUBLISH` holders — calls `publishDocument`.
- **Upload document** button opens a small modal: title, category (select), file picker → object URL (same pattern as evidence capture) → calls `uploadDocument`. Visible to anyone with `EVIDENCE_CAPTURE` (same audience as evidence capture today).

The workspace-level `documents` entry in `COMPANY_NAV` (line 81, no `to`) stays a disabled "Soon" item — that's a different, cross-project documents area and is out of scope here; only the project-scoped one is built.

### Company — Issue detail: "Share with homeowner"

`src/screens/IssueDetailScreen.tsx`, next to the existing status Tag and transition buttons (around the status-transition block near line 116), add a toggle: **"Share with homeowner"**, visible only to `CUSTOMER_PUBLISH` holders, calling `publishIssue`. Independent of the resolve/close controls (`move(next)`) — a staff member can share an open issue, or choose not to share a resolved one.

### Homeowner side menu — rename & repoint

- `src/screens/HomeDashboardScreen.tsx`: the `navMain` entry `{ id: 'site-update', ..., label: 'Site update', dest: 'customer-daily-update' }` → label becomes `'My Project'`. `dest` unchanged (same route).
- `src/components/HomeownerMobileMenu.tsx`: the matching `MAIN` entry's `label: 'Site update'` → `'My Project'`. `go` unchanged.
- No change to `DailyProgressReviewScreen.tsx`'s company-side link (`onClick={() => onNavigate("customer-daily-update", ...)}`), which previews the homeowner page from the company side — it keeps working against the same route.

## 5. Rules

- Nothing customer-visible without an explicit staff action: `Issue.customerVisibility` and `Document.customerVisibility` both default to `"private"`; only `publishIssue`/`publishDocument`, gated on `CUSTOMER_PUBLISH`, flip them.
- A homeowner can never read an issue's internal fields (severity, assignee, internal notes) or an unpublished document — the homeowner screen only ever calls the `getPublished*` selectors, never `state.issues`/`state.documents` directly.
- `CUSTOMER_PUBLISH` is reused unchanged from Phase 5 — no new permission is introduced.
- Publishing is independent per record: an issue's or document's visibility doesn't cascade from or to anything else (unlike `publishDailyProgress`, which publishes a whole update's chosen evidence at once — issues and documents are published one at a time, since they're not part of a daily-update review cycle).

## 6. Testing

### Domain tests (Vitest, written first)

- `publishIssue`: succeeds for a `CUSTOMER_PUBLISH` holder (both directions: private→visible, visible→private); refused for a caller without the permission (`PermissionError`); refused for a missing issue.
- `uploadDocument`: succeeds for an `EVIDENCE_CAPTURE` holder, defaults to `"private"`; refused for a caller without the permission; refused for an empty/whitespace title (`ConflictError`, exact copy).
- `publishDocument`: same shape as `publishIssue`'s tests.
- Selectors: `getPublishedIssues` / `getPublishedDocuments` only return records for the requested project with `customerVisibility === "customer-visible"`; a private record from the same project is excluded; a published record from a different project is excluded.

### Browser walkthrough

- Company: open a project, go to the new Documents page, upload a document, confirm it's listed as private, toggle it customer-visible.
- Company: open an issue, toggle "Share with homeowner" on.
- Homeowner: open "My Project" (via the renamed side-menu item), confirm Current Stage shows, the published document and the shared issue both appear with plain-language status, and an unpublished document/issue from the same project does not appear.
- Confirm the existing pieces (timeline, photos, messaging) still render exactly as before.

### Out of scope

Real file storage/upload persistence, homeowner-side document upload, issue photos in the homeowner view, a separate "Questions" tab (Messages already covers this), severity or status detail beyond "Being looked into" / "Fixed", the workspace-level (non-project) Documents nav item, any change to `publishDailyProgress` or evidence's existing three-state visibility.

## Acceptance

```text
Staff uploads a document → stays private → staff toggles it customer-visible
→ it appears on the homeowner's "My Project" page under Documents, with a working viewer
Staff opens an issue → toggles "Share with homeowner" → it appears under Issues
  as "Being looked into" (open) or "Fixed" (resolved), no internal detail
Anything not explicitly published never appears on the homeowner side
The homeowner's side menu says "My Project" instead of "Site update" and leads to one
  combined page: stage, timeline, photos, issues, documents, messages
```

Existing checks still pass: `pnpm run typecheck`, `pnpm run test`, `pnpm run build`.
