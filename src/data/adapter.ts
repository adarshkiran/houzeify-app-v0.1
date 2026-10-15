// Repository adapter: reads the Supabase tables into a ConstructionDataState
// and sends each B4 write to its Postgres function. It holds no domain rules;
// those stay in src/domain and in the functions themselves.

import type { SupabaseClient } from "@supabase/supabase-js"
import { ConflictError, IntegrityError } from "../domain/errors"
import type {
  BusinessProfileInput,
  AddEvidenceInput,
  AddLibraryStageInput,
  AddLibraryTradeInput,
  AddLibraryWorkTypeInput,
  AddProjectUnitInput,
  AddWorkerInput,
  AddWorkPlanItemInput,
  AssignWorkerToProjectInput,
  CreateProjectInput,
  CreateTaskInput,
  InviteProjectMemberInput,
  IssueEvidenceInput,
  ReportIssueInput,
  ResubmitDailyProgressInput,
  SubmitDailyProgressInput,
  UploadDocumentInput,
} from "../domain/commandInputs"
import type { LogCallInput, PostMessageInput } from "../domain/conversationCommands"
import type { GenerateEstimateInput } from "../domain/estimateCommands"
import type {
  CallLog,
  ConstructionDataState,
  ConstructionStage,
  CreditWallet,
  DailyProgress,
  Document,
  EntityId,
  Estimate,
  Evidence,
  Issue,
  MarketplaceRequirement,
  MarketplaceUnlock,
  Message,
  Project,
  ProjectMembership,
  ProjectUnit,
  Proposal,
  ReviewDecision,
  Task,
  TaskAssignment,
  TaskStatus,
  TaskTemplate,
  Thread,
  Trade,
  WorkPlanItem,
  Worker,
  WorkerAttendance,
  WorkerOnboarding,
  WorkerProjectAssignment,
  WorkType,
  SavedProjectReport,
} from "../domain/models"
import type { ProjectReport } from "../domain/projectAnalysis"
import { PermissionError } from "../domain/session"
import type { Permission } from "../domain/permissions"
import {
  callLogFromRow,
  creditTransactionFromRow,
  projectReportFromRow,
  creditWalletFromRow,
  dailyProgressFromRow,
  documentFromRow,
  estimateFromRow,
  evidenceFromRow,
  issueFromRow,
  marketplaceRequirementFromPreviewRow,
  marketplaceRequirementFromRow,
  marketplaceUnlockFromRow,
  membershipFromRow,
  messageFromRow,
  organizationFromRow,
  personFromRow,
  planFromRow,
  progressPublicationFromRow,
  progressReviewFromRow,
  projectFromRow,
  projectUnitFromRow,
  proposalFromRow,
  stageFromRow,
  subscriptionFromRow,
  taskAssignmentFromRow,
  taskFromRow,
  taskTemplateFromRow,
  threadFromRow,
  threadReadFromRow,
  tradeFromRow,
  workerAttendanceFromRow,
  workerFromRow,
  workerOnboardingFromRow,
  workerProjectAssignmentFromRow,
  workPlanItemFromRow,
  workTypeFromRow,
  type CallLogRow,
  type CreditTransactionRow,
  type ProjectReportRow,
  type CreditWalletRow,
  type DailyProgressRow,
  type DocumentRow,
  type EstimateRow,
  type EvidenceRow,
  type IssueRow,
  type MarketplaceRequirementPreviewRow,
  type MarketplaceRequirementRow,
  type MarketplaceUnlockRow,
  type MembershipRow,
  type MessageRow,
  type OrganizationRow,
  type PersonRow,
  type PlanRow,
  type ProgressPublicationRow,
  type ProgressReviewRow,
  type ProjectRow,
  type ProjectUnitRow,
  type ProposalRow,
  type StageRow,
  type SubscriptionRow,
  type TaskAssignmentRow,
  type TaskRow,
  type TaskTemplateRow,
  type ThreadReadRow,
  type ThreadRow,
  type TradeRow,
  type ToDomainId,
  type WorkerAttendanceRow,
  type WorkerOnboardingRow,
  type WorkerProjectAssignmentRow,
  type WorkerRow,
  type WorkPlanItemRow,
  type WorkTypeRow,
} from "./rows"

type Keyed = { id: string; legacy_id: string | null }

/** Domain id → uuid for each client, filled by loadState, used when a write names an id. */
const uuidByDomainId = new WeakMap<SupabaseClient, Map<EntityId, string>>()

// PostgREST caps a response at max_rows (supabase/config.toml, 1000) and truncates
// silently. The first page is read exactly as before (natural order, one request),
// which is all a table under the cap ever needs. Only a full first page can mean
// truncation, so then every page is re-read in a stable order until one is short.
const PAGE_SIZE = 1000

export async function selectAll<T>(
  client: SupabaseClient,
  table: string,
  orderBy: string | string[] = "id",
): Promise<T[]> {
  const first = await client.from(table).select("*").range(0, PAGE_SIZE - 1)
  if (first.error) throw refusalFrom(first.error.message, first.error.code)
  const firstRows = (first.data ?? []) as T[]
  if (firstRows.length < PAGE_SIZE) return firstRows

  const columns = Array.isArray(orderBy) ? orderBy : [orderBy]
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.from(table).select("*")
    for (const column of columns) query = query.order(column)
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) throw refusalFrom(error.message, error.code)
    rows.push(...((data ?? []) as T[]))
    if ((data?.length ?? 0) < PAGE_SIZE) return rows
  }
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
    projectReports: [],
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
    workTypes,
    taskTemplates,
    workPlanItems,
    tasks,
    taskAssignments,
    dailyProgressRows,
    progressReviews,
    progressPublications,
    evidence,
    documents,
    issues,
    threads,
    messages,
    threadReads,
    callLogs,
    estimates,
    marketplaceRequirements,
    marketplaceRequirementPreviews,
    marketplaceUnlocks,
    proposals,
    plans,
    subscriptions,
    creditWallets,
    creditTransactions,
    projectReports,
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
    selectAll<WorkTypeRow & Keyed>(client, "work_types"),
    selectAll<TaskTemplateRow & Keyed>(client, "task_templates"),
    selectAll<WorkPlanItemRow & Keyed>(client, "work_plan_items"),
    selectAll<TaskRow & Keyed>(client, "tasks"),
    selectAll<TaskAssignmentRow & Keyed>(client, "task_assignments"),
    selectAll<DailyProgressRow & Keyed>(client, "daily_progress"),
    selectAll<ProgressReviewRow & Keyed>(client, "progress_reviews"),
    selectAll<ProgressPublicationRow & Keyed>(client, "progress_publications"),
    selectAll<EvidenceRow & Keyed>(client, "evidence"),
    selectAll<DocumentRow & Keyed>(client, "documents"),
    selectAll<IssueRow & Keyed>(client, "issues"),
    selectAll<ThreadRow & Keyed>(client, "threads"),
    selectAll<MessageRow & Keyed>(client, "messages"),
    selectAll<ThreadReadRow>(client, "thread_reads", ["thread_id", "membership_id"]),
    selectAll<CallLogRow & Keyed>(client, "call_logs"),
    selectAll<EstimateRow & Keyed>(client, "estimates"),
    selectAll<MarketplaceRequirementRow & Keyed>(client, "marketplace_requirements"),
    selectAll<MarketplaceRequirementPreviewRow>(client, "marketplace_requirement_previews"),
    selectAll<MarketplaceUnlockRow & Keyed>(client, "marketplace_unlocks"),
    selectAll<ProposalRow & Keyed>(client, "proposals"),
    selectAll<PlanRow & Keyed>(client, "plans"),
    selectAll<SubscriptionRow & Keyed>(client, "subscriptions"),
    selectAll<CreditWalletRow>(client, "credit_wallets", "organization_id"),
    selectAll<CreditTransactionRow & Keyed>(client, "credit_transactions"),
    selectAll<ProjectReportRow>(client, "project_reports"),
  ])

  const domainByUuid = new Map<string, EntityId>()
  const uuidByDomain = new Map<EntityId, string>()
  for (const rows of [
    organizations,
    people,
    projects,
    units,
    stages,
    trades,
    workers,
    onboardings,
    assignments,
    attendance,
    memberships,
    workTypes,
    taskTemplates,
    workPlanItems,
    tasks,
    taskAssignments,
    dailyProgressRows,
    progressReviews,
    progressPublications,
    evidence,
    documents,
    issues,
    threads,
    messages,
    callLogs,
    estimates,
    marketplaceRequirements,
    marketplaceUnlocks,
    proposals,
    plans,
    subscriptions,
    creditTransactions,
  ]) {
    for (const row of rows) {
      const domainId = row.legacy_id ?? row.id
      domainByUuid.set(row.id, domainId)
      uuidByDomain.set(domainId, row.id)
    }
  }
  uuidByDomainId.set(client, uuidByDomain)
  const toDomain: ToDomainId = (uuid) => domainByUuid.get(uuid) ?? uuid

  // Evidence that a published daily_progress update shared with the homeowner,
  // grouped back onto the progress row so dailyProgressFromRow's publication
  // carries the right evidenceIds (publish_daily_progress makes the shared
  // evidence customer-visible but does not store the id list anywhere else).
  const evidenceIdsByProgress = new Map<string, EntityId[]>()
  for (const row of evidence) {
    if (!row.daily_progress_id) continue
    const list = evidenceIdsByProgress.get(row.daily_progress_id) ?? []
    list.push(row.legacy_id ?? row.id)
    evidenceIdsByProgress.set(row.daily_progress_id, list)
  }

  const reviewByProgress = new Map<string, ReturnType<typeof progressReviewFromRow>>()
  for (const row of progressReviews) reviewByProgress.set(row.daily_progress_id, progressReviewFromRow(row, toDomain))

  const publicationByProgress = new Map<string, ReturnType<typeof progressPublicationFromRow>>()
  for (const row of progressPublications) {
    publicationByProgress.set(
      row.daily_progress_id,
      progressPublicationFromRow(row, evidenceIdsByProgress.get(row.daily_progress_id) ?? [], toDomain),
    )
  }

  const dailyProgressWithEvidenceIds = dailyProgressRows.map((row) => ({
    ...dailyProgressFromRow(row, toDomain, reviewByProgress.get(row.id), publicationByProgress.get(row.id)),
    evidenceIds: evidenceIdsByProgress.get(row.id) ?? [],
  }))

  // Evidence attached to an issue (migration 0017's evidence.issue_id), grouped
  // back onto the issue the same way progress evidence is grouped above.
  const evidenceIdsByIssue = new Map<string, EntityId[]>()
  for (const row of evidence) {
    if (!row.issue_id) continue
    const list = evidenceIdsByIssue.get(row.issue_id) ?? []
    list.push(row.legacy_id ?? row.id)
    evidenceIdsByIssue.set(row.issue_id, list)
  }

  // Marketplace requirements: the preview view gives every posted requirement
  // a business member can see; the base table (RLS: owner or unlocked
  // partner, migration 0005) gives the full row wherever the caller may read
  // it. Full rows always win — mirrors src/domain/marketplaceVisibility.ts
  // viewRequirement, which only falls back to the rounded preview until unlock.
  const requirementById = new Map<string, MarketplaceRequirement>()
  for (const row of marketplaceRequirementPreviews) {
    requirementById.set(row.id, marketplaceRequirementFromPreviewRow(row, toDomain))
  }
  for (const row of marketplaceRequirements) {
    requirementById.set(row.id, marketplaceRequirementFromRow(row, toDomain))
  }

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
    workTypes: workTypes.map((r) => workTypeFromRow(r, toDomain)),
    taskTemplates: taskTemplates.map((r) => taskTemplateFromRow(r, toDomain)),
    workPlanItems: workPlanItems.map((r) => workPlanItemFromRow(r, toDomain)),
    tasks: tasks.map((r) => taskFromRow(r, toDomain)),
    assignments: taskAssignments.map((r) => taskAssignmentFromRow(r, toDomain)),
    dailyProgress: dailyProgressWithEvidenceIds,
    evidence: evidence.map((r) => evidenceFromRow(r, toDomain)),
    documents: documents.map((r) => documentFromRow(r, toDomain)),
    issues: issues.map((r) => issueFromRow(r, toDomain, evidenceIdsByIssue.get(r.id) ?? [])),
    threads: threads.map((r) => threadFromRow(r, toDomain)),
    messages: messages.map((r) => messageFromRow(r, toDomain)),
    threadReads: threadReads.map((r) => threadReadFromRow(r, toDomain)),
    callLogs: callLogs.map((r) => callLogFromRow(r, toDomain)),
    estimates: estimates.map((r) => estimateFromRow(r, toDomain)),
    requirements: [...requirementById.values()],
    unlocks: marketplaceUnlocks.map((r) => marketplaceUnlockFromRow(r, toDomain)),
    proposals: proposals.map((r) => proposalFromRow(r, toDomain)),
    plans: plans.map((r) => planFromRow(r)),
    subscriptions: subscriptions.map((r) => subscriptionFromRow(r, toDomain)),
    wallets: creditWallets.map((r) => creditWalletFromRow(r, toDomain)),
    creditTransactions: creditTransactions.map((r) => creditTransactionFromRow(r, toDomain)),
    projectReports: projectReports.map((r) => projectReportFromRow(r, toDomain)),
  }
}

/**
 * Hand-written sentences the B4 functions raise without a `conflict:` prefix and
 * with no placeholders, so they are safe to show. src/data/refusals.test.ts fails
 * when a migration adds another unclassified one.
 */
export const USER_FACING_RAISES: readonly string[] = [
  "Give the issue a title.",
  "A unit, task or issue conversation needs its target.",
  "Stage and trade are required to add a work type",
  "The conversation message for this record wasn't found.",
]

/**
 * A failure from a B4 function or table read. `conflict:` and `permission:`
 * prefixes become typed errors, as do known user-facing sentences. Anything else
 * carrying a database code (an unprefixed raise naming ids, a constraint, a
 * syntax or RLS error) becomes a bare IntegrityError, which describeCommandError
 * renders with fixed text, so raw Postgres wording never reaches the UI.
 */
export function refusalFrom(message: string, code?: string): Error {
  if (message.startsWith("conflict:")) return new ConflictError(message.slice("conflict:".length))
  if (message.startsWith("permission:")) {
    const quoted = /"([^"]+)"/.exec(message)
    return new PermissionError((quoted?.[1] ?? "") as Permission)
  }
  if (USER_FACING_RAISES.includes(message)) return new ConflictError(message)
  if (!code) return new Error(message)
  console.warn(`[supabase] unmapped database error ${code}: ${message}`)
  if (code === "42501") return new PermissionError("" as Permission)
  return new IntegrityError(message)
}

function uuidOf(client: SupabaseClient, id: EntityId): string {
  return uuidByDomainId.get(client)?.get(id) ?? id
}

async function callFunction(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await client.rpc(name, args)
  if (error) throw refusalFrom(error.message, error.code)
  return data
}

export interface RequirementRef {
  requirementId: EntityId
  organizationId: EntityId
}

export async function unlockRequirement(client: SupabaseClient, input: RequirementRef): Promise<MarketplaceUnlock> {
  const row = await callFunction(client, "unlock_requirement", {
    requirement_id: uuidOf(client, input.requirementId),
    organization_id: uuidOf(client, input.organizationId),
  })
  return marketplaceUnlockFromRow(row as MarketplaceUnlockRow)
}

export async function submitProposal(
  client: SupabaseClient,
  input: RequirementRef & { assumptions: string[]; exclusions: string[] },
): Promise<Proposal> {
  const row = await callFunction(client, "submit_proposal", {
    requirement_id: uuidOf(client, input.requirementId),
    organization_id: uuidOf(client, input.organizationId),
    assumptions: input.assumptions,
    exclusions: input.exclusions,
  })
  return proposalFromRow(row as ProposalRow)
}

export async function selectProposal(client: SupabaseClient, input: { proposalId: EntityId }): Promise<Project> {
  const row = await callFunction(client, "select_proposal", { proposal_id: uuidOf(client, input.proposalId) })
  return projectFromRow(row as ProjectRow)
}

export async function generateEstimate(
  client: SupabaseClient,
  input: GenerateEstimateInput,
): Promise<Estimate> {
  const row = await callFunction(client, "generate_estimate", {
    project_name: input.projectName,
    property_type: input.propertyType,
    location: input.location,
    built_up_area_sqft: input.builtUpAreaSqft,
    floors: input.floors,
    construction_level: input.constructionLevel,
  })
  return estimateFromRow(row as EstimateRow)
}

/**
 * Saves a report the person reviewed as an approved snapshot. The report holds
 * domain ids; only its projectId is swapped for the project's uuid, which the
 * function checks against the project it is approving for.
 */
export async function approveProjectReport(
  client: SupabaseClient,
  input: { report: ProjectReport },
): Promise<SavedProjectReport> {
  const projectUuid = uuidOf(client, input.report.projectId)
  const row = await callFunction(client, "approve_project_report", {
    project_id: projectUuid,
    payload: { ...input.report, projectId: projectUuid },
  })
  return projectReportFromRow(row as ProjectReportRow, (id) => (id === projectUuid ? input.report.projectId : id))
}

export async function confirmEstimate(client: SupabaseClient, input: { estimateId: EntityId }): Promise<Estimate> {
  const row = await callFunction(client, "confirm_estimate", { estimate_id: uuidOf(client, input.estimateId) })
  return estimateFromRow(row as EstimateRow)
}

export async function postRequirement(
  client: SupabaseClient,
  input: { estimateId: EntityId },
): Promise<MarketplaceRequirement> {
  const row = await callFunction(client, "post_requirement", { estimate_id: uuidOf(client, input.estimateId) })
  return marketplaceRequirementFromRow(row as MarketplaceRequirementRow)
}

export async function purchaseCredits(
  client: SupabaseClient,
  input: { organizationId: EntityId; credits: number },
): Promise<CreditWallet> {
  const row = await callFunction(client, "purchase_credits", {
    organization_id: uuidOf(client, input.organizationId),
    credits: input.credits,
  })
  return creditWalletFromRow(row as CreditWalletRow)
}

export async function createWorkerOnboarding(
  client: SupabaseClient,
  input: { workerId: EntityId; method: string },
): Promise<WorkerOnboarding> {
  const row = await callFunction(client, "create_worker_onboarding", {
    worker_id: uuidOf(client, input.workerId),
    method: input.method,
  })
  return workerOnboardingFromRow(row as WorkerOnboardingRow)
}

export async function acceptWorkerOnboarding(
  client: SupabaseClient,
  input: { onboardingId: EntityId; joinCode: string },
): Promise<Worker> {
  const row = await callFunction(client, "accept_worker_onboarding", {
    onboarding_id: uuidOf(client, input.onboardingId),
    join_code: input.joinCode,
  })
  return workerFromRow(row as WorkerRow)
}

export async function acceptOwnWorkerOnboarding(
  client: SupabaseClient,
  input: { onboardingId: EntityId },
): Promise<Worker> {
  const row = await callFunction(client, "accept_own_worker_onboarding", {
    onboarding_id: uuidOf(client, input.onboardingId),
  })
  return workerFromRow(row as WorkerRow)
}

export async function markWorkerJoined(client: SupabaseClient, input: { onboardingId: EntityId }): Promise<Worker> {
  const row = await callFunction(client, "mark_worker_joined", { onboarding_id: uuidOf(client, input.onboardingId) })
  return workerFromRow(row as WorkerRow)
}

export async function endWorkerProjectAssignment(
  client: SupabaseClient,
  input: { assignmentId: EntityId; reason: string },
): Promise<WorkerProjectAssignment> {
  const row = await callFunction(client, "end_worker_project_assignment", {
    assignment_id: uuidOf(client, input.assignmentId),
    reason: input.reason,
  })
  return workerProjectAssignmentFromRow(row as WorkerProjectAssignmentRow)
}

export async function assignWorkerToProject(
  client: SupabaseClient,
  input: AssignWorkerToProjectInput,
): Promise<WorkerProjectAssignment> {
  const row = await callFunction(client, "assign_worker_to_project", {
    worker_id: uuidOf(client, input.workerId),
    project_id: uuidOf(client, input.projectId),
    project_unit_ids: input.projectUnitIds?.length
      ? input.projectUnitIds.map((id) => uuidOf(client, id))
      : null,
    trade_ids: input.tradeIds?.length ? input.tradeIds.map((id) => uuidOf(client, id)) : null,
  })
  return workerProjectAssignmentFromRow(row as WorkerProjectAssignmentRow)
}

export async function addWorker(
  client: SupabaseClient,
  input: AddWorkerInput,
): Promise<{ worker: Worker; assignment?: WorkerProjectAssignment }> {
  const row = await callFunction(client, "add_worker", {
    organization_id: uuidOf(client, input.organizationId),
    name: input.name,
    phone: input.phone ?? null,
    trade_ids: input.tradeIds.map((id) => uuidOf(client, id)),
    languages: input.languages?.length ? input.languages : ["en"],
    project_id: input.projectId ? uuidOf(client, input.projectId) : null,
    project_unit_ids: input.projectUnitIds?.length
      ? input.projectUnitIds.map((id) => uuidOf(client, id))
      : null,
  })
  const result = row as { worker: WorkerRow; assignment: WorkerProjectAssignmentRow | null }
  return {
    worker: workerFromRow(result.worker),
    assignment: result.assignment ? workerProjectAssignmentFromRow(result.assignment) : undefined,
  }
}

export async function inviteProjectMember(
  client: SupabaseClient,
  input: InviteProjectMemberInput,
): Promise<ProjectMembership> {
  const row = await callFunction(client, "invite_project_member", {
    project_id: uuidOf(client, input.projectId),
    name: input.name,
    phone: input.phone ?? null,
    role: input.role,
    project_unit_ids: input.projectUnitIds?.length
      ? input.projectUnitIds.map((id) => uuidOf(client, id))
      : null,
  })
  return membershipFromRow(row as MembershipRow)
}

export async function cancelWorkerOnboarding(
  client: SupabaseClient,
  input: { onboardingId: EntityId },
): Promise<WorkerOnboarding> {
  const row = await callFunction(client, "cancel_worker_onboarding", {
    onboarding_id: uuidOf(client, input.onboardingId),
  })
  return workerOnboardingFromRow(row as WorkerOnboardingRow)
}

export async function checkInWorker(client: SupabaseClient, input: { projectId: EntityId }): Promise<WorkerAttendance> {
  const row = await callFunction(client, "check_in_worker", { project_id: uuidOf(client, input.projectId) })
  return workerAttendanceFromRow(row as WorkerAttendanceRow)
}

export async function checkOutWorker(client: SupabaseClient, input: { projectId: EntityId }): Promise<WorkerAttendance> {
  const row = await callFunction(client, "check_out_worker", { project_id: uuidOf(client, input.projectId) })
  return workerAttendanceFromRow(row as WorkerAttendanceRow)
}

export async function recordAttendance(
  client: SupabaseClient,
  input: {
    projectId: EntityId
    workerId: EntityId
    day: string
    status: string | null
    checkInAt: string | null
    checkOutAt: string | null
  },
): Promise<WorkerAttendance> {
  const row = await callFunction(client, "record_attendance", {
    project_id: uuidOf(client, input.projectId),
    worker_id: uuidOf(client, input.workerId),
    day: input.day,
    status: input.status,
    check_in_at: input.checkInAt,
    check_out_at: input.checkOutAt,
  })
  return workerAttendanceFromRow(row as WorkerAttendanceRow)
}

export async function setAttendancePolicy(
  client: SupabaseClient,
  input: { projectId: EntityId; requireCheckout: boolean },
): Promise<Project> {
  const row = await callFunction(client, "set_attendance_policy", {
    project_id: uuidOf(client, input.projectId),
    require_checkout: input.requireCheckout,
  })
  return projectFromRow(row as ProjectRow)
}

// ─── Project setup (batch 21) ──────────────────────────────────────────────────

/** Deliberately unauthorized: see public.update_organization_profile in migration 0014. */
export async function updateOrganizationProfile(
  client: SupabaseClient,
  input: { organizationId: EntityId; profile: BusinessProfileInput },
): Promise<void> {
  await callFunction(client, "update_organization_profile", {
    organization_id: uuidOf(client, input.organizationId),
    name: input.profile.name,
    kind: input.profile.kind,
    city: input.profile.city,
    phone: input.profile.phone,
    team_size: input.profile.teamSize,
  })
}

export async function createProject(client: SupabaseClient, input: CreateProjectInput): Promise<Project> {
  const row = await callFunction(client, "create_project", {
    organization_id: uuidOf(client, input.organizationId),
    name: input.name,
    kind: input.kind,
    status: input.status,
    location: input.location,
  })
  return projectFromRow(row as ProjectRow)
}

/**
 * project_units has no kind/code/sequence columns yet; only projectId,
 * parentUnitId and name persist. Routed through add_project_units (migration
 * 0024), the only write path that checks the caller's membership scope and
 * that parent_id belongs to the same project -- the direct-table insert this
 * replaced skipped both (task 31 / T2).
 */
export async function addProjectUnit(client: SupabaseClient, input: AddProjectUnitInput): Promise<ProjectUnit> {
  const [unit] = await addProjectUnits(client, [input])
  return unit
}

export async function addProjectUnits(
  client: SupabaseClient,
  inputs: readonly AddProjectUnitInput[],
): Promise<ProjectUnit[]> {
  const data = await callFunction(client, "add_project_units", {
    units: inputs.map((input) => ({
      projectId: uuidOf(client, input.projectId),
      parentId: input.parentUnitId ? uuidOf(client, input.parentUnitId) : null,
      name: input.name,
    })),
  })
  return (data as ProjectUnitRow[]).map((row) => projectUnitFromRow(row))
}

export async function setStageBaselines(
  client: SupabaseClient,
  input: { projectId: EntityId; baselines: Record<EntityId, number> },
): Promise<Project> {
  const baselines: Record<string, number> = {}
  for (const [stageId, value] of Object.entries(input.baselines)) {
    baselines[uuidOf(client, stageId)] = value
  }
  const row = await callFunction(client, "set_stage_baselines", {
    project_id: uuidOf(client, input.projectId),
    baselines,
  })
  return projectFromRow(row as ProjectRow)
}

export async function addLibraryStage(client: SupabaseClient, input: AddLibraryStageInput): Promise<ConstructionStage> {
  const row = await callFunction(client, "add_library_stage", { name: input.name, code: input.code ?? null })
  return stageFromRow(row as StageRow)
}

export async function addLibraryTrade(client: SupabaseClient, input: AddLibraryTradeInput): Promise<Trade> {
  const row = await callFunction(client, "add_library_trade", { name: input.name, code: input.code ?? null })
  return tradeFromRow(row as TradeRow)
}

export async function addLibraryWorkType(
  client: SupabaseClient,
  input: AddLibraryWorkTypeInput,
): Promise<{ workType: WorkType; template: TaskTemplate }> {
  const row = (await callFunction(client, "add_library_work_type", {
    name: input.name,
    stage_id: input.stageId ? uuidOf(client, input.stageId) : null,
    trade_id: input.tradeId ? uuidOf(client, input.tradeId) : null,
    new_stage_name: input.newStageName ?? null,
    new_trade_name: input.newTradeName ?? null,
    default_unit: input.defaultUnit,
  })) as { workType: (WorkTypeRow & { skipped?: boolean }) | null; template: TaskTemplateRow | null }

  if (!row.workType || row.workType.skipped) {
    // Mirrors the domain's "no partial library entries" early return: an unknown
    // stage/trade id passed straight through changes nothing in the database, so
    // this result is constructed, not read back from a row.
    const workType: WorkType = {
      id: `work-${input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
      stageId: input.stageId ?? "",
      tradeId: input.tradeId ?? "",
      code: input.name.trim().toUpperCase(),
      name: input.name.trim(),
      defaultUnit: input.defaultUnit,
    }
    const template: TaskTemplate = {
      id: `template-${workType.id.slice("work-".length)}`,
      workTypeId: workType.id,
      name: `${workType.name} — Standard`,
      checklist: input.checklist?.map((item) => item.trim()).filter(Boolean) ?? [
        `${workType.name} scope confirmed on site`,
        "Quality checks completed before submission",
        "Site evidence captured for review",
      ],
      requiredEvidence: input.requiredEvidence?.length ? input.requiredEvidence : ["photo"],
      defaultUnit: workType.defaultUnit,
      dependencyWorkTypeIds: [],
    }
    return { workType, template }
  }

  return {
    workType: workTypeFromRow(row.workType),
    template: row.template ? taskTemplateFromRow(row.template) : (undefined as unknown as TaskTemplate),
  }
}

// ─── Task engine (batch 22) ────────────────────────────────────────────────────

/**
 * work_plan_items has no plannedQuantity/templateId columns and the domain's
 * WorkPlanItem type has no title at all; see public.add_work_plan_item in
 * migration 0015 (title is filled from the work type's name).
 */
export async function addWorkPlanItem(client: SupabaseClient, input: AddWorkPlanItemInput): Promise<WorkPlanItem> {
  const row = await callFunction(client, "add_work_plan_item", {
    project_id: uuidOf(client, input.projectId),
    project_unit_id: uuidOf(client, input.projectUnitId),
    stage_id: uuidOf(client, input.stageId),
    trade_id: uuidOf(client, input.tradeId),
    work_type_id: uuidOf(client, input.workTypeId),
    planned_start: input.plannedStart ?? null,
    due_date: input.dueDate ?? null,
  })
  return workPlanItemFromRow(row as WorkPlanItemRow)
}

/**
 * tasks has no work_type_id, priority or planned_start/due_date column; those
 * input fields are accepted but not persisted (migration 0015 header). templateId
 * round-trips through the existing work_plan_item_id column, as taskFromRow
 * already reads it back.
 */
export async function createTask(client: SupabaseClient, input: CreateTaskInput): Promise<Task> {
  const row = await callFunction(client, "create_task", {
    project_id: uuidOf(client, input.projectId),
    project_unit_id: uuidOf(client, input.projectUnitId),
    stage_id: uuidOf(client, input.stageId),
    trade_id: uuidOf(client, input.tradeId),
    work_type_id: uuidOf(client, input.workTypeId),
    template_id: input.templateId ? uuidOf(client, input.templateId) : null,
    title: input.title,
    planned_quantity: input.plannedQuantity?.value ?? null,
    planned_quantity_unit: input.plannedQuantity?.unit ?? null,
    source_thread_id: input.source ? uuidOf(client, input.source.threadId) : null,
    source_message_id: input.source ? uuidOf(client, input.source.messageId) : null,
  })
  return taskFromRow(row as TaskRow)
}

/**
 * Only a worker assignee is supported: task_assignments has no assignee_type
 * column, so it cannot store a membership/organization assignee (migration
 * 0015 header). Re-assigning the same worker returns the existing row.
 */
export async function assignTask(
  client: SupabaseClient,
  input: { taskId: EntityId; assigneeType: TaskAssignment["assigneeType"]; assigneeId: EntityId },
): Promise<TaskAssignment> {
  const row = await callFunction(client, "assign_task", {
    task_id: uuidOf(client, input.taskId),
    assignee_type: input.assigneeType,
    assignee_id: uuidOf(client, input.assigneeId),
  })
  return taskAssignmentFromRow(row as TaskAssignmentRow)
}

export async function acceptTaskAssignment(client: SupabaseClient, input: { taskId: EntityId }): Promise<void> {
  await callFunction(client, "accept_task_assignment", { task_id: uuidOf(client, input.taskId) })
}

export async function startTask(client: SupabaseClient, input: { taskId: EntityId }): Promise<void> {
  await callFunction(client, "start_task", { task_id: uuidOf(client, input.taskId) })
}

export async function transitionTask(
  client: SupabaseClient,
  input: { taskId: EntityId; nextStatus: TaskStatus },
): Promise<void> {
  await callFunction(client, "transition_task", {
    task_id: uuidOf(client, input.taskId),
    next_status: input.nextStatus,
  })
}

// ─── Progress & issues (batch 24) ──────────────────────────────────────────────
// See migration 0017's header for how reviewDailyProgress/publishDailyProgress
// resolve the surface mismatch against the three-argument publish_daily_progress
// function migration 0008 created (kept, unexported, for its own existing callers).

function evidenceDraftToJson(
  client: SupabaseClient,
  items: SubmitDailyProgressInput["evidence"],
): Record<string, unknown>[] {
  return items.map((item) => ({
    type: item.type,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl ?? null,
    caption: item.caption ?? null,
    capturedByWorkerId: item.capturedByWorkerId ? uuidOf(client, item.capturedByWorkerId) : null,
  }))
}

export async function submitDailyProgress(
  client: SupabaseClient,
  input: SubmitDailyProgressInput,
): Promise<DailyProgress> {
  const row = await callFunction(client, "submit_daily_progress", {
    project_id: uuidOf(client, input.projectId),
    project_unit_id: uuidOf(client, input.projectUnitId),
    task_id: input.taskId ? uuidOf(client, input.taskId) : null,
    stage_id: uuidOf(client, input.stageId),
    trade_id: uuidOf(client, input.tradeId),
    work_type_id: uuidOf(client, input.workTypeId),
    workers_present: input.workersPresent,
    progress_after: input.progressAfter ?? null,
    completed_quantity: input.completedQuantity?.value ?? null,
    completed_quantity_unit: input.completedQuantity?.unit ?? null,
    today_summary: input.todaySummary,
    tomorrow_plan: input.tomorrowPlan,
    yesterday_summary: input.yesterdaySummary ?? null,
    blocker_summary: input.blockerSummary ?? null,
    evidence: evidenceDraftToJson(client, input.evidence),
  })
  return dailyProgressFromRow(row as DailyProgressRow)
}

export async function resubmitDailyProgress(
  client: SupabaseClient,
  previousId: EntityId,
  input: ResubmitDailyProgressInput,
): Promise<DailyProgress> {
  const row = await callFunction(client, "resubmit_daily_progress", {
    previous_id: uuidOf(client, previousId),
    workers_present: input.workersPresent,
    progress_after: input.progressAfter ?? null,
    completed_quantity: input.completedQuantity?.value ?? null,
    completed_quantity_unit: input.completedQuantity?.unit ?? null,
    today_summary: input.todaySummary,
    tomorrow_plan: input.tomorrowPlan,
    yesterday_summary: input.yesterdaySummary ?? null,
    blocker_summary: input.blockerSummary ?? null,
    keep_evidence_ids: input.keepEvidenceIds.map((id) => uuidOf(client, id)),
    evidence: evidenceDraftToJson(client, input.evidence),
  })
  return dailyProgressFromRow(row as DailyProgressRow)
}

export async function reviewDailyProgress(
  client: SupabaseClient,
  input: { progressId: EntityId; decision: ReviewDecision; note?: string },
): Promise<void> {
  await callFunction(client, "review_daily_progress", {
    progress_id: uuidOf(client, input.progressId),
    decision: input.decision,
    note: input.note ?? null,
  })
}

export async function publishDailyProgress(
  client: SupabaseClient,
  input: { progressId: EntityId; evidenceIds: EntityId[] },
): Promise<void> {
  await callFunction(client, "publish_daily_progress_evidence", {
    progress_id: uuidOf(client, input.progressId),
    evidence_ids: input.evidenceIds.map((id) => uuidOf(client, id)),
  })
}

export async function addEvidence(client: SupabaseClient, input: AddEvidenceInput): Promise<Evidence> {
  const row = await callFunction(client, "add_evidence", {
    project_id: uuidOf(client, input.projectId),
    project_unit_id: input.projectUnitId ? uuidOf(client, input.projectUnitId) : null,
    task_id: input.taskId ? uuidOf(client, input.taskId) : null,
    daily_progress_id: input.dailyProgressId ? uuidOf(client, input.dailyProgressId) : null,
    type: input.type,
    url: input.url,
    thumbnail_url: input.thumbnailUrl ?? null,
    caption: input.caption ?? null,
    captured_by_worker_id: input.capturedByWorkerId ? uuidOf(client, input.capturedByWorkerId) : null,
    customer_visibility: input.customerVisibility ?? null,
  })
  return evidenceFromRow(row as EvidenceRow)
}

export async function reportIssue(client: SupabaseClient, input: ReportIssueInput): Promise<Issue> {
  const row = await callFunction(client, "report_issue", {
    project_id: uuidOf(client, input.projectId),
    project_unit_id: input.projectUnitId ? uuidOf(client, input.projectUnitId) : null,
    task_id: input.taskId ? uuidOf(client, input.taskId) : null,
    daily_progress_id: input.dailyProgressId ? uuidOf(client, input.dailyProgressId) : null,
    title: input.title,
    description: input.description,
    severity: input.severity,
    evidence: (input.evidence ?? []).map((item) => ({
      type: item.type,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl ?? null,
      caption: item.caption ?? null,
    })),
    source_thread_id: input.source ? uuidOf(client, input.source.threadId) : null,
    source_message_id: input.source ? uuidOf(client, input.source.messageId) : null,
  })
  return issueFromRow(row as IssueRow)
}

export async function assignIssue(
  client: SupabaseClient,
  input: { issueId: EntityId; membershipId: EntityId | undefined },
): Promise<void> {
  await callFunction(client, "assign_issue", {
    issue_id: uuidOf(client, input.issueId),
    membership_id: input.membershipId ? uuidOf(client, input.membershipId) : null,
  })
}

export async function transitionIssue(
  client: SupabaseClient,
  input: { issueId: EntityId; next: Issue["status"]; resolutionNote?: string },
): Promise<void> {
  await callFunction(client, "transition_issue", {
    issue_id: uuidOf(client, input.issueId),
    next_status: input.next,
    resolution_note: input.resolutionNote ?? null,
  })
}

export async function addIssueEvidence(
  client: SupabaseClient,
  input: { issueId: EntityId; items: IssueEvidenceInput[] },
): Promise<Evidence[]> {
  const row = await callFunction(client, "add_issue_evidence", {
    issue_id: uuidOf(client, input.issueId),
    items: input.items.map((item) => ({
      type: item.type,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl ?? null,
      caption: item.caption ?? null,
    })),
  })
  return (row as EvidenceRow[]).map((r) => evidenceFromRow(r))
}

export async function publishIssue(
  client: SupabaseClient,
  input: { issueId: EntityId; visible: boolean },
): Promise<Issue> {
  const row = await callFunction(client, "publish_issue", {
    issue_id: uuidOf(client, input.issueId),
    visible: input.visible,
  })
  return issueFromRow(row as IssueRow)
}

export async function uploadDocument(client: SupabaseClient, input: UploadDocumentInput): Promise<Document> {
  const row = await callFunction(client, "upload_document", {
    project_id: uuidOf(client, input.projectId),
    title: input.title,
    category: input.category,
    url: input.url,
  })
  return documentFromRow(row as DocumentRow)
}

export async function publishDocument(
  client: SupabaseClient,
  input: { documentId: EntityId; visible: boolean },
): Promise<Document> {
  const row = await callFunction(client, "publish_document", {
    document_id: uuidOf(client, input.documentId),
    visible: input.visible,
  })
  return documentFromRow(row as DocumentRow)
}

export async function postMessage(client: SupabaseClient, input: PostMessageInput): Promise<Message> {
  const row = await callFunction(client, "post_message", {
    thread_id: "threadId" in input ? uuidOf(client, input.threadId) : null,
    project_id: "threadId" in input ? null : uuidOf(client, input.projectId),
    subject: "threadId" in input ? null : input.subject,
    target_id: "threadId" in input ? null : input.targetId ? uuidOf(client, input.targetId) : null,
    body: input.body ?? null,
    voice_url: input.voice?.url ?? null,
    voice_duration_sec: input.voice?.durationSec ?? null,
    voice_transcript: input.voice?.transcript ?? null,
  })
  return messageFromRow(row as MessageRow)
}

export async function openDirectThread(
  client: SupabaseClient,
  input: { projectId: EntityId; otherMembershipId: EntityId },
): Promise<Thread> {
  const row = await callFunction(client, "open_direct_thread", {
    project_id: uuidOf(client, input.projectId),
    other_membership_id: uuidOf(client, input.otherMembershipId),
  })
  return threadFromRow(row as ThreadRow)
}

export async function markThreadRead(client: SupabaseClient, input: { threadId: EntityId }): Promise<void> {
  await callFunction(client, "mark_thread_read", { thread_id: uuidOf(client, input.threadId) })
}

export async function markThreadUnread(client: SupabaseClient, input: { threadId: EntityId }): Promise<void> {
  await callFunction(client, "mark_thread_unread", { thread_id: uuidOf(client, input.threadId) })
}

export async function logCall(client: SupabaseClient, input: LogCallInput): Promise<CallLog> {
  const row = await callFunction(client, "log_call", {
    thread_id: uuidOf(client, input.threadId),
    type: input.type,
    started_at: input.startedAt,
    duration_minutes: input.durationMinutes,
    note: input.note ?? null,
  })
  return callLogFromRow(row as CallLogRow)
}
