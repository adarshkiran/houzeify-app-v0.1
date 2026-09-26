import type {
  ConstructionDataState,
  DailyProgress,
  EntityId,
  Evidence,
  Issue,
  Project,
  Task,
} from "../domain/models"

const openTaskStatuses = new Set([
  "assigned",
  "accepted",
  "ready",
  "in-progress",
  "submitted",
  "review",
  "blocked",
  "delayed",
  "reopened",
])

export function getOrganizationProjects(
  state: ConstructionDataState,
  organizationId: EntityId,
) {
  return state.projects.filter(
    (project) => project.organizationId === organizationId,
  )
}

export function getProject(state: ConstructionDataState, projectId: EntityId) {
  return state.projects.find((project) => project.id === projectId)
}

export function getStageName(state: ConstructionDataState, stageId?: EntityId) {
  return state.stages.find((stage) => stage.id === stageId)?.name ?? "Not set"
}

export function getTradeName(state: ConstructionDataState, tradeId: EntityId) {
  return (
    state.trades.find((trade) => trade.id === tradeId)?.name ?? "Unknown trade"
  )
}

export function getWorkTypeName(
  state: ConstructionDataState,
  workTypeId: EntityId,
) {
  return (
    state.workTypes.find((workType) => workType.id === workTypeId)?.name ??
    "Unknown work"
  )
}

export function getOpenTasks(
  state: ConstructionDataState,
  projectId?: EntityId,
) {
  return state.tasks
    .filter(
      (task) =>
        (!projectId || task.projectId === projectId) &&
        openTaskStatuses.has(task.status),
    )
    .sort((left, right) =>
      (left.dueDate ?? "").localeCompare(right.dueDate ?? ""),
    )
}

export function getOpenIssues(
  state: ConstructionDataState,
  projectId?: EntityId,
) {
  return state.issues
    .filter(
      (issue) =>
        (!projectId || issue.projectId === projectId) &&
        issue.status !== "resolved" &&
        issue.status !== "closed",
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function getRecentProgress(
  state: ConstructionDataState,
  projectId?: EntityId,
) {
  return state.dailyProgress
    .filter((progress) => !projectId || progress.projectId === projectId)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
}

export function getPendingReview(
  state: ConstructionDataState,
  projectId?: EntityId,
) {
  return state.dailyProgress
    .filter(
      (progress) =>
        (!projectId || progress.projectId === projectId) &&
        (progress.reviewStatus === "submitted" ||
          progress.reviewStatus === "draft"),
    )
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
}

export function getPublishedForCustomer(
  state: ConstructionDataState,
  projectId?: EntityId,
) {
  return state.dailyProgress
    .filter(
      (progress) =>
        (!projectId || progress.projectId === projectId) &&
        progress.reviewStatus === "approved" &&
        progress.publicationStatus === "published",
    )
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        right.submittedAt.localeCompare(left.submittedAt),
    )
}

export function getEvidenceForProgress(
  state: ConstructionDataState,
  progress: DailyProgress,
) {
  return state.evidence.filter(
    (item) =>
      progress.evidenceIds.includes(item.id) ||
      item.dailyProgressId === progress.id,
  )
}

export function getCustomerVisibleEvidence(evidence: Evidence[]) {
  return evidence.filter(
    (item) => item.customerVisibility === "customer-visible",
  )
}

export function getActiveWorkerAssignments(
  state: ConstructionDataState,
  projectId?: EntityId,
) {
  return state.workerProjectAssignments.filter(
    (assignment) =>
      assignment.status === "active" &&
      (!projectId || assignment.projectId === projectId),
  )
}

export function getWorkersForProject(
  state: ConstructionDataState,
  projectId: EntityId,
) {
  const workerIds = new Set(
    getActiveWorkerAssignments(state, projectId).map(
      (assignment) => assignment.workerId,
    ),
  )
  return state.workers.filter(
    (worker) => workerIds.has(worker.id) && worker.status === "active",
  )
}

export function getProjectUnits(
  state: ConstructionDataState,
  projectId: EntityId,
) {
  return state.projectUnits
    .filter((unit) => unit.projectId === projectId)
    .sort((left, right) => left.sequence - right.sequence)
}

export function getProjectMemberships(
  state: ConstructionDataState,
  projectId: EntityId,
) {
  return state.memberships.filter(
    (membership) =>
      membership.projectId === projectId && membership.status === "active",
  )
}

export interface DashboardProject {
  project: Project
  stageName: string
  openTaskCount: number
  openIssueCount: number
  workforceCount: number
  lastProgress?: DailyProgress
}

export interface OrganizationDashboard {
  projects: DashboardProject[]
  activeProjectCount: number
  openTasks: Task[]
  openIssues: Issue[]
  workforceCount: number
  recentProgress: DailyProgress[]
}

export function getOrganizationDashboard(
  state: ConstructionDataState,
  organizationId: EntityId,
): OrganizationDashboard {
  const organizationProjects = getOrganizationProjects(state, organizationId)
  const projectIds = new Set(organizationProjects.map((project) => project.id))
  const openTasks = getOpenTasks(state).filter((task) =>
    projectIds.has(task.projectId),
  )
  const openIssues = getOpenIssues(state).filter((issue) =>
    projectIds.has(issue.projectId),
  )
  const recentProgress = getRecentProgress(state).filter((progress) =>
    projectIds.has(progress.projectId),
  )

  return {
    projects: organizationProjects.map((project) => {
      const lastProgress = recentProgress.find(
        (progress) => progress.projectId === project.id,
      )

      return {
        project,
        stageName: getStageName(state, project.currentStageId),
        openTaskCount: openTasks.filter((task) => task.projectId === project.id)
          .length,
        openIssueCount: openIssues.filter(
          (issue) => issue.projectId === project.id,
        ).length,
        workforceCount: lastProgress?.workersPresent ?? 0,
        lastProgress,
      }
    }),
    activeProjectCount: organizationProjects.filter(
      (project) => project.status === "active" || project.status === "planning",
    ).length,
    openTasks,
    openIssues,
    workforceCount: state.workers.filter(
      (worker) =>
        worker.organizationId === organizationId && worker.status === "active",
    ).length,
    recentProgress,
  }
}
