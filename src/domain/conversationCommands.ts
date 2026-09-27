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
