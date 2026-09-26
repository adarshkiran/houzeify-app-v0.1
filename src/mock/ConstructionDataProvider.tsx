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
  }>
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
  reviewDailyProgress: (progressId: EntityId, decision: "approve" | "reject") => void
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

function todayISODate() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function statusAfterProgressSubmit(status: TaskStatus): TaskStatus | null {
  const allowed = taskTransitions[status]
  if (allowed.includes("review")) return "review"
  if (allowed.includes("submitted")) return "submitted"
  return null
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
    capturedAt: new Date().toISOString(),
    customerVisibility: input.customerVisibility ?? "review-required",
  }
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

  const addEvidence = useCallback((input: AddEvidenceInput) => {
    const evidence = buildEvidence(input)
    setState((current) => ({
      ...current,
      evidence: [...current.evidence, evidence],
    }))
    return evidence
  }, [])

  const submitDailyProgress = useCallback((input: SubmitDailyProgressInput) => {
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
  }, [state.memberships, state.projects])

  const reviewDailyProgress = useCallback(
    (progressId: EntityId, decision: "approve" | "reject") => {
      setState((current) => {
        const progress = current.dailyProgress.find((item) => item.id === progressId)
        if (!progress || progress.reviewStatus === "approved" || progress.reviewStatus === "rejected") {
          return current
        }

        if (decision === "reject") {
          return {
            ...current,
            dailyProgress: current.dailyProgress.map((item) =>
              item.id === progressId
                ? { ...item, reviewStatus: "rejected", publicationStatus: "private" }
                : item,
            ),
          }
        }

        const timestamp = new Date().toISOString()
        return {
          ...current,
          dailyProgress: current.dailyProgress.map((item) =>
            item.id === progressId
              ? { ...item, reviewStatus: "approved", publicationStatus: "published" }
              : item,
          ),
          evidence: current.evidence.map((item) =>
            progress.evidenceIds.includes(item.id) || item.dailyProgressId === progressId
              ? { ...item, customerVisibility: "customer-visible" }
              : item,
          ),
          projects: current.projects.map((project) =>
            project.id === progress.projectId && typeof progress.progressAfter === "number"
              ? { ...project, progress: progress.progressAfter, updatedAt: timestamp }
              : project,
          ),
        }
      })
    },
    [],
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
