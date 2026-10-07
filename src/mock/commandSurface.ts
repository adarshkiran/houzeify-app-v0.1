// The command surface the screens call through useConstructionData. Two builders
// expose the same names: memoryCommands runs the domain commands against the
// in-memory store; supabaseCommands sends writes to the adapter and reads from
// the loaded state. Reads run the domain selectors in both modes.

import type { SupabaseClient } from "@supabase/supabase-js"
import * as adapter from "../data/adapter"
import type { CreditWallet } from "../domain/models"
import type * as Inputs from "../domain/commandInputs"
import * as attendanceCommands from "../domain/attendanceCommands"
import type { RecordAttendanceInput } from "../domain/attendanceCommands"
import * as billingCommands from "../domain/billingCommands"
import * as conversationCommands from "../domain/conversationCommands"
import type { LogCallInput, PostMessageInput } from "../domain/conversationCommands"
import * as estimateCommands from "../domain/estimateCommands"
import type { GenerateEstimateInput } from "../domain/estimateCommands"
import * as marketplaceCommands from "../domain/marketplaceCommands"
import type { SubmitProposalInput } from "../domain/marketplaceCommands"
import { viewRequirement as selectViewRequirement } from "../domain/marketplaceVisibility"
import * as commands from "../domain/constructionCommands"
import type {
  AssignmentEndReason,
  CallLog,
  ConstructionDataState,
  ConstructionStage,
  DailyProgress,
  Document,
  EntityId,
  Estimate,
  Evidence,
  ISODate,
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
  WorkerAttendance,
  WorkPlanItem,
  WorkType,
  Worker,
  WorkerOnboarding,
  WorkerProjectAssignment,
} from "../domain/models"
import type { Command } from "../domain/ports"

/** Worker check-in and check-out. The supabase path ignores the phone: the session identifies the worker. */
export interface AttendancePunchInput {
  projectId: EntityId
  phone?: string
}

export interface CommandSurface {
  updateOrganizationProfile: (
    organizationId: EntityId,
    input: Inputs.BusinessProfileInput,
  ) => void
  createProject: (input: Inputs.CreateProjectInput) => Project
  setStageBaselines: (
    projectId: EntityId,
    baselines: Record<EntityId, number>,
  ) => Project
  addProjectUnit: (input: Inputs.AddProjectUnitInput) => ProjectUnit
  addProjectUnits: (inputs: Inputs.AddProjectUnitInput[]) => ProjectUnit[]
  inviteProjectMember: (input: Inputs.InviteProjectMemberInput) => ProjectMembership
  addWorkPlanItem: (input: Inputs.AddWorkPlanItemInput) => WorkPlanItem
  createTask: (input: Inputs.CreateTaskInput) => Task
  assignTask: (
    taskId: EntityId,
    assigneeType: TaskAssignment["assigneeType"],
    assigneeId: EntityId,
  ) => TaskAssignment
  assignWorkerToProject: (
    input: Inputs.AssignWorkerToProjectInput,
  ) => WorkerProjectAssignment
  addWorker: (input: Inputs.AddWorkerInput) => {
    worker: Worker
    assignment?: WorkerProjectAssignment
  }
  createWorkerOnboarding: (input: {
    workerId: EntityId
    method: "qr" | "supervisor-assisted"
  }) => WorkerOnboarding
  acceptWorkerOnboarding: (onboardingId: EntityId, joinCode?: string) => Worker
  acceptOwnWorkerOnboarding: (onboardingId: EntityId, phone: string) => Worker
  cancelWorkerOnboarding: (onboardingId: EntityId) => WorkerOnboarding
  endWorkerProjectAssignment: (
    assignmentId: EntityId,
    reason: AssignmentEndReason,
  ) => WorkerProjectAssignment
  recordAttendance: (input: RecordAttendanceInput) => WorkerAttendance
  checkInWorker: (input: AttendancePunchInput) => WorkerAttendance
  checkOutWorker: (input: AttendancePunchInput) => WorkerAttendance
  setAttendancePolicy: (projectId: EntityId, requireCheckout: boolean) => Project
  listAttendance: (projectId: EntityId, date: ISODate) => WorkerAttendance[]
  getOwnAttendance: (
    projectId: EntityId,
    phone: string,
    date: ISODate,
  ) => WorkerAttendance | undefined
  addLibraryStage: (input: Inputs.AddLibraryStageInput) => ConstructionStage
  addLibraryTrade: (input: Inputs.AddLibraryTradeInput) => Trade
  addLibraryWorkType: (input: Inputs.AddLibraryWorkTypeInput) => {
    workType: WorkType
    template: TaskTemplate
  }
  transitionTask: (taskId: EntityId, nextStatus: TaskStatus) => void
  acceptTaskAssignment: (taskId: EntityId) => void
  startTask: (taskId: EntityId) => void
  addEvidence: (input: Inputs.AddEvidenceInput) => Evidence
  submitDailyProgress: (input: Inputs.SubmitDailyProgressInput) => DailyProgress
  resubmitDailyProgress: (
    previousId: EntityId,
    input: Inputs.ResubmitDailyProgressInput,
  ) => DailyProgress
  reviewDailyProgress: (
    progressId: EntityId,
    decision: ReviewDecision,
    note?: string,
  ) => void
  publishDailyProgress: (progressId: EntityId, evidenceIds: EntityId[]) => void
  reportIssue: (input: Inputs.ReportIssueInput) => Issue
  assignIssue: (issueId: EntityId, membershipId: EntityId | undefined) => void
  transitionIssue: (
    issueId: EntityId,
    next: Issue["status"],
    resolutionNote?: string,
  ) => void
  addIssueEvidence: (
    issueId: EntityId,
    items: Inputs.IssueEvidenceInput[],
  ) => Evidence[]
  publishIssue: (issueId: EntityId, visible: boolean) => Issue
  uploadDocument: (input: Inputs.UploadDocumentInput) => Document
  publishDocument: (documentId: EntityId, visible: boolean) => Document
  generateEstimate: (input: GenerateEstimateInput) => Estimate
  confirmEstimate: (estimateId: EntityId) => Estimate
  postRequirement: (estimateId: EntityId) => MarketplaceRequirement
  unlockRequirement: (requirementId: EntityId, partnerOrganizationId: EntityId) => MarketplaceUnlock
  purchaseCredits: (organizationId: EntityId, credits: number) => CreditWallet
  submitProposal: (requirementId: EntityId, partnerOrganizationId: EntityId, input: SubmitProposalInput) => Proposal
  selectProposal: (proposalId: EntityId) => Project
  viewRequirement: (requirementId: EntityId, partnerOrganizationId: EntityId) => ReturnType<typeof selectViewRequirement>
  postMessage: (input: PostMessageInput) => Message
  logCall: (input: LogCallInput) => CallLog
  openDirectThread: (projectId: EntityId, otherMembershipId: EntityId) => Thread
  markThreadRead: (threadId: EntityId) => void
  markThreadUnread: (threadId: EntityId) => void
}

/** Runs a pure domain command against the in-memory state and commits the result. */
export interface MemoryExec {
  run: <T>(command: Command<T>) => T
  read: <T>(command: Command<T>) => T
  getState: () => ConstructionDataState
}

export function memoryCommands(exec: MemoryExec): CommandSurface {
  const { run, read, getState } = exec
  return {
    updateOrganizationProfile: (id, input) =>
      run(commands.updateOrganizationProfile(id, input)),
    createProject: (input) => run(commands.createProject(input)),
    setStageBaselines: (id, baselines) =>
      run(commands.setStageBaselines(id, baselines)),
    addProjectUnit: (input) => run(commands.addProjectUnit(input)),
    addProjectUnits: (inputs) => run(commands.addProjectUnits(inputs)),
    inviteProjectMember: (input) => run(commands.inviteProjectMember(input)),
    addWorkPlanItem: (input) => run(commands.addWorkPlanItem(input)),
    createTask: (input) => run(commands.createTask(input)),
    assignTask: (taskId, type, assigneeId) =>
      run(commands.assignTask(taskId, type, assigneeId)),
    assignWorkerToProject: (input) =>
      run(commands.assignWorkerToProject(input)),
    addWorker: (input) => run(commands.addWorker(input)),
    createWorkerOnboarding: (input) =>
      run(commands.createWorkerOnboarding(input)),
    acceptWorkerOnboarding: (onboardingId, joinCode) =>
      run(commands.acceptWorkerOnboarding(onboardingId, joinCode)),
    acceptOwnWorkerOnboarding: (onboardingId, phone) =>
      run(commands.acceptOwnWorkerOnboarding(onboardingId, phone)),
    cancelWorkerOnboarding: (onboardingId) =>
      run(commands.cancelWorkerOnboarding(onboardingId)),
    endWorkerProjectAssignment: (assignmentId, reason) =>
      run(commands.endWorkerProjectAssignment(assignmentId, reason)),
    recordAttendance: (input) =>
      run(attendanceCommands.recordAttendance(input)),
    // The memory store identifies the worker by phone, so the phone is required here.
    checkInWorker: (input) =>
      run(attendanceCommands.checkInWorker({ projectId: input.projectId, phone: input.phone ?? "" })),
    checkOutWorker: (input) =>
      run(attendanceCommands.checkOutWorker({ projectId: input.projectId, phone: input.phone ?? "" })),
    setAttendancePolicy: (projectId, requireCheckout) =>
      run(attendanceCommands.setAttendancePolicy(projectId, requireCheckout)),
    listAttendance: (projectId, date) =>
      read(attendanceCommands.listAttendance(projectId, date)),
    getOwnAttendance: (projectId, phone, date) =>
      read(attendanceCommands.getOwnAttendance(projectId, phone, date)),
    addLibraryStage: (input) => run(commands.addLibraryStage(input)),
    addLibraryTrade: (input) => run(commands.addLibraryTrade(input)),
    addLibraryWorkType: (input) => run(commands.addLibraryWorkType(input)),
    transitionTask: (taskId, status) =>
      run(commands.transitionTask(taskId, status)),
    acceptTaskAssignment: (taskId) =>
      run(commands.acceptTaskAssignment(taskId)),
    startTask: (taskId) => run(commands.startTask(taskId)),
    addEvidence: (input) => run(commands.addEvidence(input)),
    submitDailyProgress: (input) => run(commands.submitDailyProgress(input)),
    resubmitDailyProgress: (id, input) =>
      run(commands.resubmitDailyProgress(id, input)),
    reviewDailyProgress: (id, decision, note) =>
      run(commands.reviewDailyProgress(id, decision, note)),
    publishDailyProgress: (id, evidenceIds) =>
      run(commands.publishDailyProgress(id, evidenceIds)),
    reportIssue: (input) => run(commands.reportIssue(input)),
    assignIssue: (id, membershipId) =>
      run(commands.assignIssue(id, membershipId)),
    transitionIssue: (id, next, note) =>
      run(commands.transitionIssue(id, next, note)),
    addIssueEvidence: (id, items) =>
      run(commands.addIssueEvidence(id, items)),
    publishIssue: (id, visible) => run(commands.publishIssue(id, visible)),
    uploadDocument: (input) => run(commands.uploadDocument(input)),
    publishDocument: (id, visible) => run(commands.publishDocument(id, visible)),
    generateEstimate: (input) => run(estimateCommands.generateEstimate(input)),
    confirmEstimate: (estimateId) => run(estimateCommands.confirmEstimate(estimateId)),
    postRequirement: (estimateId) => run(marketplaceCommands.postRequirement(estimateId)),
    unlockRequirement: (requirementId, partnerOrganizationId) =>
      run(marketplaceCommands.unlockRequirement(requirementId, partnerOrganizationId)),
    purchaseCredits: (organizationId, credits) =>
      run(billingCommands.purchaseCredits(organizationId, credits)),
    submitProposal: (requirementId, partnerOrganizationId, input) =>
      run(marketplaceCommands.submitProposal(requirementId, partnerOrganizationId, input)),
    selectProposal: (proposalId) => run(marketplaceCommands.selectProposal(proposalId)),
    viewRequirement: (requirementId, partnerOrganizationId) =>
      selectViewRequirement(getState(), requirementId, partnerOrganizationId),
    postMessage: (input) => run(conversationCommands.postMessage(input)),
    logCall: (input) => run(conversationCommands.logCall(input)),
    openDirectThread: (projectId, otherId) =>
      run(conversationCommands.openDirectThread(projectId, otherId)),
    markThreadRead: (threadId) =>
      run(conversationCommands.markThreadRead(threadId)),
    markThreadUnread: (threadId) =>
      run(conversationCommands.markThreadUnread(threadId)),
  }
}

/**
 * Supabase-mode exec. `write` sends one adapter call and then reloads the state.
 * `read` runs a domain selector against the loaded state.
 */
export interface SupabaseExec {
  client: SupabaseClient
  write: <T>(call: () => Promise<T>) => Promise<T>
  read: <T>(command: Command<T>) => T
  getState: () => ConstructionDataState
}

function notInSupabaseYet(name: string): never {
  throw new Error(`${name} is not available with the Supabase data source yet.`)
}

/**
 * Supabase-mode surface. Writes that have an adapter function return a promise
 * (the adapter is async). Commands without one throw a clear error when called.
 */
export function supabaseCommands(exec: SupabaseExec): CommandSurface {
  const { client, write, read, getState } = exec
  const surface = {
    updateOrganizationProfile: (organizationId: EntityId, input: Inputs.BusinessProfileInput) =>
      write(() => adapter.updateOrganizationProfile(client, { organizationId, profile: input })),
    createProject: (input: Inputs.CreateProjectInput) => write(() => adapter.createProject(client, input)),
    setStageBaselines: (projectId: EntityId, baselines: Record<EntityId, number>) =>
      write(() => adapter.setStageBaselines(client, { projectId, baselines })),
    addProjectUnit: (input: Inputs.AddProjectUnitInput) => write(() => adapter.addProjectUnit(client, input)),
    addProjectUnits: (inputs: Inputs.AddProjectUnitInput[]) => write(() => adapter.addProjectUnits(client, inputs)),
    inviteProjectMember: () => notInSupabaseYet("inviteProjectMember"),
    addWorkPlanItem: () => notInSupabaseYet("addWorkPlanItem"),
    createTask: () => notInSupabaseYet("createTask"),
    assignTask: () => notInSupabaseYet("assignTask"),
    assignWorkerToProject: () => notInSupabaseYet("assignWorkerToProject"),
    addWorker: () => notInSupabaseYet("addWorker"),
    createWorkerOnboarding: (input: { workerId: EntityId; method: "qr" | "supervisor-assisted" }) =>
      write(() => adapter.createWorkerOnboarding(client, input)),
    acceptWorkerOnboarding: (onboardingId: EntityId, joinCode?: string) =>
      write(() => adapter.acceptWorkerOnboarding(client, { onboardingId, joinCode: joinCode ?? "" })),
    // The session identifies the worker, so the phone argument is not sent.
    acceptOwnWorkerOnboarding: (onboardingId: EntityId) =>
      write(() => adapter.acceptOwnWorkerOnboarding(client, { onboardingId })),
    cancelWorkerOnboarding: () => notInSupabaseYet("cancelWorkerOnboarding"),
    endWorkerProjectAssignment: (assignmentId: EntityId, reason: AssignmentEndReason) =>
      write(() => adapter.endWorkerProjectAssignment(client, { assignmentId, reason })),
    recordAttendance: (input: RecordAttendanceInput) =>
      write(() =>
        adapter.recordAttendance(client, {
          projectId: input.projectId,
          workerId: input.workerId,
          day: input.date,
          status: input.status ?? null,
          checkInAt: input.checkInAt ?? null,
          checkOutAt: input.checkOutAt ?? null,
        }),
      ),
    checkInWorker: (input: AttendancePunchInput) =>
      write(() => adapter.checkInWorker(client, { projectId: input.projectId })),
    checkOutWorker: (input: AttendancePunchInput) =>
      write(() => adapter.checkOutWorker(client, { projectId: input.projectId })),
    setAttendancePolicy: (projectId: EntityId, requireCheckout: boolean) =>
      write(() => adapter.setAttendancePolicy(client, { projectId, requireCheckout })),
    listAttendance: (projectId: EntityId, date: ISODate) =>
      read(attendanceCommands.listAttendance(projectId, date)),
    getOwnAttendance: (projectId: EntityId, phone: string, date: ISODate) =>
      read(attendanceCommands.getOwnAttendance(projectId, phone, date)),
    addLibraryStage: (input: Inputs.AddLibraryStageInput) => write(() => adapter.addLibraryStage(client, input)),
    addLibraryTrade: (input: Inputs.AddLibraryTradeInput) => write(() => adapter.addLibraryTrade(client, input)),
    addLibraryWorkType: (input: Inputs.AddLibraryWorkTypeInput) =>
      write(() => adapter.addLibraryWorkType(client, input)),
    transitionTask: () => notInSupabaseYet("transitionTask"),
    acceptTaskAssignment: () => notInSupabaseYet("acceptTaskAssignment"),
    startTask: () => notInSupabaseYet("startTask"),
    addEvidence: () => notInSupabaseYet("addEvidence"),
    submitDailyProgress: () => notInSupabaseYet("submitDailyProgress"),
    resubmitDailyProgress: () => notInSupabaseYet("resubmitDailyProgress"),
    reviewDailyProgress: () => notInSupabaseYet("reviewDailyProgress"),
    publishDailyProgress: () => notInSupabaseYet("publishDailyProgress"),
    reportIssue: () => notInSupabaseYet("reportIssue"),
    assignIssue: () => notInSupabaseYet("assignIssue"),
    transitionIssue: () => notInSupabaseYet("transitionIssue"),
    addIssueEvidence: () => notInSupabaseYet("addIssueEvidence"),
    publishIssue: () => notInSupabaseYet("publishIssue"),
    uploadDocument: () => notInSupabaseYet("uploadDocument"),
    publishDocument: () => notInSupabaseYet("publishDocument"),
    generateEstimate: () => notInSupabaseYet("generateEstimate"),
    confirmEstimate: () => notInSupabaseYet("confirmEstimate"),
    postRequirement: () => notInSupabaseYet("postRequirement"),
    unlockRequirement: (requirementId: EntityId, partnerOrganizationId: EntityId) =>
      write(() => adapter.unlockRequirement(client, { requirementId, organizationId: partnerOrganizationId })),
    purchaseCredits: () => notInSupabaseYet("purchaseCredits"),
    submitProposal: (requirementId: EntityId, partnerOrganizationId: EntityId, input: SubmitProposalInput) =>
      write(() =>
        adapter.submitProposal(client, {
          requirementId,
          organizationId: partnerOrganizationId,
          assumptions: input.assumptions,
          exclusions: input.exclusions,
        }),
      ),
    selectProposal: (proposalId: EntityId) =>
      write(() => adapter.selectProposal(client, { proposalId })),
    viewRequirement: (requirementId: EntityId, partnerOrganizationId: EntityId) =>
      selectViewRequirement(getState(), requirementId, partnerOrganizationId),
    postMessage: () => notInSupabaseYet("postMessage"),
    logCall: () => notInSupabaseYet("logCall"),
    openDirectThread: () => notInSupabaseYet("openDirectThread"),
    markThreadRead: () => notInSupabaseYet("markThreadRead"),
    markThreadUnread: () => notInSupabaseYet("markThreadUnread"),
  }
  // The adapter is async, so the write methods return promises where the
  // interface states the domain's synchronous values. Screens do not await
  // them yet (see the task-14 report).
  return surface as unknown as CommandSurface
}
