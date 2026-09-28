import { readerMembership, unreadCount } from "../domain/conversations"
import type {
  CallLog,
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
