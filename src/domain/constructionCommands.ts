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
  SubmitDailyProgressInput,
} from "./commandInputs"
import type {
  ConstructionDataState,
  ConstructionStage,
  DailyProgress,
  EntityId,
  Evidence,
  EvidenceType,
  Person,
  Project,
  ProjectMembership,
  ProjectUnit,
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
  Permissions,
  permissionsForRole,
  type Permission,
} from "./permissions"
import type { Command, CommandContext } from "./ports"
import { calculateProjectProgress } from "./progress"
import { defaultRootUnitForKind } from "./projectSetup"
import { PermissionError, projectPermissions } from "./session"
import {
  canTransitionTask,
  statusAfterProgressApproval,
  statusAfterProgressRejection,
  statusAfterProgressSubmit,
} from "./taskTransitions"
import { slugifyLibraryName } from "./workLibrary"

/**
 * Pure construction-data commands. Each takes the current state, a context
 * (actor, clock, ids) and an input, and returns the next state plus a result.
 * No React, no globals: the same inputs always give the same outputs.
 *
 * Authorization lives here so it holds regardless of which UI calls a command.
 */

// ─── Authorization ────────────────────────────────────────────────────────────

/** Throws unless the actor holds one of `permissions` on the project. */
function authorizeProject(
  state: ConstructionDataState,
  ctx: CommandContext,
  projectId: EntityId,
  ...permissions: Permission[]
) {
  const granted = projectPermissions(ctx.actor, state.memberships, projectId)
  if (!permissions.some((permission) => granted.includes(permission))) {
    throw new PermissionError(permissions[0], projectId)
  }
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
      progress: input.trackingStartedMidProject ? 1 : 0,
      trackingStartedMidProject: input.trackingStartedMidProject,
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
      authorizeProject(state, ctx, input.projectId, Permissions.PROJECT_MANAGE)
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
    authorizeProject(state, ctx, input.projectId, Permissions.PROJECT_MANAGE)
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
    authorizeProject(state, ctx, input.projectId, Permissions.TASK_MANAGE)
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
    authorizeProject(state, ctx, input.projectId, Permissions.TASK_MANAGE)
    const creator = state.memberships.find(
      (membership) =>
        membership.projectId === input.projectId &&
        membership.role === "project-manager",
    )
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
      createdByMembershipId: creator?.id ?? "",
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    return { state: { ...state, tasks: [...state.tasks, task] }, result: task }
  }

export const assignTask =
  (
    taskId: EntityId,
    assigneeType: TaskAssignment["assigneeType"],
    assigneeId: EntityId,
  ): Command<TaskAssignment> =>
  (state, ctx) => {
    authorizeProject(
      state,
      ctx,
      projectIdOfTask(state, taskId, Permissions.TASK_MANAGE),
      Permissions.TASK_MANAGE,
    )
    const task = state.tasks.find((item) => item.id === taskId)
    const timestamp = iso(ctx)
    const assignment: TaskAssignment = {
      id: ctx.ids.next("assignment"),
      taskId,
      assigneeType,
      assigneeId,
      assignedByMembershipId: task?.createdByMembershipId ?? "",
      status: "assigned",
      assignedAt: timestamp,
    }
    return {
      state: {
        ...state,
        assignments: [...state.assignments, assignment],
        tasks: state.tasks.map((item) =>
          item.id === taskId && item.status === "draft"
            ? { ...item, status: "assigned", updatedAt: timestamp }
            : item,
        ),
      },
      result: assignment,
    }
  }

export const transitionTask =
  (taskId: EntityId, nextStatus: TaskStatus): Command<void> =>
  (state, ctx) => {
    const projectId = projectIdOfTask(state, taskId, Permissions.TASK_MANAGE)
    // Workers who can submit progress may also start/pause their own work.
    authorizeProject(
      state,
      ctx,
      projectId,
      Permissions.TASK_MANAGE,
      Permissions.PROGRESS_SUBMIT,
    )
    const timestamp = iso(ctx)
    return {
      state: {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id !== taskId || !canTransitionTask(task.status, nextStatus)
            ? task
            : { ...task, status: nextStatus, updatedAt: timestamp },
        ),
      },
      result: undefined,
    }
  }

// ─── Workforce ────────────────────────────────────────────────────────────────

function buildAssignment(
  ctx: CommandContext,
  input: {
    workerId: EntityId
    projectId: EntityId
    projectUnitIds?: EntityId[]
    tradeIds?: EntityId[]
    role?: WorkerProjectAssignment["role"]
    assignedByMembershipId?: EntityId
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
    assignedByMembershipId: input.assignedByMembershipId,
  }
}

export const assignWorkerToProject =
  (input: AssignWorkerToProjectInput): Command<WorkerProjectAssignment> =>
  (state, ctx) => {
    authorizeProject(state, ctx, input.projectId, Permissions.WORKFORCE_MANAGE)
    // A worker has at most one active assignment per project; re-assigning
    // returns the existing one instead of a record that was never stored.
    const existing = state.workerProjectAssignments.find(
      (item) =>
        item.workerId === input.workerId &&
        item.projectId === input.projectId &&
        item.status === "active",
    )
    if (existing) return { state, result: existing }
    const assignment = buildAssignment(ctx, input)
    return {
      state: {
        ...state,
        workerProjectAssignments: [
          ...state.workerProjectAssignments,
          assignment,
        ],
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
    if (input.projectId) {
      authorizeProject(
        state,
        ctx,
        input.projectId,
        Permissions.WORKFORCE_MANAGE,
      )
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
      ? buildAssignment(ctx, {
          workerId: worker.id,
          projectId: input.projectId,
          projectUnitIds: input.projectUnitIds,
          tradeIds: input.tradeIds,
          role: input.role,
          assignedByMembershipId: input.assignedByMembershipId,
        })
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

function buildEvidence(input: AddEvidenceInput, ctx: CommandContext): Evidence {
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
    authorizeProject(state, ctx, input.projectId, Permissions.EVIDENCE_CAPTURE)
    const evidence = buildEvidence(input, ctx)
    return {
      state: { ...state, evidence: [...state.evidence, evidence] },
      result: evidence,
    }
  }

export const submitDailyProgress =
  (input: SubmitDailyProgressInput): Command<DailyProgress> =>
  (state, ctx) => {
    authorizeProject(state, ctx, input.projectId, Permissions.PROGRESS_SUBMIT)
    const progressId = ctx.ids.next("progress")
    const timestamp = iso(ctx)
    const project = state.projects.find((item) => item.id === input.projectId)
    const submitter =
      input.submittedByMembershipId ??
      state.memberships.find(
        (membership) =>
          membership.projectId === input.projectId &&
          membership.role === "project-manager",
      )?.id ??
      ""
    const evidence = input.evidence.map((item) =>
      buildEvidence(
        {
          ...item,
          projectId: input.projectId,
          projectUnitId: input.projectUnitId,
          taskId: input.taskId,
          dailyProgressId: progressId,
          capturedByMembershipId: submitter,
          capturedByWorkerId: item.capturedByWorkerId,
          customerVisibility: "review-required",
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
      progressBefore: project?.progress,
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
    }
    return {
      state: {
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
      result: progress,
    }
  }

export const reviewDailyProgress =
  (progressId: EntityId, decision: "approve" | "reject"): Command<void> =>
  (state, ctx) => {
    // Authorize against the stored item's project, never a caller-supplied one.
    const progress = state.dailyProgress.find((item) => item.id === progressId)
    if (!progress) throw new PermissionError(Permissions.PROGRESS_REVIEW)
    authorizeProject(
      state,
      ctx,
      progress.projectId,
      Permissions.PROGRESS_REVIEW,
    )
    if (
      progress.reviewStatus === "approved" ||
      progress.reviewStatus === "rejected"
    ) {
      return { state, result: undefined }
    }

    const timestamp = iso(ctx)

    if (decision === "reject") {
      return {
        state: {
          ...state,
          dailyProgress: state.dailyProgress.map((item) =>
            item.id === progressId
              ? {
                  ...item,
                  reviewStatus: "rejected",
                  publicationStatus: "private",
                }
              : item,
          ),
          tasks: state.tasks.map((task) => {
            if (task.id !== progress.taskId) return task
            const nextStatus = statusAfterProgressRejection(task.status)
            return nextStatus
              ? { ...task, status: nextStatus, updatedAt: timestamp }
              : task
          }),
        },
        result: undefined,
      }
    }

    const updatedProgress = state.dailyProgress.map((item) =>
      item.id === progressId
        ? {
            ...item,
            reviewStatus: "approved" as const,
            publicationStatus: "published" as const,
          }
        : item,
    )
    return {
      state: {
        ...state,
        dailyProgress: updatedProgress,
        evidence: state.evidence.map((item) =>
          progress.evidenceIds.includes(item.id) ||
          item.dailyProgressId === progressId
            ? { ...item, customerVisibility: "customer-visible" }
            : item,
        ),
        projects: state.projects.map((project) =>
          project.id !== progress.projectId
            ? project
            : {
                ...project,
                progress: calculateProjectProgress(project, updatedProgress),
                updatedAt: timestamp,
              },
        ),
        tasks: state.tasks.map((task) => {
          if (task.id !== progress.taskId) return task
          const nextStatus = statusAfterProgressApproval(task.status)
          return nextStatus === task.status
            ? task
            : { ...task, status: nextStatus, updatedAt: timestamp }
        }),
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
