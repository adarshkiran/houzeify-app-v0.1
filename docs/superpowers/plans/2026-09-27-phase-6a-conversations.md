# Phase 6A — Contextual Conversations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Threads attached to project / unit / task / issue, a Homeowner thread per project and allowed direct messages, with text + voice messages and unread counts.

**Architecture:** Pure visibility rules and helpers in `src/domain/conversations.ts`; pure commands in `src/domain/conversationCommands.ts` (same `(state, ctx) => { state, result }` shape as `constructionCommands.ts`); read helpers in `src/mock/conversationSelectors.ts`; one shared `ThreadPanel` UI used by company, worker and homeowner screens.

**Tech Stack:** React 19, TypeScript 5.7, Ant Design 6, Tailwind v4, Vite 8, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-phase-6a-conversations-design.md`

## Global Constraints

- After every task: `pnpm run typecheck`, `pnpm run test`, `pnpm run build` pass.
- Never run `pnpm run format` (oxfmt 0.2.0 breaks TypeScript types). No semicolons, double quotes in `src/domain`, `src/mock`, `src/components`.
- Strings with an apostrophe use double quotes.
- React components are default exports.
- Git: prefix with `export PATH="/opt/homebrew/bin:$PATH" &&` (git-lfs hooks). Stage only files you changed — never `git add -A` at the repo root (`.claude/` and `Houzeify_Master_Plan_v0_2_FINAL.md` must stay untracked). Commit trailer `Co-Authored-By: <your model> <noreply@anthropic.com>`. Do not push.
- Never kill processes by pattern (`pkill -f …`, `killall`). If a command hangs, stop only that command.
- Dev server: `http://localhost:5174` (already running from this folder).
- Error copy (exact):
  - `"Write a message or record a voice note."`
  - `"Messages can be up to 2,000 characters."`
  - `"You can't message this person directly. Use the task or project conversation."`
- Thread audience: `"homeowner"` only for subject `"homeowner"`; every other subject is `"internal"`.
- Messages show author name and role, never phone numbers.

## File Map

| File | Responsibility |
|---|---|
| `src/domain/models.ts` | `Thread`, `Message`, `MessageVoice`, `ThreadRead`, `ThreadSubject`; state arrays |
| `src/mock/seed.ts` | Demo conversations on Sharma Residence |
| `src/domain/conversations.ts` | `findThread`, `readerMembership`, `canReadThread`, `canMessageDirectly`, `unreadCount` |
| `src/domain/conversationCommands.ts` | `postMessage`, `openDirectThread`, `markThreadRead` |
| `src/mock/conversationSelectors.ts` | `getViewerThreads`, `getThreadMessages`, `getUnreadTotal`, `threadTitle` |
| `src/mock/ConstructionDataProvider.tsx` | Wire the three commands |
| `src/components/speechRecognition.ts` | Shared browser speech-recognition types + `getSpeechRecognition` |
| `src/components/VoiceTextArea.tsx` | Import from `speechRecognition.ts` |
| `src/components/VoiceNoteRecorder.tsx` | Optional live transcript + duration |
| `src/components/conversations/ThreadPanel.tsx` | Messages + composer for one thread (or a not-yet-created one) |
| `src/components/conversations/ConversationList.tsx` | Selectable thread rows with unread badges |
| `src/screens/ProjectMessagesScreen.tsx` | Company project Messages page |
| `src/domain/navigation.ts`, `src/App.tsx`, `src/components/company/companyNav.tsx`, `src/components/company/CompanyLayout.tsx` | Routes, menu item, unread badge |
| `src/screens/TaskDetailScreen.tsx`, `src/screens/IssueDetailScreen.tsx`, `src/screens/ProjectTeamScreen.tsx` | Discussion cards, Message button |
| `src/screens/WorkerMessagesScreen.tsx`, `src/screens/WorkerTodayScreen.tsx`, `src/screens/WorkerTaskScreen.tsx` | Worker messages |
| `src/screens/CustomerDailyUpdateScreen.tsx` | Homeowner thread card |
| `src/index.css` | Chat styles |

---

### Task 1: Data model and demo conversations

**Files:**
- Modify: `src/domain/models.ts` (before `ConstructionDataState`; add three arrays to it)
- Modify: `src/mock/seed.ts` (new arrays + export)
- Test: `src/domain/conversationSeed.test.ts` (new)

**Interfaces:**
- Produces:
  ```ts
  export type ThreadSubject = "project" | "unit" | "task" | "issue" | "homeowner" | "direct"
  export interface Thread { id; projectId; subject: ThreadSubject; targetId?; audience: "internal" | "homeowner"; participantMembershipIds?: EntityId[]; createdAt: ISODateTime; lastMessageAt?: ISODateTime }
  export interface MessageVoice { url: string; durationSec?: number; transcript?: string }
  export interface Message { id; threadId; authorMembershipId; body?: string; voice?: MessageVoice; createdAt: ISODateTime }
  export interface ThreadRead { threadId; membershipId; lastReadAt: ISODateTime }
  // ConstructionDataState gains: threads: Thread[]; messages: Message[]; threadReads: ThreadRead[]
  ```

- [ ] **Step 1: Failing test** — `src/domain/conversationSeed.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"

describe("seed conversations", () => {
  it("has the four Sharma threads with the right audiences", () => {
    const byId = Object.fromEntries(seed.threads.map((t) => [t.id, t]))
    expect(byId["thread-sharma-project"]).toMatchObject({ subject: "project", audience: "internal" })
    expect(byId["thread-sharma-task-4"]).toMatchObject({ subject: "task", targetId: "task-4", audience: "internal" })
    expect(byId["thread-sharma-homeowner"]).toMatchObject({ subject: "homeowner", audience: "homeowner" })
    expect(byId["thread-sharma-direct-arjun-ravi"]).toMatchObject({
      subject: "direct",
      audience: "internal",
      participantMembershipIds: ["membership-manager-1", "membership-worker-ravi-sharma"],
    })
  })

  it("only has messages in known threads, by members of that project", () => {
    for (const message of seed.messages) {
      const thread = seed.threads.find((t) => t.id === message.threadId)
      expect(thread, message.id).toBeDefined()
      const author = seed.memberships.find((m) => m.id === message.authorMembershipId)
      expect(author?.projectId, message.id).toBe(thread!.projectId)
      expect(Boolean(message.body) || Boolean(message.voice), message.id).toBe(true)
    }
  })

  it("keeps lastMessageAt equal to each thread's newest message", () => {
    for (const thread of seed.threads) {
      const newest = seed.messages
        .filter((m) => m.threadId === thread.id)
        .map((m) => m.createdAt)
        .sort()
        .at(-1)
      expect(thread.lastMessageAt, thread.id).toBe(newest)
    }
  })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/domain/conversationSeed.test.ts` → FAIL (`seed.threads` undefined).

- [ ] **Step 3: Types** — in `src/domain/models.ts`, above `export interface ConstructionDataState`:

```ts
/** What a conversation is attached to. */
export type ThreadSubject = "project" | "unit" | "task" | "issue" | "homeowner" | "direct"

/** A conversation attached to a piece of work, the project's homeowner channel, or two people. */
export interface Thread {
  id: EntityId
  projectId: EntityId
  subject: ThreadSubject
  /** Unit, task or issue id for those subjects; absent otherwise. */
  targetId?: EntityId
  /** "homeowner" only for the homeowner subject. */
  audience: "internal" | "homeowner"
  /** Direct threads only: exactly two membership ids. */
  participantMembershipIds?: EntityId[]
  createdAt: ISODateTime
  lastMessageAt?: ISODateTime
}

export interface MessageVoice {
  url: string
  durationSec?: number
  transcript?: string
}

export interface Message {
  id: EntityId
  threadId: EntityId
  authorMembershipId: EntityId
  body?: string
  voice?: MessageVoice
  createdAt: ISODateTime
}

/** When a member last read a thread; newer messages by others are unread. */
export interface ThreadRead {
  threadId: EntityId
  membershipId: EntityId
  lastReadAt: ISODateTime
}
```

and add to `ConstructionDataState`:

```ts
  threads: Thread[]
  messages: Message[]
  threadReads: ThreadRead[]
```

- [ ] **Step 4: Seed** — in `src/mock/seed.ts` add (after the `issues` array definition) and include `threads, messages, threadReads,` in `seedConstructionData` (after `issues,`). Import the three types.

```ts
// Demo conversations on Sharma Residence. Some messages are left unread:
// Arjun 1 (project chat), Ravi 2 (task-4, direct), homeowner 1.
const threads: Thread[] = [
  {
    id: "thread-sharma-project",
    projectId: "project-sharma",
    subject: "project",
    audience: "internal",
    createdAt: "2026-09-25T09:00:00+05:30",
    lastMessageAt: "2026-09-27T07:50:00+05:30",
  },
  {
    id: "thread-sharma-task-4",
    projectId: "project-sharma",
    subject: "task",
    targetId: "task-4",
    audience: "internal",
    createdAt: "2026-09-26T17:30:00+05:30",
    lastMessageAt: "2026-09-26T17:45:00+05:30",
  },
  {
    id: "thread-sharma-homeowner",
    projectId: "project-sharma",
    subject: "homeowner",
    audience: "homeowner",
    createdAt: "2026-09-26T19:00:00+05:30",
    lastMessageAt: "2026-09-26T19:30:00+05:30",
  },
  {
    id: "thread-sharma-direct-arjun-ravi",
    projectId: "project-sharma",
    subject: "direct",
    audience: "internal",
    participantMembershipIds: ["membership-manager-1", "membership-worker-ravi-sharma"],
    createdAt: "2026-09-27T08:30:00+05:30",
    lastMessageAt: "2026-09-27T08:30:00+05:30",
  },
]

const messages: Message[] = [
  { id: "message-1", threadId: "thread-sharma-project", authorMembershipId: "membership-manager-1", body: "Morning all — concrete for the Grid A columns arrives at 10.", createdAt: "2026-09-25T09:00:00+05:30" },
  { id: "message-2", threadId: "thread-sharma-project", authorMembershipId: "membership-worker-ravi-sharma", body: "Noted. Curing team is ready.", createdAt: "2026-09-25T09:20:00+05:30" },
  { id: "message-3", threadId: "thread-sharma-project", authorMembershipId: "membership-manager-1", body: "Inspection went well. Backfilling starts Monday.", createdAt: "2026-09-26T18:05:00+05:30" },
  { id: "message-4", threadId: "thread-sharma-project", authorMembershipId: "membership-worker-ravi-sharma", body: "Pump is booked for 7 am Monday.", createdAt: "2026-09-27T07:50:00+05:30" },
  {
    id: "message-5",
    threadId: "thread-sharma-task-4",
    authorMembershipId: "membership-worker-ravi-sharma",
    voice: {
      url: "/mock-evidence/ravi-curing-voice.webm",
      durationSec: 18,
      transcript: "Footings are covered with wet hessian. I will keep them wet till Friday.",
    },
    createdAt: "2026-09-26T17:30:00+05:30",
  },
  { id: "message-6", threadId: "thread-sharma-task-4", authorMembershipId: "membership-manager-1", body: "Good. Add a photo with today's update.", createdAt: "2026-09-26T17:45:00+05:30" },
  { id: "message-7", threadId: "thread-sharma-homeowner", authorMembershipId: "membership-homeowner-sharma", body: "When will the ground floor slab be poured?", createdAt: "2026-09-26T19:00:00+05:30" },
  { id: "message-8", threadId: "thread-sharma-homeowner", authorMembershipId: "membership-manager-1", body: "Around 10 October, after the columns cure. We'll share photos as it happens.", createdAt: "2026-09-26T19:30:00+05:30" },
  { id: "message-9", threadId: "thread-sharma-direct-arjun-ravi", authorMembershipId: "membership-manager-1", body: "Ravi, can you come in at 8 tomorrow for the pour?", createdAt: "2026-09-27T08:30:00+05:30" },
]

const threadReads: ThreadRead[] = [
  { threadId: "thread-sharma-project", membershipId: "membership-manager-1", lastReadAt: "2026-09-26T18:05:00+05:30" },
  { threadId: "thread-sharma-project", membershipId: "membership-worker-ravi-sharma", lastReadAt: "2026-09-27T07:50:00+05:30" },
  { threadId: "thread-sharma-task-4", membershipId: "membership-manager-1", lastReadAt: "2026-09-26T17:45:00+05:30" },
  { threadId: "thread-sharma-task-4", membershipId: "membership-worker-ravi-sharma", lastReadAt: "2026-09-26T17:30:00+05:30" },
  { threadId: "thread-sharma-homeowner", membershipId: "membership-manager-1", lastReadAt: "2026-09-26T19:30:00+05:30" },
  { threadId: "thread-sharma-homeowner", membershipId: "membership-homeowner-sharma", lastReadAt: "2026-09-26T19:00:00+05:30" },
  { threadId: "thread-sharma-direct-arjun-ravi", membershipId: "membership-manager-1", lastReadAt: "2026-09-27T08:30:00+05:30" },
]
```

- [ ] **Step 5: Run** — `pnpm vitest run src/domain/conversationSeed.test.ts` → PASS; `pnpm run typecheck && pnpm run test && pnpm run build` → clean.

- [ ] **Step 6: Commit** — `git add src/domain/models.ts src/mock/seed.ts src/domain/conversationSeed.test.ts && git commit -m "feat: conversation data model and demo threads"` (+ trailer).

---

### Task 2: Visibility rules and unread counts

**Files:**
- Create: `src/domain/conversations.ts`
- Test: `src/domain/conversations.test.ts`

**Interfaces:**
- Consumes: Task 1 types; `scopeCovers`, `Session` from `./session`; `Permissions` from `./permissions`.
- Produces:
  ```ts
  export function findThread(state, projectId: EntityId, subject: ThreadSubject, targetId?: EntityId): Thread | undefined
  export function readerMembership(state, session: Session | null, thread: Thread): ProjectMembership | undefined
  export function canReadThread(state, session: Session | null, thread: Thread): boolean
  export function canMessageDirectly(a: ProjectRole, b: ProjectRole): boolean
  export function unreadCount(state, thread: Thread, membershipId: EntityId): number
  ```

- [ ] **Step 1: Failing tests** — `src/domain/conversations.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import {
  canMessageDirectly,
  canReadThread,
  findThread,
  readerMembership,
  unreadCount,
} from "./conversations"
import type { Thread } from "./models"
import type { Session } from "./session"

const arjun: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const ravi: Session = { accountType: "worker", personId: "person-ravi", organizationId: "org-buildright" }
const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }
const thread = (id: string) => seed.threads.find((t) => t.id === id)!
const draft = (partial: Partial<Thread>): Thread => ({
  id: "draft",
  projectId: "project-sharma",
  subject: "project",
  audience: "internal",
  createdAt: "2026-09-27T00:00:00+05:30",
  ...partial,
})

describe("canReadThread", () => {
  it("lets the manager read every Sharma thread", () => {
    for (const t of seed.threads) expect(canReadThread(seed, arjun, t), t.id).toBe(true)
  })

  it("never lets a worker read the Homeowner thread", () => {
    expect(canReadThread(seed, ravi, thread("thread-sharma-homeowner"))).toBe(false)
  })

  it("lets a worker read the project chat, their task thread and their DM", () => {
    expect(canReadThread(seed, ravi, thread("thread-sharma-project"))).toBe(true)
    expect(canReadThread(seed, ravi, thread("thread-sharma-task-4"))).toBe(true)
    expect(canReadThread(seed, ravi, thread("thread-sharma-direct-arjun-ravi"))).toBe(true)
  })

  it("hides threads outside a scoped worker's trade or unit", () => {
    // Ravi is scoped to Main House + civil; task-9 is electrical, issue-3 is whole-project.
    expect(canReadThread(seed, ravi, draft({ subject: "task", targetId: "task-9" }))).toBe(false)
    expect(canReadThread(seed, ravi, draft({ subject: "issue", targetId: "issue-3" }))).toBe(false)
  })

  it("lets the homeowner read only the Homeowner thread", () => {
    expect(canReadThread(seed, homeowner, thread("thread-sharma-homeowner"))).toBe(true)
    expect(canReadThread(seed, homeowner, thread("thread-sharma-project"))).toBe(false)
    expect(canReadThread(seed, homeowner, thread("thread-sharma-task-4"))).toBe(false)
    expect(canReadThread(seed, homeowner, thread("thread-sharma-direct-arjun-ravi"))).toBe(false)
  })

  it("denies people who aren't on the project, and signed-out sessions", () => {
    const other = draft({ projectId: "project-reddy" })
    expect(canReadThread(seed, ravi, other)).toBe(false)
    expect(canReadThread(seed, null, thread("thread-sharma-project"))).toBe(false)
  })

  it("returns the membership a person reads (and posts) with", () => {
    expect(readerMembership(seed, ravi, thread("thread-sharma-task-4"))?.id).toBe("membership-worker-ravi-sharma")
  })
})

describe("canMessageDirectly", () => {
  it("allows the build plan's pairs in either order", () => {
    expect(canMessageDirectly("worker", "supervisor")).toBe(true)
    expect(canMessageDirectly("project-manager", "worker")).toBe(true)
    expect(canMessageDirectly("contractor", "developer-admin")).toBe(true)
    expect(canMessageDirectly("supervisor", "project-manager")).toBe(true)
  })

  it("refuses other pairs", () => {
    expect(canMessageDirectly("worker", "worker")).toBe(false)
    expect(canMessageDirectly("worker", "homeowner")).toBe(false)
    expect(canMessageDirectly("homeowner", "project-manager")).toBe(false)
    expect(canMessageDirectly("consultant", "worker")).toBe(false)
  })
})

describe("unreadCount and findThread", () => {
  it("counts newer messages by others", () => {
    expect(unreadCount(seed, thread("thread-sharma-project"), "membership-manager-1")).toBe(1)
    expect(unreadCount(seed, thread("thread-sharma-task-4"), "membership-worker-ravi-sharma")).toBe(1)
    expect(unreadCount(seed, thread("thread-sharma-direct-arjun-ravi"), "membership-worker-ravi-sharma")).toBe(1)
    expect(unreadCount(seed, thread("thread-sharma-homeowner"), "membership-homeowner-sharma")).toBe(1)
    expect(unreadCount(seed, thread("thread-sharma-direct-arjun-ravi"), "membership-manager-1")).toBe(0)
  })

  it("finds a thread by subject and target", () => {
    expect(findThread(seed, "project-sharma", "task", "task-4")?.id).toBe("thread-sharma-task-4")
    expect(findThread(seed, "project-sharma", "homeowner")?.id).toBe("thread-sharma-homeowner")
    expect(findThread(seed, "project-sharma", "task", "task-9")).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/domain/conversations.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** — `src/domain/conversations.ts`

```ts
import type {
  ConstructionDataState,
  EntityId,
  ProjectMembership,
  ProjectRole,
  Thread,
  ThreadSubject,
} from "./models"
import { Permissions } from "./permissions"
import { scopeCovers, type ScopeTarget, type Session } from "./session"

/**
 * Conversation visibility (Phase 6A). A thread is readable when the person
 * holds an active membership on its project that passes the subject's rule;
 * the same membership is who they post as. Pure, like the read-scope rules.
 */

/** Company staff who may read the homeowner channel regardless of permissions. */
const HOMEOWNER_CHANNEL_ROLES: readonly ProjectRole[] = ["project-manager", "developer-admin"]

/** Direct-message pairs from the build plan (§21); order doesn't matter. */
const DIRECT_PAIRS: ReadonlyArray<readonly [ProjectRole, ProjectRole]> = [
  ["worker", "supervisor"],
  ["worker", "contractor"],
  ["worker", "project-manager"],
  ["contractor", "supervisor"],
  ["contractor", "project-manager"],
  ["contractor", "developer-admin"],
  ["project-manager", "supervisor"],
  ["project-manager", "developer-admin"],
  ["supervisor", "developer-admin"],
  ["project-manager", "project-manager"],
  ["supervisor", "supervisor"],
  ["developer-admin", "developer-admin"],
]

export function canMessageDirectly(a: ProjectRole, b: ProjectRole): boolean {
  return DIRECT_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

export function findThread(
  state: ConstructionDataState,
  projectId: EntityId,
  subject: ThreadSubject,
  targetId?: EntityId,
): Thread | undefined {
  return state.threads.find(
    (thread) =>
      thread.projectId === projectId &&
      thread.subject === subject &&
      (thread.targetId ?? undefined) === (targetId ?? undefined),
  )
}

/** The unit / task / issue a context thread is about, as a scope target. */
function threadTarget(state: ConstructionDataState, thread: Thread): ScopeTarget | undefined {
  if (thread.subject === "unit") {
    const unit = state.projectUnits.find((u) => u.id === thread.targetId && u.projectId === thread.projectId)
    return unit ? { projectUnitId: unit.id } : undefined
  }
  if (thread.subject === "task") {
    return state.tasks.find((t) => t.id === thread.targetId && t.projectId === thread.projectId)
  }
  if (thread.subject === "issue") {
    return state.issues.find((i) => i.id === thread.targetId && i.projectId === thread.projectId)
  }
  return undefined
}

function membershipCanRead(
  state: ConstructionDataState,
  membership: ProjectMembership,
  thread: Thread,
): boolean {
  if (thread.subject === "homeowner") {
    return (
      membership.role === "homeowner" ||
      HOMEOWNER_CHANNEL_ROLES.includes(membership.role) ||
      membership.permissions.includes(Permissions.CUSTOMER_PUBLISH)
    )
  }
  if (thread.subject === "direct") {
    return thread.participantMembershipIds?.includes(membership.id) ?? false
  }
  if (membership.role === "homeowner") return false
  if (!membership.permissions.includes(Permissions.PROJECT_READ)) return false
  if (thread.subject === "project") return true
  const target = threadTarget(state, thread)
  return target ? scopeCovers(membership.scope, target, state.projectUnits) : false
}

/** The membership a person reads and posts in this thread with, if any. */
export function readerMembership(
  state: ConstructionDataState,
  session: Session | null,
  thread: Thread,
): ProjectMembership | undefined {
  if (!session) return undefined
  return state.memberships.find(
    (membership) =>
      membership.projectId === thread.projectId &&
      membership.status === "active" &&
      membership.principalType === "person" &&
      membership.principalId === session.personId &&
      membershipCanRead(state, membership, thread),
  )
}

export function canReadThread(
  state: ConstructionDataState,
  session: Session | null,
  thread: Thread,
): boolean {
  return readerMembership(state, session, thread) !== undefined
}

/** Messages by others newer than this member's last read. */
export function unreadCount(
  state: ConstructionDataState,
  thread: Thread,
  membershipId: EntityId,
): number {
  const lastReadAt = state.threadReads.find(
    (read) => read.threadId === thread.id && read.membershipId === membershipId,
  )?.lastReadAt
  return state.messages.filter(
    (message) =>
      message.threadId === thread.id &&
      message.authorMembershipId !== membershipId &&
      // Seed times use +05:30 and commands write UTC, so compare instants.
      (!lastReadAt || Date.parse(message.createdAt) > Date.parse(lastReadAt)),
  ).length
}
```

- [ ] **Step 4: Run** — `pnpm vitest run src/domain/conversations.test.ts` → PASS; then `pnpm run typecheck && pnpm run test`.

- [ ] **Step 5: Commit** — `git add src/domain/conversations.ts src/domain/conversations.test.ts && git commit -m "feat: conversation visibility rules and unread counts"` (+ trailer).

---

### Task 3: Conversation commands

**Files:**
- Create: `src/domain/conversationCommands.ts`
- Modify: `src/mock/ConstructionDataProvider.tsx` (context type + wiring)
- Test: `src/domain/conversationCommands.test.ts`

**Interfaces:**
- Consumes: Task 2 helpers; `Command`, `CommandContext` from `./ports`; `ConflictError`, `IntegrityError` from `./errors`; `PermissionError` from `./session`.
- Produces:
  ```ts
  export type PostMessageTarget =
    | { threadId: EntityId }
    | { projectId: EntityId; subject: Exclude<ThreadSubject, "direct">; targetId?: EntityId }
  export type PostMessageInput = PostMessageTarget & { body?: string; voice?: MessageVoice }
  export const postMessage: (input: PostMessageInput) => Command<Message>
  export const openDirectThread: (projectId: EntityId, otherMembershipId: EntityId) => Command<Thread>
  export const markThreadRead: (threadId: EntityId) => Command<void>
  // provider: postMessage(input) => Message; openDirectThread(projectId, otherMembershipId) => Thread; markThreadRead(threadId) => void
  ```

- [ ] **Step 1: Failing tests** — `src/domain/conversationCommands.test.ts`

```ts
import { beforeEach, describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { markThreadRead, openDirectThread, postMessage } from "./conversationCommands"
import { unreadCount } from "./conversations"
import { ConflictError } from "./errors"
import type { ConstructionDataState } from "./models"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import { PermissionError, type Session } from "./session"

const arjun: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const ravi: Session = { accountType: "worker", personId: "person-ravi", organizationId: "org-buildright" }
const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }
const clock: Clock = { now: () => new Date("2026-09-27T10:00:00.000Z") }
let ids: IdGenerator
beforeEach(() => {
  let n = 0
  ids = { next: (prefix) => `${prefix}-new-${++n}`, short: () => `s${++n}` }
})
const as = (actor: Session): CommandContext => ({ actor, clock, ids })
const run = <T,>(state: ConstructionDataState, actor: Session, command: (s: ConstructionDataState, c: CommandContext) => { state: ConstructionDataState; result: T }) =>
  command(state, as(actor))

describe("postMessage", () => {
  it("adds a message to an existing thread and marks it read for the author", () => {
    const { state, result } = run(seed, ravi, postMessage({ threadId: "thread-sharma-task-4", body: "  Photo added.  " }))
    expect(result).toMatchObject({ threadId: "thread-sharma-task-4", authorMembershipId: "membership-worker-ravi-sharma", body: "Photo added." })
    expect(state.threads.find((t) => t.id === "thread-sharma-task-4")!.lastMessageAt).toBe("2026-09-27T10:00:00.000Z")
    expect(unreadCount(state, state.threads.find((t) => t.id === "thread-sharma-task-4")!, "membership-worker-ravi-sharma")).toBe(0)
    expect(unreadCount(state, state.threads.find((t) => t.id === "thread-sharma-task-4")!, "membership-manager-1")).toBe(1)
  })

  it("creates a task thread on the first message, and reuses it after", () => {
    const first = run(seed, arjun, postMessage({ projectId: "project-sharma", subject: "task", targetId: "task-13", body: "Start Monday." }))
    const created = first.state.threads.filter((t) => t.subject === "task" && t.targetId === "task-13")
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ audience: "internal", projectId: "project-sharma" })
    const second = run(first.state, arjun, postMessage({ projectId: "project-sharma", subject: "task", targetId: "task-13", body: "Pump booked." }))
    expect(second.state.threads.filter((t) => t.subject === "task" && t.targetId === "task-13")).toHaveLength(1)
    expect(second.state.messages.filter((m) => m.threadId === created[0].id)).toHaveLength(2)
  })

  it("accepts a voice message with a transcript", () => {
    const { result } = run(seed, ravi, postMessage({ threadId: "thread-sharma-project", voice: { url: "blob:v", durationSec: 6, transcript: " On site. " } }))
    expect(result.voice).toEqual({ url: "blob:v", durationSec: 6, transcript: "On site." })
    expect(result.body).toBeUndefined()
  })

  it("refuses empty and too-long messages", () => {
    expect(() => run(seed, ravi, postMessage({ threadId: "thread-sharma-project", body: "   " }))).toThrow("Write a message or record a voice note.")
    expect(() => run(seed, ravi, postMessage({ threadId: "thread-sharma-project", body: "x".repeat(2001) }))).toThrow("Messages can be up to 2,000 characters.")
  })

  it("refuses threads the author can't read", () => {
    expect(() => run(seed, ravi, postMessage({ threadId: "thread-sharma-homeowner", body: "Hi" }))).toThrow(PermissionError)
    expect(() => run(seed, ravi, postMessage({ projectId: "project-sharma", subject: "task", targetId: "task-9", body: "Hi" }))).toThrow(PermissionError)
    expect(() => run(seed, homeowner, postMessage({ threadId: "thread-sharma-project", body: "Hi" }))).toThrow(PermissionError)
  })

  it("lets the homeowner post in the Homeowner thread", () => {
    const { result } = run(seed, homeowner, postMessage({ projectId: "project-sharma", subject: "homeowner", body: "Thanks!" }))
    expect(result).toMatchObject({ threadId: "thread-sharma-homeowner", authorMembershipId: "membership-homeowner-sharma" })
  })

  it("rejects a target that isn't in the project", () => {
    expect(() => run(seed, arjun, postMessage({ projectId: "project-sharma", subject: "task", targetId: "task-6", body: "Hi" }))).toThrow()
  })
})

describe("openDirectThread", () => {
  it("returns the existing DM from either side", () => {
    expect(run(seed, arjun, openDirectThread("project-sharma", "membership-worker-ravi-sharma")).result.id).toBe("thread-sharma-direct-arjun-ravi")
    expect(run(seed, ravi, openDirectThread("project-sharma", "membership-manager-1")).result.id).toBe("thread-sharma-direct-arjun-ravi")
  })

  it("refuses pairs the plan doesn't allow", () => {
    expect(() => run(seed, arjun, openDirectThread("project-sharma", "membership-homeowner-sharma")))
      .toThrow("You can't message this person directly. Use the task or project conversation.")
    expect(() => run(seed, arjun, openDirectThread("project-sharma", "membership-manager-1"))).toThrow(ConflictError)
  })

  it("creates a DM for an allowed new pair", () => {
    const withoutDm = { ...seed, threads: seed.threads.filter((t) => t.subject !== "direct") }
    const { state, result } = run(withoutDm, ravi, openDirectThread("project-sharma", "membership-manager-1"))
    expect(result).toMatchObject({ subject: "direct", audience: "internal" })
    expect([...result.participantMembershipIds!].sort()).toEqual(["membership-manager-1", "membership-worker-ravi-sharma"])
    expect(state.threads).toHaveLength(withoutDm.threads.length + 1)
  })
})

describe("markThreadRead", () => {
  it("clears the caller's unread count", () => {
    const { state } = run(seed, ravi, markThreadRead("thread-sharma-direct-arjun-ravi"))
    expect(unreadCount(state, state.threads.find((t) => t.id === "thread-sharma-direct-arjun-ravi")!, "membership-worker-ravi-sharma")).toBe(0)
  })

  it("refuses a thread the caller can't read", () => {
    expect(() => run(seed, ravi, markThreadRead("thread-sharma-homeowner"))).toThrow(PermissionError)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/domain/conversationCommands.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `src/domain/conversationCommands.ts`

```ts
import { canMessageDirectly, findThread, readerMembership } from "./conversations"
import { ConflictError, IntegrityError } from "./errors"
import type {
  ConstructionDataState,
  EntityId,
  Message,
  MessageVoice,
  Thread,
  ThreadRead,
  ThreadSubject,
} from "./models"
import { Permissions } from "./permissions"
import type { Command, CommandContext } from "./ports"
import { PermissionError } from "./session"

/**
 * Conversation commands (Phase 6A). Same shape as constructionCommands: pure,
 * authorize first (via the thread's read rule), then validate, then build the
 * next state.
 */

export type PostMessageTarget =
  | { threadId: EntityId }
  | { projectId: EntityId; subject: Exclude<ThreadSubject, "direct">; targetId?: EntityId }

export type PostMessageInput = PostMessageTarget & { body?: string; voice?: MessageVoice }

const MAX_BODY = 2000
const iso = (ctx: CommandContext) => ctx.clock.now().toISOString()

function withRead(
  reads: readonly ThreadRead[],
  threadId: EntityId,
  membershipId: EntityId,
  lastReadAt: string,
): ThreadRead[] {
  const rest = reads.filter((read) => !(read.threadId === threadId && read.membershipId === membershipId))
  return [...rest, { threadId, membershipId, lastReadAt }]
}

function assertTargetInProject(state: ConstructionDataState, thread: Thread) {
  if (thread.subject === "project" || thread.subject === "homeowner") return
  const exists =
    thread.subject === "unit"
      ? state.projectUnits.some((u) => u.id === thread.targetId && u.projectId === thread.projectId)
      : thread.subject === "task"
        ? state.tasks.some((t) => t.id === thread.targetId && t.projectId === thread.projectId)
        : state.issues.some((i) => i.id === thread.targetId && i.projectId === thread.projectId)
  if (!exists) {
    throw new IntegrityError(`${thread.subject} ${thread.targetId} is not in project ${thread.projectId}`)
  }
}

export const postMessage =
  (input: PostMessageInput): Command<Message> =>
  (state, ctx) => {
    const existing =
      "threadId" in input
        ? state.threads.find((thread) => thread.id === input.threadId)
        : findThread(state, input.projectId, input.subject, input.targetId)
    if (!existing && "threadId" in input) throw new PermissionError(Permissions.PROJECT_READ)

    const timestamp = iso(ctx)
    const thread: Thread =
      existing ??
      (() => {
        const target = input as Extract<PostMessageTarget, { projectId: EntityId }>
        return {
          id: ctx.ids.next("thread"),
          projectId: target.projectId,
          subject: target.subject,
          targetId: target.targetId,
          audience: target.subject === "homeowner" ? "homeowner" : "internal",
          createdAt: timestamp,
        }
      })()

    const author = readerMembership(state, ctx.actor, thread)
    if (!author) throw new PermissionError(Permissions.PROJECT_READ, thread.projectId)
    if (!existing) assertTargetInProject(state, thread)

    const body = input.body?.trim() || undefined
    if (!body && !input.voice) throw new ConflictError("Write a message or record a voice note.")
    if (body && body.length > MAX_BODY) throw new ConflictError("Messages can be up to 2,000 characters.")

    const message: Message = {
      id: ctx.ids.next("message"),
      threadId: thread.id,
      authorMembershipId: author.id,
      body,
      voice: input.voice
        ? { ...input.voice, transcript: input.voice.transcript?.trim() || undefined }
        : undefined,
      createdAt: timestamp,
    }
    const updatedThread: Thread = { ...thread, lastMessageAt: timestamp }
    return {
      state: {
        ...state,
        threads: existing
          ? state.threads.map((item) => (item.id === thread.id ? updatedThread : item))
          : [...state.threads, updatedThread],
        messages: [...state.messages, message],
        threadReads: withRead(state.threadReads, thread.id, author.id, timestamp),
      },
      result: message,
    }
  }

export const openDirectThread =
  (projectId: EntityId, otherMembershipId: EntityId): Command<Thread> =>
  (state, ctx) => {
    const mine = state.memberships.filter(
      (m) =>
        m.projectId === projectId &&
        m.status === "active" &&
        m.principalType === "person" &&
        m.principalId === ctx.actor?.personId,
    )
    if (!ctx.actor || !mine.length) throw new PermissionError(Permissions.PROJECT_READ, projectId)
    const other = state.memberships.find(
      (m) => m.id === otherMembershipId && m.projectId === projectId && m.status === "active",
    )
    if (!other) throw new IntegrityError(`Membership ${otherMembershipId} is not active on ${projectId}`)
    const me = mine.find((m) => m.id !== other.id && canMessageDirectly(m.role, other.role))
    if (!me) {
      throw new ConflictError("You can't message this person directly. Use the task or project conversation.")
    }

    const pair = [me.id, other.id]
    const existing = state.threads.find(
      (t) =>
        t.subject === "direct" &&
        t.projectId === projectId &&
        t.participantMembershipIds?.length === 2 &&
        pair.every((id) => t.participantMembershipIds!.includes(id)),
    )
    if (existing) return { state, result: existing }

    const thread: Thread = {
      id: ctx.ids.next("thread"),
      projectId,
      subject: "direct",
      audience: "internal",
      participantMembershipIds: pair,
      createdAt: iso(ctx),
    }
    return { state: { ...state, threads: [...state.threads, thread] }, result: thread }
  }

export const markThreadRead =
  (threadId: EntityId): Command<void> =>
  (state, ctx) => {
    const thread = state.threads.find((item) => item.id === threadId)
    if (!thread) throw new PermissionError(Permissions.PROJECT_READ)
    const reader = readerMembership(state, ctx.actor, thread)
    if (!reader) throw new PermissionError(Permissions.PROJECT_READ, thread.projectId)
    return {
      state: { ...state, threadReads: withRead(state.threadReads, thread.id, reader.id, iso(ctx)) },
      result: undefined,
    }
  }
```

- [ ] **Step 4: Provider** — in `src/mock/ConstructionDataProvider.tsx`: `import * as conversationCommands from "../domain/conversationCommands"` and `import type { PostMessageInput } from "../domain/conversationCommands"`; add to the context interface

```ts
  postMessage: (input: PostMessageInput) => Message
  openDirectThread: (projectId: EntityId, otherMembershipId: EntityId) => Thread
  markThreadRead: (threadId: EntityId) => void
```

and to the value object

```ts
      postMessage: (input) => run(conversationCommands.postMessage(input)),
      openDirectThread: (projectId, otherId) => run(conversationCommands.openDirectThread(projectId, otherId)),
      markThreadRead: (threadId) => run(conversationCommands.markThreadRead(threadId)),
```

(add `Message`, `Thread` to the models type import).

- [ ] **Step 5: Run** — `pnpm vitest run src/domain/conversationCommands.test.ts` → PASS; `pnpm run typecheck && pnpm run test && pnpm run build`.

- [ ] **Step 6: Commit** — `git add src/domain/conversationCommands.ts src/domain/conversationCommands.test.ts src/mock/ConstructionDataProvider.tsx && git commit -m "feat: post messages, open direct threads, mark threads read"` (+ trailer).

---

### Task 4: Conversation selectors

**Files:**
- Create: `src/mock/conversationSelectors.ts`
- Test: `src/mock/conversationSelectors.test.ts`

**Interfaces:**
- Consumes: Task 2 (`readerMembership`, `unreadCount`); `getMembershipName` from `./selectors`.
- Produces:
  ```ts
  export interface ViewerThread { thread: Thread; reader: ProjectMembership; unread: number; lastMessage?: Message }
  export function getViewerThreads(state, session: Session | null, projectId?: EntityId): ViewerThread[]
  export function getThreadMessages(state, threadId: EntityId): Message[]
  export function getUnreadTotal(state, session: Session | null, projectId?: EntityId): number
  export function threadTitle(state, thread: Thread, viewerMembershipId?: EntityId): string
  export function roleLabel(role: ProjectRole): string
  ```

- [ ] **Step 1: Failing tests** — `src/mock/conversationSelectors.test.ts`

```ts
import { describe, expect, it } from "vitest"
import type { Session } from "../domain/session"
import {
  getThreadMessages,
  getUnreadTotal,
  getViewerThreads,
  roleLabel,
  threadTitle,
} from "./conversationSelectors"
import { seedConstructionData as seed } from "./seed"

const arjun: Session = { accountType: "business", personId: "person-arjun", organizationId: "org-buildright" }
const ravi: Session = { accountType: "worker", personId: "person-ravi", organizationId: "org-buildright" }
const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }

describe("conversation selectors", () => {
  it("orders threads: project, homeowner, context threads, then direct", () => {
    expect(getViewerThreads(seed, arjun, "project-sharma").map((v) => v.thread.id)).toEqual([
      "thread-sharma-project",
      "thread-sharma-homeowner",
      "thread-sharma-task-4",
      "thread-sharma-direct-arjun-ravi",
    ])
  })

  it("shows each viewer only what they can read, with unread counts", () => {
    const forRavi = getViewerThreads(seed, ravi)
    expect(forRavi.map((v) => [v.thread.id, v.unread])).toEqual([
      ["thread-sharma-project", 0],
      ["thread-sharma-task-4", 1],
      ["thread-sharma-direct-arjun-ravi", 1],
    ])
    expect(getViewerThreads(seed, homeowner).map((v) => v.thread.id)).toEqual(["thread-sharma-homeowner"])
  })

  it("totals unread per viewer", () => {
    expect(getUnreadTotal(seed, arjun, "project-sharma")).toBe(1)
    expect(getUnreadTotal(seed, ravi)).toBe(2)
    expect(getUnreadTotal(seed, homeowner)).toBe(1)
    expect(getUnreadTotal(seed, arjun, "project-reddy")).toBe(0)
  })

  it("lists messages oldest first and names threads", () => {
    expect(getThreadMessages(seed, "thread-sharma-project").map((m) => m.id)).toEqual(["message-1", "message-2", "message-3", "message-4"])
    const byId = (id: string) => seed.threads.find((t) => t.id === id)!
    expect(threadTitle(seed, byId("thread-sharma-project"))).toBe("Project chat")
    expect(threadTitle(seed, byId("thread-sharma-homeowner"))).toBe("Homeowner")
    expect(threadTitle(seed, byId("thread-sharma-task-4"))).toBe("Complete footing curing log")
    expect(threadTitle(seed, byId("thread-sharma-direct-arjun-ravi"), "membership-manager-1")).toBe("Ravi Naik")
    expect(threadTitle(seed, byId("thread-sharma-direct-arjun-ravi"), "membership-worker-ravi-sharma")).toBe("Arjun Mehta")
    expect(roleLabel("project-manager")).toBe("Project manager")
  })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/mock/conversationSelectors.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `src/mock/conversationSelectors.ts`

```ts
import { readerMembership, unreadCount } from "../domain/conversations"
import type {
  ConstructionDataState,
  EntityId,
  Message,
  ProjectMembership,
  ProjectRole,
  Thread,
} from "../domain/models"
import type { Session } from "../domain/session"
import { getMembershipName } from "./selectors"

export interface ViewerThread {
  thread: Thread
  reader: ProjectMembership
  unread: number
  lastMessage?: Message
}

const SUBJECT_ORDER: Record<Thread["subject"], number> = {
  project: 0,
  homeowner: 1,
  unit: 2,
  task: 2,
  issue: 2,
  direct: 3,
}

const byTime = (left?: string, right?: string) =>
  (right ? Date.parse(right) : 0) - (left ? Date.parse(left) : 0)

export function getThreadMessages(state: ConstructionDataState, threadId: EntityId): Message[] {
  return state.messages
    .filter((message) => message.threadId === threadId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}

/** Threads this person can read (optionally one project), in list order. */
export function getViewerThreads(
  state: ConstructionDataState,
  session: Session | null,
  projectId?: EntityId,
): ViewerThread[] {
  return state.threads
    .filter((thread) => !projectId || thread.projectId === projectId)
    .flatMap((thread) => {
      const reader = readerMembership(state, session, thread)
      if (!reader) return []
      const messages = getThreadMessages(state, thread.id)
      return [{ thread, reader, unread: unreadCount(state, thread, reader.id), lastMessage: messages.at(-1) }]
    })
    .sort(
      (a, b) =>
        SUBJECT_ORDER[a.thread.subject] - SUBJECT_ORDER[b.thread.subject] ||
        byTime(a.thread.lastMessageAt, b.thread.lastMessageAt),
    )
}

export function getUnreadTotal(
  state: ConstructionDataState,
  session: Session | null,
  projectId?: EntityId,
): number {
  return getViewerThreads(state, session, projectId).reduce((sum, item) => sum + item.unread, 0)
}

const ROLE_LABELS: Record<ProjectRole, string> = {
  homeowner: "Homeowner",
  "developer-admin": "Admin",
  "project-manager": "Project manager",
  contractor: "Contractor",
  subcontractor: "Subcontractor",
  supervisor: "Supervisor",
  worker: "Worker",
  consultant: "Consultant",
}

export function roleLabel(role: ProjectRole): string {
  return ROLE_LABELS[role]
}

/** Human title for a thread; direct threads are named after the other person. */
export function threadTitle(
  state: ConstructionDataState,
  thread: Thread,
  viewerMembershipId?: EntityId,
): string {
  switch (thread.subject) {
    case "project":
      return "Project chat"
    case "homeowner":
      return "Homeowner"
    case "task":
      return state.tasks.find((t) => t.id === thread.targetId)?.title ?? "Task"
    case "issue":
      return state.issues.find((i) => i.id === thread.targetId)?.title ?? "Issue"
    case "unit":
      return state.projectUnits.find((u) => u.id === thread.targetId)?.name ?? "Location"
    case "direct": {
      const otherId = thread.participantMembershipIds?.find((id) => id !== viewerMembershipId)
      return getMembershipName(state, otherId) ?? "Direct message"
    }
  }
}
```

- [ ] **Step 4: Run** — `pnpm vitest run src/mock/conversationSelectors.test.ts` → PASS; full checks.

- [ ] **Step 5: Commit** — `git add src/mock/conversationSelectors.ts src/mock/conversationSelectors.test.ts && git commit -m "feat: conversation selectors (viewer threads, unread totals, titles)"` (+ trailer).

---

### Task 5: Voice transcript + shared chat components

**Files:**
- Create: `src/components/speechRecognition.ts`
- Modify: `src/components/VoiceTextArea.tsx` (import shared types/helper)
- Modify: `src/components/VoiceNoteRecorder.tsx` (optional live transcript + duration)
- Create: `src/components/conversations/ThreadPanel.tsx`
- Create: `src/components/conversations/ConversationList.tsx`
- Modify: `src/index.css` (append chat styles)

**Interfaces:**
- Consumes: provider `postMessage`, `markThreadRead`; selectors `getThreadMessages`, `roleLabel`, `threadTitle`, `getMembershipName`; domain `findThread`, `readerMembership`, `unreadCount`; `useSession()`.
- Produces:
  ```tsx
  // speechRecognition.ts
  export type SpeechRecognitionLike; export type SpeechRecognitionConstructor
  export function getSpeechRecognition(): SpeechRecognitionConstructor | null
  // VoiceNoteRecorder new optional props
  onRecorded: (url: string, durationSec: number) => void
  onTranscript?: (text: string) => void
  label?: string
  // ThreadPanel (default export)
  { projectId: EntityId; subject: Exclude<ThreadSubject, "direct">; targetId?: EntityId } | { threadId: EntityId }
    & { emptyText?: string; compact?: boolean }
  // ConversationList (default export)
  { items: ViewerThread[]; selectedId?: EntityId; onSelect: (threadId: EntityId) => void }
  ```

- [ ] **Step 1: Extract speech recognition** — create `src/components/speechRecognition.ts` by MOVING the `SpeechRecognitionResultLike`, `SpeechRecognitionEventLike`, `SpeechRecognitionLike`, `SpeechRecognitionConstructor` types and `getSpeechRecognition()` out of `VoiceTextArea.tsx` unchanged, exporting each. In `VoiceTextArea.tsx` replace them with `import { getSpeechRecognition, type SpeechRecognitionLike } from "./speechRecognition"`. Behaviour unchanged.

- [ ] **Step 2: Recorder transcript + duration** — in `VoiceNoteRecorder.tsx`:
  - Props become `{ onRecorded: (url: string, durationSec: number) => void; onTranscript?: (text: string) => void; maxSeconds?: number; label?: string }` (existing callers pass a one-argument callback — still type-correct).
  - Add refs: `const recognitionRef = useRef<SpeechRecognitionLike | null>(null)`, `const transcriptRef = useRef("")`, `const onTranscriptRef = useRef(onTranscript); onTranscriptRef.current = onTranscript`, `const elapsedRef = useRef(0)` (keep it in sync: `useEffect(() => { elapsedRef.current = elapsed }, [elapsed])`).
  - In `start()`, after `recorder.start()`: when `onTranscriptRef.current` and `getSpeechRecognition()` are available, create a recognition with `continuous = true`, `interimResults = false`, `lang = "en-IN"`, set `transcriptRef.current = ""`, and `onresult` appends each final `result[0].transcript` (joined with a space) to `transcriptRef.current`; call `recognition.start()` inside `try { … } catch { /* recognition unavailable: voice-only */ }`.
  - In `recorder.onstop`: stop recognition (`recognitionRef.current?.stop(); recognitionRef.current = null`), then `onRecordedRef.current(url, Math.max(1, elapsedRef.current))` and, if `onTranscriptRef.current`, call it with `transcriptRef.current.trim()`.
  - In the unmount cleanup also `recognitionRef.current?.abort()`.
  - Button label: `label ?? "Voice note"`.

- [ ] **Step 3: `src/components/conversations/ThreadPanel.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react"
import { CloseOutlined, SendOutlined } from "@ant-design/icons"
import { Button, Empty, Flex, Input, Tag, Typography } from "antd"
import { findThread, readerMembership, unreadCount } from "../../domain/conversations"
import type { EntityId, MessageVoice, Thread, ThreadSubject } from "../../domain/models"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { getThreadMessages, roleLabel } from "../../mock/conversationSelectors"
import { getMembershipName } from "../../mock/selectors"
import { useSession } from "../../session/SessionProvider"
import { useCommand } from "../../session/useCommand"
import VoiceNoteRecorder from "../VoiceNoteRecorder"
import VoiceTextArea from "../VoiceTextArea"

const { Text } = Typography

type PanelTarget =
  | { threadId: EntityId }
  | { projectId: EntityId; subject: Exclude<ThreadSubject, "direct">; targetId?: EntityId }

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

/**
 * One conversation: messages oldest → newest and a composer. For a context
 * (task, issue, …) that has no thread yet, it shows an empty state and the
 * first message creates the thread. Opening it marks the thread read.
 */
export default function ThreadPanel(props: PanelTarget & { emptyText?: string; compact?: boolean }) {
  const { state, postMessage, markThreadRead } = useConstructionData()
  const { session } = useSession()
  const run = useCommand()
  const [body, setBody] = useState("")
  const [voice, setVoice] = useState<MessageVoice>()

  const thread: Thread | undefined =
    "threadId" in props
      ? state.threads.find((t) => t.id === props.threadId)
      : findThread(state, props.projectId, props.subject, props.targetId)
  const probe: Thread | undefined =
    thread ??
    ("threadId" in props
      ? undefined
      : {
          id: "draft",
          projectId: props.projectId,
          subject: props.subject,
          targetId: props.targetId,
          audience: props.subject === "homeowner" ? "homeowner" : "internal",
          createdAt: "",
        })
  const me = probe ? readerMembership(state, session, probe) : undefined
  const messages = useMemo(() => (thread ? getThreadMessages(state, thread.id) : []), [state, thread])
  const unread = thread && me ? unreadCount(state, thread, me.id) : 0

  useEffect(() => {
    if (thread && me && unread > 0) run(() => markThreadRead(thread.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, me?.id, unread])

  if (!probe || !me) return <Text type="secondary">You can't see this conversation.</Text>

  const send = () => {
    const target: PanelTarget = thread
      ? { threadId: thread.id }
      : { projectId: probe.projectId, subject: probe.subject as Exclude<ThreadSubject, "direct">, targetId: probe.targetId }
    const outcome = run(() => postMessage({ ...target, body, voice }))
    if (outcome.ok) {
      setBody("")
      setVoice(undefined)
    }
  }

  return (
    <Flex vertical gap="middle" className={`thread-panel${props.compact ? " is-compact" : ""}`}>
      <Flex vertical gap="small" className="thread-messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={props.emptyText ?? "No messages yet. Start the conversation."} />
        ) : (
          messages.map((message) => {
            const author = state.memberships.find((m) => m.id === message.authorMembershipId)
            const mine = message.authorMembershipId === me.id
            return (
              <Flex key={message.id} vertical className={`thread-message${mine ? " is-mine" : ""}`}>
                <Flex gap={6} align="baseline" wrap>
                  <Text strong className="text-[13px]!">{mine ? "You" : getMembershipName(state, message.authorMembershipId) ?? "Someone"}</Text>
                  {author && !mine && <Text type="secondary" className="text-[12px]!">{roleLabel(author.role)}</Text>}
                  <Text type="secondary" className="text-[12px]!">{timeLabel(message.createdAt)}</Text>
                </Flex>
                {message.voice && (
                  <Flex vertical gap={4}>
                    <audio src={message.voice.url} controls preload="none" className="thread-audio" />
                    {message.voice.transcript && <Text type="secondary" italic>“{message.voice.transcript}”</Text>}
                  </Flex>
                )}
                {message.body && <Text className="thread-body">{message.body}</Text>}
              </Flex>
            )
          })
        )}
      </Flex>

      <Flex vertical gap="small" className="thread-composer">
        {voice && (
          <Flex vertical gap={6} className="thread-voice-draft">
            <Flex align="center" justify="space-between" gap="small">
              <Tag className="m-0!">Voice message · {voice.durationSec ?? 0}s</Tag>
              <Button size="small" type="text" icon={<CloseOutlined />} aria-label="Remove voice message" onClick={() => setVoice(undefined)} />
            </Flex>
            <audio src={voice.url} controls className="thread-audio" />
            <Input.TextArea
              rows={2}
              value={voice.transcript ?? ""}
              onChange={(event) => setVoice({ ...voice, transcript: event.target.value })}
              placeholder="Transcript (optional) — correct it if needed"
              aria-label="Voice message transcript"
            />
          </Flex>
        )}
        <VoiceTextArea
          rows={2}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a message"
          aria-label="Message"
        />
        <Flex justify="space-between" align="center" gap="small" wrap>
          <VoiceNoteRecorder
            label="Record voice message"
            onRecorded={(url, durationSec) => setVoice((current) => ({ ...current, url, durationSec }))}
            onTranscript={(text) => setVoice((current) => (current ? { ...current, transcript: text || current.transcript } : current))}
          />
          <Button type="primary" icon={<SendOutlined />} disabled={!body.trim() && !voice} onClick={send}>
            Send
          </Button>
        </Flex>
      </Flex>
    </Flex>
  )
}
```

(Note on `onTranscript` ordering: the recorder calls `onRecorded` before `onTranscript`, so `voice` exists when the transcript arrives.)

- [ ] **Step 4: `src/components/conversations/ConversationList.tsx`**

```tsx
import { AudioOutlined } from "@ant-design/icons"
import { Badge, Empty, Flex, Typography } from "antd"
import type { EntityId } from "../../domain/models"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { threadTitle, type ViewerThread } from "../../mock/conversationSelectors"

const { Text } = Typography

const SUBJECT_LABEL: Record<string, string> = {
  project: "Everyone on the project",
  homeowner: "Homeowner and project team",
  task: "Task",
  issue: "Issue",
  unit: "Location",
  direct: "Direct message",
}

/** Selectable conversation rows with unread badges (list + detail layout). */
export default function ConversationList({
  items,
  selectedId,
  onSelect,
}: {
  items: ViewerThread[]
  selectedId?: EntityId
  onSelect: (threadId: EntityId) => void
}) {
  const { state } = useConstructionData()
  if (!items.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No conversations yet." />
  return (
    <Flex vertical gap={4} role="listbox" aria-label="Conversations">
      {items.map(({ thread, reader, unread, lastMessage }) => {
        const active = thread.id === selectedId
        const preview = lastMessage?.body ?? (lastMessage?.voice ? "Voice message" : "")
        return (
          <button
            key={thread.id}
            type="button"
            role="option"
            aria-selected={active}
            className={`progress-queue-item${active ? " is-active" : ""}`}
            onClick={() => onSelect(thread.id)}
          >
            <Flex align="center" justify="space-between" gap="small">
              <Text strong ellipsis>{threadTitle(state, thread, reader.id)}</Text>
              <Badge count={unread} size="small" />
            </Flex>
            <Text type="secondary" className="text-[12px]!">{SUBJECT_LABEL[thread.subject]}</Text>
            {preview && (
              <Text type="secondary" ellipsis>
                {lastMessage?.voice && !lastMessage.body && <AudioOutlined />} {preview}
              </Text>
            )}
          </button>
        )
      })}
    </Flex>
  )
}
```

(Reuses the Progress queue row styles `.progress-queue-item` already in `index.css`.)

- [ ] **Step 5: Styles** — append to `src/index.css`:

```css
/* Conversations: message list scrolls inside the panel; own messages tinted. */
.thread-messages {
  max-height: 420px;
  overflow-y: auto;
  padding-right: 4px;
}

.thread-panel.is-compact .thread-messages {
  max-height: 280px;
}

.thread-message {
  gap: 4px;
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--ant-color-fill-quaternary);
  align-self: flex-start;
}

.thread-message.is-mine {
  align-self: flex-end;
  background: var(--ant-color-primary-bg);
}

.thread-body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.thread-audio {
  width: 100%;
  max-width: 320px;
  height: 36px;
}

.thread-composer {
  padding-top: 12px;
  border-top: 1px solid var(--ant-color-border-secondary);
}

.thread-voice-draft {
  padding: 8px;
  border-radius: var(--ant-border-radius);
  background: var(--ant-color-fill-quaternary);
}
```

- [ ] **Step 6: Verify** — `pnpm run typecheck && pnpm run test && pnpm run build` (components are exercised in Tasks 6–9).

- [ ] **Step 7: Commit** — `git add src/components src/index.css && git commit -m "feat: thread panel, conversation list, live voice-message transcript"` (+ trailer).

---

### Task 6: Company Messages page

**Files:**
- Create: `src/screens/ProjectMessagesScreen.tsx`
- Modify: `src/domain/navigation.ts` (route + `thread_id` scoped param)
- Modify: `src/App.tsx` (lazy import + render)
- Modify: `src/components/company/companyNav.tsx` (`"messages"` key + item)
- Modify: `src/components/company/CompanyLayout.tsx` (unread badge on the menu item)

**Interfaces:**
- Consumes: `getViewerThreads`, `getUnreadTotal`, `threadTitle`, `roleLabel`; `ThreadPanel`, `ConversationList`.
- Produces: route `"project-messages"` (params `project_id`, optional `thread_id`).

- [ ] **Step 1: Route** — in `src/domain/navigation.ts` `routes`, after `issues`:

```ts
  "project-messages": {
    access: project(Permissions.PROJECT_READ),
    requires: ["project_id"],
  },
```

and add `"thread_id"` to `SCOPED_PARAMS`.

- [ ] **Step 2: Menu** — `companyNav.tsx`: add `| "messages"` to `ProjectNavKey`; import `MessageOutlined`; insert after the Issues item:

```tsx
    { key: "messages", label: "Messages", icon: <MessageOutlined />, to: { screen: "project-messages", params: p } },
```

- [ ] **Step 3: Badge** — `CompanyLayout.tsx`: import `getUnreadTotal` from `../../mock/conversationSelectors`; in the project branch replace `projectItems.map((item) => toMenuItem(item))` with

```tsx
        children: projectItems
          .map((item) =>
            toMenuItem(item, item.key === "messages" ? getUnreadTotal(state, session, nav.projectId) : undefined),
          )
          .filter(Boolean),
```

- [ ] **Step 4: Screen** — `src/screens/ProjectMessagesScreen.tsx`

```tsx
import { Card, Col, Flex, Row, Tag, Typography } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import ConversationList from "../components/conversations/ConversationList"
import ThreadPanel from "../components/conversations/ThreadPanel"
import type { EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getViewerThreads, threadTitle } from "../mock/conversationSelectors"
import { useSession } from "../session/SessionProvider"

const { Title } = Typography

function Messages({ onNavigate, projectId, threadId }: { onNavigate: Navigate; projectId: EntityId; threadId?: EntityId }) {
  const { state } = useConstructionData()
  const { session } = useSession()
  const items = getViewerThreads(state, session, projectId)
  const selected = items.find((item) => item.thread.id === threadId) ?? items[0]
  const select = (id: EntityId) => onNavigate("project-messages", { project_id: projectId, thread_id: id })

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "messages" }}
      onNavigate={onNavigate}
      description="Conversations about this project's work"
    >
      <Flex vertical gap="large" className="company-content">
        <Row gutter={[16, 16]} align="top">
          <Col xs={24} lg={8}>
            <Card
              title={<Title level={5} className="company-heading! m-0!">Conversations</Title>}
              classNames={{ body: "progress-queue-body" }}
            >
              <ConversationList items={items} selectedId={selected?.thread.id} onSelect={select} />
            </Card>
          </Col>
          <Col xs={24} lg={16}>
            {selected ? (
              <Card
                title={
                  <Title level={5} className="company-heading! m-0!">
                    {threadTitle(state, selected.thread, selected.reader.id)}
                  </Title>
                }
                extra={
                  selected.thread.audience === "homeowner"
                    ? <Tag color="purple">Homeowner can see this</Tag>
                    : <Tag>Internal</Tag>
                }
              >
                <ThreadPanel key={selected.thread.id} threadId={selected.thread.id} />
              </Card>
            ) : (
              // No conversations yet: the first message starts the project chat.
              <Card title={<Title level={5} className="company-heading! m-0!">Project chat</Title>}>
                <ThreadPanel projectId={projectId} subject="project" emptyText="Start the project conversation." />
              </Card>
            )}
          </Col>
        </Row>
      </Flex>
    </CompanyLayout>
  )
}

export default function ProjectMessagesScreen(props: { onNavigate: Navigate; projectId: EntityId; threadId?: EntityId }) {
  return (
    <CompanyThemeProvider>
      <Messages {...props} />
    </CompanyThemeProvider>
  )
}
```

- [ ] **Step 5: App** — `src/App.tsx`: `const ProjectMessagesScreen = lazy(() => import('./screens/ProjectMessagesScreen'))` and render, next to `issues`:

```tsx
      {screen === 'project-messages' && (
        <div style={{ ...slide }}>
          <Suspense fallback={null}>
            <ProjectMessagesScreen onNavigate={navigateTo} projectId={projectId} threadId={params.thread_id} />
          </Suspense>
        </div>
      )}
```

- [ ] **Step 6: Verify** — full checks; any navigation test that enumerates routes or menu items gets the new entry. Browser (controller will also check): `#onboarding-business` → Create workspace → `#project-messages?project_id=project-sharma` shows 4 conversations, the menu badge shows 1, opening Project chat clears it; typing a message and Send appends it.

- [ ] **Step 7: Commit** — `git add src/screens/ProjectMessagesScreen.tsx src/domain/navigation.ts src/App.tsx src/components/company && git commit -m "feat: project Messages page with unread badge"` (+ trailer).

---

### Task 7: Discussions on Task and Issue detail, Message on Project Team

**Files:**
- Modify: `src/screens/TaskDetailScreen.tsx` (left column, after "Progress history" card)
- Modify: `src/screens/IssueDetailScreen.tsx` (left column, after the "Evidence" card)
- Modify: `src/screens/ProjectTeamScreen.tsx` (table: actions column)

**Interfaces:**
- Consumes: `ThreadPanel`; `canMessageDirectly` (domain); provider `openDirectThread`.

- [ ] **Step 1: Task detail** — add after the Progress history card:

```tsx
              <Card title={<Title level={5} className="company-heading! m-0!">Discussion</Title>}>
                <ThreadPanel compact projectId={projectId} subject="task" targetId={task.id} emptyText="No messages about this task yet." />
              </Card>
```

(import `ThreadPanel from "../components/conversations/ThreadPanel"`).

- [ ] **Step 2: Issue detail** — same card with `subject="issue" targetId={issue.id} emptyText="No messages about this issue yet."`.

- [ ] **Step 3: Project Team** — in `ProjectTeam`, compute the viewer's membership and add a last column:

```tsx
  const { session } = useSession()
  const { openDirectThread } = useConstructionData() // merge into the existing destructure
  const myMemberships = state.memberships.filter(
    (m) => m.projectId === projectId && m.status === "active" && m.principalType === "person" && m.principalId === session?.personId,
  )
  const canDm = (other: ProjectMembership) =>
    other.status === "active" &&
    other.principalType === "person" &&
    myMemberships.some((m) => m.id !== other.id && canMessageDirectly(m.role, other.role))
  const message = (other: ProjectMembership) => {
    const outcome = run(() => openDirectThread(projectId, other.id))
    if (outcome.ok) onNavigate("project-messages", { project_id: projectId, thread_id: outcome.value.id })
  }
```

column:

```tsx
    {
      key: "message",
      title: "",
      width: 110,
      render: (_: unknown, member: ProjectMembership) =>
        canDm(member) ? (
          <Button size="small" icon={<MessageOutlined />} onClick={() => message(member)}>
            Message
          </Button>
        ) : null,
    },
```

(`useSession` from `../session/SessionProvider`, `canMessageDirectly` from `../domain/conversations`, `MessageOutlined` from icons; `run` and `useSession` may already exist — reuse. Hooks before any early return.)

- [ ] **Step 4: Verify** — full checks. Browser: Task detail task-4 shows the two task-4 messages; Project Team → Message on Ravi opens Messages on the Arjun ↔ Ravi thread; the homeowner row has no Message button.

- [ ] **Step 5: Commit** — `git add src/screens/TaskDetailScreen.tsx src/screens/IssueDetailScreen.tsx src/screens/ProjectTeamScreen.tsx && git commit -m "feat: task and issue discussions, direct message from project team"` (+ trailer).

---

### Task 8: Worker messages

**Files:**
- Create: `src/screens/WorkerMessagesScreen.tsx`
- Modify: `src/domain/navigation.ts` (route `worker-messages`)
- Modify: `src/App.tsx`
- Modify: `src/screens/WorkerTodayScreen.tsx` (header Messages button)
- Modify: `src/screens/WorkerTaskScreen.tsx` (Discussion section)

**Interfaces:**
- Consumes: `getViewerThreads`, `getUnreadTotal`, `threadTitle`; `ThreadPanel`, `ConversationList`; `WorkerShell`.
- Produces: route `"worker-messages"` (optional `thread_id`).

- [ ] **Step 1: Route** — `"worker-messages": { access: WORKER },` in `routes` (after `worker-submit`).

- [ ] **Step 2: Screen** — `src/screens/WorkerMessagesScreen.tsx`

```tsx
import { ArrowLeftOutlined } from "@ant-design/icons"
import { Button, Card, Flex, Typography } from "antd"
import ConversationList from "../components/conversations/ConversationList"
import ThreadPanel from "../components/conversations/ThreadPanel"
import WorkerShell from "../components/worker/WorkerShell"
import type { EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getViewerThreads, threadTitle } from "../mock/conversationSelectors"
import { useSession } from "../session/SessionProvider"

const { Text, Title } = Typography

export default function WorkerMessagesScreen({ onNavigate, threadId }: { onNavigate: Navigate; threadId?: EntityId }) {
  const { state } = useConstructionData()
  const { session } = useSession()
  const items = getViewerThreads(state, session)
  const open = items.find((item) => item.thread.id === threadId)

  return (
    <WorkerShell
      headerAction={
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => (open ? onNavigate("worker-messages") : onNavigate("worker-today"))}
        >
          {open ? "Messages" : "Today"}
        </Button>
      }
    >
      {open ? (
        <Flex vertical gap="small">
          <Title level={4} className="company-heading! m-0!">{threadTitle(state, open.thread, open.reader.id)}</Title>
          <Card size="small">
            <ThreadPanel key={open.thread.id} threadId={open.thread.id} />
          </Card>
        </Flex>
      ) : (
        <Flex vertical gap="small">
          <Title level={4} className="company-heading! m-0!">Messages</Title>
          <Text type="secondary">Your supervisor, your tasks and the project team.</Text>
          <Card size="small" classNames={{ body: "progress-queue-body" }}>
            <ConversationList items={items} onSelect={(id) => onNavigate("worker-messages", { thread_id: id })} />
          </Card>
        </Flex>
      )}
    </WorkerShell>
  )
}
```

- [ ] **Step 3: App** — lazy import + render `WorkerMessagesScreen` with `onNavigate={navigateTo} threadId={params.thread_id}` (wrapper `div` with `overflowY: 'auto'`, like `worker-today`).

- [ ] **Step 4: Worker Today header** — in `WorkerTodayScreen`'s default export, replace `headerAction` with:

```tsx
      headerAction={
        <Flex gap="small">
          <Badge count={unread} size="small">
            <Button icon={<MessageOutlined />} onClick={() => onNavigate("worker-messages")}>
              Messages
            </Button>
          </Badge>
          <Button icon={<LogoutOutlined />} onClick={() => onNavigate("welcome")}>
            Sign out
          </Button>
        </Flex>
      }
```

with `const { state } = useConstructionData(); const { session } = useSession(); const unread = getUnreadTotal(state, session)` at the top of that component (imports: `Badge`, `Flex`, `MessageOutlined`, `getUnreadTotal`, `useSession`, `useConstructionData` as needed).

- [ ] **Step 5: Worker task Discussion** — in `WorkerTaskScreen`, after the "My updates" card:

```tsx
      <Card size="small" title="Discussion">
        <ThreadPanel compact projectId={task.projectId} subject="task" targetId={task.id} emptyText="Ask your supervisor about this task." />
      </Card>
```

- [ ] **Step 6: Verify** — full checks. Browser: `#onboarding-worker` → Continue → header shows Messages with badge 2 → list shows Project chat, task thread (1), Arjun Mehta (1) — no Homeowner → open Arjun Mehta → badge drops.

- [ ] **Step 7: Commit** — `git add src/screens/WorkerMessagesScreen.tsx src/screens/WorkerTodayScreen.tsx src/screens/WorkerTaskScreen.tsx src/domain/navigation.ts src/App.tsx && git commit -m "feat: worker messages and task discussion"` (+ trailer).

---

### Task 9: Homeowner "Message your project team"

**Files:**
- Modify: `src/screens/CustomerDailyUpdateScreen.tsx`

**Interfaces:**
- Consumes: `ThreadPanel` with `subject="homeowner"`.

- [ ] **Step 1: Card** — after the photos card, when a project is known:

```tsx
            {project && (
              <Card title="Message your project team">
                <ThreadPanel compact projectId={project.id} subject="homeowner" emptyText="Ask the project team anything about your home." />
              </Card>
            )}
```

(The panel shows "You can't see this conversation." for anyone outside the audience — e.g. a worker opening this URL is already blocked by routing, but the panel stays safe.)

- [ ] **Step 2: Verify** — full checks. Browser: sign in as homeowner (`#onboarding-homeowner` flow, or set the session via the demo homeowner identity) → `#customer-daily-update?project_id=project-sharma` shows the two homeowner-thread messages, Arjun's reply unread cleared on open; a new message appears in Arjun's Messages → Homeowner with a badge.

- [ ] **Step 3: Commit** — `git add src/screens/CustomerDailyUpdateScreen.tsx && git commit -m "feat: homeowner can message the project team"` (+ trailer).

---

### Task 10: End-to-end check and spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-phase-6a-conversations-design.md` (Status → Implemented)

- [ ] **Step 1: Full checks** — `pnpm run typecheck && pnpm run test && pnpm run build`.
- [ ] **Step 2: Browser acceptance (fresh load, desktop then 375px)**
  1. Worker Ravi → Messages (badge 2) → task thread → reply "Photo added" → Arjun Mehta DM → reply by voice (record ~3 s; transcript appears in Chrome) → Send.
  2. Company Arjun → project menu Messages badge shows new unread → task thread shows Ravi's reply; DM shows the voice message with player → reply.
  3. Homeowner → Daily Update → "Message your project team" → send → Arjun sees it under Homeowner with badge; tag "Homeowner can see this".
  4. Ravi's Messages never lists Homeowner; Task detail and Issue detail Discussion cards work; Project Team Message button only on allowed rows.
  5. 375px: Messages page stacks list above chat, no horizontal scroll.
- [ ] **Step 3: Spec status** — `**Status:** Design approved — not yet implemented` → `**Status:** Implemented`.
- [ ] **Step 4: Commit** — `git add docs/superpowers/specs/2026-09-27-phase-6a-conversations-design.md && git commit -m "docs: mark Phase 6A implemented"` (+ trailer).
