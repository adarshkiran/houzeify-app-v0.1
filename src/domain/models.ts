export type EntityId = string
export type ISODate = string
export type ISODateTime = string

export type QuantityUnit = "nos" | "m" | "m2" | "m3" | "kg" | "tonne" | "day" | "percentage"

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
  reviewStatus: "draft" | "submitted" | "approved" | "rejected"
  publicationStatus: "private" | "ready" | "published"
}

export interface Issue {
  id: EntityId
  projectId: EntityId
  projectUnitId?: EntityId
  taskId?: EntityId
  title: string
  description: string
  severity: "low" | "medium" | "high" | "critical"
  status: "open" | "in-progress" | "resolved" | "closed"
  assignedMembershipId?: EntityId
  evidenceIds: EntityId[]
  createdByMembershipId: EntityId
  createdAt: ISODateTime
  resolvedAt?: ISODateTime
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
}
