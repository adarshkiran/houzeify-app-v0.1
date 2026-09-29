import type {
  DailyProgress,
  Document,
  EntityId,
  Evidence,
  Issue,
  EvidenceType,
  MessageSource,
  Organization,
  ProjectKind,
  ProjectRole,
  ProjectStatus,
  ProjectUnitKind,
  Quantity,
  QuantityUnit,
  Task,
  Worker,
  WorkerProjectAssignment,
} from "./models"

/** Inputs for every construction-data command (see constructionCommands.ts). */

export interface BusinessProfileInput {
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
  projectUnitIds?: EntityId[]
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
  /** Created from a conversation message (checked: exists, same project, readable). */
  source?: MessageSource
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
  capturedByWorkerId?: EntityId
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
  /**
   * Project % after today's work. Supervisors report it; workers leave it out
   * and report `completedQuantity` instead.
   */
  progressAfter?: number
  /** Quantity of the task's work completed today. */
  completedQuantity?: Quantity
  todaySummary: string
  tomorrowPlan: string
  yesterdaySummary?: string
  blockerSummary?: string
  evidence: Array<{
    type: EvidenceType
    url: string
    thumbnailUrl?: string
    caption?: string
    capturedByWorkerId?: EntityId
  }>
}

/** A fixed version of an update the reviewer sent back. Location and task stay the same. */
export interface ResubmitDailyProgressInput {
  workersPresent: number
  progressAfter?: number
  completedQuantity?: Quantity
  todaySummary: string
  tomorrowPlan: string
  yesterdaySummary?: string
  blockerSummary?: string
  /** Evidence from the previous version to carry over. */
  keepEvidenceIds: EntityId[]
  /** Newly captured evidence. */
  evidence: SubmitDailyProgressInput["evidence"]
}

export interface AssignWorkerToProjectInput {
  workerId: EntityId
  projectId: EntityId
  projectUnitIds?: EntityId[]
  tradeIds?: EntityId[]
  role?: WorkerProjectAssignment["role"]
}

export interface AddWorkerInput {
  organizationId: EntityId
  name: string
  phone?: string
  tradeIds: EntityId[]
  preferredLanguage?: string
  onboardingMethod?: Worker["onboardingMethod"]
  projectId?: EntityId
  projectUnitIds?: EntityId[]
  role?: WorkerProjectAssignment["role"]
}

export interface AddLibraryStageInput {
  name: string
  code?: string
}

export interface AddLibraryTradeInput {
  name: string
  code?: string
}

export interface AddLibraryWorkTypeInput {
  name: string
  stageId?: EntityId
  tradeId?: EntityId
  newStageName?: string
  newTradeName?: string
  defaultUnit: QuantityUnit
  checklist?: string[]
  requiredEvidence?: EvidenceType[]
}

/** A photo/video/document to attach to an issue. */
export interface IssueEvidenceInput {
  type: EvidenceType
  url: string
  thumbnailUrl?: string
  caption?: string
}

export interface ReportIssueInput {
  projectId: EntityId
  /** Where it is. Omitted when raised from a task or progress record. */
  projectUnitId?: EntityId
  taskId?: EntityId
  dailyProgressId?: EntityId
  title: string
  description: string
  severity: Issue["severity"]
  evidence?: IssueEvidenceInput[]
  /** Created from a conversation message (checked: exists, same project, readable). */
  source?: MessageSource
}

export interface UploadDocumentInput {
  projectId: EntityId
  title: string
  category: Document["category"]
  url: string
}
