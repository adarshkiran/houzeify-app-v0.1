import type {
  ConstructionDataState,
  EntityId,
  ProjectMembership,
  ProjectUnit,
  Task,
} from "./models"
import { Permissions } from "./permissions"
import { canAct, type ScopeTarget, type Session } from "./session"

/**
 * Read scope. Membership scope limits what a person can *see*, not only what
 * they can change, using the same rule as the commands (empty = unrestricted,
 * a unit scope covers descendants, whole-project data needs an unscoped
 * membership). These are pure so lists, counts and aggregates all agree.
 */

/** The team members a person can see on a project. */
export function visibleMemberships(
  session: Session | null,
  memberships: readonly ProjectMembership[],
  units: readonly ProjectUnit[],
  projectId: EntityId,
): ProjectMembership[] {
  const canRead = (target: ScopeTarget) =>
    canAct(session, memberships, units, projectId, [Permissions.PROJECT_READ], target)
  const team = memberships.filter((m) => m.projectId === projectId)
  // Not on the project (or no read access at all): sees no one.
  if (!team.some((m) => m.principalId === session?.personId && m.status === "active")) {
    return []
  }
  if (canRead({})) return team // unscoped viewer sees the whole team
  return team.filter(
    (m) =>
      m.principalId === session?.personId ||
      m.scope.projectUnitIds.length === 0 || // a project-wide role
      m.scope.projectUnitIds.some((unitId) => canRead({ projectUnitId: unitId })),
  )
}

/**
 * The state as this person may read it: tasks, plan items, issues, progress,
 * evidence, units, assignments and team members are narrowed to their scope,
 * and projects they are not on show nothing. Feed the result to the ordinary
 * selectors (open issues, dashboard counts, ...).
 */
export function scopeStateForReading(
  state: ConstructionDataState,
  session: Session | null,
): ConstructionDataState {
  const canRead = (projectId: EntityId, target: ScopeTarget) =>
    canAct(session, state.memberships, state.projectUnits, projectId, [Permissions.PROJECT_READ], target)

  const tasks = state.tasks.filter((task) => canRead(task.projectId, task))
  const visibleTaskIds = new Set(tasks.map((task) => task.id))
  const taskById = new Map<EntityId, Task>(state.tasks.map((task) => [task.id, task]))

  const projectIds = new Set(state.projects.map((project) => project.id))
  const memberships = [...projectIds].flatMap((projectId) =>
    visibleMemberships(session, state.memberships, state.projectUnits, projectId),
  )

  return {
    ...state,
    projectUnits: state.projectUnits.filter((unit) =>
      canRead(unit.projectId, { projectUnitId: unit.id }),
    ),
    tasks,
    workPlanItems: state.workPlanItems.filter((item) => canRead(item.projectId, item)),
    issues: state.issues.filter((issue) => canRead(issue.projectId, issue)),
    dailyProgress: state.dailyProgress.filter((item) => canRead(item.projectId, item)),
    evidence: state.evidence.filter((item) => {
      const task = item.taskId ? taskById.get(item.taskId) : undefined
      return canRead(item.projectId, task ?? { projectUnitId: item.projectUnitId })
    }),
    assignments: state.assignments.filter((a) => visibleTaskIds.has(a.taskId)),
    workerProjectAssignments: state.workerProjectAssignments.filter((a) =>
      a.projectUnitIds.length === 0
        ? canRead(a.projectId, {})
        : a.projectUnitIds.some((projectUnitId) => canRead(a.projectId, { projectUnitId })),
    ),
    memberships,
  }
}
