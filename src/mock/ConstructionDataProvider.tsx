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
  Task,
  TaskAssignment,
  TaskStatus,
  WorkPlanItem,
} from "../domain/models"
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
  date: string
  workersPresent: number
  plannedQuantity?: Quantity
  completedQuantity?: Quantity
  progressBefore?: number
  progressAfter?: number
  yesterdaySummary?: string
  todaySummary: string
  tomorrowPlan: string
  blockerSummary?: string
  evidenceIds?: EntityId[]
  evidence?: Omit<AddEvidenceInput, "projectId" | "projectUnitId" | "taskId" | "dailyProgressId">[]
  submittedByMembershipId?: EntityId
}

interface ConstructionDataContextValue {
  state: ConstructionDataState
  updateOrganizationProfile: (organizationId: EntityId, input: BusinessProfileInput) => void
  createProject: (input: CreateProjectInput) => Project
  addProjectUnit: (input: AddProjectUnitInput) => ProjectUnit
  inviteProjectMember: (input: InviteProjectMemberInput) => ProjectMembership
  addWorkPlanItem: (input: AddWorkPlanItemInput) => WorkPlanItem
  createTask: (input: CreateTaskInput) => Task
  assignTask: (
    taskId: EntityId,
    assigneeType: TaskAssignment["assigneeType"],
    assigneeId: EntityId,
  ) => TaskAssignment
  transitionTask: (taskId: EntityId, nextStatus: TaskStatus) => void
  addEvidence: (input: AddEvidenceInput) => Evidence
  submitDailyProgress: (input: SubmitDailyProgressInput) => DailyProgress
  reviewDailyProgress: (id: EntityId, decision: "approve" | "reject") => void
}

const taskTransitions: Record<TaskStatus, TaskStatus[]> = {
  draft: ["assigned", "cancelled"],
  assigned: ["accepted", "blocked", "cancelled"],
  accepted: ["ready", "blocked", "delayed", "cancelled"],
  ready: ["in-progress", "blocked", "delayed", "cancelled"],
  "in-progress": ["submitted", "blocked", "delayed", "cancelled"],
  submitted: ["review", "reopened"],
  review: ["approved", "reopened"],
  approved: ["completed", "reopened"],
  completed: ["reopened"],
  blocked: ["ready", "in-progress", "cancelled"],
  delayed: ["ready", "in-progress", "cancelled"],
  reopened: ["ready", "in-progress", "cancelled"],
  cancelled: ["reopened"],
}

export function getAllowedTaskTransitions(status: TaskStatus) {
  return taskTransitions[status]
}

const ConstructionDataContext = createContext<ConstructionDataContextValue | null>(null)

export default function ConstructionDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConstructionDataState>(seedConstructionData)

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

    setState((current) => ({ ...current, projects: [...current.projects, project] }))
    return project
  }, [])

  const addProjectUnit = useCallback((input: AddProjectUnitInput) => {
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
  }, [state.projectUnits])

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
      scope: { projectUnitIds: [], stageIds: [], tradeIds: [] },
      permissions: ["project.read"],
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

  const createTask = useCallback((input: CreateTaskInput) => {
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
  }, [state.memberships, state.taskTemplates])

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
            ? { ...item, status: "assigned", updatedAt: new Date().toISOString() }
            : item,
        ),
      }))
      return assignment
    },
    [state.tasks],
  )

  const transitionTask = useCallback((taskId: EntityId, nextStatus: TaskStatus) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (
          task.id !== taskId ||
          !taskTransitions[task.status].includes(nextStatus)
        ) {
          return task
        }
        return { ...task, status: nextStatus, updatedAt: new Date().toISOString() }
      }),
    }))
  }, [])

  const addEvidence = useCallback((input: AddEvidenceInput) => {
    const evidence: Evidence = {
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

    setState((current) => {
      const nextEvidence = [...current.evidence, evidence]
      if (!input.dailyProgressId) {
        return { ...current, evidence: nextEvidence }
      }

      return {
        ...current,
        evidence: nextEvidence,
        dailyProgress: current.dailyProgress.map((progress) =>
          progress.id === input.dailyProgressId
            ? {
                ...progress,
                evidenceIds: progress.evidenceIds.includes(evidence.id)
                  ? progress.evidenceIds
                  : [...progress.evidenceIds, evidence.id],
              }
            : progress,
        ),
      }
    })

    return evidence
  }, [])

  const submitDailyProgress = useCallback((input: SubmitDailyProgressInput) => {
    const timestamp = new Date().toISOString()
    const progressId = `progress-${crypto.randomUUID()}`
    const submitter =
      input.submittedByMembershipId ??
      state.memberships.find(
        (membership) =>
          membership.projectId === input.projectId &&
          (membership.role === "supervisor" ||
            membership.role === "contractor" ||
            membership.role === "project-manager"),
      )?.id ??
      ""

    const attachedEvidence: Evidence[] = (input.evidence ?? []).map((item) => ({
      id: `evidence-${crypto.randomUUID()}`,
      projectId: input.projectId,
      projectUnitId: input.projectUnitId,
      taskId: input.taskId,
      dailyProgressId: progressId,
      type: item.type,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl,
      caption: item.caption,
      capturedByMembershipId: item.capturedByMembershipId ?? submitter,
      capturedByWorkerId: item.capturedByWorkerId,
      capturedAt: timestamp,
      customerVisibility: item.customerVisibility ?? "review-required",
    }))

    const evidenceIds = [
      ...(input.evidenceIds ?? []),
      ...attachedEvidence.map((item) => item.id),
    ]

    const progress: DailyProgress = {
      id: progressId,
      projectId: input.projectId,
      projectUnitId: input.projectUnitId,
      taskId: input.taskId,
      stageId: input.stageId,
      tradeId: input.tradeId,
      workTypeId: input.workTypeId,
      date: input.date,
      workersPresent: input.workersPresent,
      plannedQuantity: input.plannedQuantity,
      completedQuantity: input.completedQuantity,
      progressBefore: input.progressBefore,
      progressAfter: input.progressAfter,
      yesterdaySummary: input.yesterdaySummary,
      todaySummary: input.todaySummary,
      tomorrowPlan: input.tomorrowPlan,
      blockerSummary: input.blockerSummary,
      evidenceIds,
      submittedByMembershipId: submitter,
      submittedAt: timestamp,
      reviewStatus: "submitted",
      publicationStatus: "private",
    }

    setState((current) => ({
      ...current,
      dailyProgress: [progress, ...current.dailyProgress],
      evidence: [...current.evidence, ...attachedEvidence],
      tasks: input.taskId
        ? current.tasks.map((task) => {
            if (task.id !== input.taskId) return task
            const nextStatus =
              task.status === "in-progress" || task.status === "ready"
                ? "submitted"
                : task.status === "submitted"
                  ? "review"
                  : task.status
            if (nextStatus === task.status) {
              return {
                ...task,
                completedQuantity: input.completedQuantity ?? task.completedQuantity,
                updatedAt: timestamp,
              }
            }
            return {
              ...task,
              status: nextStatus,
              completedQuantity: input.completedQuantity ?? task.completedQuantity,
              updatedAt: timestamp,
            }
          })
        : current.tasks,
    }))

    return progress
  }, [state.memberships])

  const reviewDailyProgress = useCallback(
    (id: EntityId, decision: "approve" | "reject") => {
      setState((current) => {
        const target = current.dailyProgress.find((progress) => progress.id === id)
        if (!target) return current

        const approved = decision === "approve"
        const nextProgress = current.dailyProgress.map((progress) =>
          progress.id === id
            ? {
                ...progress,
                reviewStatus: approved ? ("approved" as const) : ("rejected" as const),
                publicationStatus: approved
                  ? ("published" as const)
                  : ("private" as const),
              }
            : progress,
        )

        const evidenceIds = new Set(target.evidenceIds)
        const updatedEvidence = approved
          ? current.evidence.map((item) =>
              evidenceIds.has(item.id) || item.dailyProgressId === id
                ? { ...item, customerVisibility: "customer-visible" as const }
                : item,
            )
          : current.evidence

        const nextProjects =
          approved && typeof target.progressAfter === "number"
            ? current.projects.map((project) =>
                project.id === target.projectId
                  ? {
                      ...project,
                      progress: target.progressAfter!,
                      updatedAt: new Date().toISOString(),
                    }
                  : project,
              )
            : current.projects

        const nextTasks =
          approved && target.taskId
            ? current.tasks.map((task) => {
                if (task.id !== target.taskId) return task
                if (task.status === "submitted" || task.status === "review") {
                  return {
                    ...task,
                    status: "approved" as const,
                    updatedAt: new Date().toISOString(),
                  }
                }
                return task
              })
            : current.tasks

        return {
          ...current,
          dailyProgress: nextProgress,
          evidence: updatedEvidence,
          projects: nextProjects,
          tasks: nextTasks,
        }
      })
    },
    [],
  )

  const value = useMemo(
    () => ({
      state,
      updateOrganizationProfile,
      createProject,
      addProjectUnit,
      inviteProjectMember,
      addWorkPlanItem,
      createTask,
      assignTask,
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
      inviteProjectMember,
      addWorkPlanItem,
      createTask,
      assignTask,
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
    throw new Error("useConstructionData must be used inside ConstructionDataProvider")
  }

  return context
}
