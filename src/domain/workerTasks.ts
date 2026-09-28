import type {
  ConstructionDataState,
  EntityId,
  EvidenceType,
  Task,
  TaskAssignment,
  TaskChecklistItem,
  TaskStatus,
  TaskTemplate,
  Worker,
} from "./models"
import type { Session } from "./session"
import { samePhone } from "./phone"
import { canTransitionTask } from "./taskTransitions"

/**
 * Worker experience (Phase 4). A worker signs in as a `worker` session whose
 * person is linked to a Worker record (`Worker.userId`). What they may *do* on
 * a project still comes from their scoped `worker` project membership, the
 * same rule every other command uses; these helpers only decide what the
 * worker app shows ("what do I need to do today?").
 */

/** The Worker record the session signs in as, if any. */
export function workerForSession(
  state: ConstructionDataState,
  session: Session | null,
): Worker | undefined {
  if (session?.accountType !== "worker") return undefined
  return state.workers.find(
    (worker) =>
      worker.userId === session.personId &&
      worker.organizationId === session.organizationId &&
      worker.status === "active",
  )
}

/** The worker's live assignment on a task (declined ones don't count). */
export function workerAssignment(
  state: ConstructionDataState,
  workerId: EntityId,
  taskId: EntityId,
): TaskAssignment | undefined {
  return state.assignments.find(
    (assignment) =>
      assignment.taskId === taskId &&
      assignment.assigneeType === "worker" &&
      assignment.assigneeId === workerId &&
      assignment.status !== "declined",
  )
}

/** Tasks assigned to the worker, excluding cancelled ones. */
export function tasksAssignedToWorker(
  state: ConstructionDataState,
  workerId: EntityId,
): Task[] {
  const taskIds = new Set(
    state.assignments
      .filter(
        (assignment) =>
          assignment.assigneeType === "worker" &&
          assignment.assigneeId === workerId &&
          assignment.status !== "declined",
      )
      .map((assignment) => assignment.taskId),
  )
  return state.tasks.filter(
    (task) => taskIds.has(task.id) && task.status !== "cancelled",
  )
}

/**
 * The one thing the worker app offers next on a task:
 * - accept: newly assigned, not yet accepted
 * - start: accepted / ready / reopened / blocked / delayed — can go on site
 * - submit: work under way — log today's progress
 * - waiting: submitted, supervisor has not decided yet
 * - done: approved or completed
 */
export type WorkerNextAction = "accept" | "start" | "submit" | "waiting" | "done"

export function workerNextAction(status: TaskStatus): WorkerNextAction {
  switch (status) {
    case "draft":
    case "assigned":
      return "accept"
    case "in-progress":
      return "submit"
    case "submitted":
    case "review":
      return "waiting"
    case "approved":
    case "completed":
    case "cancelled":
      return "done"
    default:
      return "start"
  }
}

/** Statuses from which `startTask` can reach in-progress. */
export function canStartTask(status: TaskStatus): boolean {
  return pathToInProgress(status) !== null
}

/**
 * Legal steps from `status` to in-progress, e.g. accepted → ready →
 * in-progress. Null when in-progress can't be reached (or already is).
 */
export function pathToInProgress(status: TaskStatus): TaskStatus[] | null {
  if (canTransitionTask(status, "in-progress")) return ["in-progress"]
  if (canTransitionTask(status, "ready")) return ["ready", "in-progress"]
  return null
}

export interface WorkerDay {
  /** Newly assigned — accept to take it on. */
  toAccept: Task[]
  /** Accepted or under way — today's work. */
  today: Task[]
  /** Sent in, waiting on the supervisor. */
  waiting: Task[]
  /** Approved or completed. */
  done: Task[]
}

const PRIORITY_RANK: Record<Task["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/** Most urgent first: priority, then earliest due date (undated last). */
function byUrgency(left: Task, right: Task): number {
  return (
    PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority] ||
    (left.dueDate ?? "9999").localeCompare(right.dueDate ?? "9999")
  )
}

/** The worker's assigned tasks grouped for the Today screen. */
export function workerDay(
  state: ConstructionDataState,
  workerId: EntityId,
): WorkerDay {
  const day: WorkerDay = { toAccept: [], today: [], waiting: [], done: [] }
  for (const task of tasksAssignedToWorker(state, workerId).sort(byUrgency)) {
    const action = workerNextAction(task.status)
    if (action === "accept") day.toAccept.push(task)
    else if (action === "waiting") day.waiting.push(task)
    else if (action === "done") day.done.push(task)
    else day.today.push(task)
  }
  return day
}

/**
 * The active, sign-in-capable worker (linked to a person) with this phone.
 * Stand-in for OTP onboarding until real authentication exists.
 */
export function findWorkerByPhone(
  state: ConstructionDataState,
  phone: string,
): Worker | undefined {
  return state.workers.find(
    (worker) =>
      worker.status === "active" &&
      Boolean(worker.userId) &&
      samePhone(worker.phone, phone),
  )
}

/** The task's own template, else the standard one for its work type. */
export function templateForTask(
  state: ConstructionDataState,
  task: Task,
): TaskTemplate | undefined {
  return (
    state.taskTemplates.find((item) => item.id === task.templateId) ??
    state.taskTemplates.find((item) => item.workTypeId === task.workTypeId)
  )
}

/**
 * The task's own checklist, or else its standard template's checks (unticked),
 * so company and worker screens show the same list.
 */
export function taskChecklist(state: ConstructionDataState, task: Task): TaskChecklistItem[] {
  if (task.checklist.length) return task.checklist
  return (templateForTask(state, task)?.checklist ?? []).map((label, index) => ({
    id: `template-${index}`,
    label,
    completed: false,
  }))
}

/**
 * Required evidence types the draft doesn't cover yet. Documents can't be
 * captured on site yet, so they are not demanded.
 */
export function missingRequiredEvidence(
  required: readonly EvidenceType[],
  provided: readonly { type: EvidenceType }[],
): EvidenceType[] {
  return required.filter(
    (type) =>
      type !== "document" && !provided.some((item) => item.type === type),
  )
}
