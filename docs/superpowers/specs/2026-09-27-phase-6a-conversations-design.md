# Phase 6A — Contextual Conversations

**Date:** 2026-09-27  
**Branch:** `feature/communication-voice`  
**Status:** Implemented  
**Source:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` → Phase 6 (Communication & Voice), §21 Communication Security Model

## Goal

Construction communication attached to the work it is about — project, unit, task, issue, person — with text and voice messages and unread counts. No single unstructured inbox.

Phase 6 is split into three builds; this is the first:

| Build | Scope |
|---|---|
| **6A (this)** | Threads on project / unit / task / issue, a Homeowner thread per project, direct messages for allowed pairs, text + voice messages, unread counts |
| 6B (later) | Voice → transcript → draft task / progress / issue → user confirms → saved; voice instructions |
| 6C (later) | Calls: dialler link + call log now; real voice/video calls with the backend (build Phase 11) |

## Today

- Speech-to-text in form fields (`VoiceTextArea`), voice-note recording (`VoiceNoteRecorder`), text-to-speech "Listen" on the worker task screen.
- No messages, threads or chat anywhere in the data model.

## 1. Data and visibility

### New records (in `ConstructionDataState`)

```ts
type ThreadSubject = "project" | "unit" | "task" | "issue" | "homeowner" | "direct"

interface Thread {
  id: EntityId
  projectId: EntityId
  subject: ThreadSubject
  /** Unit, task or issue id for those subjects; absent otherwise. */
  targetId?: EntityId
  audience: "internal" | "homeowner"
  /** Direct threads only: exactly two membership ids. */
  participantMembershipIds?: EntityId[]
  createdAt: ISODateTime
  lastMessageAt?: ISODateTime
}

interface Message {
  id: EntityId
  threadId: EntityId
  authorMembershipId: EntityId
  body?: string
  voice?: { url: string; durationSec?: number; transcript?: string }
  createdAt: ISODateTime
}

interface ThreadRead {
  threadId: EntityId
  membershipId: EntityId
  lastReadAt: ISODateTime
}
```

State gains `threads: Thread[]`, `messages: Message[]`, `threadReads: ThreadRead[]`.

- `audience` is `"homeowner"` only for the `homeowner` subject; every other subject is `"internal"`.
- At most one thread per (projectId, subject, targetId); at most one direct thread per unordered membership pair.
- Unread count for a person = messages in the thread by someone else, newer than their `lastReadAt` (all of them if no marker).

### Who can read a thread — `canReadThread(state, session, thread)` (pure)

| Subject | Readable by |
|---|---|
| project | Any active member of the project except homeowner-role members |
| unit / task / issue | Anyone who can already read that unit / task / issue (existing `PROJECT_READ` + membership scope via `canAct`) — homeowner-role members excluded |
| homeowner | Homeowner-role members of the project, plus company staff on it: project managers, developer-admins and anyone holding `customer.publish`. Never workers, contractors, subcontractors, consultants |
| direct | Only its two participants |

- Anyone who can read a thread can post in it.
- Homeowners post only in their project's Homeowner thread.
- Messages show author name and role, never phone numbers.

### Allowed direct-message pairs — `canMessageDirectly(a, b)`

Both memberships active on the same project, and the role pair is one of:

- worker ↔ supervisor, contractor, project-manager
- contractor ↔ supervisor, project-manager, developer-admin
- company staff ↔ company staff (project-manager, supervisor, developer-admin)

Homeowners never use direct messages. Project managers count as the "supervisor" side (the seed has no supervisor role on its projects).

## 2. Where conversations appear

### Shared `ThreadPanel` component

- Messages oldest → newest: author name, role, time; voice messages show a player and transcript.
- Composer: text box with the existing mic dictation (`VoiceTextArea`), **Record voice message**, **Send**.
- Opening a panel marks the thread read.

### Company

- **Project menu → Messages** (between Issues and Project Team) with an unread badge. List + detail layout like the Progress page:
  - Left "Conversations" card, in order: Project chat, Homeowner, then unit / task / issue threads that have messages (newest first), then direct messages; each row shows an unread count.
  - Right: the `ThreadPanel`.
- **Task detail** and **Issue detail**: a **Discussion** card with that item's thread (created on first message).
- **Project Team**: a **Message** button on member rows the viewer may message directly; opens or starts the direct thread in Messages.

### Worker app

- **Worker Today**: a **Messages** button with an unread badge → phone-friendly list of their direct messages, threads on their tasks, and the project chat → `ThreadPanel`.
- **Worker task screen**: a **Discussion** section with the task's thread.

### Homeowner

- **Daily Update** page: a **"Message your project team"** card showing the project's Homeowner thread.

### Not in this build

Notifications / sounds, typing indicators, editing or deleting messages, attachments other than voice, search.

## 3. Voice, commands, rules, testing

### Voice messages

- Recorded with `VoiceNoteRecorder`.
- Where the browser supports speech recognition (Chrome, Edge), the transcript is captured live while recording and can be corrected before sending; otherwise the message is voice-only.
- Recordings are session-only blob URLs (no media storage yet), like existing evidence.

### Commands (pure, authorize first)

- `postMessage(input)` — input is either `{ threadId }` or `{ projectId, subject, targetId? }` for a thread's first message, plus `body?` and `voice?`. Creates the thread if missing (never a duplicate for the same subject/target), appends the message, updates `lastMessageAt`, and marks the thread read for the author.
- `openDirectThread(projectId, otherMembershipId)` — returns the existing direct thread for the pair or creates it; only for allowed pairs.
- `markThreadRead(threadId)` — sets the caller's `lastReadAt` to now.

### Errors (exact copy)

- `"Write a message or record a voice note."` — no text and no voice.
- `"Messages can be up to 2,000 characters."` — body longer than 2000 characters.
- `"You can't message this person directly. Use the task or project conversation."` — disallowed direct pair.
- Posting to or opening a thread the caller can't read → `PermissionError`.

### Seed data (Sharma Residence)

- Project chat: 4 messages (Arjun, Ravi).
- Task-4 thread: Ravi and Arjun, including one voice message with a transcript.
- Homeowner thread: demo homeowner and Arjun.
- Direct thread Arjun ↔ Ravi: 1 message.
- Some messages left unread for each person so badges show.

### Tests (Vitest, written first)

- `canReadThread` for each role × subject: workers never read the Homeowner thread; scoped workers read only threads in their scope; homeowners read only the Homeowner thread.
- `canMessageDirectly` allowed / refused pairs.
- `postMessage`: empty / too long refused; lazy creation; no duplicate threads; permission refused; author marked read.
- `openDirectThread`: returns the same thread both ways round; refuses disallowed pairs.
- `markThreadRead` and unread counts; thread-list ordering selector.
- Browser walkthrough before the PR: Ravi replies on task-4 → Arjun sees the unread badge and replies with a voice message → the homeowner messages the team from Daily Update → Ravi cannot see the Homeowner thread.

## Acceptance

```text
Worker / company / homeowner → open the conversation attached to the work
→ post text or voice → the other side sees an unread badge → reads and replies
→ nobody sees a thread outside their audience or scope
```

Existing checks still pass: `pnpm run typecheck`, `pnpm run test`, `pnpm run build`.
