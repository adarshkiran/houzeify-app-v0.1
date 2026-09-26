import type {
  ConstructionDataState,
  EntityId,
  Worker,
  WorkerProjectAssignment,
} from "./models"

export function getOrganizationWorkers(
  state: ConstructionDataState,
  organizationId: EntityId,
): Worker[] {
  return state.workers.filter(
    (worker) => worker.organizationId === organizationId,
  )
}

export function getActiveAssignmentsForWorker(
  state: ConstructionDataState,
  workerId: EntityId,
): WorkerProjectAssignment[] {
  return state.workerProjectAssignments.filter(
    (assignment) =>
      assignment.workerId === workerId && assignment.status === "active",
  )
}

export function getWorkerProjectIds(
  state: ConstructionDataState,
  workerId: EntityId,
): EntityId[] {
  return getActiveAssignmentsForWorker(state, workerId).map(
    (assignment) => assignment.projectId,
  )
}

export function workerMatchesProject(
  state: ConstructionDataState,
  workerId: EntityId,
  projectId: EntityId,
): boolean {
  return getWorkerProjectIds(state, workerId).includes(projectId)
}
