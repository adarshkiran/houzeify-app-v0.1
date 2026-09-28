import { canMessageDirectly, findThread, readerMembership } from "./conversations"
import { ConflictError, IntegrityError } from "./errors"
import type {
  CallLog,
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

/** Project / homeowner threads have no target; unit / task / issue threads need one. */
function normalizedTarget(
  subject: Exclude<ThreadSubject, "direct">,
  targetId: EntityId | undefined,
): EntityId | undefined {
  if (subject === "project" || subject === "homeowner") return undefined
  if (!targetId) throw new IntegrityError("A unit, task or issue conversation needs its target.")
  return targetId
}

export const postMessage =
  (input: PostMessageInput): Command<Message> =>
  (state, ctx) => {
    const targetId = "threadId" in input ? undefined : normalizedTarget(input.subject, input.targetId)
    const existing =
      "threadId" in input
        ? state.threads.find((thread) => thread.id === input.threadId)
        : findThread(state, input.projectId, input.subject, targetId)
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
          targetId,
          audience: target.subject === "homeowner" ? "homeowner" : "internal",
          createdAt: timestamp,
        }
      })()

    // A unit / task / issue outside the project has no scope target, so no
    // membership can read (or create) its thread.
    const author = readerMembership(state, ctx.actor, thread)
    if (!author) throw new PermissionError(Permissions.PROJECT_READ, thread.projectId)

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
    const me =
      other.principalType === "person" && other.principalId !== ctx.actor.personId
        ? mine.find((m) => canMessageDirectly(m.role, other.role))
        : undefined
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

/** Moves the caller's read marker to just before the latest message from someone else. */
export const markThreadUnread =
  (threadId: EntityId): Command<void> =>
  (state, ctx) => {
    const thread = state.threads.find((item) => item.id === threadId)
    if (!thread) throw new PermissionError(Permissions.PROJECT_READ)
    const reader = readerMembership(state, ctx.actor, thread)
    if (!reader) throw new PermissionError(Permissions.PROJECT_READ, thread.projectId)
    const latest = state.messages
      .filter((message) => message.threadId === thread.id && message.authorMembershipId !== reader.id)
      .reduce<Message | undefined>(
        (last, message) => (!last || Date.parse(message.createdAt) > Date.parse(last.createdAt) ? message : last),
        undefined,
      )
    if (!latest) throw new ConflictError("There's no message from someone else to mark unread.")
    const justBefore = new Date(Date.parse(latest.createdAt) - 1).toISOString()
    return {
      state: { ...state, threadReads: withRead(state.threadReads, thread.id, reader.id, justBefore) },
      result: undefined,
    }
  }

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
    const me = readerMembership(state, ctx.actor, thread)
    if (!me) throw new PermissionError(Permissions.PROJECT_READ, thread.projectId)
    if (thread.subject !== "direct") {
      throw new IntegrityError(`Thread ${thread.id} is not a direct thread`)
    }
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
