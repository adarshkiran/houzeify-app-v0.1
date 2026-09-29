import { ConflictError, IntegrityError } from "./errors"
import { readerMembership } from "./conversations"
import type {
  AddEvidenceInput,
  AddLibraryStageInput,
  AddLibraryTradeInput,
  AddLibraryWorkTypeInput,
  AddProjectUnitInput,
  AddWorkPlanItemInput,
  AddWorkerInput,
  AssignWorkerToProjectInput,
  BusinessProfileInput,
  CreateProjectInput,
  CreateTaskInput,
  InviteProjectMemberInput,
  IssueEvidenceInput,
  ReportIssueInput,
  ResubmitDailyProgressInput,
  SubmitDailyProgressInput,
} from "./commandInputs"
import type {
  ConstructionDataState,
  ConstructionStage,
  DailyProgress,
  EntityId,
  Evidence,
  EvidenceType,
  Issue,
  MessageSource,
  Person,
  Project,
  ProjectMembership,
  ProjectUnit,
  ProgressPublication,
  ProgressReview,
  Quantity,
  ReviewDecision,
  Task,
  TaskAssignment,
  TaskStatus,
  TaskTemplate,
  Trade,
  WorkPlanItem,
  WorkType,
  Worker,
  WorkerProjectAssignment,
} from "./models"
import {
  ISSUE_REPORT_PERMISSIONS,
  Permissions,
  permissionsForRole,
  type Permission,
} from "./permissions"
import { samePhone } from "./phone"
import type { Command, CommandContext } from "./ports"
import { canTransitionIssue } from "./issueTransitions"
import { calculateProjectProgress } from "./progress"
import { defaultRootUnitForKind } from "./projectSetup"
import {
  authorizingMembership,
  PermissionError,
  type ScopeTarget,
} from "./session"
import {
  canTransitionTask,
  isSiteTaskStatus,
  statusAfterChangesRequested,
  statusAfterProgressApproval,
  statusAfterProgressRejection,
  statusAfterProgressSubmit,
} from "./taskTransitions"
import { slugifyLibraryName } from "./workLibrary"
import {
  pathToInProgress,
  workerAssignment,
  workerForSession,
} from "./workerTasks"

/**
 * Pure construction-data commands. Each takes the current state, a context
 * (actor, clock, ids) and an input, and returns the next state plus a result.
 * No React, no globals: the same inputs always give the same outputs.
 *
 * Authorization lives here so it holds regardless of which UI calls a command.
 */

// ─── Authorization ────────────────────────────────────────────────────────────

/**
 * Throws unless the actor holds one of `permissions` on the project through an
 * active membership whose scope covers `target`. Returns that membership, which
 * is also who the resulting record is attributed to. The default target is a
 * whole-project operation, so unit/stage/trade-scoped members are denied.
 */
function authorizeProject(
  state: ConstructionDataState,
  ctx: CommandContext,
  projectId: EntityId,
  permissions: Permission[],
  target: ScopeTarget = {},
): ProjectMembership {
  const membership = authorizingMembership(
    ctx.actor,
    state.memberships,
    state.projectUnits,
    projectId,
    permissions,
    target,
  )
  if (!membership) throw new PermissionError(permissions[0], projectId)
  return membership
}

/** Throws unless the actor is a business user (of `organizationId`, if given). */
function authorizeOrganization(
  ctx: CommandContext,
  organizationId: EntityId | undefined,
  permission: Permission,
) {
  const { actor } = ctx
  if (
    actor?.accountType !== "business" ||
    (organizationId && actor.organizationId !== organizationId)
  ) {
    throw new PermissionError(permission)
  }
}

/** Project of a task, or a PermissionError if the task is unknown. */
function projectIdOfTask(
  state: ConstructionDataState,
  taskId: EntityId,
  permission: Permission,
): EntityId {
  const projectId = state.tasks.find((task) => task.id === taskId)?.projectId
  if (!projectId) throw new PermissionError(permission)
  return projectId
}

/** Scope target for a task's own unit, stage and trade. */
function taskTarget(task: Task): ScopeTarget {
  return {
    projectUnitId: task.projectUnitId,
    stageId: task.stageId,
    tradeId: task.tradeId,
  }
}

/** Every unit x trade combination an assignment touches (empty list = whole project). */
function assignmentTargets(
  projectUnitIds: readonly EntityId[] | undefined,
  tradeIds: readonly EntityId[] | undefined,
): ScopeTarget[] {
  const units = projectUnitIds?.length ? projectUnitIds : [undefined]
  const trades = tradeIds?.length ? tradeIds : [undefined]
  return units.flatMap((projectUnitId) =>
    trades.map((tradeId) => ({ projectUnitId, tradeId })),
  )
}

function projectOrThrow(state: ConstructionDataState, projectId: EntityId) {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) throw new IntegrityError(`Unknown project ${projectId}`)
  return project
}

/**
 * Recalculates a project's stored progress from its tasks. Every command that
 * changes a project's tasks runs its new state through this, so the stored
 * figure never drifts from the calculation. updatedAt moves only on a change.
 */
function withProjectProgress(
  state: ConstructionDataState,
  projectId: EntityId,
  timestamp: string,
): ConstructionDataState {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return state
  const progress = calculateProjectProgress(project, state.stages, state.tasks)
  if (progress === project.progress) return state
  return {
    ...state,
    projects: state.projects.map((item) =>
      item.id === projectId ? { ...project, progress, updatedAt: timestamp } : item,
    ),
  }
}

function assertUnitInProject(
  state: ConstructionDataState,
  projectId: EntityId,
  unitId: EntityId | undefined,
) {
  if (!unitId) return
  const unit = state.projectUnits.find((item) => item.id === unitId)
  if (!unit || unit.projectId !== projectId) {
    throw new IntegrityError(`Unit ${unitId} does not belong to project ${projectId}`)
  }
}

function assertTaskInProject(
  state: ConstructionDataState,
  projectId: EntityId,
  taskId: EntityId | undefined,
) {
  if (!taskId) return
  const task = state.tasks.find((item) => item.id === taskId)
  if (!task || task.projectId !== projectId) {
    throw new IntegrityError(`Task ${taskId} does not belong to project ${projectId}`)
  }
}

/** The stage and trade must be the ones the work type is defined under. */
function assertWorkTypeMatches(
  state: ConstructionDataState,
  ref: { workTypeId: EntityId; stageId: EntityId; tradeId: EntityId },
) {
  const workType = state.workTypes.find((item) => item.id === ref.workTypeId)
  if (
    !workType ||
    workType.stageId !== ref.stageId ||
    workType.tradeId !== ref.tradeId
  ) {
    throw new IntegrityError(
      `Work type ${ref.workTypeId} does not match stage ${ref.stageId} / trade ${ref.tradeId}`,
    )
  }
}

/** A source message must exist, sit in its thread, belong to the project, and be readable by the caller. */
function assertSourceMessage(
  state: ConstructionDataState,
  ctx: CommandContext,
  projectId: EntityId,
  source?: MessageSource,
) {
  if (!source) return
  const thread = state.threads.find((item) => item.id === source.threadId)
  const message = state.messages.find((item) => item.id === source.messageId)
  if (!thread || !message || message.threadId !== thread.id) {
    throw new IntegrityError("The conversation message for this record wasn't found.")
  }
  if (thread.projectId !== projectId) {
    throw new IntegrityError(`Message ${message.id} is not in project ${projectId}`)
  }
  if (!readerMembership(state, ctx.actor, thread)) {
    throw new PermissionError(Permissions.PROJECT_READ, projectId)
  }
}

const iso = (ctx: CommandContext) => ctx.clock.now().toISOString()

function todayISODate(ctx: CommandContext) {
  const now = ctx.clock.now()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

// ─── Organization & project setup ─────────────────────────────────────────────

/** Deliberately unauthorized: business onboarding fills the profile before sign-in. */
export const updateOrganizationProfile =
  (organizationId: EntityId, input: BusinessProfileInput): Command<void> =>
  (state) => ({
    state: {
      ...state,
      organizations: state.organizations.map((organization) =>
        organization.id === organizationId
          ? { ...organization, ...input, status: "active" }
          : organization,
      ),
    },
    result: undefined,
  })

export const createProject =
  (input: CreateProjectInput): Command<Project> =>
  (state, ctx) => {
    authorizeOrganization(ctx, input.organizationId, Permissions.PROJECT_MANAGE)
    const id = ctx.ids.next("project")
    const timestamp = iso(ctx)
    const project: Project = {
      id,
      organizationId: input.organizationId,
      code: input.code,
      name: input.name,
      kind: input.kind,
      status: input.status,
      location: input.location,
      startDate: input.startDate,
      targetDate: input.targetDate,
      progress: 0,
      trackingStartedMidProject: input.trackingStartedMidProject,
      stageBaselines: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const root = defaultRootUnitForKind(input.kind)
    const rootUnit: ProjectUnit | null = root
      ? {
          id: ctx.ids.next("unit"),
          projectId: id,
          kind: root.kind,
          code: root.code,
          name: root.name,
          status: "active",
          sequence: 1,
        }
      : null

    const creator = state.people.find(
      (person) => person.id === ctx.actor?.personId,
    )
    const membership: ProjectMembership | null = creator
      ? {
          id: ctx.ids.next("membership"),
          projectId: id,
          principalType: "person",
          principalId: creator.id,
          role: "project-manager",
          scope: { projectUnitIds: [], stageIds: [], tradeIds: [] },
          permissions: permissionsForRole("project-manager"),
          status: "active",
        }
      : null

    return {
      state: {
        ...state,
        projects: [...state.projects, project],
        projectUnits: rootUnit
          ? [...state.projectUnits, rootUnit]
          : state.projectUnits,
        memberships: membership
          ? [...state.memberships, membership]
          : state.memberships,
      },
      result: project,
    }
  }

/** Records how complete each stage was when tracking started, and refreshes project %. */
export const setStageBaselines =
  (projectId: EntityId, baselines: Record<EntityId, number>): Command<Project> =>
  (state, ctx) => {
    authorizeProject(state, ctx, projectId, [Permissions.PROJECT_MANAGE])
    const project = projectOrThrow(state, projectId)
    for (const [stageId, value] of Object.entries(baselines)) {
      if (!state.stages.some((stage) => stage.id === stageId)) {
        throw new IntegrityError(`Unknown stage ${stageId}`)
      }
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new ConflictError("Stage baselines must be between 0 and 100.")
      }
    }
    const withBaselines: Project = { ...project, stageBaselines: { ...baselines } }
    const updated: Project = {
      ...withBaselines,
      progress: calculateProjectProgress(withBaselines, state.stages, state.tasks),
      updatedAt: iso(ctx),
    }
    return {
      state: {
        ...state,
        projects: state.projects.map((item) => (item.id === projectId ? updated : item)),
      },
      result: updated,
    }
  }

function buildUnit(
  units: readonly ProjectUnit[],
  input: AddProjectUnitInput,
  ctx: CommandContext,
): ProjectUnit {
  const siblings = units.filter(
    (unit) =>
      unit.projectId === input.projectId &&
      unit.parentUnitId === input.parentUnitId,
  )
  return {
    id: ctx.ids.next("unit"),
    projectId: input.projectId,
    parentUnitId: input.parentUnitId,
    kind: input.kind,
    code: input.code,
    name: input.name,
    status: "planned",
    sequence: siblings.length + 1,
  }
}

export const addProjectUnits =
  (inputs: readonly AddProjectUnitInput[]): Command<ProjectUnit[]> =>
  (state, ctx) => {
    for (const input of inputs) {
      // Beneath a parent unit needs that unit in scope; a root unit is whole-project.
      authorizeProject(state, ctx, input.projectId, [Permissions.PROJECT_MANAGE], {
        projectUnitId: input.parentUnitId,
      })
      assertUnitInProject(state, input.projectId, input.parentUnitId)
    }
    // Sequence numbers depend on earlier units in the same batch.
    let units: ProjectUnit[] = state.projectUnits
    const created: ProjectUnit[] = []
    for (const input of inputs) {
      const unit = buildUnit(units, input, ctx)
      units = [...units, unit]
      created.push(unit)
    }
    return { state: { ...state, projectUnits: units }, result: created }
  }

export const addProjectUnit =
  (input: AddProjectUnitInput): Command<ProjectUnit> =>
  (state, ctx) => {
    const { state: next, result } = addProjectUnits([input])(state, ctx)
    return { state: next, result: result[0] }
  }

export const inviteProjectMember =
  (input: InviteProjectMemberInput): Command<ProjectMembership> =>
  (state, ctx) => {
    authorizeProject(state, ctx, input.projectId, [Permissions.PROJECT_MANAGE])
    if (input.phone) {
      const teamPersonIds = new Set(
        state.memberships
          .filter((m) => m.projectId === input.projectId && m.principalType === "person")
          .map((m) => m.principalId),
      )
      if (state.people.some((p) => teamPersonIds.has(p.id) && samePhone(p.phone, input.phone))) {
        throw new ConflictError("Someone with this phone number is already on the project team.")
      }
    }
    const person: Person = {
      id: ctx.ids.next("person"),
      name: input.name,
      phone: input.phone,
      email: input.email,
    }
    const membership: ProjectMembership = {
      id: ctx.ids.next("membership"),
      projectId: input.projectId,
      principalType: "person",
      principalId: person.id,
      role: input.role,
      scope: {
        projectUnitIds: input.projectUnitIds ?? [],
        stageIds: [],
        tradeIds: [],
      },
      permissions: permissionsForRole(input.role),
      status: "invited",
    }
    return {
      state: {
        ...state,
        people: [...state.people, person],
        memberships: [...state.memberships, membership],
      },
      result: membership,
    }
  }

// ─── Work plan & tasks ────────────────────────────────────────────────────────

export const addWorkPlanItem =
  (input: AddWorkPlanItemInput): Command<WorkPlanItem> =>
  (state, ctx) => {
    authorizeProject(state, ctx, input.projectId, [Permissions.TASK_MANAGE], input)
    assertUnitInProject(state, input.projectId, input.projectUnitId)
    assertWorkTypeMatches(state, input)
    const item: WorkPlanItem = {
      id: ctx.ids.next("plan"),
      ...input,
      status: "planned",
      createdAt: iso(ctx),
    }
    return {
      state: { ...state, workPlanItems: [...state.workPlanItems, item] },
      result: item,
    }
  }

export const createTask =
  (input: CreateTaskInput): Command<Task> =>
  (state, ctx) => {
    const creator = authorizeProject(state, ctx, input.projectId, [Permissions.TASK_MANAGE], input)
    assertUnitInProject(state, input.projectId, input.projectUnitId)
    assertWorkTypeMatches(state, input)
    assertSourceMessage(state, ctx, input.projectId, input.source)
    const template = state.taskTemplates.find(
      (item) => item.id === input.templateId,
    )
    const timestamp = iso(ctx)
    const task: Task = {
      id: ctx.ids.next("task"),
      ...input,
      status: "draft",
      checklist: (template?.checklist ?? []).map((label, index) => ({
        id: `check-${index + 1}`,
        label,
        completed: false,
      })),
      createdByMembershipId: creator.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    return {
      state: withProjectProgress(
        { ...state, tasks: [...state.tasks, task] },
        input.projectId,
        timestamp,
      ),
      result: task,
    }
  }

export const assignTask =
  (
    taskId: EntityId,
    assigneeType: TaskAssignment["assigneeType"],
    assigneeId: EntityId,
  ): Command<TaskAssignment> =>
  (state, ctx) => {
    const projectId = projectIdOfTask(state, taskId, Permissions.TASK_MANAGE)
    const task = state.tasks.find((item) => item.id === taskId)!
    const assigner = authorizeProject(
      state, ctx, projectId, [Permissions.TASK_MANAGE], taskTarget(task),
    )

    if (assigneeType === "worker") {
      const project = projectOrThrow(state, projectId)
      const worker = state.workers.find((item) => item.id === assigneeId)
      if (!worker || worker.organizationId !== project.organizationId) {
        throw new IntegrityError(`Worker ${assigneeId} is not in this organization`)
      }
      const onProject = state.workerProjectAssignments.some(
        (item) =>
          item.workerId === assigneeId &&
          item.projectId === projectId &&
          item.status === "active",
      )
      if (!onProject) {
        throw new IntegrityError(
          `Worker ${assigneeId} is not assigned to project ${projectId}`,
        )
      }
    } else if (assigneeType === "membership") {
      const member = state.memberships.find((item) => item.id === assigneeId)
      if (!member || member.projectId !== projectId) {
        throw new IntegrityError(`Membership ${assigneeId} is not on project ${projectId}`)
      }
    }

    const existing = state.assignments.find(
      (item) =>
        item.taskId === taskId &&
        item.assigneeType === assigneeType &&
        item.assigneeId === assigneeId &&
        item.status !== "declined",
    )
    if (existing) return { state, result: existing }

    const timestamp = iso(ctx)
    const assignment: TaskAssignment = {
      id: ctx.ids.next("assignment"),
      taskId,
      assigneeType,
      assigneeId,
      assignedByMembershipId: assigner.id,
      status: "assigned",
      assignedAt: timestamp,
    }
    return {
      state: withProjectProgress(
        {
          ...state,
          assignments: [...state.assignments, assignment],
          tasks: state.tasks.map((item) =>
            item.id === taskId && item.status === "draft"
              ? { ...item, status: "assigned", updatedAt: timestamp }
              : item,
          ),
        },
        projectId,
        timestamp,
      ),
      result: assignment,
    }
  }

export const transitionTask =
  (taskId: EntityId, nextStatus: TaskStatus): Command<void> =>
  (state, ctx) => {
    const projectId = projectIdOfTask(state, taskId, Permissions.TASK_MANAGE)
    const task = state.tasks.find((item) => item.id === taskId)!
    authorizeTaskMove(state, ctx, task, nextStatus)
    const timestamp = iso(ctx)
    return {
      state: withProjectProgress(
        {
          ...state,
          tasks: state.tasks.map((task) =>
            task.id !== taskId || !canTransitionTask(task.status, nextStatus)
              ? task
              : { ...task, status: nextStatus, updatedAt: timestamp },
          ),
        },
        projectId,
        timestamp,
      ),
      result: undefined,
    }
  }

/**
 * Task managers may make any legal move. Site members who can only log
 * progress may make the site moves (accept, get ready, start, flag a block)
 * but not review outcomes or planning moves.
 */
function authorizeTaskMove(
  state: ConstructionDataState,
  ctx: CommandContext,
  task: Task,
  nextStatus: TaskStatus,
): ProjectMembership {
  const target = taskTarget(task)
  const manager = authorizingMembership(
    ctx.actor,
    state.memberships,
    state.projectUnits,
    task.projectId,
    [Permissions.TASK_MANAGE],
    target,
  )
  if (manager) return manager
  const siteMember = authorizeProject(
    state,
    ctx,
    task.projectId,
    [Permissions.PROGRESS_SUBMIT],
    target,
  )
  if (!isSiteTaskStatus(nextStatus)) {
    throw new PermissionError(Permissions.TASK_MANAGE, task.projectId)
  }
  return siteMember
}

/**
 * For a worker account: the Worker it signs in as and their assignment on the
 * task. Workers act only on tasks assigned to them. Other accounts get null.
 */
function workerOnTask(
  state: ConstructionDataState,
  ctx: CommandContext,
  task: Task,
): { worker: Worker; assignment: TaskAssignment } | null {
  if (ctx.actor?.accountType !== "worker") return null
  const worker = workerForSession(state, ctx.actor)
  if (!worker) throw new PermissionError(Permissions.PROGRESS_SUBMIT, task.projectId)
  const assignment = workerAssignment(state, worker.id, task.id)
  if (!assignment) throw new ConflictError("This task isn't assigned to you.")
  return { worker, assignment }
}

function taskOrThrow(
  state: ConstructionDataState,
  taskId: EntityId,
  permission: Permission,
): Task {
  const task = state.tasks.find((item) => item.id === taskId)
  if (!task) throw new PermissionError(permission)
  return task
}

/**
 * A worker takes on a task assigned to them: their assignment becomes
 * accepted, and a task still waiting on acceptance moves to accepted.
 */
export const acceptTaskAssignment =
  (taskId: EntityId): Command<void> =>
  (state, ctx) => {
    const task = taskOrThrow(state, taskId, Permissions.PROGRESS_SUBMIT)
    const onTask = workerOnTask(state, ctx, task)
    if (!onTask) throw new PermissionError(Permissions.PROGRESS_SUBMIT, task.projectId)
    authorizeProject(state, ctx, task.projectId, [Permissions.PROGRESS_SUBMIT], taskTarget(task))
    const { assignment } = onTask
    const taskAccepts = canTransitionTask(task.status, "accepted")
    if (assignment.status !== "assigned" && !taskAccepts) {
      return { state, result: undefined }
    }
    const timestamp = iso(ctx)
    return {
      state: withProjectProgress(
        {
          ...state,
          assignments: state.assignments.map((item) =>
            item.id === assignment.id && item.status === "assigned"
              ? { ...item, status: "accepted" }
              : item,
          ),
          tasks: state.tasks.map((item) =>
            item.id === task.id && taskAccepts
              ? { ...item, status: "accepted", updatedAt: timestamp }
              : item,
          ),
        },
        task.projectId,
        timestamp,
      ),
      result: undefined,
    }
  }

/**
 * Start work on site: walks the legal path to in-progress (accepted → ready
 * → in-progress). Workers must have accepted the task first.
 */
export const startTask =
  (taskId: EntityId): Command<void> =>
  (state, ctx) => {
    const task = taskOrThrow(state, taskId, Permissions.PROGRESS_SUBMIT)
    authorizeTaskMove(state, ctx, task, "in-progress")
    const onTask = workerOnTask(state, ctx, task)
    if (onTask && onTask.assignment.status === "assigned") {
      throw new ConflictError("Accept the task before starting it.")
    }
    if (!pathToInProgress(task.status)) {
      throw new ConflictError(`This task can't be started while it is ${task.status}.`)
    }
    const timestamp = iso(ctx)
    return {
      state: withProjectProgress(
        {
          ...state,
          tasks: state.tasks.map((item) =>
            item.id === task.id
              ? { ...item, status: "in-progress", updatedAt: timestamp }
              : item,
          ),
        },
        task.projectId,
        timestamp,
      ),
      result: undefined,
    }
  }

// ─── Workforce ────────────────────────────────────────────────────────────────

function buildAssignment(
  ctx: CommandContext,
  assignedByMembershipId: EntityId,
  input: {
    workerId: EntityId
    projectId: EntityId
    projectUnitIds?: EntityId[]
    tradeIds?: EntityId[]
    role?: WorkerProjectAssignment["role"]
  },
): WorkerProjectAssignment {
  return {
    id: ctx.ids.next("wpa"),
    workerId: input.workerId,
    projectId: input.projectId,
    projectUnitIds: input.projectUnitIds ?? [],
    tradeIds: input.tradeIds ?? [],
    role: input.role ?? "worker",
    status: "active",
    assignedAt: iso(ctx),
    assignedByMembershipId,
  }
}

/**
 * A worker who can sign in (linked to a person) acts on a project through a
 * `worker` membership scoped like their assignment. Returns the membership to
 * add, or null when the worker can't sign in or already has one.
 */
function workerMembershipFor(
  state: ConstructionDataState,
  ctx: CommandContext,
  worker: Worker,
  assignment: WorkerProjectAssignment,
): ProjectMembership | null {
  if (!worker.userId) return null
  const alreadyMember = state.memberships.some(
    (item) =>
      item.projectId === assignment.projectId &&
      item.principalType === "person" &&
      item.principalId === worker.userId &&
      item.role === "worker" &&
      item.status === "active",
  )
  if (alreadyMember) return null
  return {
    id: ctx.ids.next("membership"),
    projectId: assignment.projectId,
    principalType: "person",
    principalId: worker.userId,
    role: "worker",
    scope: {
      projectUnitIds: [...assignment.projectUnitIds],
      stageIds: [],
      tradeIds: [...assignment.tradeIds],
    },
    permissions: permissionsForRole("worker"),
    status: "active",
  }
}

export const assignWorkerToProject =
  (input: AssignWorkerToProjectInput): Command<WorkerProjectAssignment> =>
  (state, ctx) => {
    const memberships = assignmentTargets(input.projectUnitIds, input.tradeIds).map(
      (target) =>
        authorizeProject(state, ctx, input.projectId, [Permissions.WORKFORCE_MANAGE], target),
    )
    const project = projectOrThrow(state, input.projectId)
    const worker = state.workers.find((item) => item.id === input.workerId)
    if (!worker || worker.organizationId !== project.organizationId) {
      throw new IntegrityError(
        `Worker ${input.workerId} is not in the organization that owns project ${input.projectId}`,
      )
    }
    for (const unitId of input.projectUnitIds ?? []) {
      assertUnitInProject(state, input.projectId, unitId)
    }
    const assigner = memberships[0]
    // A worker has at most one active assignment per project; re-assigning
    // returns the existing one instead of a record that was never stored.
    const existing = state.workerProjectAssignments.find(
      (item) =>
        item.workerId === input.workerId &&
        item.projectId === input.projectId &&
        item.status === "active",
    )
    if (existing) return { state, result: existing }
    const assignment = buildAssignment(ctx, assigner.id, input)
    const membership = workerMembershipFor(state, ctx, worker, assignment)
    return {
      state: {
        ...state,
        workerProjectAssignments: [
          ...state.workerProjectAssignments,
          assignment,
        ],
        memberships: membership
          ? [...state.memberships, membership]
          : state.memberships,
      },
      result: assignment,
    }
  }

export const addWorker =
  (
    input: AddWorkerInput,
  ): Command<{ worker: Worker; assignment?: WorkerProjectAssignment }> =>
  (state, ctx) => {
    authorizeOrganization(
      ctx,
      input.organizationId,
      Permissions.WORKFORCE_MANAGE,
    )
    if (
      input.phone &&
      state.workers.some(
        (w) => w.organizationId === input.organizationId && samePhone(w.phone, input.phone),
      )
    ) {
      throw new ConflictError("A worker with this phone number already exists in your organization.")
    }
    const projectMemberships = input.projectId
      ? assignmentTargets(input.projectUnitIds, input.tradeIds).map((target) =>
          authorizeProject(
            state,
            ctx,
            input.projectId!,
            [Permissions.WORKFORCE_MANAGE],
            target,
          ),
        )
      : []
    if (input.projectId) {
      if (projectOrThrow(state, input.projectId).organizationId !== input.organizationId) {
        throw new IntegrityError(
          `Project ${input.projectId} belongs to a different organization`,
        )
      }
      for (const unitId of input.projectUnitIds ?? []) {
        assertUnitInProject(state, input.projectId, unitId)
      }
    }
    const worker: Worker = {
      id: `worker-${ctx.ids.short()}`,
      organizationId: input.organizationId,
      name: input.name.trim(),
      phone: input.phone?.trim() || undefined,
      tradeIds: input.tradeIds,
      preferredLanguage: input.preferredLanguage ?? "en",
      onboardingMethod: input.onboardingMethod ?? "manual",
      status: "active",
    }
    const assignment = input.projectId
      ? buildAssignment(
          ctx,
          projectMemberships[0].id,
          {
            workerId: worker.id,
            projectId: input.projectId,
            projectUnitIds: input.projectUnitIds,
            tradeIds: input.tradeIds,
            role: input.role,
          },
        )
      : undefined
    return {
      state: {
        ...state,
        workers: [...state.workers, worker],
        workerProjectAssignments: assignment
          ? [...state.workerProjectAssignments, assignment]
          : state.workerProjectAssignments,
      },
      result: { worker, assignment },
    }
  }

// ─── Evidence & daily progress ────────────────────────────────────────────────

/** Evidence with its author already resolved from the session by the caller. */
type EvidenceDraft = AddEvidenceInput & { capturedByMembershipId: EntityId }

function buildEvidence(input: EvidenceDraft, ctx: CommandContext): Evidence {
  return {
    id: ctx.ids.next("evidence"),
    projectId: input.projectId,
    projectUnitId: input.projectUnitId,
    taskId: input.taskId,
    dailyProgressId: input.dailyProgressId,
    type: input.type,
    url: input.url,
    thumbnailUrl: input.thumbnailUrl,
    caption: input.caption,
    capturedByMembershipId: input.capturedByMembershipId,
    capturedByWorkerId: input.capturedByWorkerId,
    capturedAt: iso(ctx),
    customerVisibility: input.customerVisibility ?? "review-required",
  }
}

export const addEvidence =
  (input: AddEvidenceInput): Command<Evidence> =>
  (state, ctx) => {
    // Evidence takes the scope of the task it is attached to, else its unit.
    const task = input.taskId
      ? state.tasks.find((item) => item.id === input.taskId)
      : undefined
    const author = authorizeProject(
      state,
      ctx,
      input.projectId,
      [Permissions.EVIDENCE_CAPTURE],
      task ? taskTarget(task) : { projectUnitId: input.projectUnitId },
    )
    assertUnitInProject(state, input.projectId, input.projectUnitId)
    assertTaskInProject(state, input.projectId, input.taskId)
    const evidence = buildEvidence(
      { ...input, capturedByMembershipId: author.id },
      ctx,
    )
    return {
      state: { ...state, evidence: [...state.evidence, evidence] },
      result: evidence,
    }
  }

export const submitDailyProgress =
  (input: SubmitDailyProgressInput): Command<DailyProgress> =>
  (state, ctx) => {
    const submitterMembership = authorizeProject(
      state, ctx, input.projectId, [Permissions.PROGRESS_SUBMIT], input,
    )
    const project = projectOrThrow(state, input.projectId)
    assertUnitInProject(state, input.projectId, input.projectUnitId)
    assertTaskInProject(state, input.projectId, input.taskId)
    assertWorkTypeMatches(state, input)
    const linkedTask = input.taskId
      ? state.tasks.find((item) => item.id === input.taskId)
      : undefined
    if (linkedTask && linkedTask.projectUnitId !== input.projectUnitId) {
      throw new IntegrityError(`Task ${linkedTask.id} is not at unit ${input.projectUnitId}`)
    }
    // Workers log progress only on tasks assigned to them, and their
    // evidence is always attributed to them.
    let workerId: EntityId | undefined
    if (ctx.actor?.accountType === "worker") {
      if (!linkedTask) throw new ConflictError("Choose the task this update is for.")
      workerId = workerOnTask(state, ctx, linkedTask)!.worker.id
    }
    if (
      input.completedQuantity &&
      !(Number.isFinite(input.completedQuantity.value) && input.completedQuantity.value >= 0)
    ) {
      throw new ConflictError("Enter the quantity completed today as a number, 0 or more.")
    }
    const progressId = ctx.ids.next("progress")
    const timestamp = iso(ctx)
    const submitter = submitterMembership.id
    const evidence = input.evidence.map((item) =>
      buildEvidence(
        {
          ...item,
          projectId: input.projectId,
          projectUnitId: input.projectUnitId,
          taskId: input.taskId,
          dailyProgressId: progressId,
          capturedByMembershipId: submitter,
          capturedByWorkerId: workerId ?? item.capturedByWorkerId,
          // Voice notes are internal site communication; they never go to
          // the customer. Photos, video and documents wait for review.
          customerVisibility: item.type === "audio" ? "private" : "review-required",
        },
        ctx,
      ),
    )
    const progress: DailyProgress = {
      id: progressId,
      projectId: input.projectId,
      projectUnitId: input.projectUnitId,
      taskId: input.taskId,
      stageId: input.stageId,
      tradeId: input.tradeId,
      workTypeId: input.workTypeId,
      date: todayISODate(ctx),
      workersPresent: input.workersPresent,
      plannedQuantity: linkedTask?.plannedQuantity,
      completedQuantity: input.completedQuantity,
      // Only a submitter who reports project % records a before/after.
      progressBefore:
        typeof input.progressAfter === "number" ? project.progress : undefined,
      progressAfter: input.progressAfter,
      yesterdaySummary: input.yesterdaySummary,
      todaySummary: input.todaySummary,
      tomorrowPlan: input.tomorrowPlan,
      blockerSummary: input.blockerSummary,
      evidenceIds: evidence.map((item) => item.id),
      submittedByMembershipId: submitter,
      submittedAt: timestamp,
      reviewStatus: "submitted",
      publicationStatus: "private",
      version: 1,
    }
    return {
      state: withProjectProgress(
        {
          ...state,
          evidence: [...state.evidence, ...evidence],
          dailyProgress: [progress, ...state.dailyProgress],
          tasks: state.tasks.map((task) => {
            if (task.id !== input.taskId) return task
            const nextStatus = statusAfterProgressSubmit(task.status)
            return nextStatus
              ? { ...task, status: nextStatus, updatedAt: timestamp }
              : task
          }),
        },
        input.projectId,
        timestamp,
      ),
      result: progress,
    }
  }

/**
 * Sends a fixed version of an update the reviewer sent back. Builds the new
 * version through submitDailyProgress (same checks, same task move), then
 * links the two; the earlier version is kept as it was, marked superseded.
 */
export const resubmitDailyProgress =
  (
    previousId: EntityId,
    input: ResubmitDailyProgressInput,
  ): Command<DailyProgress> =>
  (state, ctx) => {
    const previous = state.dailyProgress.find((item) => item.id === previousId)
    if (!previous) throw new PermissionError(Permissions.PROGRESS_SUBMIT)
    // Authorize against the stored record's project before anything else, so
    // an outsider gets a PermissionError instead of a status/evidence check
    // leaking whether this record exists and what state it's in.
    const submitter = authorizeProject(
      state, ctx, previous.projectId, [Permissions.PROGRESS_SUBMIT], previous,
    )
    if (submitter.id !== previous.submittedByMembershipId) {
      throw new PermissionError(Permissions.PROGRESS_SUBMIT, previous.projectId)
    }
    if (previous.reviewStatus !== "changes-requested") {
      throw new ConflictError("Only an update sent back for changes can be resubmitted.")
    }
    const { keepEvidenceIds, ...rest } = input
    for (const id of keepEvidenceIds) {
      if (!previous.evidenceIds.includes(id)) {
        throw new IntegrityError(`Evidence ${id} is not on update ${previousId}`)
      }
    }

    const submitted = submitDailyProgress({
      ...rest,
      projectId: previous.projectId,
      projectUnitId: previous.projectUnitId,
      taskId: previous.taskId,
      stageId: previous.stageId,
      tradeId: previous.tradeId,
      workTypeId: previous.workTypeId,
    })(state, ctx)
    const created = submitted.result

    const next: DailyProgress = {
      ...created,
      version: previous.version + 1,
      supersedesId: previous.id,
      evidenceIds: [...keepEvidenceIds, ...created.evidenceIds],
    }
    return {
      state: {
        ...submitted.state,
        dailyProgress: submitted.state.dailyProgress.map((item) =>
          item.id === created.id
            ? next
            : item.id === previous.id
              ? { ...item, reviewStatus: "superseded" as const, supersededById: created.id }
              : item,
        ),
        evidence: submitted.state.evidence.map((item) =>
          keepEvidenceIds.includes(item.id)
            ? { ...item, dailyProgressId: created.id }
            : item,
        ),
      },
      result: next,
    }
  }

/** Running total of approved quantity; mismatched units keep the total unchanged. */
function addQuantity(
  total: Quantity | undefined,
  added: Quantity | undefined,
): Quantity | undefined {
  if (!added) return total
  if (!total) return { ...added }
  if (total.unit !== added.unit) return total
  return { unit: total.unit, value: total.value + added.value }
}

const NOTE_REQUIRED: Record<Exclude<ReviewDecision, "approve">, string> = {
  "request-changes": "Add a note so the worker knows what to fix.",
  reject: "Add a note saying why this update is rejected.",
}

export const reviewDailyProgress =
  (
    progressId: EntityId,
    decision: ReviewDecision,
    note?: string,
  ): Command<void> =>
  (state, ctx) => {
    // Authorize against the stored item's project, never a caller-supplied one.
    const progress = state.dailyProgress.find((item) => item.id === progressId)
    if (!progress) throw new PermissionError(Permissions.PROGRESS_REVIEW)
    const reviewer = authorizeProject(
      state,
      ctx,
      progress.projectId,
      [Permissions.PROGRESS_REVIEW],
      progress,
    )
    // Only a waiting update can be reviewed; a repeat review is a no-op.
    if (progress.reviewStatus !== "submitted") return { state, result: undefined }

    const trimmed = note?.trim() || undefined
    if (decision !== "approve" && !trimmed) {
      throw new ConflictError(NOTE_REQUIRED[decision])
    }

    const timestamp = iso(ctx)
    const review: ProgressReview = {
      decision,
      note: trimmed,
      reviewedByMembershipId: reviewer.id,
      reviewedAt: timestamp,
    }
    const nextReviewStatus: DailyProgress["reviewStatus"] =
      decision === "approve"
        ? "approved"
        : decision === "reject"
          ? "rejected"
          : "changes-requested"
    const dailyProgress = state.dailyProgress.map((item) =>
      item.id === progressId
        ? { ...item, reviewStatus: nextReviewStatus, review }
        : item,
    )

    const tasks = state.tasks.map((task) => {
      if (task.id !== progress.taskId || task.projectId !== progress.projectId) {
        return task
      }
      if (decision === "approve") {
        const nextStatus = statusAfterProgressApproval(task.status)
        const completedQuantity = addQuantity(
          task.completedQuantity,
          progress.completedQuantity,
        )
        return nextStatus === task.status && completedQuantity === task.completedQuantity
          ? task
          : { ...task, status: nextStatus, completedQuantity, updatedAt: timestamp }
      }
      const nextStatus =
        decision === "reject"
          ? statusAfterProgressRejection(task.status)
          : statusAfterChangesRequested(task.status)
      return nextStatus ? { ...task, status: nextStatus, updatedAt: timestamp } : task
    })

    // Every decision can change a task (approve completes it, reject reopens
    // it), so the official figure is recalculated each time. Publishing is separate.
    return {
      state: withProjectProgress(
        { ...state, dailyProgress, tasks },
        progress.projectId,
        timestamp,
      ),
      result: undefined,
    }
  }

/**
 * Shares an approved update with the homeowner. Only the chosen evidence
 * becomes customer-visible; voice notes and review notes never do.
 */
export const publishDailyProgress =
  (progressId: EntityId, evidenceIds: EntityId[]): Command<void> =>
  (state, ctx) => {
    const progress = state.dailyProgress.find((item) => item.id === progressId)
    if (!progress) throw new PermissionError(Permissions.CUSTOMER_PUBLISH)
    const publisher = authorizeProject(
      state,
      ctx,
      progress.projectId,
      [Permissions.CUSTOMER_PUBLISH],
      progress,
    )
    if (progress.publicationStatus === "published") return { state, result: undefined }
    if (progress.reviewStatus !== "approved") {
      throw new ConflictError("Only approved updates can be published.")
    }
    const chosen = [...new Set(evidenceIds)]
    for (const id of chosen) {
      const item = state.evidence.find((evidence) => evidence.id === id)
      if (!item || !progress.evidenceIds.includes(id)) {
        throw new IntegrityError(`Evidence ${id} is not on update ${progressId}`)
      }
      if (item.type === "audio") {
        throw new ConflictError("Voice notes can't be shared with the homeowner.")
      }
    }

    const publication: ProgressPublication = {
      publishedByMembershipId: publisher.id,
      publishedAt: iso(ctx),
      evidenceIds: chosen,
    }
    return {
      state: {
        ...state,
        dailyProgress: state.dailyProgress.map((item) =>
          item.id === progressId
            ? { ...item, publicationStatus: "published" as const, publication }
            : item,
        ),
        evidence: state.evidence.map((item) =>
          chosen.includes(item.id)
            ? { ...item, customerVisibility: "customer-visible" as const }
            : item,
        ),
      },
      result: undefined,
    }
  }

// ─── Work library ─────────────────────────────────────────────────────────────

export const addLibraryStage =
  (input: AddLibraryStageInput): Command<ConstructionStage> =>
  (state, ctx) => {
    authorizeOrganization(ctx, undefined, Permissions.PROJECT_MANAGE)
    const slug =
      slugifyLibraryName(input.name) || `stage-${ctx.ids.short()}`
    const id = `stage-${slug}`
    const existing = state.stages.find((item) => item.id === id)
    if (existing) return { state, result: existing }
    const stage: ConstructionStage = {
      id,
      code: (input.code ?? slug.slice(0, 6)).toUpperCase(),
      name: input.name.trim(),
      sequence: state.stages.length + 1,
    }
    return { state: { ...state, stages: [...state.stages, stage] }, result: stage }
  }

export const addLibraryTrade =
  (input: AddLibraryTradeInput): Command<Trade> =>
  (state, ctx) => {
    authorizeOrganization(ctx, undefined, Permissions.PROJECT_MANAGE)
    const slug =
      slugifyLibraryName(input.name) || `trade-${ctx.ids.short()}`
    const id = `trade-${slug}`
    const existing = state.trades.find((item) => item.id === id)
    if (existing) return { state, result: existing }
    const trade: Trade = {
      id,
      code: (input.code ?? slug.slice(0, 6)).toUpperCase(),
      name: input.name.trim(),
    }
    return { state: { ...state, trades: [...state.trades, trade] }, result: trade }
  }

export const addLibraryWorkType =
  (
    input: AddLibraryWorkTypeInput,
  ): Command<{ workType: WorkType; template: TaskTemplate }> =>
  (state, ctx) => {
    authorizeOrganization(ctx, undefined, Permissions.PROJECT_MANAGE)
    let newStage: ConstructionStage | undefined
    let newTrade: Trade | undefined

    if (input.newStageName?.trim()) {
      const slug =
        slugifyLibraryName(input.newStageName) || `stage-${ctx.ids.short()}`
      newStage = {
        id: `stage-${slug}`,
        code: slug.slice(0, 6).toUpperCase(),
        name: input.newStageName.trim(),
        sequence: 0,
      }
    }
    if (input.newTradeName?.trim()) {
      const slug =
        slugifyLibraryName(input.newTradeName) || `trade-${ctx.ids.short()}`
      newTrade = {
        id: `trade-${slug}`,
        code: slug.slice(0, 6).toUpperCase(),
        name: input.newTradeName.trim(),
      }
    }

    const stageId = newStage?.id ?? input.stageId
    const tradeId = newTrade?.id ?? input.tradeId
    if (!stageId || !tradeId) {
      throw new Error("Stage and trade are required to add a work type")
    }

    const slug =
      slugifyLibraryName(input.name) || `work-${ctx.ids.short()}`
    const workType: WorkType = {
      id: `work-${slug}`,
      stageId,
      tradeId,
      code: slug.toUpperCase(),
      name: input.name.trim(),
      defaultUnit: input.defaultUnit,
    }
    const checklist = input.checklist
      ?.map((item) => item.trim())
      .filter(Boolean) ?? [
      `${workType.name} scope confirmed on site`,
      "Quality checks completed before submission",
      "Site evidence captured for review",
    ]
    const requiredEvidence: EvidenceType[] = input.requiredEvidence?.length
      ? input.requiredEvidence
      : ["photo"]
    const template: TaskTemplate = {
      id: `template-${slug}`,
      workTypeId: workType.id,
      name: `${workType.name} — Standard`,
      checklist,
      requiredEvidence,
      defaultUnit: workType.defaultUnit,
      dependencyWorkTypeIds: [],
    }

    let { stages, trades } = state
    if (newStage && !stages.some((item) => item.id === newStage.id)) {
      stages = [...stages, { ...newStage, sequence: stages.length + 1 }]
    }
    if (newTrade && !trades.some((item) => item.id === newTrade.id)) {
      trades = [...trades, newTrade]
    }
    // Unknown stage/trade ids: change nothing (no partial library entries).
    if (
      !stages.some((item) => item.id === stageId) ||
      !trades.some((item) => item.id === tradeId)
    ) {
      return { state, result: { workType, template } }
    }
    if (state.workTypes.some((item) => item.id === workType.id)) {
      return { state: { ...state, stages, trades }, result: { workType, template } }
    }
    return {
      state: {
        ...state,
        stages,
        trades,
        workTypes: [...state.workTypes, workType],
        taskTemplates: [...state.taskTemplates, template],
      },
      result: { workType, template },
    }
  }

// ─── Issues ───────────────────────────────────────────────────────────────────

const issueTarget = (issue: Issue): ScopeTarget => ({
  projectUnitId: issue.projectUnitId,
  stageId: issue.stageId,
  tradeId: issue.tradeId,
})

function issueOrThrow(state: ConstructionDataState, issueId: EntityId): Issue {
  const issue = state.issues.find((item) => item.id === issueId)
  if (!issue) throw new PermissionError(Permissions.ISSUE_MANAGE)
  return issue
}

function withIssue(
  state: ConstructionDataState,
  issueId: EntityId,
  change: (issue: Issue) => Issue,
): ConstructionDataState {
  return {
    ...state,
    issues: state.issues.map((item) => (item.id === issueId ? change(item) : item)),
  }
}

/**
 * Reporting needs progress-submit OR issue-manage on the issue's location. The
 * location comes from the linked task, else the linked progress record, else
 * the input; an issue with no location is a whole-project issue, which
 * scoped members cannot raise.
 */
export const reportIssue =
  (input: ReportIssueInput): Command<Issue> =>
  (state, ctx) => {
    const task = input.taskId
      ? state.tasks.find((item) => item.id === input.taskId)
      : undefined
    const progress = input.dailyProgressId
      ? state.dailyProgress.find((item) => item.id === input.dailyProgressId)
      : undefined
    const target: ScopeTarget = {
      projectUnitId: input.projectUnitId ?? task?.projectUnitId ?? progress?.projectUnitId,
      stageId: task?.stageId ?? progress?.stageId,
      tradeId: task?.tradeId ?? progress?.tradeId,
    }
    const reporter = authorizeProject(
      state,
      ctx,
      input.projectId,
      ISSUE_REPORT_PERMISSIONS,
      target,
    )

    const title = input.title.trim()
    if (!title) throw new Error("Give the issue a title.")
    assertTaskInProject(state, input.projectId, input.taskId)
    if (input.dailyProgressId && progress?.projectId !== input.projectId) {
      throw new IntegrityError(
        `Progress record ${input.dailyProgressId} does not belong to project ${input.projectId}`,
      )
    }
    assertUnitInProject(state, input.projectId, target.projectUnitId)
    if (task && input.projectUnitId && input.projectUnitId !== task.projectUnitId) {
      throw new IntegrityError(`Task ${task.id} is not at unit ${input.projectUnitId}`)
    }
    assertSourceMessage(state, ctx, input.projectId, input.source)

    const id = ctx.ids.next("issue")
    // Issue photos stay private and are not tied to the daily-progress record,
    // so approving that record cannot publish them to the customer.
    const evidence = (input.evidence ?? []).map((item) =>
      buildEvidence(
        {
          projectId: input.projectId,
          projectUnitId: target.projectUnitId,
          taskId: input.taskId,
          type: item.type,
          url: item.url,
          thumbnailUrl: item.thumbnailUrl,
          caption: item.caption,
          capturedByMembershipId: reporter.id,
          customerVisibility: "private",
        },
        ctx,
      ),
    )
    const issue: Issue = {
      id,
      projectId: input.projectId,
      projectUnitId: target.projectUnitId,
      stageId: target.stageId,
      tradeId: target.tradeId,
      taskId: input.taskId,
      dailyProgressId: input.dailyProgressId,
      source: input.source,
      title,
      description: input.description.trim(),
      severity: input.severity,
      status: "open",
      evidenceIds: evidence.map((item) => item.id),
      customerVisibility: "private",
      createdByMembershipId: reporter.id,
      createdAt: iso(ctx),
    }
    return {
      state: {
        ...state,
        issues: [...state.issues, issue],
        evidence: [...state.evidence, ...evidence],
      },
      result: issue,
    }
  }

/** Assign (or, with no membership, unassign) an issue. Needs ISSUE_MANAGE in scope. */
export const assignIssue =
  (issueId: EntityId, membershipId: EntityId | undefined): Command<void> =>
  (state, ctx) => {
    const issue = issueOrThrow(state, issueId)
    authorizeProject(state, ctx, issue.projectId, [Permissions.ISSUE_MANAGE], issueTarget(issue))
    if (issue.status === "closed") {
      throw new ConflictError("Reopen this issue before assigning it.")
    }
    if (membershipId) {
      const assignee = state.memberships.find((item) => item.id === membershipId)
      if (!assignee || assignee.projectId !== issue.projectId || assignee.status !== "active") {
        throw new IntegrityError(`Membership ${membershipId} cannot take issues on this project`)
      }
    }
    const timestamp = iso(ctx)
    return {
      state: withIssue(state, issueId, (item) => ({
        ...item,
        assignedMembershipId: membershipId,
        updatedAt: timestamp,
      })),
      result: undefined,
    }
  }

/** Move an issue through its lifecycle (start, resolve, close, reopen). Needs ISSUE_MANAGE in scope. */
export const transitionIssue =
  (
    issueId: EntityId,
    next: Issue["status"],
    resolutionNote?: string,
  ): Command<void> =>
  (state, ctx) => {
    const issue = issueOrThrow(state, issueId)
    authorizeProject(state, ctx, issue.projectId, [Permissions.ISSUE_MANAGE], issueTarget(issue))
    if (!canTransitionIssue(issue.status, next)) {
      throw new ConflictError(`An issue can't move from ${issue.status} to ${next}.`)
    }
    const timestamp = iso(ctx)
    return {
      state: withIssue(state, issueId, (item) => {
        const updated: Issue = { ...item, status: next, updatedAt: timestamp }
        if (next === "resolved") {
          updated.resolvedAt = timestamp
          updated.resolutionNote = resolutionNote?.trim() || undefined
        } else if (next === "closed") {
          updated.closedAt = timestamp
        } else if (next === "open") {
          // Reopening clears what settling the issue recorded.
          delete updated.resolvedAt
          delete updated.closedAt
          delete updated.resolutionNote
        }
        return updated
      }),
      result: undefined,
    }
  }

/** Attach more photos/video to an existing issue. Anyone who can report may add. */
export const addIssueEvidence =
  (issueId: EntityId, items: IssueEvidenceInput[]): Command<Evidence[]> =>
  (state, ctx) => {
    const issue = issueOrThrow(state, issueId)
    const author = authorizeProject(
      state,
      ctx,
      issue.projectId,
      ISSUE_REPORT_PERMISSIONS,
      issueTarget(issue),
    )
    if (issue.status === "closed") {
      throw new ConflictError("Reopen this issue before adding evidence.")
    }
    const evidence = items.map((item) =>
      buildEvidence(
        {
          projectId: issue.projectId,
          projectUnitId: issue.projectUnitId,
          taskId: issue.taskId,
          type: item.type,
          url: item.url,
          thumbnailUrl: item.thumbnailUrl,
          caption: item.caption,
          capturedByMembershipId: author.id,
          customerVisibility: "private",
        },
        ctx,
      ),
    )
    const timestamp = iso(ctx)
    return {
      state: {
        ...withIssue(state, issueId, (item) => ({
          ...item,
          evidenceIds: [...item.evidenceIds, ...evidence.map((e) => e.id)],
          updatedAt: timestamp,
        })),
        evidence: [...state.evidence, ...evidence],
      },
      result: evidence,
    }
  }
