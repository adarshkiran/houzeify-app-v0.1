import type { EntityId, ISODate, Issue, ProjectUnit, QuantityUnit, Task, WorkType } from "../models"

export interface VoicePerson {
  id: EntityId
  name: string
}

export interface VoiceContext {
  today: ISODate
  units: ProjectUnit[]
  workTypes: WorkType[]
  /** People who can be assigned (the project's workers). */
  people: VoicePerson[]
  /** Open tasks of the project, for linking issues. */
  tasks: Task[]
  /** Set when started from a task or a task conversation. */
  currentTaskId?: EntityId
}

export type FieldState =
  | { state: "heard" }
  | { state: "guessed"; reason: string }
  | { state: "missing"; note?: string }
  | { state: "choose"; options: { value: string; label: string }[] }

export interface TaskDraftValues {
  title?: string
  projectUnitId?: EntityId
  workTypeId?: EntityId
  priority?: Task["priority"]
  plannedValue?: number
  unit?: QuantityUnit
  plannedStart?: ISODate
  dueDate?: ISODate
  assigneeId?: EntityId
}

export interface IssueDraftValues {
  title?: string
  description?: string
  severity?: Issue["severity"]
  projectUnitId?: EntityId
  taskId?: EntityId
}

export interface ProgressDraftValues {
  todaySummary?: string
  tomorrowPlan?: string
  blockerSummary?: string
  completedQuantity?: number
  /** The unit the quantity was said in; the screen checks it against the task's unit. */
  unit?: QuantityUnit
  workersPresent?: number
}

export interface VoiceDraft<V> {
  transcript: string
  values: V
  fields: Partial<Record<keyof V, FieldState>>
}

/** Swap point: rules today, an AI extractor later. */
export interface VoiceExtractor {
  task(text: string, ctx: VoiceContext): VoiceDraft<TaskDraftValues>
  issue(text: string, ctx: VoiceContext): VoiceDraft<IssueDraftValues>
  progress(text: string, ctx: VoiceContext): VoiceDraft<ProgressDraftValues>
}
