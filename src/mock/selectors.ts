import type {
  ConstructionDataState,
  DailyProgress,
  Document,
  EntityId,
  Estimate,
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

/**
 * Pending review items, optionally scoped to one project and/or to the
 * projects the caller may review (`reviewableProjectIds`).
 */
export function getPendingReview(
  state: ConstructionDataState,
  projectId?: EntityId,
  reviewableProjectIds?: ReadonlySet<EntityId>,
) {
  return state.dailyProgress
    .filter(
      (progress) =>
        (!projectId || progress.projectId === projectId) &&
        (!reviewableProjectIds || reviewableProjectIds.has(progress.projectId)) &&
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

const newestFirst = (left: DailyProgress, right: DailyProgress) =>
  right.submittedAt.localeCompare(left.submittedAt)

/** Approved updates not yet shared with the homeowner. */
export function getReadyToPublish(
  state: ConstructionDataState,
  projectId?: EntityId,
) {
  return state.dailyProgress
    .filter(
      (progress) =>
        (!projectId || progress.projectId === projectId) &&
        progress.reviewStatus === "approved" &&
        progress.publicationStatus === "private",
    )
    .sort(newestFirst)
}

/** Every submitted update (all review states), newest first. */
export function getProgressHistory(
  state: ConstructionDataState,
  projectId?: EntityId,
) {
  return state.dailyProgress
    .filter(
      (progress) =>
        (!projectId || progress.projectId === projectId) &&
        progress.reviewStatus !== "draft",
    )
    .sort(newestFirst)
}

/** All versions of an update, oldest first, including `progress` itself. */
export function getVersionChain(
  state: ConstructionDataState,
  progress: DailyProgress,
) {
  const byId = new Map(state.dailyProgress.map((item) => [item.id, item]))
  let first = progress
  while (first.supersedesId && byId.has(first.supersedesId)) {
    first = byId.get(first.supersedesId)!
  }
  const chain = [first]
  let current = first
  while (current.supersededById && byId.has(current.supersededById)) {
    current = byId.get(current.supersededById)!
    chain.push(current)
  }
  return chain
}

/** Updates sent back to these memberships (optionally for one task), newest first. */
export function getChangesRequested(
  state: ConstructionDataState,
  membershipIds: ReadonlySet<EntityId>,
  taskId?: EntityId,
) {
  return state.dailyProgress
    .filter(
      (progress) =>
        progress.reviewStatus === "changes-requested" &&
        membershipIds.has(progress.submittedByMembershipId) &&
        (!taskId || progress.taskId === taskId),
    )
    .sort(newestFirst)
}

/** Evidence the reviewer chose to share when publishing; nothing else. */
export function getPublishedEvidence(
  state: ConstructionDataState,
  progress: DailyProgress,
) {
  const chosen = new Set(progress.publication?.evidenceIds ?? [])
  return state.evidence.filter(
    (item) => chosen.has(item.id) && item.customerVisibility === "customer-visible",
  )
}

/** Membership ids held by a signed-in person. */
export function getMyMembershipIds(
  state: ConstructionDataState,
  personId: EntityId | undefined,
) {
  return new Set(
    state.memberships
      .filter(
        (item) => item.principalType === "person" && item.principalId === personId,
      )
      .map((item) => item.id),
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
      membership.projectId === projectId &&
      (membership.status === "active" || membership.status === "invited"),
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

/** A membership's display name (person or organization), or undefined if unknown. */
export function getMembershipName(
  state: ConstructionDataState,
  membershipId?: EntityId,
) {
  const membership = state.memberships.find((item) => item.id === membershipId)
  if (!membership) return undefined
  return membership.principalType === "organization"
    ? state.organizations.find((item) => item.id === membership.principalId)?.name
    : state.people.find((item) => item.id === membership.principalId)?.name
}

/** Issues a staff member has shared with the homeowner, newest first. */
export function getPublishedIssues(state: ConstructionDataState, projectId: EntityId) {
  return state.issues
    .filter((issue) => issue.projectId === projectId && issue.customerVisibility === "customer-visible")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

/** Documents a staff member has shared with the homeowner, newest first. */
export function getPublishedDocuments(state: ConstructionDataState, projectId: EntityId) {
  return state.documents
    .filter((doc) => doc.projectId === projectId && doc.customerVisibility === "customer-visible")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function getEstimate(state: ConstructionDataState, estimateId: EntityId) {
  return state.estimates.find((item) => item.id === estimateId)
}

/** A homeowner's most recent estimate, newest first, or undefined if they have none. */
export function getLatestEstimate(state: ConstructionDataState, homeownerPersonId: EntityId) {
  return state.estimates
    .filter((item) => item.homeownerPersonId === homeownerPersonId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
}
