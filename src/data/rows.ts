// Pure row mappers between Postgres rows (snake_case) and domain shapes
// (camelCase). No Supabase import here: this file is testable without a
// database. Row ids are uuids; a domain id is the seed's legacy_id when one
// exists, otherwise the uuid. Foreign keys are translated with `toDomain`
// so a loaded state refers to the same ids the screens use.

import type {
  AssignmentEndReason,
  AttendanceStatus,
  CallLog,
  ConstructionLevel,
  ConstructionStage,
  CreditTransaction,
  CreditTransactionKind,
  CreditWallet,
  DailyProgress,
  Document,
  EntityId,
  Estimate,
  EstimateLine,
  EstimateLineCategory,
  EstimateReviewStatus,
  Evidence,
  EvidenceType,
  Issue,
  MarketplaceRequirement,
  MarketplaceUnlock,
  Message,
  OnboardingMethod,
  OnboardingStatus,
  Organization,
  Person,
  Plan,
  EntitlementKey,
  Project,
  ProjectMembership,
  ProjectUnit,
  Proposal,
  ProposalStatus,
  ProgressPublication,
  ProgressReview,
  ReviewDecision,
  ReviewStatus,
  Subscription,
  SubscriptionStatus,
  Task,
  TaskAssignment,
  TaskChecklistItem,
  TaskStatus,
  TaskTemplate,
  Thread,
  ThreadRead,
  ThreadSubject,
  Trade,
  Quantity,
  QuantityUnit,
  Worker,
  WorkerAttendance,
  WorkerOnboarding,
  WorkerProjectAssignment,
  WorkPlanItem,
  WorkType,
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
  kind: string | null
  city: string | null
  phone: string | null
  team_size: string | null
  created_at: string
}

export function organizationFromRow(row: OrganizationRow): Organization {
  return {
    id: ownId(row),
    name: row.name,
    kind: (row.kind ?? "construction-company") as Organization["kind"],
    status: "active",
    city: row.city ?? "",
    phone: row.phone ?? undefined,
    teamSize: row.team_size ?? undefined,
    createdAt: row.created_at,
  }
}

export function organizationToRow(org: Organization): Omit<OrganizationRow, "id"> {
  return {
    legacy_id: org.id,
    name: org.name,
    kind: org.kind,
    city: org.city || null,
    phone: org.phone ?? null,
    team_size: org.teamSize ?? null,
    created_at: org.createdAt,
  }
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
  location: string | null
  kind: string | null
  require_checkout: boolean
  stage_baselines: Record<string, number> | null
  progress: number
  created_at: string
}

export function projectFromRow(row: ProjectRow, toDomain: ToDomainId = identity): Project {
  const stageBaselines: Record<string, number> = {}
  for (const [stageUuid, value] of Object.entries(row.stage_baselines ?? {})) {
    stageBaselines[toDomain(stageUuid)] = value
  }
  return {
    id: ownId(row),
    organizationId: toDomain(row.organization_id),
    code: row.legacy_id ?? row.id,
    name: row.name,
    kind: (row.kind ?? "individual-house") as Project["kind"],
    status: row.status as Project["status"],
    location: row.location ?? "",
    progress: row.progress,
    trackingStartedMidProject: false,
    requireCheckout: row.require_checkout,
    stageBaselines,
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
    location: p.location || null,
    kind: p.kind,
    require_checkout: p.requireCheckout,
    stage_baselines: p.stageBaselines,
    progress: p.progress,
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
  code: string | null
}

export function stageFromRow(row: StageRow): ConstructionStage {
  return { id: ownId(row), code: row.code ?? row.legacy_id ?? row.id, name: row.name, sequence: row.sort_order }
}

export function stageToRow(s: ConstructionStage): Omit<StageRow, "id"> {
  return { legacy_id: s.id, name: s.name, sort_order: s.sequence, code: s.code }
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

// Work types. project_id is null for a library entry (shared by every project; see
// migration 0014), the only kind this adapter writes.

export interface WorkTypeRow {
  id: string
  legacy_id: string | null
  project_id: string | null
  stage_id: string | null
  trade_id: string | null
  name: string
  default_unit: string
  created_at: string
}

export function workTypeFromRow(row: WorkTypeRow, toDomain: ToDomainId = identity): WorkType {
  return {
    id: ownId(row),
    stageId: row.stage_id ? toDomain(row.stage_id) : "",
    tradeId: row.trade_id ? toDomain(row.trade_id) : "",
    code: row.legacy_id ?? row.id,
    name: row.name,
    defaultUnit: (row.default_unit as WorkType["defaultUnit"]) ?? "nos",
  }
}

// Task templates. The schema has no checklist/evidence/unit/dependency columns yet.

export interface TaskTemplateRow {
  id: string
  legacy_id: string | null
  project_id: string
  work_type_id: string | null
  name: string
  created_at: string
}

export function taskTemplateFromRow(row: TaskTemplateRow, toDomain: ToDomainId = identity): TaskTemplate {
  return {
    id: ownId(row),
    workTypeId: row.work_type_id ? toDomain(row.work_type_id) : "",
    name: row.name,
    checklist: [],
    requiredEvidence: [],
    defaultUnit: "nos",
    dependencyWorkTypeIds: [],
  }
}

// Task assignments (per-worker assignment of a task). The schema has no
// assignee-type, assigned-by or status columns yet; every row is a worker
// assignment loaded as "assigned".

export interface TaskAssignmentRow {
  id: string
  legacy_id: string | null
  project_id: string
  task_id: string
  worker_id: string
  assigned_at: string
}

export function taskAssignmentFromRow(row: TaskAssignmentRow, toDomain: ToDomainId = identity): TaskAssignment {
  return {
    id: ownId(row),
    taskId: toDomain(row.task_id),
    assigneeType: "worker",
    assigneeId: toDomain(row.worker_id),
    assignedByMembershipId: "",
    status: "assigned",
    assignedAt: row.assigned_at,
  }
}

// Work plan items. The schema has no quantity column at all; plannedQuantity
// (required by the domain) loads as a zero placeholder until one is added.

export interface WorkPlanItemRow {
  id: string
  legacy_id: string | null
  project_id: string
  project_unit_id: string | null
  stage_id: string | null
  trade_id: string | null
  work_type_id: string | null
  title: string
  planned_start: string | null
  planned_end: string | null
  status: string
  created_at: string
}

export function workPlanItemFromRow(row: WorkPlanItemRow, toDomain: ToDomainId = identity): WorkPlanItem {
  return {
    id: ownId(row),
    projectId: toDomain(row.project_id),
    projectUnitId: row.project_unit_id ? toDomain(row.project_unit_id) : "",
    stageId: row.stage_id ? toDomain(row.stage_id) : "",
    tradeId: row.trade_id ? toDomain(row.trade_id) : "",
    workTypeId: row.work_type_id ? toDomain(row.work_type_id) : "",
    plannedQuantity: { value: 0, unit: "nos" },
    plannedStart: row.planned_start ?? undefined,
    dueDate: row.planned_end ?? undefined,
    status: row.status as WorkPlanItem["status"],
    createdAt: row.created_at,
  }
}

// Tasks. The schema does not store priority, checklist items or who created
// the row; these load as placeholders (see task-17 report).

export interface TaskRow {
  id: string
  legacy_id: string | null
  project_id: string
  work_plan_item_id: string | null
  project_unit_id: string | null
  stage_id: string | null
  trade_id: string | null
  work_type_id: string | null
  title: string
  status: string
  planned_quantity: number | null
  planned_quantity_unit: string | null
  completed_quantity: number | null
  completed_quantity_unit: string | null
  created_at: string
}

function quantityFrom(value: number | null, unit: string | null): Quantity | undefined {
  if (value === null || unit === null) return undefined
  return { value, unit: unit as QuantityUnit }
}

export function taskFromRow(row: TaskRow, toDomain: ToDomainId = identity): Task {
  return {
    id: ownId(row),
    projectId: toDomain(row.project_id),
    projectUnitId: row.project_unit_id ? toDomain(row.project_unit_id) : "",
    stageId: row.stage_id ? toDomain(row.stage_id) : "",
    tradeId: row.trade_id ? toDomain(row.trade_id) : "",
    workTypeId: row.work_type_id ? toDomain(row.work_type_id) : "",
    templateId: row.work_plan_item_id ? toDomain(row.work_plan_item_id) : undefined,
    title: row.title,
    status: row.status as TaskStatus,
    priority: "medium",
    plannedQuantity: quantityFrom(row.planned_quantity, row.planned_quantity_unit),
    completedQuantity: quantityFrom(row.completed_quantity, row.completed_quantity_unit),
    checklist: [] as TaskChecklistItem[],
    createdByMembershipId: "",
    createdAt: row.created_at,
    updatedAt: row.created_at,
  }
}

// Daily progress, plus the review and publication rows merged onto it. The
// review/publication tables hold at most one row per daily_progress id (a
// correction is a new daily_progress row, not a second review).

export interface DailyProgressRow {
  id: string
  legacy_id: string | null
  project_id: string
  project_unit_id: string
  task_id: string | null
  stage_id: string
  trade_id: string
  work_type_id: string
  date: string
  workers_present: number
  planned_quantity: number | null
  planned_quantity_unit: string | null
  completed_quantity: number | null
  completed_quantity_unit: string | null
  progress_before: number | null
  progress_after: number | null
  yesterday_summary: string | null
  today_summary: string
  tomorrow_plan: string
  blocker_summary: string | null
  submitted_by_membership_id: string
  submitted_at: string
  review_status: string
  publication_status: string
  version: number
  supersedes_id: string | null
  superseded_by_id: string | null
  created_at: string
}

export interface ProgressReviewRow {
  id: string
  legacy_id: string | null
  daily_progress_id: string
  decision: string
  note: string | null
  reviewer_membership_id: string
  reviewed_at: string
}

export interface ProgressPublicationRow {
  id: string
  legacy_id: string | null
  daily_progress_id: string
  published_by_membership_id: string
  published_at: string
}

export function progressReviewFromRow(row: ProgressReviewRow, toDomain: ToDomainId = identity): ProgressReview {
  return {
    decision: row.decision as ReviewDecision,
    note: row.note ?? undefined,
    reviewedByMembershipId: toDomain(row.reviewer_membership_id),
    reviewedAt: row.reviewed_at,
  }
}

export function progressPublicationFromRow(
  row: ProgressPublicationRow,
  evidenceIds: EntityId[],
  toDomain: ToDomainId = identity,
): ProgressPublication {
  return {
    publishedByMembershipId: toDomain(row.published_by_membership_id),
    publishedAt: row.published_at,
    evidenceIds,
  }
}

export function dailyProgressFromRow(
  row: DailyProgressRow,
  toDomain: ToDomainId = identity,
  review?: ProgressReview,
  publication?: ProgressPublication,
): DailyProgress {
  return {
    id: ownId(row),
    projectId: toDomain(row.project_id),
    projectUnitId: toDomain(row.project_unit_id),
    taskId: row.task_id ? toDomain(row.task_id) : undefined,
    stageId: toDomain(row.stage_id),
    tradeId: toDomain(row.trade_id),
    workTypeId: toDomain(row.work_type_id),
    date: row.date,
    workersPresent: row.workers_present,
    plannedQuantity: quantityFrom(row.planned_quantity, row.planned_quantity_unit),
    completedQuantity: quantityFrom(row.completed_quantity, row.completed_quantity_unit),
    progressBefore: row.progress_before ?? undefined,
    progressAfter: row.progress_after ?? undefined,
    yesterdaySummary: row.yesterday_summary ?? undefined,
    todaySummary: row.today_summary,
    tomorrowPlan: row.tomorrow_plan,
    blockerSummary: row.blocker_summary ?? undefined,
    evidenceIds: [],
    submittedByMembershipId: toDomain(row.submitted_by_membership_id),
    submittedAt: row.submitted_at,
    reviewStatus: row.review_status as ReviewStatus,
    publicationStatus: row.publication_status as DailyProgress["publicationStatus"],
    version: row.version,
    supersedesId: row.supersedes_id ? toDomain(row.supersedes_id) : undefined,
    supersededById: row.superseded_by_id ? toDomain(row.superseded_by_id) : undefined,
    review,
    publication,
  }
}

// Evidence

export interface EvidenceRow {
  id: string
  legacy_id: string | null
  project_id: string
  project_unit_id: string | null
  task_id: string | null
  daily_progress_id: string | null
  issue_id: string | null
  type: string
  url: string
  thumbnail_url: string | null
  caption: string | null
  captured_by_membership_id: string | null
  captured_by_worker_id: string | null
  captured_at: string
  customer_visibility: string
}

export function evidenceFromRow(row: EvidenceRow, toDomain: ToDomainId = identity): Evidence {
  return {
    id: ownId(row),
    projectId: toDomain(row.project_id),
    projectUnitId: row.project_unit_id ? toDomain(row.project_unit_id) : undefined,
    taskId: row.task_id ? toDomain(row.task_id) : undefined,
    dailyProgressId: row.daily_progress_id ? toDomain(row.daily_progress_id) : undefined,
    type: row.type as EvidenceType,
    url: row.url,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    caption: row.caption ?? undefined,
    capturedByMembershipId: row.captured_by_membership_id ? toDomain(row.captured_by_membership_id) : undefined,
    capturedByWorkerId: row.captured_by_worker_id ? toDomain(row.captured_by_worker_id) : undefined,
    capturedAt: row.captured_at,
    customerVisibility: row.customer_visibility as Evidence["customerVisibility"],
  }
}

// Documents

export interface DocumentRow {
  id: string
  legacy_id: string | null
  project_id: string
  title: string
  category: string
  url: string
  uploaded_by_membership_id: string | null
  shared_with_homeowner: boolean
  created_at: string
}

export function documentFromRow(row: DocumentRow, toDomain: ToDomainId = identity): Document {
  return {
    id: ownId(row),
    projectId: toDomain(row.project_id),
    title: row.title,
    category: row.category as Document["category"],
    url: row.url,
    uploadedByMembershipId: row.uploaded_by_membership_id ? toDomain(row.uploaded_by_membership_id) : "",
    customerVisibility: row.shared_with_homeowner ? "customer-visible" : "private",
    createdAt: row.created_at,
  }
}

// Issues. evidenceIds has no column of its own on this table -- it is derived
// by the caller from evidence rows whose issue_id (migration 0017) points here
// and passed in, same pattern as dailyProgressFromRow's evidenceIds.

export interface IssueRow {
  id: string
  legacy_id: string | null
  project_id: string
  project_unit_id: string | null
  stage_id: string | null
  trade_id: string | null
  task_id: string | null
  daily_progress_id: string | null
  title: string
  description: string
  severity: string
  status: string
  assigned_membership_id: string | null
  customer_visible: boolean
  created_by_membership_id: string
  created_at: string
  updated_at: string | null
  resolved_at: string | null
  resolution_note: string | null
  closed_at: string | null
}

export function issueFromRow(
  row: IssueRow,
  toDomain: ToDomainId = identity,
  evidenceIds: EntityId[] = [],
): Issue {
  return {
    id: ownId(row),
    projectId: toDomain(row.project_id),
    projectUnitId: row.project_unit_id ? toDomain(row.project_unit_id) : undefined,
    stageId: row.stage_id ? toDomain(row.stage_id) : undefined,
    tradeId: row.trade_id ? toDomain(row.trade_id) : undefined,
    taskId: row.task_id ? toDomain(row.task_id) : undefined,
    dailyProgressId: row.daily_progress_id ? toDomain(row.daily_progress_id) : undefined,
    title: row.title,
    description: row.description,
    severity: row.severity as Issue["severity"],
    status: row.status as Issue["status"],
    assignedMembershipId: row.assigned_membership_id ? toDomain(row.assigned_membership_id) : undefined,
    evidenceIds,
    customerVisibility: row.customer_visible ? "customer-visible" : "private",
    createdByMembershipId: toDomain(row.created_by_membership_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    resolutionNote: row.resolution_note ?? undefined,
    closedAt: row.closed_at ?? undefined,
  }
}

// Threads, messages, thread reads, call logs

export interface ThreadRow {
  id: string
  legacy_id: string | null
  project_id: string
  subject: string
  target_id: string | null
  audience: string
  participant_membership_ids: string[]
  created_at: string
  last_message_at: string | null
}

export function threadFromRow(row: ThreadRow, toDomain: ToDomainId = identity): Thread {
  return {
    id: ownId(row),
    projectId: toDomain(row.project_id),
    subject: row.subject as ThreadSubject,
    targetId: row.target_id ? toDomain(row.target_id) : undefined,
    audience: row.audience as Thread["audience"],
    participantMembershipIds: row.participant_membership_ids.length
      ? row.participant_membership_ids.map(toDomain)
      : undefined,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at ?? undefined,
  }
}

export interface MessageRow {
  id: string
  legacy_id: string | null
  thread_id: string
  author_membership_id: string
  body: string | null
  voice_url: string | null
  voice_duration_sec: number | null
  voice_transcript: string | null
  created_at: string
}

export function messageFromRow(row: MessageRow, toDomain: ToDomainId = identity): Message {
  return {
    id: ownId(row),
    threadId: toDomain(row.thread_id),
    authorMembershipId: toDomain(row.author_membership_id),
    body: row.body ?? undefined,
    voice: row.voice_url
      ? {
          url: row.voice_url,
          durationSec: row.voice_duration_sec ?? undefined,
          transcript: row.voice_transcript ?? undefined,
        }
      : undefined,
    createdAt: row.created_at,
  }
}

export interface ThreadReadRow {
  thread_id: string
  membership_id: string
  last_read_at: string
}

export function threadReadFromRow(row: ThreadReadRow, toDomain: ToDomainId = identity): ThreadRead {
  return {
    threadId: toDomain(row.thread_id),
    membershipId: toDomain(row.membership_id),
    lastReadAt: row.last_read_at,
  }
}

export interface CallLogRow {
  id: string
  legacy_id: string | null
  thread_id: string
  logged_by_membership_id: string
  other_membership_id: string | null
  type: string
  started_at: string
  duration_minutes: number
  note: string | null
  created_at: string
}

export function callLogFromRow(row: CallLogRow, toDomain: ToDomainId = identity): CallLog {
  return {
    id: ownId(row),
    threadId: toDomain(row.thread_id),
    loggedByMembershipId: toDomain(row.logged_by_membership_id),
    otherMembershipId: row.other_membership_id ? toDomain(row.other_membership_id) : "",
    type: row.type as CallLog["type"],
    startedAt: row.started_at,
    durationMinutes: row.duration_minutes,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  }
}

// Estimates. The schema has no estimate-lines table; lines loads as [] until
// one exists (see task-17 report).

export interface EstimateRow {
  id: string
  legacy_id: string | null
  homeowner_person_id: string
  project_name: string
  property_type: string
  location: string
  built_up_area_sqft: number
  floors: number
  construction_level: string
  total_low: number
  total_high: number
  breakdown: { materials?: number; labour?: number; finishing?: number; contingency?: number } | null
  review_status: string
  created_at: string
}

export function estimateFromRow(row: EstimateRow, toDomain: ToDomainId = identity): Estimate {
  return {
    id: ownId(row),
    homeownerPersonId: toDomain(row.homeowner_person_id),
    projectName: row.project_name,
    propertyType: row.property_type,
    location: row.location,
    builtUpAreaSqft: row.built_up_area_sqft,
    floors: row.floors,
    constructionLevel: row.construction_level as ConstructionLevel,
    totalLow: row.total_low,
    totalHigh: row.total_high,
    breakdown: {
      materials: row.breakdown?.materials ?? 0,
      labour: row.breakdown?.labour ?? 0,
      finishing: row.breakdown?.finishing ?? 0,
      contingency: row.breakdown?.contingency ?? 0,
    },
    lines: [],
    source: "ai",
    confidence: "medium",
    createdBy: "ai",
    reviewStatus: row.review_status as EstimateReviewStatus,
    createdAt: row.created_at,
  }
}

// Marketplace requirements. Business/partner callers see the preview view's
// rounded, city-only columns for a requirement they have not unlocked, and
// the full base-table row (this schema's RLS policy grants it automatically)
// once they have — mirroring src/domain/marketplaceVisibility.ts viewRequirement.

export interface MarketplaceRequirementRow {
  id: string
  legacy_id: string | null
  estimate_id: string
  homeowner_person_id: string
  project_name: string
  location: string
  built_up_area_sqft: number
  construction_level: string
  property_type: string
  estimate_total_low: number
  estimate_total_high: number
  status: string
  posted_at: string | null
  awarded_proposal_id: string | null
  created_at: string
}

export function marketplaceRequirementFromRow(
  row: MarketplaceRequirementRow,
  toDomain: ToDomainId = identity,
): MarketplaceRequirement {
  return {
    id: ownId(row),
    estimateId: toDomain(row.estimate_id),
    homeownerPersonId: toDomain(row.homeowner_person_id),
    projectName: row.project_name,
    location: row.location,
    builtUpAreaSqft: row.built_up_area_sqft,
    constructionLevel: row.construction_level as ConstructionLevel,
    propertyType: row.property_type,
    estimateTotalLow: row.estimate_total_low,
    estimateTotalHigh: row.estimate_total_high,
    status: row.status as MarketplaceRequirement["status"],
    postedAt: row.posted_at ?? undefined,
    awardedProposalId: row.awarded_proposal_id ? toDomain(row.awarded_proposal_id) : undefined,
    createdAt: row.created_at,
  }
}

/** marketplace_requirement_previews: columns visible to a partner who has not unlocked this requirement. */
export interface MarketplaceRequirementPreviewRow {
  id: string
  location: string
  property_type: string
  area_band: string
  estimate_total_low: number
  estimate_total_high: number
  status: string
}

/**
 * Builds a MarketplaceRequirement from the preview view alone. Fields the
 * preview does not expose (projectName, exact builtUpAreaSqft,
 * constructionLevel, estimateId, homeownerPersonId, createdAt) are not
 * knowable until unlock and load as placeholders; the adapter overwrites them
 * with the full row's values once an unlock exists (see loadState).
 */
export function marketplaceRequirementFromPreviewRow(
  row: MarketplaceRequirementPreviewRow,
  toDomain: ToDomainId = identity,
): MarketplaceRequirement {
  return {
    id: toDomain(row.id),
    estimateId: "",
    homeownerPersonId: "",
    projectName: "",
    location: row.location,
    builtUpAreaSqft: 0,
    constructionLevel: "standard",
    propertyType: row.property_type,
    estimateTotalLow: row.estimate_total_low,
    estimateTotalHigh: row.estimate_total_high,
    status: row.status as MarketplaceRequirement["status"],
    createdAt: "",
  }
}

// Marketplace unlocks

export interface MarketplaceUnlockRow {
  id: string
  legacy_id: string | null
  requirement_id: string
  partner_organization_id: string
  unlocked_at: string
  credit_transaction_id: string
}

export function marketplaceUnlockFromRow(
  row: MarketplaceUnlockRow,
  toDomain: ToDomainId = identity,
): MarketplaceUnlock {
  return {
    id: ownId(row),
    requirementId: toDomain(row.requirement_id),
    partnerOrganizationId: toDomain(row.partner_organization_id),
    unlockedAt: row.unlocked_at,
    creditTransactionId: toDomain(row.credit_transaction_id),
  }
}

// Proposals. Lines come from catalog_estimate_lines (category/item/quantity/
// unit/rate/amount/confidence only); id, source and effectiveDate have no
// backing columns and are filled in per line.

export interface ProposalLineRow {
  category: string
  item: string
  quantity: number
  unit: string
  rate: number
  amount: number
  confidence: string
}

export interface ProposalRow {
  id: string
  legacy_id: string | null
  requirement_id: string
  partner_organization_id: string
  submitted_by_person_id: string
  lines: ProposalLineRow[]
  total: number
  assumptions: string[]
  exclusions: string[]
  status: string
  submitted_at: string
}

export function proposalFromRow(row: ProposalRow, toDomain: ToDomainId = identity): Proposal {
  return {
    id: ownId(row),
    requirementId: toDomain(row.requirement_id),
    partnerOrganizationId: toDomain(row.partner_organization_id),
    submittedByPersonId: toDomain(row.submitted_by_person_id),
    lines: (row.lines ?? []).map((line, index) => ({
      id: `${ownId(row)}-line-${index}`,
      category: line.category as EstimateLineCategory,
      item: line.item,
      quantity: line.quantity,
      unit: line.unit,
      rate: line.rate,
      amount: line.amount,
      source: "catalog",
      effectiveDate: row.submitted_at,
      confidence: line.confidence as EstimateLine["confidence"],
    })),
    total: row.total,
    assumptions: row.assumptions ?? [],
    exclusions: row.exclusions ?? [],
    status: row.status as ProposalStatus,
    submittedAt: row.submitted_at,
  }
}

// Plans, subscriptions, credits

export interface PlanRow {
  id: string
  legacy_id: string | null
  name: string
  price_label: string
  entitlements: string[]
  monthly_credits: number
}

export function planFromRow(row: PlanRow): Plan {
  return {
    id: ownId(row),
    name: row.name,
    priceLabel: row.price_label,
    entitlements: row.entitlements as EntitlementKey[],
    monthlyCredits: row.monthly_credits,
  }
}

export interface SubscriptionRow {
  id: string
  legacy_id: string | null
  organization_id: string
  plan_id: string
  status: string
  started_at: string
}

export function subscriptionFromRow(row: SubscriptionRow, toDomain: ToDomainId = identity): Subscription {
  return {
    id: ownId(row),
    organizationId: toDomain(row.organization_id),
    planId: toDomain(row.plan_id),
    status: row.status as SubscriptionStatus,
    startedAt: row.started_at,
  }
}

export interface CreditWalletRow {
  organization_id: string
  balance: number
}

export function creditWalletFromRow(row: CreditWalletRow, toDomain: ToDomainId = identity): CreditWallet {
  return {
    organizationId: toDomain(row.organization_id),
    balance: row.balance,
  }
}

export interface CreditTransactionRow {
  id: string
  legacy_id: string | null
  organization_id: string
  kind: string
  amount: number
  balance_after: number
  requirement_id: string | null
  created_at: string
}

export function creditTransactionFromRow(
  row: CreditTransactionRow,
  toDomain: ToDomainId = identity,
): CreditTransaction {
  return {
    id: ownId(row),
    organizationId: toDomain(row.organization_id),
    kind: row.kind as CreditTransactionKind,
    amount: row.amount,
    balanceAfter: row.balance_after,
    requirementId: row.requirement_id ? toDomain(row.requirement_id) : undefined,
    createdAt: row.created_at,
  }
}
