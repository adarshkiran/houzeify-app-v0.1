import { attendanceDate, validateTimes } from "./attendance"
import { ConflictError } from "./errors"
import type {
  AttendanceStatus,
  ConstructionDataState,
  EntityId,
  ISODate,
  ISODateTime,
  Project,
  ProjectMembership,
  Worker,
  WorkerAttendance,
  WorkerProjectAssignment,
} from "./models"
import { Permissions, type Permission } from "./permissions"
import { samePhone } from "./phone"
import type { Command, CommandContext } from "./ports"
import { authorizingMembership, PermissionError } from "./session"

/**
 * Attendance commands (Phase 4). A supervisor records a worker's day with
 * `recordAttendance`, and a project's checkout rule is set with
 * `setAttendancePolicy`. Each command takes the current state, a context and an
 * input, and returns the next state plus a result. None of them mutate input.
 */

export interface RecordAttendanceInput {
  projectId: EntityId
  workerId: EntityId
  date: ISODate
  status: AttendanceStatus
  checkInAt?: ISODateTime
  checkOutAt?: ISODateTime
}

export interface WorkerPhoneInput {
  projectId: EntityId
  phone: string
  at: ISODateTime
}

const UNKNOWN_WORKER_OR_PROJECT = "That worker or project no longer exists."

const iso = (ctx: CommandContext) => ctx.clock.now().toISOString()

// ─── Authorization and lookup ────────────────────────────────────────────────

/**
 * Throws unless the actor holds one of `permissions` on the project through an
 * active membership. Same rule as the project-scoped construction commands.
 */
function authorizeProject(
  state: ConstructionDataState,
  ctx: CommandContext,
  projectId: EntityId,
  permissions: Permission[],
): ProjectMembership {
  const membership = authorizingMembership(
    ctx.actor,
    state.memberships,
    state.projectUnits,
    projectId,
    permissions,
    {},
  )
  if (!membership) throw new PermissionError(permissions[0], projectId)
  return membership
}

function projectOrThrow(state: ConstructionDataState, projectId: EntityId): Project {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) throw new ConflictError(UNKNOWN_WORKER_OR_PROJECT)
  return project
}

/**
 * Finds the worker by phone within the project's organization.
 * Identity is the phone number. This is a stand-in for OTP until Phase 11, not authentication.
 */
function workerByPhone(state: ConstructionDataState, project: Project, phone: string): Worker {
  const worker = state.workers.find(
    (item) => item.organizationId === project.organizationId && samePhone(item.phone, phone),
  )
  if (!worker) throw new ConflictError(UNKNOWN_WORKER_OR_PROJECT)
  if (worker.status !== "active") throw new ConflictError("Your account isn't active yet.")
  return worker
}

function findRecord(
  state: ConstructionDataState,
  workerId: EntityId,
  projectId: EntityId,
  date: ISODate,
): WorkerAttendance | undefined {
  return state.workerAttendance.find(
    (record) => record.workerId === workerId && record.projectId === projectId && record.date === date,
  )
}

/** The worker's assignment to the project that is live now (not ended, not invited). */
function activeAssignment(
  state: ConstructionDataState,
  workerId: EntityId,
  projectId: EntityId,
): WorkerProjectAssignment | undefined {
  return state.workerProjectAssignments.find(
    (item) =>
      item.workerId === workerId &&
      item.projectId === projectId &&
      item.status === "active" &&
      !item.endedAt,
  )
}

/**
 * The assignment that covers `date` (A9). It started on or before the date and
 * had not ended before it. Throws the spec §6 refusal when the worker was on
 * the project but the assignment had already ended by that date.
 */
function assignmentForDate(
  state: ConstructionDataState,
  workerId: EntityId,
  projectId: EntityId,
  date: ISODate,
): WorkerProjectAssignment {
  const started = state.workerProjectAssignments.filter(
    (item) =>
      item.workerId === workerId &&
      item.projectId === projectId &&
      item.status !== "invited" &&
      attendanceDate(new Date(item.startedAt ?? item.assignedAt)) <= date,
  )
  const covering = started.find(
    (item) => !item.endedAt || attendanceDate(new Date(item.endedAt)) >= date,
  )
  if (covering) return covering
  if (started.length > 0) {
    throw new ConflictError("This assignment has ended, so attendance can't be changed.")
  }
  throw new ConflictError("This worker wasn't assigned to the project on that date.")
}

function upsert(state: ConstructionDataState, record: WorkerAttendance): ConstructionDataState {
  const exists = state.workerAttendance.some((item) => item.id === record.id)
  return {
    ...state,
    workerAttendance: exists
      ? state.workerAttendance.map((item) => (item.id === record.id ? record : item))
      : [...state.workerAttendance, record],
  }
}

// ─── Supervisor commands ─────────────────────────────────────────────────────

/**
 * Supervisor entry or correction for one worker, project and day. Upserts on
 * (worker, project, date); a day keeps the assignment it was first recorded on (A9).
 */
export const recordAttendance =
  (input: RecordAttendanceInput): Command<WorkerAttendance> =>
  (state, ctx) => {
    const membership = authorizeProject(state, ctx, input.projectId, [Permissions.WORKFORCE_MANAGE])
    const project = projectOrThrow(state, input.projectId)
    const worker = state.workers.find(
      (item) => item.id === input.workerId && item.organizationId === project.organizationId,
    )
    if (!worker) throw new ConflictError(UNKNOWN_WORKER_OR_PROJECT)

    const existing = findRecord(state, input.workerId, input.projectId, input.date)
    const checkInAt = input.checkInAt ?? existing?.checkInAt
    const checkOutAt = input.checkOutAt ?? existing?.checkOutAt
    const refusal = validateTimes(checkInAt, checkOutAt)
    if (refusal) throw refusal

    const assignment = assignmentForDate(state, input.workerId, input.projectId, input.date)
    const at = iso(ctx)
    const record: WorkerAttendance = {
      id: existing?.id ?? ctx.ids.next("attendance"),
      workerId: input.workerId,
      projectId: input.projectId,
      assignmentId: existing?.assignmentId ?? assignment.id,
      date: input.date,
      status: input.status,
      checkInAt,
      checkOutAt,
      recordedBy: "supervisor",
      recordedByMembershipId: membership.id,
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
    }
    return { state: upsert(state, record), result: record }
  }

/** Sets whether a worker's day is incomplete until checked out (A4). */
export const setAttendancePolicy =
  (projectId: EntityId, requireCheckout: boolean): Command<Project> =>
  (state, ctx) => {
    authorizeProject(state, ctx, projectId, [Permissions.PROJECT_MANAGE])
    const project = projectOrThrow(state, projectId)
    const updated: Project = { ...project, requireCheckout, updatedAt: iso(ctx) }
    return {
      state: {
        ...state,
        projects: state.projects.map((item) => (item.id === projectId ? updated : item)),
      },
      result: updated,
    }
  }

// ─── Worker commands ─────────────────────────────────────────────────────────

/**
 * Worker check-in for today (Asia/Kolkata). Sets the status to present if none
 * is set, and refuses a second check-in on the same day (A6).
 * Identity is the phone number. This is a stand-in for OTP until Phase 11, not authentication.
 */
export const checkInWorker =
  (input: WorkerPhoneInput): Command<WorkerAttendance> =>
  (state, ctx) => {
    const project = projectOrThrow(state, input.projectId)
    const worker = workerByPhone(state, project, input.phone)
    const assignment = activeAssignment(state, worker.id, input.projectId)
    if (!assignment) throw new ConflictError("You're not assigned to this project.")

    const date = attendanceDate(new Date(input.at))
    const existing = findRecord(state, worker.id, input.projectId, date)
    if (existing?.checkInAt) throw new ConflictError("You've already checked in today.")

    const at = iso(ctx)
    const record: WorkerAttendance = {
      id: existing?.id ?? ctx.ids.next("attendance"),
      workerId: worker.id,
      projectId: input.projectId,
      assignmentId: existing?.assignmentId ?? assignment.id,
      date,
      status: existing?.status ?? "present",
      checkInAt: input.at,
      checkOutAt: existing?.checkOutAt,
      recordedBy: "worker",
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
    }
    return { state: upsert(state, record), result: record }
  }

/**
 * Worker check-out. Needs a check-in for the same day. Allowed after the
 * assignment has ended, so a worker can always close a day they opened (A8).
 * Identity is the phone number. This is a stand-in for OTP until Phase 11, not authentication.
 */
export const checkOutWorker =
  (input: WorkerPhoneInput): Command<WorkerAttendance> =>
  (state, ctx) => {
    const project = projectOrThrow(state, input.projectId)
    const worker = workerByPhone(state, project, input.phone)

    const date = attendanceDate(new Date(input.at))
    const existing = findRecord(state, worker.id, input.projectId, date)
    if (!existing?.checkInAt) throw new ConflictError("Check in before you check out.")
    if (existing.checkOutAt) throw new ConflictError("You've already checked out today.")
    const refusal = validateTimes(existing.checkInAt, input.at)
    if (refusal) throw refusal

    const record: WorkerAttendance = {
      ...existing,
      checkOutAt: input.at,
      recordedBy: "worker",
      updatedAt: iso(ctx),
    }
    return { state: upsert(state, record), result: record }
  }
