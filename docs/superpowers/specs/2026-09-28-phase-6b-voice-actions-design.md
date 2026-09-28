# Phase 6B — Voice → Structured Actions

**Date:** 2026-09-28
**Branch:** `feature/voice-actions` (branched from `feature/communication-voice`, i.e. PR #14)
**Status:** Implemented
**Source:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` → Phase 6 (Communication & Voice): voice pipeline, Voice → Task / Progress / Issue, voice instructions
**Follows:** Phase 6A — `docs/superpowers/specs/2026-09-27-phase-6a-conversations-design.md`

## Goal

Speech → transcription → extraction → **editable draft** → **user confirms** → record saved through the existing domain commands. AI (later) never silently changes official project records.

| Build | Scope |
|---|---|
| 6A (done) | Conversations, voice input, unread counts |
| **6B (this)** | Voice → Task, Voice → Progress, Voice → Issue, chat message → Task / Issue |
| 6C (later) | Calls: dialler link + call log; real calls with the backend (Phase 11) |

## Decisions (from brainstorming)

- **Extraction:** rules-based now, behind one extractor interface so an AI extractor can replace it later without screen changes.
- **Scope:** all four actions, each producing an editable draft that needs explicit confirmation.
- **Entry points:** in context (where the action already lives), not a global voice button.
- **Architecture (approach A):** extractor module + a capture step that pre-fills the existing forms. Drafts live only on screen; nothing is stored until the form's own submit runs the existing command.

## 1. Extractor (pure, swappable)

```ts
type VoiceKind = "task" | "issue" | "progress"

interface VoiceContext {
  today: ISODate
  projectId: EntityId
  units: ProjectUnit[]            // the project's locations
  workTypes: WorkType[]           // Work Library
  people: { id: EntityId; name: string }[]   // the project's workers (assignable)
  tasks: Task[]                   // open tasks of the project (for issue links)
  currentTaskId?: EntityId        // when opened from a task / task thread
}

type FieldState =
  | { state: "heard" }                                  // taken from the words
  | { state: "guessed"; reason: string }                // inferred; user should check
  | { state: "missing" }                                // required, not found
  | { state: "choose"; options: { value: string; label: string }[] } // ambiguous

interface VoiceDraft<T> {
  kind: VoiceKind
  transcript: string
  values: Partial<T>                                    // form values
  fields: Partial<Record<keyof T, FieldState>>
}
```

The extractor is one function type, `(text, kind, context) => VoiceDraft`. The rules implementation lives in `src/domain/voice/` (pure, no React), split into small helpers per concern (dates, people, locations, work types, quantities, severity/priority, progress split, title cleanup). An AI extractor later implements the same type. Implemented as an object `VoiceExtractor` with `task` / `issue` / `progress` methods; screens use the exported `voiceExtractor` instance.

### Rules (English; speech recognised as en-IN)

| Field | Rule |
|---|---|
| Dates | "today", "tomorrow", "day after tomorrow", weekday names ("on Friday" = next such day; a past weekday → next week, marked *guessed*), "by the 5th" (next date with that day), "next week" (next Monday, *guessed*) → due date (task); planned start when phrased "start … / from …" |
| Person | Case-insensitive match of first or full name against project members. One match → *heard*; several → *choose*; a name-like word after "assign / ask / tell" with no match → *missing* with note "Nobody named 'X' on this project" |
| Location | Unit name or code match ("Main House", "Block B", "MH") → `projectUnitId`; a project with one unit → *guessed* to it; otherwise *missing* |
| Work type | Work Library name match, then keyword map ("pour/concrete/casting", "shuttering/formwork", "curing", "plaster", "brick/block work", "backfill", "waterproof", "tiling", "painting", "wiring/electrical", "plumbing") → `workTypeId` (stage and trade follow). None → *missing* |
| Priority (task) | "urgent / asap / immediately" → high; "critical" → critical; "low priority / when free" → low; default medium (*guessed*) |
| Severity (issue) | "unsafe / danger / collapse / injury" → critical; "leak / crack / damaged / broken / short / stopped" → high; "delay / late / missing" → medium; default medium (*guessed*) |
| Quantity | number + unit ("42 cubic metres / m3", "120 sq ft / sqm", "10 bags", "3 days") → `plannedQuantity` (task) / `completedQuantity` (progress) |
| Progress split | "today / done / completed / finished …" → Today; "tomorrow / next / will …" → Tomorrow; "problem / issue / blocked / waiting for …" → Blocker; unmarked sentences → Today. "N of us / N workers / N people" → people on site |
| Title | The instruction with the person, date, priority words and filler ("please", "can you", "ok") removed, first letter capitalised, at most 120 characters |
| Issue link | `currentTaskId` → linked task (*heard*); otherwise a task title match (*guessed*) |

Empty or whitespace-only input produces no draft (the capture step blocks "Make draft").

## 2. Capture step (shared)

`VoiceCapture` modal, used by every entry point:

1. **🎤 Speak** — live transcript via the existing `useDictation`; stop to finish.
2. **Typing fallback** — when speech recognition is unavailable (Safari, Firefox, the preview pane) or the mic is blocked, the same box is typed into, with the note "Voice isn't available in this browser — type the instruction instead."
3. The transcript is editable; **Make draft** runs the extractor and closes the capture step.
4. The existing form opens pre-filled.

In the form:

- Each pre-filled field shows a marker: 🎤 **Heard**, ✨ **Guessed** (tooltip = reason), ⚠ **Needs you** (missing or choose; field highlighted, choices listed).
- A "You said: …" line at the top shows the transcript.
- Required ⚠ fields block the form's submit (the form's existing required-field validation).
- **Nothing is saved until the form's own submit** (Create task / Report issue / Submit update), which calls the existing command. Permissions and validation there stay the final authority.
- Cancel / close discards the draft. Audio of voice commands is not stored.
- A 🎤 entry point is shown only to people allowed to perform that action (same check as the non-voice button).

## 3. The four actions

| Action | Entry point | Pre-fills | Confirm |
|---|---|---|---|
| Voice → Task | Tasks page: **Speak a task** (beside Create task) | title, location, work type (→ stage, trade), priority, planned quantity, planned start, due date, **Assign to** (new optional field on the Create task form) | `createTask`, then `assignTask` if an assignee is set. If assignment fails, the task remains, unassigned, with a message |
| Voice → Progress | Log progress (worker `WorkerSubmitScreen`, company `DailyProgressSubmitScreen`): **Fill from voice** | Today, Tomorrow, Blocker, work done (quantity), people on site; task and location come from the page | the user adds evidence, then the existing **Submit update** (`submitDailyProgress`) |
| Voice → Issue | Issues page, Task detail, worker **Report a problem**: **Speak an issue** | title, description (= transcript), severity, location, linked task | `reportIssue` |
| Chat → Task / Issue | Message ⋯ menu (text messages, and voice messages with a transcript): **Turn into task** / **Turn into issue**, shown only to users allowed that action | the same forms, pre-filled from the message text; project, and for a task thread its task and location, from the thread | the same commands, with `source` |

### Conversation link

- `Task` and `Issue` gain optional `source?: { threadId: EntityId; messageId: EntityId }`.
- `createTask` / `reportIssue` accept an optional `source`. They verify the message exists, belongs to that thread and to the thread's project (the record's project), and that the caller can read the thread (`readerMembership`); otherwise `PermissionError` / `IntegrityError`.
- A selector derives, per message, the tasks / issues created from it that the viewer can read → chip **"→ Task: {title}"** / **"→ Issue: {title}"** under the message, opening the record.
- Task detail / Issue detail show **"From conversation"**, linking to the thread (Messages page, worker messages, or the Discussion card).
- Messages themselves are not changed.

## 4. Errors, testing, scope

### Behaviour

| Case | Behaviour |
|---|---|
| Nothing heard / empty transcript | "Say or type what needs doing." — Make draft disabled |
| Mic blocked / unsupported | typing mode with the explanation |
| No work type (task) | ⚠ Work type needs you — picker; Create disabled |
| Name matches two people / nobody | ⚠ Assign to — choices, or "Nobody named 'X' on this project" |
| Past weekday | next occurrence, ✨ guessed |
| Command refuses | existing error message; the draft stays open |
| Source message unreadable / mismatched | `PermissionError` / `IntegrityError` |

### Tests (Vitest, written first)

- Extractor: about 30 example sentences across task / issue / progress — dates (including month rollover and past weekdays), names (including duplicates and unknown names), units, work-type keywords, quantities and units, priority / severity words, the today / tomorrow / blocker split, people count, title cleanup, and empty or garbled input.
- Commands: `createTask` / `reportIssue` with `source` — saved when valid; refused for a missing message, a message from another thread or project, or a thread the caller can't read.
- Selector: message chips list only records the viewer can read.
- Browser walkthrough (typed input — the preview has no mic): Speak a task → fix a ⚠ field → create and assign; Fill from voice on worker Log progress → add a photo → submit; Speak an issue from Task detail; turn a task-thread message into an issue → chip on the message and "From conversation" on the issue. Real speech is checked manually in Chrome.

### Not in this build

AI extraction (plugs into the same interface later), saved or queued drafts, Hindi / Telugu / Hinglish rules, storing audio of voice commands, progress for several tasks from one recording, a global voice button.

## Acceptance

```text
Speak (or type) → transcript → editable draft with Heard / Guessed / Needs-you markers
→ user fixes and confirms → the existing command saves the record (permissions enforced)
→ from chat: the record links back to the message, and the message shows the link
Nothing is created or changed without the user's confirmation.
```

Existing checks still pass: `pnpm run typecheck`, `pnpm run test`, `pnpm run build`.
