import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type {
  ConstructionDataState,
  ConstructionStage,
  DailyProgress,
  EntityId,
  Evidence,
  EvidenceType,
  Organization,
  Person,
  Project,
  ProjectKind,
  ProjectMembership,
  ProjectStatus,
  ProjectUnit,
  ProjectUnitKind,
  ProjectRole,
  Quantity,
  QuantityUnit,
  Task,
  TaskAssignment,
  TaskStatus,
  TaskTemplate,
  Trade,
  WorkPlanItem,
  WorkType,
  Worker,
  WorkerProjectAssignment,
} from "../domain/models"
import { calculateProjectProgress } from "../domain/progress"
import { permissionsForRole } from "../domain/permissions"
import { defaultRootUnitForKind } from "../domain/projectSetup"
import {
  canTransitionTask,
  getAllowedTaskTransitions,
  statusAfterProgressApproval,
  statusAfterProgressRejection,
  statusAfterProgressSubmit,
} from "../domain/taskTransitions"
import { slugifyLibraryName } from "../domain/workLibrary"
import { seedConstructionData } from "./seed"

interface BusinessProfileInput {
  name: string
  kind: Organization["kind"]
  city: string
  phone: string
  teamSize: string
}

export interface CreateProjectInput {
  organizationId: EntityId
  name: string
  code: string
  kind: ProjectKind
  status: ProjectStatus
  location: string
  startDate?: string
  targetDate?: string
  trackingStartedMidProject: boolean
}

export interface AddProjectUnitInput {
  projectId: EntityId
  parentUnitId?: EntityId
  kind: ProjectUnitKind
  code: string
  name: string
}

export interface InviteProjectMemberInput {
  projectId: EntityId
  name: string
  phone?: string
  email?: string
  role: ProjectRole
  projectUnitIds?: EntityId[]
}

export interface AddWorkPlanItemInput {
  projectId: EntityId
  projectUnitId: EntityId
  stageId: EntityId
  tradeId: EntityId
  workTypeId: EntityId
  templateId?: EntityId
  plannedQuantity: Quantity
  plannedStart?: string
  dueDate?: string
}

export interface CreateTaskInput {
  projectId: EntityId
  projectUnitId: EntityId
  stageId: EntityId
  tradeId: EntityId
  workTypeId: EntityId
  templateId?: EntityId
  title: string
  priority: Task["priority"]
  plannedQuantity?: Quantity
  plannedStart?: string
  dueDate?: string
}

export interface AddEvidenceInput {
  projectId: EntityId
  projectUnitId?: EntityId
  taskId?: EntityId
  dailyProgressId?: EntityId
  type: EvidenceType
  url: string
  thumbnailUrl?: string
  caption?: string
  capturedByMembershipId?: EntityId
  capturedByWorkerId?: EntityId
  customerVisibility?: Evidence["customerVisibility"]
}

export interface SubmitDailyProgressInput {
  projectId: EntityId
  projectUnitId: EntityId
  taskId?: EntityId
  stageId: EntityId
  tradeId: EntityId
  workTypeId: EntityId
  workersPresent: number
  progressAfter: number
  todaySummary: string
  tomorrowPlan: string
  yesterdaySummary?: string
  blockerSummary?: string
  submittedByMembershipId?: EntityId
  evidence: Array<{
    type: EvidenceType
    url: string
    thumbnailUrl?: string
    caption?: string
    capturedByWorkerId?: EntityId
  }>
}

export interface AssignWorkerToProjectInput {
  workerId: EntityId
  projectId: EntityId
  projectUnitIds?: EntityId[]
  tradeIds?: EntityId[]
  role?: WorkerProjectAssignment["role"]
  assignedByMembershipId?: EntityId
}

export interface AddWorkerInput {
  organizationId: EntityId
  name: string
  phone?: string
  tradeIds: EntityId[]
  preferredLanguage?: string
  onboardingMethod?: Worker["onboardingMethod"]
  projectId?: EntityId
  projectUnitIds?: EntityId[]
  role?: WorkerProjectAssignment["role"]
  assignedByMembershipId?: EntityId
}

export interface AddLibraryStageInput {
  name: string
  code?: string
}

export interface AddLibraryTradeInput {
  name: string
  code?: string
}

export interface AddLibraryWorkTypeInput {
  name: string
  stageId?: EntityId
  tradeId?: EntityId
  newStageName?: string
  newTradeName?: string
  defaultUnit: QuantityUnit
  checklist?: string[]
  requiredEvidence?: EvidenceType[]
}

interface ConstructionDataContextValue {
  state: ConstructionDataState
  updateOrganizationProfile: (
    organizationId: EntityId,
    input: BusinessProfileInput,
  ) => void
  createProject: (input: CreateProjectInput) => Project
  addProjectUnit: (input: AddProjectUnitInput) => ProjectUnit
  addProjectUnits: (inputs: AddProjectUnitInput[]) => ProjectUnit[]
  inviteProjectMember: (input: InviteProjectMemberInput) => ProjectMembership
  addWorkPlanItem: (input: AddWorkPlanItemInput) => WorkPlanItem
  createTask: (input: CreateTaskInput) => Task
  assignTask: (
    taskId: EntityId,
    assigneeType: TaskAssignment["assigneeType"],
    assigneeId: EntityId,
  ) => TaskAssignment
  assignWorkerToProject: (
    input: AssignWorkerToProjectInput,
  ) => WorkerProjectAssignment
  addWorker: (input: AddWorkerInput) => {
    worker: Worker
    assignment?: WorkerProjectAssignment
  }
  addLibraryStage: (input: AddLibraryStageInput) => ConstructionStage
  addLibraryTrade: (input: AddLibraryTradeInput) => Trade
  addLibraryWorkType: (input: AddLibraryWorkTypeInput) => {
    workType: WorkType
    template: TaskTemplate
  }
  transitionTask: (taskId: EntityId, nextStatus: TaskStatus) => void
  addEvidence: (input: AddEvidenceInput) => Evidence
  submitDailyProgress: (input: SubmitDailyProgressInput) => DailyProgress
  reviewDailyProgress: (
    progressId: EntityId,
    decision: "approve" | "reject",
  ) => void
}

export { getAllowedTaskTransitions, canTransitionTask }

function todayISODate() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function buildEvidence(input: AddEvidenceInput): Evidence {
  return {
    id: `evidence-${crypto.randomUUID()}`,
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
    capturedAt: new Date().toISOString(),
    customerVisibility: input.customerVisibility ?? "review-required",
  }
}

const ConstructionDataContext =
  createContext<ConstructionDataContextValue | null>(null)

export default function ConstructionDataProvider({
  children,
}: {
  children: ReactNode
}) {
  const [state, setState] =
    useState<ConstructionDataState>(seedConstructionData)

  const updateOrganizationProfile = useCallback(
    (organizationId: EntityId, input: BusinessProfileInput) => {
      setState((current) => ({
        ...current,
        organizations: current.organizations.map((organization) =>
          organization.id === organizationId
            ? { ...organization, ...input, status: "active" }
            : organization,
        ),
      }))
    },
    [],
  )

  const createProject = useCallback((input: CreateProjectInput) => {
    const id = `project-${crypto.randomUUID()}`
    const timestamp = new Date().toISOString()
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
          id: `unit-${crypto.randomUUID()}`,
          projectId: id,
          kind: root.kind,
          code: root.code,
          name: root.name,
          status: "active",
          sequence: 1,
        }
      : null

    setState((current) => {
      const creatorPerson =
        current.people.find((person) => person.id === "person-arjun") ??
        current.people[0]
      const membership: ProjectMembership | null = creatorPerson
        ? {
            id: `membership-${crypto.randomUUID()}`,
            projectId: id,
            principalType: "person",
            principalId: creatorPerson.id,
            role: "project-manager",
            scope: { projectUnitIds: [], stageIds: [], tradeIds: [] },
            permissions: permissionsForRole("project-manager"),
            status: "active",
          }
        : null

      return {
        ...current,
        projects: [...current.projects, project],
        projectUnits: rootUnit
          ? [...current.projectUnits, rootUnit]
          : current.projectUnits,
        memberships: membership
          ? [...current.memberships, membership]
          : current.memberships,
      }
    })
    return project
  }, [])

  const addProjectUnit = useCallback(
    (input: AddProjectUnitInput) => {
      const siblings = state.projectUnits.filter(
        (unit) =>
          unit.projectId === input.projectId &&
          unit.parentUnitId === input.parentUnitId,
      )
      const unit: ProjectUnit = {
        id: `unit-${crypto.randomUUID()}`,
        projectId: input.projectId,
        parentUnitId: input.parentUnitId,
        kind: input.kind,
        code: input.code,
        name: input.name,
        status: "planned",
        sequence: siblings.length + 1,
      }

      setState((current) => ({
        ...current,
        projectUnits: [...current.projectUnits, unit],
      }))
      return unit
    },
    [state.projectUnits],
  )

  const addProjectUnits = useCallback((inputs: AddProjectUnitInput[]) => {
    const created: ProjectUnit[] = []
    if (!inputs.length) return created

    setState((current) => {
      let units = [...current.projectUnits]
      for (const input of inputs) {
        const siblings = units.filter(
          (unit) =>
            unit.projectId === input.projectId &&
            unit.parentUnitId === input.parentUnitId,
        )
        const unit: ProjectUnit = {
          id: `unit-${crypto.randomUUID()}`,
          projectId: input.projectId,
          parentUnitId: input.parentUnitId,
          kind: input.kind,
          code: input.code,
          name: input.name,
          status: "planned",
          sequence: siblings.length + 1,
        }
        units = [...units, unit]
        created.push(unit)
      }
      return { ...current, projectUnits: units }
    })

    return created
  }, [])

  const inviteProjectMember = useCallback((input: InviteProjectMemberInput) => {
    const person: Person = {
      id: `person-${crypto.randomUUID()}`,
      name: input.name,
      phone: input.phone,
      email: input.email,
    }
    const membership: ProjectMembership = {
      id: `membership-${crypto.randomUUID()}`,
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

    setState((current) => ({
      ...current,
      people: [...current.people, person],
      memberships: [...current.memberships, membership],
    }))
    return membership
  }, [])

  const addWorkPlanItem = useCallback((input: AddWorkPlanItemInput) => {
    const item: WorkPlanItem = {
      id: `plan-${crypto.randomUUID()}`,
      ...input,
      status: "planned",
      createdAt: new Date().toISOString(),
    }
    setState((current) => ({
      ...current,
      workPlanItems: [...current.workPlanItems, item],
    }))
    return item
  }, [])

  const createTask = useCallback(
    (input: CreateTaskInput) => {
      const creator = state.memberships.find(
        (membership) =>
          membership.projectId === input.projectId &&
          membership.role === "project-manager",
      )
      const template = state.taskTemplates.find(
        (item) => item.id === input.templateId,
      )
      const timestamp = new Date().toISOString()
      const task: Task = {
        id: `task-${crypto.randomUUID()}`,
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
      setState((current) => ({ ...current, tasks: [...current.tasks, task] }))
      return task
    },
    [state.memberships, state.taskTemplates],
  )

  const assignTask = useCallback(
    (
      taskId: EntityId,
      assigneeType: TaskAssignment["assigneeType"],
      assigneeId: EntityId,
    ) => {
      const task = state.tasks.find((item) => item.id === taskId)
      const assignment: TaskAssignment = {
        id: `assignment-${crypto.randomUUID()}`,
        taskId,
        assigneeType,
        assigneeId,
        assignedByMembershipId: task?.createdByMembershipId ?? "",
        status: "assigned",
        assignedAt: new Date().toISOString(),
      }
      setState((current) => ({
        ...current,
        assignments: [...current.assignments, assignment],
        tasks: current.tasks.map((item) =>
          item.id === taskId && item.status === "draft"
            ? {
                ...item,
                status: "assigned",
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      }))
      return assignment
    },
    [state.tasks],
  )

  const assignWorkerToProject = useCallback(
    (input: AssignWorkerToProjectInput) => {
      const assignment: WorkerProjectAssignment = {
        id: `wpa-${crypto.randomUUID()}`,
        workerId: input.workerId,
        projectId: input.projectId,
        projectUnitIds: input.projectUnitIds ?? [],
        tradeIds: input.tradeIds ?? [],
        role: input.role ?? "worker",
        status: "active",
        assignedAt: new Date().toISOString(),
        assignedByMembershipId: input.assignedByMembershipId,
      }
      setState((current) => {
        const alreadyAssigned = current.workerProjectAssignments.some(
          (item) =>
            item.workerId === input.workerId &&
            item.projectId === input.projectId &&
            item.status === "active",
        )
        if (alreadyAssigned) return current
        return {
          ...current,
          workerProjectAssignments: [
            ...current.workerProjectAssignments,
            assignment,
          ],
        }
      })
      return assignment
    },
    [],
  )

  const addWorker = useCallback((input: AddWorkerInput) => {
    const worker: Worker = {
      id: `worker-${crypto.randomUUID().slice(0, 8)}`,
      organizationId: input.organizationId,
      name: input.name.trim(),
      phone: input.phone?.trim() || undefined,
      tradeIds: input.tradeIds,
      preferredLanguage: input.preferredLanguage ?? "en",
      onboardingMethod: input.onboardingMethod ?? "manual",
      status: "active",
    }
    let assignment: WorkerProjectAssignment | undefined
    if (input.projectId) {
      assignment = {
        id: `wpa-${crypto.randomUUID()}`,
        workerId: worker.id,
        projectId: input.projectId,
        projectUnitIds: input.projectUnitIds ?? [],
        tradeIds: input.tradeIds,
        role: input.role ?? "worker",
        status: "active",
        assignedAt: new Date().toISOString(),
        assignedByMembershipId: input.assignedByMembershipId,
      }
    }

    setState((current) => ({
      ...current,
      workers: [...current.workers, worker],
      workerProjectAssignments: assignment
        ? [...current.workerProjectAssignments, assignment]
        : current.workerProjectAssignments,
    }))

    return { worker, assignment }
  }, [])

  const addEvidence = useCallback((input: AddEvidenceInput) => {
    const evidence = buildEvidence(input)
    setState((current) => ({
      ...current,
      evidence: [...current.evidence, evidence],
    }))
    return evidence
  }, [])

  const submitDailyProgress = useCallback(
    (input: SubmitDailyProgressInput) => {
      const progressId = `progress-${crypto.randomUUID()}`
      const timestamp = new Date().toISOString()
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
        buildEvidence({
          ...item,
          projectId: input.projectId,
          projectUnitId: input.projectUnitId,
          taskId: input.taskId,
          dailyProgressId: progressId,
          capturedByMembershipId: submitter,
          capturedByWorkerId: item.capturedByWorkerId,
          customerVisibility: "review-required",
        }),
      )
      const progress: DailyProgress = {
        id: progressId,
        projectId: input.projectId,
        projectUnitId: input.projectUnitId,
        taskId: input.taskId,
        stageId: input.stageId,
        tradeId: input.tradeId,
        workTypeId: input.workTypeId,
        date: todayISODate(),
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

      setState((current) => ({
        ...current,
        evidence: [...current.evidence, ...evidence],
        dailyProgress: [progress, ...current.dailyProgress],
        tasks: current.tasks.map((task) => {
          if (task.id !== input.taskId) return task
          const nextStatus = statusAfterProgressSubmit(task.status)
          if (!nextStatus) return task
          return { ...task, status: nextStatus, updatedAt: timestamp }
        }),
      }))

      return progress
    },
    [state.memberships, state.projects],
  )

  const reviewDailyProgress = useCallback(
    (progressId: EntityId, decision: "approve" | "reject") => {
      setState((current) => {
        const progress = current.dailyProgress.find(
          (item) => item.id === progressId,
        )
        if (
          !progress ||
          progress.reviewStatus === "approved" ||
          progress.reviewStatus === "rejected"
        ) {
          return current
        }

        const timestamp = new Date().toISOString()

        if (decision === "reject") {
          return {
            ...current,
            dailyProgress: current.dailyProgress.map((item) =>
              item.id === progressId
                ? {
                    ...item,
                    reviewStatus: "rejected",
                    publicationStatus: "private",
                  }
                : item,
            ),
            tasks: current.tasks.map((task) => {
              if (task.id !== progress.taskId) return task
              const nextStatus = statusAfterProgressRejection(task.status)
              if (!nextStatus) return task
              return { ...task, status: nextStatus, updatedAt: timestamp }
            }),
          }
        }

        const updatedProgress = current.dailyProgress.map((item) =>
          item.id === progressId
            ? {
                ...item,
                reviewStatus: "approved" as const,
                publicationStatus: "published" as const,
              }
            : item,
        )

        return {
          ...current,
          dailyProgress: updatedProgress,
          evidence: current.evidence.map((item) =>
            progress.evidenceIds.includes(item.id) ||
            item.dailyProgressId === progressId
              ? { ...item, customerVisibility: "customer-visible" }
              : item,
          ),
          projects: current.projects.map((project) => {
            if (project.id !== progress.projectId) return project
            return {
              ...project,
              progress: calculateProjectProgress(project, updatedProgress),
              updatedAt: timestamp,
            }
          }),
          tasks: current.tasks.map((task) => {
            if (task.id !== progress.taskId) return task
            const nextStatus = statusAfterProgressApproval(task.status)
            if (nextStatus === task.status) return task
            return { ...task, status: nextStatus, updatedAt: timestamp }
          }),
        }
      })
    },
    [],
  )

  const transitionTask = useCallback(
    (taskId: EntityId, nextStatus: TaskStatus) => {
      setState((current) => ({
        ...current,
        tasks: current.tasks.map((task) => {
          if (
            task.id !== taskId ||
            !canTransitionTask(task.status, nextStatus)
          ) {
            return task
          }
          return {
            ...task,
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          }
        }),
      }))
    },
    [],
  )

  const addLibraryStage = useCallback((input: AddLibraryStageInput) => {
    const slug =
      slugifyLibraryName(input.name) ||
      `stage-${crypto.randomUUID().slice(0, 8)}`
    const stage: ConstructionStage = {
      id: `stage-${slug}`,
      code: (input.code ?? slug.slice(0, 6)).toUpperCase(),
      name: input.name.trim(),
      sequence: state.stages.length + 1,
    }
    setState((current) => {
      if (current.stages.some((item) => item.id === stage.id)) {
        return current
      }
      return {
        ...current,
        stages: [
          ...current.stages,
          { ...stage, sequence: current.stages.length + 1 },
        ],
      }
    })
    return stage
  }, [state.stages.length])

  const addLibraryTrade = useCallback((input: AddLibraryTradeInput) => {
    const slug =
      slugifyLibraryName(input.name) ||
      `trade-${crypto.randomUUID().slice(0, 8)}`
    const trade: Trade = {
      id: `trade-${slug}`,
      code: (input.code ?? slug.slice(0, 6)).toUpperCase(),
      name: input.name.trim(),
    }
    setState((current) => {
      if (current.trades.some((item) => item.id === trade.id)) {
        return current
      }
      return { ...current, trades: [...current.trades, trade] }
    })
    return trade
  }, [])

  const addLibraryWorkType = useCallback((input: AddLibraryWorkTypeInput) => {
    let stage: ConstructionStage | undefined
    let trade: Trade | undefined

    if (input.newStageName?.trim()) {
      const slug =
        slugifyLibraryName(input.newStageName) ||
        `stage-${crypto.randomUUID().slice(0, 8)}`
      stage = {
        id: `stage-${slug}`,
        code: slug.slice(0, 6).toUpperCase(),
        name: input.newStageName.trim(),
        sequence: 0,
      }
    }

    if (input.newTradeName?.trim()) {
      const slug =
        slugifyLibraryName(input.newTradeName) ||
        `trade-${crypto.randomUUID().slice(0, 8)}`
      trade = {
        id: `trade-${slug}`,
        code: slug.slice(0, 6).toUpperCase(),
        name: input.newTradeName.trim(),
      }
    }

    const stageId = stage?.id ?? input.stageId
    const tradeId = trade?.id ?? input.tradeId
    if (!stageId || !tradeId) {
      throw new Error("Stage and trade are required to add a work type")
    }

    const slug =
      slugifyLibraryName(input.name) ||
      `work-${crypto.randomUUID().slice(0, 8)}`
    const workType: WorkType = {
      id: `work-${slug}`,
      stageId,
      tradeId,
      code: slug.toUpperCase(),
      name: input.name.trim(),
      defaultUnit: input.defaultUnit,
    }
    const checklist =
      input.checklist?.map((item) => item.trim()).filter(Boolean) ??
      [
        `${workType.name} scope confirmed on site`,
        "Quality checks completed before submission",
        "Site evidence captured for review",
      ]
    const requiredEvidence =
      input.requiredEvidence && input.requiredEvidence.length
        ? input.requiredEvidence
        : (["photo"] as EvidenceType[])
    const template: TaskTemplate = {
      id: `template-${slug}`,
      workTypeId: workType.id,
      name: `${workType.name} — Standard`,
      checklist,
      requiredEvidence,
      defaultUnit: workType.defaultUnit,
      dependencyWorkTypeIds: [],
    }

    setState((current) => {
      let stages = current.stages
      let trades = current.trades

      if (stage && !current.stages.some((item) => item.id === stage!.id)) {
        stages = [
          ...current.stages,
          { ...stage, sequence: current.stages.length + 1 },
        ]
      }
      if (trade && !current.trades.some((item) => item.id === trade!.id)) {
        trades = [...current.trades, trade]
      }

      const stagesOk = stages.some((item) => item.id === stageId)
      const tradesOk = trades.some((item) => item.id === tradeId)
      if (!stagesOk || !tradesOk) return current
      if (current.workTypes.some((item) => item.id === workType.id)) {
        return { ...current, stages, trades }
      }

      return {
        ...current,
        stages,
        trades,
        workTypes: [...current.workTypes, workType],
        taskTemplates: [...current.taskTemplates, template],
      }
    })

    return { workType, template }
  }, [])

  const value = useMemo(
    () => ({
      state,
      updateOrganizationProfile,
      createProject,
      addProjectUnit,
      addProjectUnits,
      inviteProjectMember,
      addWorkPlanItem,
      createTask,
      assignTask,
      assignWorkerToProject,
      addWorker,
      addLibraryStage,
      addLibraryTrade,
      addLibraryWorkType,
      transitionTask,
      addEvidence,
      submitDailyProgress,
      reviewDailyProgress,
    }),
    [
      state,
      updateOrganizationProfile,
      createProject,
      addProjectUnit,
      addProjectUnits,
      inviteProjectMember,
      addWorkPlanItem,
      createTask,
      assignTask,
      assignWorkerToProject,
      addWorker,
      addLibraryStage,
      addLibraryTrade,
      addLibraryWorkType,
      transitionTask,
      addEvidence,
      submitDailyProgress,
      reviewDailyProgress,
    ],
  )

  return (
    <ConstructionDataContext.Provider value={value}>
      {children}
    </ConstructionDataContext.Provider>
  )
}

export function useConstructionData() {
  const context = useContext(ConstructionDataContext)

  if (!context) {
    throw new Error(
      "useConstructionData must be used within ConstructionDataProvider",
    )
  }

  return context
}
