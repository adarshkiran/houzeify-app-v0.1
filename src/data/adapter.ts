// Repository adapter: reads the Supabase tables into a ConstructionDataState
// and sends each B4 write to its Postgres function. It holds no domain rules;
// those stay in src/domain and in the functions themselves.

import type { SupabaseClient } from "@supabase/supabase-js"
import { ConflictError } from "../domain/errors"
import type { ConstructionDataState, EntityId } from "../domain/models"
import { PermissionError } from "../domain/session"
import type { Permission } from "../domain/permissions"
import {
  membershipFromRow,
  organizationFromRow,
  personFromRow,
  projectFromRow,
  projectUnitFromRow,
  stageFromRow,
  tradeFromRow,
  workerAttendanceFromRow,
  workerFromRow,
  workerOnboardingFromRow,
  workerProjectAssignmentFromRow,
  type MembershipRow,
  type OrganizationRow,
  type PersonRow,
  type ProjectRow,
  type ProjectUnitRow,
  type StageRow,
  type TradeRow,
  type ToDomainId,
  type WorkerAttendanceRow,
  type WorkerOnboardingRow,
  type WorkerProjectAssignmentRow,
  type WorkerRow,
} from "./rows"

type Keyed = { id: string; legacy_id: string | null }

/** Domain id → uuid for each client, filled by loadState, used when a write names an id. */
const uuidByDomainId = new WeakMap<SupabaseClient, Map<EntityId, string>>()

async function selectAll<T>(client: SupabaseClient, table: string): Promise<T[]> {
  const { data, error } = await client.from(table).select("*")
  if (error) throw new Error(error.message)
  return (data ?? []) as T[]
}

/** A ConstructionDataState with no rows: what supabase mode shows before sign-in. */
export function emptyConstructionState(): ConstructionDataState {
  return {
    organizations: [],
    people: [],
    projects: [],
    projectUnits: [],
    stages: [],
    trades: [],
    workTypes: [],
    taskTemplates: [],
    workPlanItems: [],
    memberships: [],
    workers: [],
    workerProjectAssignments: [],
    workerOnboardings: [],
    workerAttendance: [],
    tasks: [],
    assignments: [],
    dailyProgress: [],
    evidence: [],
    documents: [],
    estimates: [],
    issues: [],
    threads: [],
    messages: [],
    threadReads: [],
    callLogs: [],
    requirements: [],
    unlocks: [],
    proposals: [],
    plans: [],
    subscriptions: [],
    wallets: [],
    creditTransactions: [],
  }
}

/**
 * Loads the tables the screens read into a ConstructionDataState. Collections
 * the schema does not store yet come back empty (see the task-12 report).
 */
export async function loadState(client: SupabaseClient): Promise<ConstructionDataState> {
  const [
    organizations,
    people,
    memberships,
    projects,
    units,
    stages,
    trades,
    workers,
    onboardings,
    assignments,
    attendance,
  ] = await Promise.all([
    selectAll<OrganizationRow & Keyed>(client, "organizations"),
    selectAll<PersonRow & Keyed>(client, "people"),
    selectAll<MembershipRow & Keyed>(client, "memberships"),
    selectAll<ProjectRow & Keyed>(client, "projects"),
    selectAll<ProjectUnitRow & Keyed>(client, "project_units"),
    selectAll<StageRow & Keyed>(client, "stages"),
    selectAll<TradeRow & Keyed>(client, "trades"),
    selectAll<WorkerRow & Keyed>(client, "workers"),
    selectAll<WorkerOnboardingRow & Keyed>(client, "worker_onboardings"),
    selectAll<WorkerProjectAssignmentRow & Keyed>(client, "worker_project_assignments"),
    selectAll<WorkerAttendanceRow & Keyed>(client, "worker_attendance"),
  ])

  const domainByUuid = new Map<string, EntityId>()
  const uuidByDomain = new Map<EntityId, string>()
  for (const rows of [organizations, people, projects, units, stages, trades, workers, onboardings, assignments, attendance, memberships]) {
    for (const row of rows) {
      const domainId = row.legacy_id ?? row.id
      domainByUuid.set(row.id, domainId)
      uuidByDomain.set(domainId, row.id)
    }
  }
  uuidByDomainId.set(client, uuidByDomain)
  const toDomain: ToDomainId = (uuid) => domainByUuid.get(uuid) ?? uuid

  return {
    ...emptyConstructionState(),
    organizations: organizations.map((r) => organizationFromRow(r)),
    people: people.map((r) => personFromRow(r)),
    projects: projects.map((r) => projectFromRow(r, toDomain)),
    projectUnits: units.map((r) => projectUnitFromRow(r, toDomain)),
    stages: stages.map((r) => stageFromRow(r)),
    trades: trades.map((r) => tradeFromRow(r)),
    memberships: memberships.filter((r) => r.project_id).map((r) => membershipFromRow(r, toDomain)),
    workers: workers.map((r) => workerFromRow(r, toDomain)),
    workerProjectAssignments: assignments.map((r) => workerProjectAssignmentFromRow(r, toDomain)),
    workerOnboardings: onboardings.map((r) => workerOnboardingFromRow(r, toDomain)),
    workerAttendance: attendance.map((r) => workerAttendanceFromRow(r, toDomain)),
  }
}

/** A refusal raised by a B4 function: `conflict:` and `permission:` prefixes become typed errors. */
export function refusalFrom(message: string): Error {
  if (message.startsWith("conflict:")) return new ConflictError(message.slice("conflict:".length))
  if (message.startsWith("permission:")) {
    const quoted = /"([^"]+)"/.exec(message)
    return new PermissionError((quoted?.[1] ?? "") as Permission)
  }
  return new Error(message)
}

function uuidOf(client: SupabaseClient, id: EntityId): string {
  return uuidByDomainId.get(client)?.get(id) ?? id
}

async function callFunction(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await client.rpc(name, args)
  if (error) throw refusalFrom(error.message)
  return data
}

export interface RequirementRef {
  requirementId: EntityId
  organizationId: EntityId
}

export function unlockRequirement(client: SupabaseClient, input: RequirementRef) {
  return callFunction(client, "unlock_requirement", {
    requirement_id: uuidOf(client, input.requirementId),
    organization_id: uuidOf(client, input.organizationId),
  })
}

export function submitProposal(
  client: SupabaseClient,
  input: RequirementRef & { assumptions: string[]; exclusions: string[] },
) {
  return callFunction(client, "submit_proposal", {
    requirement_id: uuidOf(client, input.requirementId),
    organization_id: uuidOf(client, input.organizationId),
    assumptions: input.assumptions,
    exclusions: input.exclusions,
  })
}

export function selectProposal(client: SupabaseClient, input: { proposalId: EntityId }) {
  return callFunction(client, "select_proposal", { proposal_id: uuidOf(client, input.proposalId) })
}

export function createWorkerOnboarding(client: SupabaseClient, input: { workerId: EntityId; method: string }) {
  return callFunction(client, "create_worker_onboarding", {
    worker_id: uuidOf(client, input.workerId),
    method: input.method,
  })
}

export function acceptWorkerOnboarding(client: SupabaseClient, input: { onboardingId: EntityId; joinCode: string }) {
  return callFunction(client, "accept_worker_onboarding", {
    onboarding_id: uuidOf(client, input.onboardingId),
    join_code: input.joinCode,
  })
}

export function acceptOwnWorkerOnboarding(client: SupabaseClient, input: { onboardingId: EntityId }) {
  return callFunction(client, "accept_own_worker_onboarding", {
    onboarding_id: uuidOf(client, input.onboardingId),
  })
}

export function markWorkerJoined(client: SupabaseClient, input: { onboardingId: EntityId }) {
  return callFunction(client, "mark_worker_joined", { onboarding_id: uuidOf(client, input.onboardingId) })
}

export function endWorkerProjectAssignment(
  client: SupabaseClient,
  input: { assignmentId: EntityId; reason: string },
) {
  return callFunction(client, "end_worker_project_assignment", {
    assignment_id: uuidOf(client, input.assignmentId),
    reason: input.reason,
  })
}

export function checkInWorker(client: SupabaseClient, input: { projectId: EntityId }) {
  return callFunction(client, "check_in_worker", { project_id: uuidOf(client, input.projectId) })
}

export function checkOutWorker(client: SupabaseClient, input: { projectId: EntityId }) {
  return callFunction(client, "check_out_worker", { project_id: uuidOf(client, input.projectId) })
}

export function recordAttendance(
  client: SupabaseClient,
  input: {
    projectId: EntityId
    workerId: EntityId
    day: string
    status: string | null
    checkInAt: string | null
    checkOutAt: string | null
  },
) {
  return callFunction(client, "record_attendance", {
    project_id: uuidOf(client, input.projectId),
    worker_id: uuidOf(client, input.workerId),
    day: input.day,
    status: input.status,
    check_in_at: input.checkInAt,
    check_out_at: input.checkOutAt,
  })
}

export function setAttendancePolicy(client: SupabaseClient, input: { projectId: EntityId; requireCheckout: boolean }) {
  return callFunction(client, "set_attendance_policy", {
    project_id: uuidOf(client, input.projectId),
    require_checkout: input.requireCheckout,
  })
}

export function publishDailyProgress(
  client: SupabaseClient,
  input: { progressId: EntityId; decision: string; note: string | null },
) {
  return callFunction(client, "publish_daily_progress", {
    progress_id: uuidOf(client, input.progressId),
    decision: input.decision,
    note: input.note,
  })
}
