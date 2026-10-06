// Pure row mappers between Postgres rows (snake_case) and domain shapes
// (camelCase). No Supabase import here: this file is testable without a
// database. Row ids are uuids; a domain id is the seed's legacy_id when one
// exists, otherwise the uuid. Foreign keys are translated with `toDomain`
// so a loaded state refers to the same ids the screens use.

import type {
  AssignmentEndReason,
  AttendanceStatus,
  EntityId,
  OnboardingMethod,
  OnboardingStatus,
  Organization,
  Person,
  Project,
  ProjectMembership,
  ProjectUnit,
  ConstructionStage,
  Trade,
  Worker,
  WorkerAttendance,
  WorkerOnboarding,
  WorkerProjectAssignment,
} from "../domain/models"

/** Maps a uuid foreign key to the domain id it is known by. */
export type ToDomainId = (uuid: string) => string

const identity: ToDomainId = (uuid) => uuid

/** A domain id for this row: the legacy id when the seed set one, else the uuid. */
function ownId(row: { id: string; legacy_id?: string | null }): EntityId {
  return row.legacy_id ?? row.id
}

// Organizations

export interface OrganizationRow {
  id: string
  legacy_id: string | null
  name: string
  created_at: string
}

export function organizationFromRow(row: OrganizationRow): Organization {
  return {
    id: ownId(row),
    name: row.name,
    kind: "construction-company",
    status: "active",
    city: "",
    createdAt: row.created_at,
  }
}

export function organizationToRow(org: Organization): Omit<OrganizationRow, "id"> {
  return { legacy_id: org.id, name: org.name, created_at: org.createdAt }
}

// People

export interface PersonRow {
  id: string
  legacy_id: string | null
  phone: string | null
  full_name: string | null
}

export function personFromRow(row: PersonRow): Person {
  return {
    id: ownId(row),
    name: row.full_name ?? "",
    phone: row.phone ?? undefined,
  }
}

export function personToRow(person: Person): Omit<PersonRow, "id"> {
  return { legacy_id: person.id, phone: person.phone ?? null, full_name: person.name }
}

// Project memberships (project-scoped only)

export interface MembershipRow {
  id: string
  legacy_id: string | null
  person_id: string
  project_id: string
  role: string
  permissions: string[]
  scope: { projectUnitIds?: string[]; stageIds?: string[]; tradeIds?: string[] } | null
  status: string
}

export function membershipFromRow(row: MembershipRow, toDomain: ToDomainId = identity): ProjectMembership {
  return {
    id: ownId(row),
    projectId: toDomain(row.project_id),
    principalType: "person",
    principalId: toDomain(row.person_id),
    role: row.role as ProjectMembership["role"],
    scope: {
      projectUnitIds: (row.scope?.projectUnitIds ?? []).map(toDomain),
      stageIds: (row.scope?.stageIds ?? []).map(toDomain),
      tradeIds: row.scope?.tradeIds ?? [],
    },
    permissions: row.permissions,
    status: row.status as ProjectMembership["status"],
  }
}

export function membershipToRow(m: ProjectMembership): Omit<MembershipRow, "id"> {
  return {
    legacy_id: m.id,
    person_id: m.principalId,
    project_id: m.projectId,
    role: m.role,
    permissions: m.permissions,
    scope: { projectUnitIds: m.scope.projectUnitIds, stageIds: m.scope.stageIds, tradeIds: m.scope.tradeIds },
    status: m.status,
  }
}

// Projects

export interface ProjectRow {
  id: string
  legacy_id: string | null
  organization_id: string
  name: string
  status: string
  require_checkout: boolean
  created_at: string
}

export function projectFromRow(row: ProjectRow, toDomain: ToDomainId = identity): Project {
  return {
    id: ownId(row),
    organizationId: toDomain(row.organization_id),
    code: row.legacy_id ?? row.id,
    name: row.name,
    kind: "individual-house",
    status: row.status as Project["status"],
    location: "",
    progress: 0,
    trackingStartedMidProject: false,
    requireCheckout: row.require_checkout,
    stageBaselines: {},
    createdAt: row.created_at,
    updatedAt: row.created_at,
  }
}

export function projectToRow(p: Project): Omit<ProjectRow, "id"> {
  return {
    legacy_id: p.id,
    organization_id: p.organizationId,
    name: p.name,
    status: p.status,
    require_checkout: p.requireCheckout,
    created_at: p.createdAt,
  }
}

// Project units

export interface ProjectUnitRow {
  id: string
  legacy_id: string | null
  project_id: string
  parent_id: string | null
  name: string
}

export function projectUnitFromRow(row: ProjectUnitRow, toDomain: ToDomainId = identity): ProjectUnit {
  return {
    id: ownId(row),
    projectId: toDomain(row.project_id),
    parentUnitId: row.parent_id ? toDomain(row.parent_id) : undefined,
    kind: "location",
    code: row.legacy_id ?? row.id,
    name: row.name,
    status: "active",
    sequence: 0,
  }
}

export function projectUnitToRow(u: ProjectUnit): Omit<ProjectUnitRow, "id"> {
  return {
    legacy_id: u.id,
    project_id: u.projectId,
    parent_id: u.parentUnitId ?? null,
    name: u.name,
  }
}

// Stages

export interface StageRow {
  id: string
  legacy_id: string | null
  name: string
  sort_order: number
}

export function stageFromRow(row: StageRow): ConstructionStage {
  return { id: ownId(row), code: row.legacy_id ?? row.id, name: row.name, sequence: row.sort_order }
}

export function stageToRow(s: ConstructionStage): Omit<StageRow, "id"> {
  return { legacy_id: s.id, name: s.name, sort_order: s.sequence }
}

// Trades

export interface TradeRow {
  id: string
  legacy_id: string | null
  name: string
}

export function tradeFromRow(row: TradeRow): Trade {
  return { id: ownId(row), code: row.legacy_id ?? row.id, name: row.name }
}

export function tradeToRow(t: Trade): Omit<TradeRow, "id"> {
  return { legacy_id: t.id, name: t.name }
}

// Workers

export interface WorkerRow {
  id: string
  legacy_id: string | null
  organization_id: string
  user_id: string | null
  phone: string
  name: string
  trade_ids: string[]
  languages: string[]
  onboarding_method: string | null
  status: string
}

export function workerFromRow(row: WorkerRow, toDomain: ToDomainId = identity): Worker {
  return {
    id: ownId(row),
    organizationId: toDomain(row.organization_id),
    userId: row.user_id ? toDomain(row.user_id) : undefined,
    name: row.name,
    phone: row.phone,
    tradeIds: row.trade_ids,
    languages: row.languages,
    onboardingMethod: (row.onboarding_method ?? "manual") as OnboardingMethod,
    status: row.status as Worker["status"],
  }
}

export function workerToRow(w: Worker): Omit<WorkerRow, "id"> {
  return {
    legacy_id: w.id,
    organization_id: w.organizationId,
    user_id: w.userId ?? null,
    phone: w.phone ?? "",
    name: w.name,
    trade_ids: w.tradeIds,
    languages: w.languages,
    onboarding_method: w.onboardingMethod,
    status: w.status,
  }
}

// Worker onboardings

export interface WorkerOnboardingRow {
  id: string
  legacy_id: string | null
  worker_id: string
  organization_id: string
  method: string
  status: string
  join_code: string | null
  invited_at: string | null
  accepted_at: string | null
  expires_at: string | null
}

export function workerOnboardingFromRow(row: WorkerOnboardingRow, toDomain: ToDomainId = identity): WorkerOnboarding {
  return {
    id: ownId(row),
    workerId: toDomain(row.worker_id),
    organizationId: toDomain(row.organization_id),
    method: row.method as OnboardingMethod,
    status: row.status as OnboardingStatus,
    joinCode: row.join_code ?? undefined,
    invitedAt: row.invited_at ?? "",
    acceptedAt: row.accepted_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
  }
}

export function workerOnboardingToRow(o: WorkerOnboarding): Omit<WorkerOnboardingRow, "id"> {
  return {
    legacy_id: o.id,
    worker_id: o.workerId,
    organization_id: o.organizationId,
    method: o.method,
    status: o.status,
    join_code: o.joinCode ?? null,
    invited_at: o.invitedAt,
    accepted_at: o.acceptedAt ?? null,
    expires_at: o.expiresAt ?? null,
  }
}

// Worker project assignments

export interface WorkerProjectAssignmentRow {
  id: string
  legacy_id: string | null
  project_id: string
  worker_id: string
  project_unit_ids: string[]
  started_at: string | null
  ended_at: string | null
  end_reason: string | null
  status: string
  created_at: string
}

export function workerProjectAssignmentFromRow(
  row: WorkerProjectAssignmentRow,
  toDomain: ToDomainId = identity,
): WorkerProjectAssignment {
  return {
    id: ownId(row),
    workerId: toDomain(row.worker_id),
    projectId: toDomain(row.project_id),
    projectUnitIds: row.project_unit_ids.map(toDomain),
    tradeIds: [],
    role: "worker",
    status: row.status as WorkerProjectAssignment["status"],
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    endReason: (row.end_reason ?? undefined) as AssignmentEndReason | undefined,
    assignedAt: row.created_at,
  }
}

export function workerProjectAssignmentToRow(a: WorkerProjectAssignment): Omit<WorkerProjectAssignmentRow, "id"> {
  return {
    legacy_id: a.id,
    project_id: a.projectId,
    worker_id: a.workerId,
    project_unit_ids: a.projectUnitIds,
    started_at: a.startedAt ?? null,
    ended_at: a.endedAt ?? null,
    end_reason: a.endReason ?? null,
    status: a.status,
    created_at: a.assignedAt,
  }
}

// Worker attendance

export interface WorkerAttendanceRow {
  id: string
  legacy_id: string | null
  worker_id: string
  project_id: string
  assignment_id: string
  date: string
  status: string | null
  check_in_at: string | null
  check_out_at: string | null
  recorded_by: string
  recorded_by_membership_id: string | null
  created_at: string
  updated_at: string
}

export function workerAttendanceFromRow(row: WorkerAttendanceRow, toDomain: ToDomainId = identity): WorkerAttendance {
  return {
    id: ownId(row),
    workerId: toDomain(row.worker_id),
    projectId: toDomain(row.project_id),
    assignmentId: toDomain(row.assignment_id),
    date: row.date,
    status: (row.status ?? undefined) as AttendanceStatus | undefined,
    checkInAt: row.check_in_at ?? undefined,
    checkOutAt: row.check_out_at ?? undefined,
    recordedBy: row.recorded_by as WorkerAttendance["recordedBy"],
    recordedByMembershipId: row.recorded_by_membership_id ? toDomain(row.recorded_by_membership_id) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function workerAttendanceToRow(a: WorkerAttendance): Omit<WorkerAttendanceRow, "id"> {
  return {
    legacy_id: a.id,
    worker_id: a.workerId,
    project_id: a.projectId,
    assignment_id: a.assignmentId,
    date: a.date,
    status: a.status ?? null,
    check_in_at: a.checkInAt ?? null,
    check_out_at: a.checkOutAt ?? null,
    recorded_by: a.recordedBy,
    recorded_by_membership_id: a.recordedByMembershipId ?? null,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  }
}
