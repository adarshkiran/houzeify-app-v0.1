# Phase 6C — Call Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the greyed-out 📞/🎥 buttons on a direct-message thread's header into a working "log this call" flow — a small form (when, how long, voice/video, an optional note), saved as a `CallLog` and shown inline in the thread. No dialling, no audio, no phone number anywhere.

**Architecture:** One new pure domain command (`logCall`) alongside the existing conversation commands, one new record type in state (`callLogs`), a small selector that merges call logs into a thread's timeline with its messages, a `LogCallModal` component, and edits to `ThreadPanel` to wire the two header buttons to it and render call-log entries inline.

**Tech Stack:** React 19, TypeScript 5.7, Ant Design 6, Vitest. Package manager pnpm.

**Spec:** `docs/superpowers/specs/2026-09-29-phase-6c-call-log-design.md`

## Global Constraints

- Checks: `pnpm run typecheck`, `pnpm run test`, `pnpm run build` must pass after every task.
- **Never run `pnpm run format`** (oxfmt 0.2.0 strips `;` in TypeScript types and breaks the build).
- Git commands need `export PATH="/opt/homebrew/bin:$PATH"` first (git-lfs hooks).
- **Never kill processes by pattern** (`pkill -f …`); the dev server on port 5174 must keep running.
- Domain commands are pure `(state, ctx) => { state, result }`, authorize first; errors: `PermissionError` (from `./session`), `IntegrityError` / `ConflictError` (from `./errors`).
- A `CallLog` is only ever attached to a **direct** thread; never Project chat, Homeowner, or a unit/task/issue thread.
- No field on `CallLog`, and nothing rendered from it, ever shows a phone number.
- Only the thread's two participants may log or see a call against that thread.
- A call log does **not** update `lastMessageAt` or unread counts.
- Copy (exact): `"Enter how long the call lasted."`
- Code style: double quotes, no semicolons, match surrounding comment density; default exports for components.

## File structure

| File | Responsibility |
|---|---|
| `src/domain/models.ts` (modify) | `CallLog` interface; `callLogs: CallLog[]` on `ConstructionDataState` |
| `src/domain/conversationCommands.ts` (modify) | `LogCallInput`, `logCall` command |
| `src/domain/conversationCommands.test.ts` (modify) | `logCall` tests |
| `src/mock/seed.ts` (modify) | `callLogs: CallLog[]` seed array (can be empty) and the `callLogs` field on the exported state |
| `src/mock/conversationSelectors.ts` (modify) | `getThreadTimeline` — messages and call logs merged, sorted by time |
| `src/mock/conversationSelectors.test.ts` (modify) | timeline-merge test |
| `src/mock/ConstructionDataProvider.tsx` (modify) | `logCall` exposed on the context |
| `src/components/conversations/LogCallModal.tsx` (create) | the "Log a call" form |
| `src/components/conversations/ThreadPanel.tsx` (modify) | wires the header buttons to `LogCallModal`; renders call-log entries in the timeline |
| `src/index.css` (modify) | `.thread-call` entry styling |

---

### Task 1: `CallLog` model and the `logCall` command

**Files:**
- Modify: `src/domain/models.ts` (near `ThreadRead`, ~line 349-354)
- Modify: `src/domain/conversationCommands.ts`
- Modify: `src/mock/seed.ts` (add `callLogs: []` — see Step 4)
- Test: `src/domain/conversationCommands.test.ts`

**Interfaces:**
- Consumes: `readerMembership` from `./conversations`; `ConflictError`, `IntegrityError` from `./errors`; `PermissionError`, `Permissions.PROJECT_READ` (existing pattern for the "thread not found" case — see `markThreadRead`).
- Produces:
  ```ts
  export interface CallLog {
    id: EntityId
    threadId: EntityId
    loggedByMembershipId: EntityId
    otherMembershipId: EntityId
    type: "voice" | "video"
    startedAt: ISODateTime
    durationMinutes: number
    note?: string
    createdAt: ISODateTime
  }
  ```
  ```ts
  export interface LogCallInput {
    threadId: EntityId
    type: "voice" | "video"
    startedAt: string
    durationMinutes: number
    note?: string
  }
  export const logCall: (input: LogCallInput) => Command<CallLog>
  ```
  Later tasks (2, 3) consume `CallLog` (for the timeline) and `logCall` (for the provider and the form).

- [ ] **Step 1: Write the failing tests**

Add to `src/domain/conversationCommands.test.ts` (the file already imports `ConstructionDataState`, `PermissionError`, `ConflictError`, `IntegrityError`, and has the `arjun`/`ravi`/`homeowner` sessions, `clock`, `as`, `run` helpers — reuse them):

```ts
import { logCall, markThreadRead, markThreadUnread, openDirectThread, postMessage } from "./conversationCommands"
```

(replace the existing `import { markThreadRead, markThreadUnread, openDirectThread, postMessage } from "./conversationCommands"` line with the one above)

```ts
describe("logCall", () => {
  const DIRECT = "thread-sharma-direct-arjun-ravi" // Arjun (membership-manager-1) ↔ Ravi (membership-worker-ravi-sharma)
  const input = { threadId: DIRECT, type: "voice" as const, startedAt: "2026-09-27T09:00:00.000Z", durationMinutes: 12 }

  it("logs a call for either participant", () => {
    const { result } = run(seed, arjun, logCall(input))
    expect(result).toMatchObject({
      threadId: DIRECT,
      loggedByMembershipId: "membership-manager-1",
      otherMembershipId: "membership-worker-ravi-sharma",
      type: "voice",
      durationMinutes: 12,
    })
    const { result: fromRavi } = run(seed, ravi, logCall(input))
    expect(fromRavi).toMatchObject({ loggedByMembershipId: "membership-worker-ravi-sharma", otherMembershipId: "membership-manager-1" })
  })

  it("stores an optional note, trimmed, and drops an empty one", () => {
    const { result: withNote } = run(seed, arjun, logCall({ ...input, note: "  Discussed Friday's pour timing.  " }))
    expect(withNote.note).toBe("Discussed Friday's pour timing.")
    const { result: emptyNote } = run(seed, arjun, logCall({ ...input, note: "   " }))
    expect(emptyNote.note).toBeUndefined()
  })

  it("adds the call to state without touching lastMessageAt", () => {
    const before = seed.threads.find((t) => t.id === DIRECT)!.lastMessageAt
    const { state, result } = run(seed, arjun, logCall(input))
    expect(state.callLogs).toContainEqual(result)
    expect(state.threads.find((t) => t.id === DIRECT)!.lastMessageAt).toBe(before)
  })

  it("refuses someone who isn't a participant", () => {
    expect(() => run(seed, homeowner, logCall(input))).toThrow(PermissionError)
  })

  it("refuses a non-direct thread", () => {
    expect(() => run(seed, arjun, logCall({ ...input, threadId: "thread-sharma-project" }))).toThrow(IntegrityError)
  })

  it("refuses a missing or negative duration", () => {
    expect(() => run(seed, arjun, logCall({ ...input, durationMinutes: -1 }))).toThrow(ConflictError)
    // @ts-expect-error -- exercising the runtime guard for missing input
    expect(() => run(seed, arjun, logCall({ ...input, durationMinutes: undefined }))).toThrow(ConflictError)
  })

  it("accepts a zero-minute call (no answer)", () => {
    const { result } = run(seed, arjun, logCall({ ...input, durationMinutes: 0 }))
    expect(result.durationMinutes).toBe(0)
  })
})
```

- [ ] **Step 2: Run and see it fail**

Run: `pnpm vitest run src/domain/conversationCommands.test.ts`
Expected: FAIL (`logCall` does not exist; `state.callLogs` is `undefined`).

- [ ] **Step 3: Implement the model and command**

In `src/domain/models.ts`, right after the `ThreadRead` interface (after its closing `}`, before `export interface ConstructionDataState {`):

```ts
/** A call the two people on a direct thread had outside the app — nothing is dialled or recorded here, only that it happened. */
export interface CallLog {
  id: EntityId
  threadId: EntityId
  /** Who added the entry; the other side is whoever else is on the thread. */
  loggedByMembershipId: EntityId
  otherMembershipId: EntityId
  type: "voice" | "video"
  startedAt: ISODateTime
  durationMinutes: number
  note?: string
  createdAt: ISODateTime
}
```

Add `callLogs: CallLog[]` to `ConstructionDataState`, next to `threadReads: ThreadRead[]` (line ~376).

In `src/domain/conversationCommands.ts`, add to the top import from `./models`: `CallLog` (alongside `Message`, `MessageVoice`, `Thread`, `ThreadRead`, `ThreadSubject`). Append at the end of the file:

```ts
export interface LogCallInput {
  threadId: EntityId
  type: "voice" | "video"
  /** ISO timestamp for when the call happened. */
  startedAt: string
  durationMinutes: number
  note?: string
}

/**
 * Records that a call happened between a direct thread's two people — not a
 * message, and never carries a phone number. Either participant can log it.
 */
export const logCall =
  (input: LogCallInput): Command<CallLog> =>
  (state, ctx) => {
    const thread = state.threads.find((item) => item.id === input.threadId)
    if (!thread) throw new PermissionError(Permissions.PROJECT_READ)
    if (thread.subject !== "direct") {
      throw new IntegrityError(`Thread ${thread.id} is not a direct thread`)
    }
    const me = readerMembership(state, ctx.actor, thread)
    if (!me) throw new PermissionError(Permissions.PROJECT_READ, thread.projectId)
    const otherId = thread.participantMembershipIds?.find((id) => id !== me.id)
    if (!otherId) throw new IntegrityError(`Direct thread ${thread.id} has no other participant`)

    if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 0) {
      throw new ConflictError("Enter how long the call lasted.")
    }

    const call: CallLog = {
      id: ctx.ids.next("call"),
      threadId: thread.id,
      loggedByMembershipId: me.id,
      otherMembershipId: otherId,
      type: input.type,
      startedAt: input.startedAt,
      durationMinutes: input.durationMinutes,
      note: input.note?.trim() || undefined,
      createdAt: iso(ctx),
    }
    return { state: { ...state, callLogs: [...state.callLogs, call] }, result: call }
  }
```

- [ ] **Step 4: Add `callLogs` to the seed state**

In `src/mock/seed.ts`, add a new array near the other conversation arrays (after `const threadReads: ThreadRead[] = [...]`, before the closing of that block — read the file to find the exact spot, it's right before `export const seedConstructionData: ConstructionDataState = {`):

```ts
const callLogs: CallLog[] = []
```

Add `CallLog` to the existing `import type { ... } from "../domain/models"` block at the top of the file (wherever `Thread`, `Message`, `ThreadRead` are imported from). Add `callLogs,` to the `seedConstructionData` object literal, next to `threadReads,` (~line 1406).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/domain/conversationCommands.test.ts && pnpm run typecheck`
Expected: all PASS. (The `@ts-expect-error` line in the duration test will fail typecheck if the input type doesn't actually require `durationMinutes` — if so, drop that one assertion and keep the `-1` case, which already covers the runtime guard.)

- [ ] **Step 6: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/domain/models.ts src/domain/conversationCommands.ts src/domain/conversationCommands.test.ts src/mock/seed.ts
git commit -m "feat: log a call on a direct thread (logCall command)"
```

---

### Task 2: Thread timeline selector (messages + call logs, merged)

**Files:**
- Modify: `src/mock/conversationSelectors.ts`
- Test: `src/mock/conversationSelectors.test.ts`

**Interfaces:**
- Consumes: `CallLog` from `../domain/models`; `getThreadMessages` (existing, unchanged).
- Produces:
  ```ts
  export type TimelineEntry =
    | { kind: "message"; at: string; message: Message }
    | { kind: "call"; at: string; call: CallLog }
  export function getThreadTimeline(state: ConstructionDataState, threadId: EntityId): TimelineEntry[]
  ```
  Task 4 (`ThreadPanel`) consumes `getThreadTimeline` and `TimelineEntry` in place of the current direct call to `getThreadMessages` when rendering the message list.

- [ ] **Step 1: Write the failing test**

Read `src/mock/conversationSelectors.test.ts` first to match its existing style (imports, seed usage). Add:

```ts
import { getThreadTimeline } from "./conversationSelectors"

describe("getThreadTimeline", () => {
  const DIRECT = "thread-sharma-direct-arjun-ravi"

  it("merges messages and call logs in time order", () => {
    const withCall = {
      ...seed,
      callLogs: [
        {
          id: "call-1",
          threadId: DIRECT,
          loggedByMembershipId: "membership-manager-1",
          otherMembershipId: "membership-worker-ravi-sharma",
          type: "voice" as const,
          startedAt: "2026-09-27T09:00:00.000Z",
          durationMinutes: 5,
          createdAt: "2026-09-27T09:05:00.000Z",
        },
      ],
    }
    const timeline = getThreadTimeline(withCall, DIRECT)
    expect(timeline.some((entry) => entry.kind === "call" && entry.call.id === "call-1")).toBe(true)
    for (let i = 1; i < timeline.length; i++) {
      expect(Date.parse(timeline[i]!.at)).toBeGreaterThanOrEqual(Date.parse(timeline[i - 1]!.at))
    }
  })

  it("only includes call logs for the requested thread", () => {
    const other = {
      ...seed,
      callLogs: [
        {
          id: "call-2",
          threadId: "some-other-thread",
          loggedByMembershipId: "membership-manager-1",
          otherMembershipId: "membership-worker-ravi-sharma",
          type: "video" as const,
          startedAt: "2026-09-27T09:00:00.000Z",
          durationMinutes: 5,
          createdAt: "2026-09-27T09:05:00.000Z",
        },
      ],
    }
    const timeline = getThreadTimeline(other, DIRECT)
    expect(timeline.some((entry) => entry.kind === "call")).toBe(false)
  })

  it("returns only messages when there are no call logs", () => {
    const timeline = getThreadTimeline(seed, DIRECT)
    expect(timeline.every((entry) => entry.kind === "message")).toBe(true)
    expect(timeline).toHaveLength(seed.messages.filter((m) => m.threadId === DIRECT).length)
  })
})
```

- [ ] **Step 2: Run and see it fail**

Run: `pnpm vitest run src/mock/conversationSelectors.test.ts`
Expected: FAIL (`getThreadTimeline` does not exist).

- [ ] **Step 3: Implement**

In `src/mock/conversationSelectors.ts`, add `CallLog` to the `import type { ... } from "../domain/models"` block. After `getThreadMessages` (which stays unchanged — other callers still use it directly), add:

```ts
export type TimelineEntry =
  | { kind: "message"; at: string; message: Message }
  | { kind: "call"; at: string; call: CallLog }

/** A direct thread's messages and logged calls, oldest → newest. */
export function getThreadTimeline(state: ConstructionDataState, threadId: EntityId): TimelineEntry[] {
  const messages: TimelineEntry[] = getThreadMessages(state, threadId).map((message) => ({
    kind: "message",
    at: message.createdAt,
    message,
  }))
  const calls: TimelineEntry[] = state.callLogs
    .filter((call) => call.threadId === threadId)
    .map((call) => ({ kind: "call", at: call.startedAt, call }))
  return [...messages, ...calls].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/mock/conversationSelectors.test.ts && pnpm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/mock/conversationSelectors.ts src/mock/conversationSelectors.test.ts
git commit -m "feat: merge call logs into a thread's timeline"
```

---

### Task 3: Wire `logCall` into the data provider

**Files:**
- Modify: `src/mock/ConstructionDataProvider.tsx`

**Interfaces:**
- Consumes: `logCall`, `LogCallInput` from `../domain/conversationCommands`.
- Produces: `logCall: (input: LogCallInput) => CallLog` on the context value, alongside `postMessage`.

- [ ] **Step 1: Add the import**

In `src/mock/ConstructionDataProvider.tsx`, change:

```ts
import type { PostMessageInput } from "../domain/conversationCommands"
```

to:

```ts
import type { LogCallInput, PostMessageInput } from "../domain/conversationCommands"
```

Add `CallLog` to the `import type { ... } from "../domain/models"` block (alongside `Message`, `Thread`, etc.).

- [ ] **Step 2: Add to the interface and the provider value**

In the context type (near `postMessage: (input: PostMessageInput) => Message` at line ~132), add directly below it:

```ts
  logCall: (input: LogCallInput) => CallLog
```

In the provider's `useMemo` value (near `postMessage: (input) => run(conversationCommands.postMessage(input)),` at line ~230), add directly below it:

```ts
      logCall: (input) => run(conversationCommands.logCall(input)),
```

- [ ] **Step 3: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: all PASS (nothing calls `logCall` from the UI yet, so this only proves the wiring compiles).

- [ ] **Step 4: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/mock/ConstructionDataProvider.tsx
git commit -m "feat: expose logCall on the data provider"
```

---

### Task 4: "Log a call" form

**Files:**
- Create: `src/components/conversations/LogCallModal.tsx`

**Interfaces:**
- Consumes: `logCall` from `useConstructionData()`; `useCommand()` (existing `run(action, { success? })` pattern — see `CreateTaskModal.tsx` or `ReportIssueModal.tsx` for the exact usage).
- Produces:
  ```ts
  export default function LogCallModal(props: {
    open: boolean
    onClose: () => void
    threadId: EntityId
    /** Which button opened it; the form's toggle defaults to this. */
    initialType: "voice" | "video"
    onLogged?: (call: CallLog) => void
  }): JSX.Element
  ```
  Task 5 (`ThreadPanel`) renders this with `threadId={thread.id}`.

- [ ] **Step 1: Implement**

Read `src/components/ReportIssueModal.tsx` first for the exact `Modal`/`Form`/`useConstructionData`/`useCommand` pattern this codebase uses (imports, `destroyOnHidden`, `form.resetFields()` on close, `run(() => command(...), { success: "..." })`, `onFinish`). Match that pattern. The codebase has no `dayjs`/`DatePicker` dependency anywhere (confirmed: `CompanyCreateProjectScreen.tsx` uses plain `<Input type="date">`) — use plain HTML date/time inputs, not `DatePicker`.

```tsx
import { useEffect } from "react"
import { Button, Flex, Form, Input, InputNumber, Modal, Segmented } from "antd"
import type { CallLog, EntityId } from "../../domain/models"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { useCommand } from "../../session/useCommand"

interface CallFormValues {
  type: "voice" | "video"
  /** `<input type="date">` value, e.g. "2026-09-29". */
  callDate: string
  /** `<input type="time">` value, e.g. "14:30". */
  callTime: string
  durationMinutes: number
  note?: string
}

/** Today as "YYYY-MM-DD" and now as "HH:mm", for the form's defaults. */
function nowParts() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  }
}

/**
 * Logs that a call happened on a direct thread — no dialling, no number, no
 * audio. Opens pre-set to whichever of 📞/🎥 was tapped.
 */
export default function LogCallModal({
  open,
  onClose,
  threadId,
  initialType,
  onLogged,
}: {
  open: boolean
  onClose: () => void
  threadId: EntityId
  initialType: "voice" | "video"
  onLogged?: (call: CallLog) => void
}) {
  const { logCall } = useConstructionData()
  const run = useCommand()
  const [form] = Form.useForm<CallFormValues>()

  useEffect(() => {
    if (!open) form.resetFields()
  }, [open, form])

  const handleFinish = (values: CallFormValues) => {
    // Build the ISO timestamp from the two plain inputs (local time).
    const startedAt = new Date(`${values.callDate}T${values.callTime}:00`).toISOString()
    const outcome = run(
      () =>
        logCall({
          threadId,
          type: values.type,
          startedAt,
          durationMinutes: values.durationMinutes,
          note: values.note,
        }),
      { success: "Call logged" },
    )
    if (!outcome.ok) return
    onClose()
    onLogged?.(outcome.value)
  }

  const { date, time } = nowParts()

  return (
    <Modal title="Log a call" open={open} onCancel={onClose} footer={null} destroyOnHidden>
      <Form<CallFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ type: initialType, callDate: date, callTime: time, durationMinutes: undefined }}
        onFinish={handleFinish}
      >
        <Form.Item label="Type" name="type" rules={[{ required: true }]}>
          <Segmented
            options={[
              { label: "Voice", value: "voice" },
              { label: "Video", value: "video" },
            ]}
          />
        </Form.Item>
        <Flex gap={16}>
          <Form.Item label="Date" name="callDate" rules={[{ required: true, message: "Say when the call happened" }]} className="flex-1">
            <Input type="date" max={date} />
          </Form.Item>
          <Form.Item label="Time" name="callTime" rules={[{ required: true, message: "Say when the call happened" }]} className="flex-1">
            <Input type="time" />
          </Form.Item>
        </Flex>
        <Form.Item
          label="Duration (minutes)"
          name="durationMinutes"
          rules={[{ required: true, message: "Enter how long the call lasted." }]}
        >
          <InputNumber min={0} className="w-full!" />
        </Form.Item>
        <Form.Item label="Note (optional)" name="note">
          <Input.TextArea rows={2} placeholder="e.g. Discussed Friday's pour timing" />
        </Form.Item>
        <Flex justify="flex-end" gap="small">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit">Log call</Button>
        </Flex>
      </Form>
    </Modal>
  )
}
```

`max={date}` on the date input stops picking a future date (native browser constraint); the command doesn't separately enforce this — a future `startedAt` is accepted server-side, since a device's clock/timezone could legitimately disagree with the picker's `max` by a few hours and blocking it there isn't worth the false rejections.

- [ ] **Step 2: Verify**

Run: `pnpm run typecheck && pnpm run build`
Expected: PASS (component not wired into any screen yet).

- [ ] **Step 3: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/components/conversations/LogCallModal.tsx
git commit -m "feat: Log a call form"
```

---

### Task 5: Wire the header buttons and render call entries in `ThreadPanel`

**Files:**
- Modify: `src/components/conversations/ThreadPanel.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `LogCallModal` (Task 4), `getThreadTimeline`/`TimelineEntry` (Task 2), `getMembershipName` (existing, already imported), `clockTime`/`dayLabel`/`sameDay` (existing, already imported).

- [ ] **Step 1: Swap the message loop to the merged timeline**

In `ThreadPanel.tsx`, change the import:

```ts
import { getThreadMessages, roleLabel, threadTitle } from "../../mock/conversationSelectors"
```

to:

```ts
import { getThreadTimeline, roleLabel, threadTitle, type TimelineEntry } from "../../mock/conversationSelectors"
```

Change:

```ts
const messages = useMemo(() => (thread ? getThreadMessages(state, thread.id) : []), [state, thread])
```

to:

```ts
const timeline = useMemo(() => (thread ? getThreadTimeline(state, thread.id) : []), [state, thread])
const messages = useMemo(() => timeline.filter((e): e is Extract<TimelineEntry, { kind: "message" }> => e.kind === "message").map((e) => e.message), [timeline])
```

(`messages` keeps its old meaning — every other use of `messages` in the file, e.g. search matching, the empty-state check, `messages.some(...)` for "Mark as unread", stays unchanged, since they only care about messages, not calls.)

- [ ] **Step 2: Render call entries in the timeline loop**

The current render loop (`messages.map((message, index) => { ... newDay check using `messages[index - 1]` ... })`) must become a `timeline.map((entry, index) => { ... })`, with the day-divider logic keyed off `entry.at` instead of `message.createdAt`, and a branch for `entry.kind === "call"`. Restructure the existing block:

```tsx
{timeline.length === 0 ? (
  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={props.emptyText ?? "No messages yet. Start the conversation."} />
) : (
  timeline.map((entry, index) => {
    const previous = timeline[index - 1]
    const newDay = !previous || !sameDay(previous.at, entry.at)
    const dayDivider = newDay && (
      <div className="thread-day" role="separator">
        <span>{dayLabel(entry.at)}</span>
      </div>
    )

    if (entry.kind === "call") {
      const { call } = entry
      const byMe = call.loggedByMembershipId === me.id
      return (
        <Fragment key={call.id}>
          {dayDivider}
          <div className="thread-call" role="note">
            {call.type === "voice" ? <PhoneOutlined /> : <VideoCameraOutlined />}
            <div>
              <Text className="thread-call-title">
                {call.type === "voice" ? "Voice call" : "Video call"} · {call.durationMinutes} min
              </Text>
              <Text type="secondary" className="thread-call-meta">
                {clockTime(call.startedAt)} · logged by {byMe ? "you" : getMembershipName(state, call.loggedByMembershipId) ?? "them"}
              </Text>
              {call.note && <Text className="thread-call-note">“{call.note}”</Text>}
            </div>
          </div>
        </Fragment>
      )
    }

    const message = entry.message
    // ... the existing message-rendering body, UNCHANGED, but:
    //   - replace every `messages[index - 1]` / `previous`/`newDay` reference that
    //     used to be computed inside this branch with the `dayDivider`/`newDay`
    //     computed above (they're now shared with the call branch)
    //   - replace the old `{newDay && (<div className="thread-day">...)}` block
    //     with `{dayDivider}`
    //   - everything else (author line, bubble, voice player, link chips, time,
    //     message actions dropdown) stays exactly as it is today
  })
)}
```

Do this as a careful edit of the existing block rather than a rewrite — the message branch's body (author line, `.thread-bubble`, voice player, `highlight(...)`, link chips, the `⋯` actions dropdown) must be preserved byte-for-byte except for the `newDay`/`previous` computation moving up a level and `message`/`index` now coming from `entry`/`entry.message`.

- [ ] **Step 3: Wire the two header buttons**

State: add near the other `useState` calls at the top of the component:

```ts
const [logCallOpen, setLogCallOpen] = useState<"voice" | "video">()
```

Replace the disabled-buttons block:

```tsx
{!group && (
  <>
    <Tooltip title={CALLS_SOON}>
      <span>
        <Button type="text" shape="circle" icon={<PhoneOutlined />} aria-label="Voice call (coming soon)" disabled />
      </span>
    </Tooltip>
    <Tooltip title={CALLS_SOON}>
      <span>
        <Button type="text" shape="circle" icon={<VideoCameraOutlined />} aria-label="Video call (coming soon)" disabled />
      </span>
    </Tooltip>
  </>
)}
```

with:

```tsx
{!group && (
  <>
    <Tooltip title="Log a voice call">
      <Button type="text" shape="circle" icon={<PhoneOutlined />} aria-label="Log a voice call" onClick={() => setLogCallOpen("voice")} />
    </Tooltip>
    <Tooltip title="Log a video call">
      <Button type="text" shape="circle" icon={<VideoCameraOutlined />} aria-label="Log a video call" onClick={() => setLogCallOpen("video")} />
    </Tooltip>
  </>
)}
```

Remove the now-unused `const CALLS_SOON = "Calls are coming in the calls update"` line.

Render the modal near the other modals at the bottom of the component (alongside `CreateTaskModal`/`ReportIssueModal`), gated the same way `!group` gates the buttons (only relevant for direct threads, and `thread` — not `probe` — must exist, since you can't log a call against a not-yet-created draft thread):

```tsx
{!group && thread && (
  <LogCallModal
    open={!!logCallOpen}
    onClose={() => setLogCallOpen(undefined)}
    threadId={thread.id}
    initialType={logCallOpen ?? "voice"}
  />
)}
```

Import `LogCallModal` from `./LogCallModal`.

- [ ] **Step 4: CSS**

In `src/index.css`, add near the other `.thread-*` rules (search for `.thread-day` to find the right neighbourhood):

```css
.thread-call {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  align-self: center;
  max-width: 90%;
  padding: 8px 14px;
  border-radius: var(--ant-border-radius-lg);
  background: var(--ant-color-fill-quaternary);
  color: var(--ant-color-text-secondary);
}

.thread-call-title {
  display: block;
  color: var(--ant-color-text);
  font-weight: 500;
}

.thread-call-meta {
  display: block;
  font-size: 12px;
}

.thread-call-note {
  display: block;
  margin-top: 2px;
  font-style: italic;
}
```

- [ ] **Step 5: Verify**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS.

Browser check (typed form; http://localhost:5174, business demo sign-in for Arjun — `localStorage.setItem("houzeify:session", JSON.stringify({accountType:"business",personId:"person-arjun",organizationId:"org-buildright"}))`): open `#project-messages?project_id=project-sharma&thread_id=thread-sharma-direct-arjun-ravi`, tap 📞, fill in a duration, Log call — a card appears in the thread saying "Voice call · N min" and "logged by you". Tap 🎥 and repeat for a video call. Switch to the worker (Ravi) sign-in and open the same thread — both call cards are visible, correctly attributed. Confirm a project-chat or task-thread header still shows no call buttons (group threads).

- [ ] **Step 6: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add src/components/conversations/ThreadPanel.tsx src/index.css
git commit -m "feat: log calls from a direct thread's header, shown inline"
```

---

### Task 6: Privacy check, walkthrough, spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-phase-6c-call-log-design.md` (Status → Implemented)

- [ ] **Step 1: Full checks** — `pnpm run typecheck && pnpm run test && pnpm run build` (all pass).
- [ ] **Step 2: Privacy check (already covered by Task 1's tests, confirm once more in the browser)** — sign in as a third person who is on the same project but not part of the `thread-sharma-direct-arjun-ravi` thread (e.g. the homeowner, `person-demo-homeowner`) and confirm: they cannot open that direct thread at all (existing 6A protection — direct threads never appear in their conversation list), and no phone number appears anywhere in the app as a result of this feature (grep the diff for anything resembling `.phone` rendered in `ThreadPanel.tsx` or `LogCallModal.tsx` — there should be none).
- [ ] **Step 3: Spec status** — set `**Status:** Implemented` in `docs/superpowers/specs/2026-09-29-phase-6c-call-log-design.md`.
- [ ] **Step 4: Commit**

```bash
export PATH="/opt/homebrew/bin:$PATH"
git add docs/superpowers/specs/2026-09-29-phase-6c-call-log-design.md
git commit -m "docs: Phase 6C spec implemented"
```
