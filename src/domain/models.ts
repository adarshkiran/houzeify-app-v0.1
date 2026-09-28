export type EntityId = string
export type ISODate = string
export type ISODateTime = string

export type QuantityUnit =
  | "nos"
  | "m"
  | "m2"
  | "m3"
  | "kg"
  | "tonne"
  | "hour"
  | "day"
  | "percentage"

export interface Quantity {
  value: number
  unit: QuantityUnit
}

export type OrganizationKind = "developer" | "construction-company" | "builder" | "contractor" | "subcontractor"

export interface Organization {
  id: EntityId
  name: string
  kind: OrganizationKind
  status: "draft" | "active" | "suspended"
  city: string
  phone?: string
  teamSize?: string
  createdAt: ISODateTime
}

export type ProjectStatus = "planning" | "active" | "on-hold" | "completed" | "archived"

export type ProjectKind = "individual-house" | "multiple-houses" | "villa-development" | "apartment" | "multi-block" | "commercial"

export interface Project {
  id: EntityId
  organizationId: EntityId
  code: string
  name: string
  kind: ProjectKind
  status: ProjectStatus
  location: string
  startDate?: ISODate
  targetDate?: ISODate
  currentStageId?: EntityId
  progress: number
  trackingStartedMidProject: boolean
  /** stageId → % of that stage already complete when tracking started (0–100). */
  stageBaselines: Record<EntityId, number>
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export type ProjectUnitKind = "phase" | "block" | "tower" | "villa" | "house" | "apartment" | "floor" | "zone" | "room" | "location"

export interface ProjectUnit {
  id: EntityId
  projectId: EntityId
  parentUnitId?: EntityId
  kind: ProjectUnitKind
  code: string
  name: string
  status: "planned" | "active" | "completed"
  sequence: number
}

export interface ConstructionStage {
  id: EntityId
  code: string
  name: string
  sequence: number
}

export interface Trade {
  id: EntityId
  code: string
  name: string
}

export interface WorkType {
  id: EntityId
  stageId: EntityId
  tradeId: EntityId
  code: string
  name: string
  defaultUnit: QuantityUnit
}

export type EvidenceType = "photo" | "video" | "audio" | "document"

export interface TaskTemplate {
  id: EntityId
  workTypeId: EntityId
  name: string
  checklist: string[]
  requiredEvidence: EvidenceType[]
  defaultUnit: QuantityUnit
  dependencyWorkTypeIds: EntityId[]
}

export interface WorkPlanItem {
  id: EntityId
  projectId: EntityId
  projectUnitId: EntityId
  stageId: EntityId
  tradeId: EntityId
  workTypeId: EntityId
  templateId?: EntityId
  plannedQuantity: Quantity
  plannedStart?: ISODate
  dueDate?: ISODate
  status: "planned" | "ready" | "in-progress" | "completed"
  createdAt: ISODateTime
}

export interface Person {
  id: EntityId
  name: string
  phone?: string
  email?: string
}

export type ProjectRole = "homeowner" | "developer-admin" | "project-manager" | "contractor" | "subcontractor" | "supervisor" | "worker" | "consultant"

export interface PermissionScope {
  projectUnitIds: EntityId[]
  stageIds: EntityId[]
  tradeIds: EntityId[]
}

export interface ProjectMembership {
  id: EntityId
  projectId: EntityId
  principalType: "person" | "organization"
  principalId: EntityId
  role: ProjectRole
  scope: PermissionScope
  permissions: string[]
  status: "invited" | "active" | "inactive"
}

export interface Worker {
  id: EntityId
  organizationId: EntityId
  userId?: EntityId
  name: string
  phone?: string
  tradeIds: EntityId[]
  preferredLanguage: string
  onboardingMethod: "manual" | "otp" | "qr" | "supervisor-assisted"
  status: "invited" | "active" | "inactive"
}

/** Project-scoped assignment for a worker (workforce foundation). */
export interface WorkerProjectAssignment {
  id: EntityId
  workerId: EntityId
  projectId: EntityId
  projectUnitIds: EntityId[]
  tradeIds: EntityId[]
  role: "worker" | "lead" | "supervisor-assist"
  status: "invited" | "active" | "inactive"
  assignedAt: ISODateTime
  assignedByMembershipId?: EntityId
}

export type TaskStatus = "draft" | "assigned" | "accepted" | "ready" | "in-progress" | "submitted" | "review" | "approved" | "completed" | "blocked" | "delayed" | "reopened" | "cancelled"

export interface TaskChecklistItem {
  id: EntityId
  label: string
  completed: boolean
}

/** The conversation message a task or issue was created from (Phase 6B). */
export interface MessageSource {
  threadId: EntityId
  messageId: EntityId
}

export interface Task {
  id: EntityId
  projectId: EntityId
  projectUnitId: EntityId
  stageId: EntityId
  tradeId: EntityId
  workTypeId: EntityId
  templateId?: EntityId
  title: string
  status: TaskStatus
  priority: "low" | "medium" | "high" | "critical"
  plannedQuantity?: Quantity
  completedQuantity?: Quantity
  plannedStart?: ISODate
  dueDate?: ISODate
  checklist: TaskChecklistItem[]
  /** The conversation message this was created from, if any. */
  source?: MessageSource
  createdByMembershipId: EntityId
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface TaskAssignment {
  id: EntityId
  taskId: EntityId
  assigneeType: "membership" | "worker" | "organization"
  assigneeId: EntityId
  assignedByMembershipId: EntityId
  status: "assigned" | "accepted" | "declined" | "completed"
  assignedAt: ISODateTime
}

export interface Evidence {
  id: EntityId
  projectId: EntityId
  projectUnitId?: EntityId
  taskId?: EntityId
  dailyProgressId?: EntityId
  type: EvidenceType
  url: string
  thumbnailUrl?: string
  caption?: string
  capturedByMembershipId?: EntityId
  capturedByWorkerId?: EntityId
  capturedAt: ISODateTime
  customerVisibility: "private" | "review-required" | "customer-visible"
}

export type ReviewStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "changes-requested"
  | "rejected"
  | "superseded"

export type ReviewDecision = "approve" | "request-changes" | "reject"

/** The reviewer's decision on one version of a daily progress update. */
export interface ProgressReview {
  decision: ReviewDecision
  /** Required for request-changes and reject. Never shown to the homeowner. */
  note?: string
  reviewedByMembershipId: EntityId
  reviewedAt: ISODateTime
}

/** What was shared with the homeowner, and by whom. */
export interface ProgressPublication {
  publishedByMembershipId: EntityId
  publishedAt: ISODateTime
  evidenceIds: EntityId[]
}

export interface DailyProgress {
  id: EntityId
  projectId: EntityId
  projectUnitId: EntityId
  taskId?: EntityId
  stageId: EntityId
  tradeId: EntityId
  workTypeId: EntityId
  date: ISODate
  workersPresent: number
  plannedQuantity?: Quantity
  completedQuantity?: Quantity
  progressBefore?: number
  progressAfter?: number
  yesterdaySummary?: string
  todaySummary: string
  tomorrowPlan: string
  blockerSummary?: string
  evidenceIds: EntityId[]
  submittedByMembershipId: EntityId
  submittedAt: ISODateTime
  reviewStatus: ReviewStatus
  publicationStatus: "private" | "published"
  /** 1 for the first submission; +1 for each resubmission after changes were requested. */
  version: number
  supersedesId?: EntityId
  supersededById?: EntityId
  review?: ProgressReview
  publication?: ProgressPublication
}

export interface Issue {
  id: EntityId
  projectId: EntityId
  projectUnitId?: EntityId
  /** With projectUnitId and tradeId, what membership scope is checked against. */
  stageId?: EntityId
  tradeId?: EntityId
  taskId?: EntityId
  /** The daily progress record this was raised from, if any. */
  dailyProgressId?: EntityId
  /** The conversation message this was created from, if any. */
  source?: MessageSource
  title: string
  description: string
  severity: "low" | "medium" | "high" | "critical"
  status: "open" | "in-progress" | "resolved" | "closed"
  assignedMembershipId?: EntityId
  evidenceIds: EntityId[]
  createdByMembershipId: EntityId
  createdAt: ISODateTime
  updatedAt?: ISODateTime
  resolvedAt?: ISODateTime
  resolutionNote?: string
  closedAt?: ISODateTime
}

/** What a conversation is attached to. */
export type ThreadSubject = "project" | "unit" | "task" | "issue" | "homeowner" | "direct"

/** A conversation attached to a piece of work, the project's homeowner channel, or two people. */
export interface Thread {
  id: EntityId
  projectId: EntityId
  subject: ThreadSubject
  /** Unit, task or issue id for those subjects; absent otherwise. */
  targetId?: EntityId
  /** "homeowner" only for the homeowner subject. */
  audience: "internal" | "homeowner"
  /** Direct threads only: exactly two membership ids. */
  participantMembershipIds?: EntityId[]
  createdAt: ISODateTime
  lastMessageAt?: ISODateTime
}

export interface MessageVoice {
  url: string
  durationSec?: number
  transcript?: string
}

export interface Message {
  id: EntityId
  threadId: EntityId
  authorMembershipId: EntityId
  body?: string
  voice?: MessageVoice
  createdAt: ISODateTime
}

/** When a member last read a thread; newer messages by others are unread. */
export interface ThreadRead {
  threadId: EntityId
  membershipId: EntityId
  lastReadAt: ISODateTime
}

export interface ConstructionDataState {
  organizations: Organization[]
  people: Person[]
  projects: Project[]
  projectUnits: ProjectUnit[]
  stages: ConstructionStage[]
  trades: Trade[]
  workTypes: WorkType[]
  taskTemplates: TaskTemplate[]
  workPlanItems: WorkPlanItem[]
  memberships: ProjectMembership[]
  workers: Worker[]
  workerProjectAssignments: WorkerProjectAssignment[]
  tasks: Task[]
  assignments: TaskAssignment[]
  dailyProgress: DailyProgress[]
  evidence: Evidence[]
  issues: Issue[]
  threads: Thread[]
  messages: Message[]
  threadReads: ThreadRead[]
}
