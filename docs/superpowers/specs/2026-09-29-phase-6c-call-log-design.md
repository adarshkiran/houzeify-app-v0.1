# Phase 6C — Call Log

**Date:** 2026-09-29
**Branch:** `feature/call-log` (from `main`, after Phase 6B)
**Status:** Draft — awaiting review
**Source:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` → Phase 6 (Communication & Voice), §21 Communication Security Model
**Follows:** 6A Conversations, 6B Voice → structured actions

## Goal

Turn the greyed-out 📞/🎥 buttons that 6A left on direct-message threads (tooltip: "Calls are coming in the calls update") into a working **call log**: a record that a voice or video call happened, kept in the thread alongside messages, with no phone number ever shown.

| Build | Scope |
|---|---|
| 6A | Threads, direct messages, voice input |
| 6B | Voice → task/progress/issue drafts |
| **6C (this)** | Log a call: entry, record, thread display |
| Later (Phase 11 backend) | Real dialling, real audio/video calls, recording |

## Why not real calling

The build plan's own rule: "Phone calling, number masking, and call recording must be implemented with appropriate consent and legal/compliance handling," and real calls need the backend from Phase 11, which doesn't exist yet. This build logs that a call happened — by ordinary phone, outside the app — rather than placing one. No dialling, no device permission, no phone number anywhere.

## 1. Data

```ts
interface CallLog {
  id: EntityId
  threadId: EntityId
  /** The direct thread's two participants; who logged it vs. the other side. */
  loggedByMembershipId: EntityId
  otherMembershipId: EntityId
  type: "voice" | "video"
  startedAt: ISODateTime
  durationMinutes: number
  note?: string
  createdAt: ISODateTime
}
```

State gains `callLogs: CallLog[]`.

- A `CallLog` is not a `Message`. It never has message text, and it isn't returned by `getThreadMessages`. It renders in the thread's timeline sorted alongside messages by time (`startedAt`), as its own kind of entry.
- No field on `CallLog`, and nothing rendered from it, ever carries a phone number. There is nothing to mask, because nothing is shown.
- Only ever attached to a **direct** thread (`Thread.subject === "direct"`). Project chat, the Homeowner thread, and unit/task/issue threads have no call buttons, so no `CallLog` is ever created against them — the command enforces this (§2).

## 2. Command — `logCall(input)`

```ts
interface LogCallInput {
  threadId: EntityId
  type: "voice" | "video"
  startedAt: ISODateTime
  durationMinutes: number
  note?: string
}
```

Pure, authorize-first, same shape as `postMessage`:

1. The thread must exist and be a **direct** thread — else `IntegrityError`.
2. The caller must be one of its two participants (`readerMembership(state, session, thread)` returns a membership that is in `thread.participantMembershipIds`) — else `PermissionError`. (Being a participant of a direct thread already implies read access; this is stricter than general thread-read, matching how direct threads work today.)
3. `durationMinutes` must be a whole number ≥ 0 (0 covers "called, no answer") — else `ConflictError`, message: "Enter how long the call lasted."
4. `note`, if present, is trimmed; empty string is stored as `undefined`.
5. Builds the `CallLog` with `loggedByMembershipId` = the caller's membership, `otherMembershipId` = the thread's other participant, `id` from `ctx.ids.next("call")`, `createdAt` from `ctx.clock`.
6. Does **not** touch `lastMessageAt` or unread counts — a call log is not a message, so it never shows as an unread badge. (Decided for simplicity; revisit if it turns out people miss logged calls.)

Errors (exact copy):
- `"Enter how long the call lasted."` — missing or negative duration.
- Wrong thread kind or caller not a participant → `IntegrityError` / `PermissionError`, no custom copy (matches existing command style).

## 3. UI

### Entry point — thread header (direct threads only)

The existing buttons in `ThreadPanel.tsx`:

```tsx
<Button icon={<PhoneOutlined />} disabled aria-label="Voice call (coming soon)" />
<Button icon={<VideoCameraOutlined />} disabled aria-label="Video call (coming soon)" />
```

become:

```tsx
<Button icon={<PhoneOutlined />} aria-label="Log a voice call" onClick={() => openLogCall("voice")} />
<Button icon={<VideoCameraOutlined />} aria-label="Log a video call" onClick={() => openLogCall("video")} />
```

`CALLS_SOON` and its tooltip are removed for direct threads (the buttons already only render `!group`, i.e. direct threads — see `ThreadPanel.tsx`).

### Log a call — form (modal)

Opens pre-set to the tapped type (a Voice/Video segmented toggle the user can still change):

- **Type:** Voice / Video toggle, defaulting to whichever icon was tapped.
- **When:** date + time, defaulting to now, not in the future.
- **Duration (minutes):** number, required, min 0.
- **Note (optional):** short text, e.g. "Discussed Friday's pour timing."
- **Log call** button calls `logCall`; **Cancel** discards.

No participant picker, no number field — the thread already fixes who the call is with.

### In the thread

A small card between the message bubbles it falls between (by time), visually distinct from a chat bubble — no author avatar-bubble styling, more like the day divider:

```
📞  Voice call · 12 min
    Fri, 26 Sept, 5:40 pm · logged by You
    "Discussed Friday's pour timing."
```

"logged by You" / "logged by {name}" tells the other participant who added the entry, since either side may log it. No number, ever.

## 4. Rules, errors, testing

### Rules

- Only the thread's two participants can log or see a call against that thread (server-side, via `readerMembership` + participant check — same defense as messages).
- A call log is visible to exactly the same audience as the thread's messages (the two participants; nobody else can open a direct thread at all, per 6A).
- Never renders a phone number, under any role.

### Tests (Vitest, written first)

- `logCall`: succeeds for either participant; refused for a non-participant (`PermissionError`); refused against a non-direct thread (`IntegrityError`); refused with a missing/negative duration (`ConflictError`, exact copy); trims an empty note to `undefined`.
- Selector: a thread's timeline (messages + call logs merged, sorted by time) only includes call logs from that thread.
- Browser walkthrough (typed form — no real calling to test): open a direct thread as each participant, tap 📞, log a call, see the card; tap 🎥, log a video call; confirm a third person who is not one of the two participants cannot open the thread or its call logs (existing 6A protection, spot-checked here).

### Out of scope

Real dialling, real audio/video, call recording, showing any phone number, calls on group threads (Project chat, Homeowner, unit/task/issue), unread badges for calls, editing or deleting a logged call, the Phase 11 backend.

## Acceptance

```text
Open a direct message thread → tap 📞 or 🎥 → log when, how long, and an optional note
→ Log call → the call appears in the thread, visible to the other participant
Nobody outside the two participants can see or log it. No phone number appears anywhere.
```

Existing checks still pass: `pnpm run typecheck`, `pnpm run test`, `pnpm run build`.
