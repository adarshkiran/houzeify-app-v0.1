import type {
  ConstructionDataState,
  EntityId,
  ISODate,
  ISODateTime,
  Issue,
  Task,
} from "./models"
import { DONE_STATUSES, calculateProjectProgress, stagePercent } from "./progress"

// Project AI (build plan §10.4): a deterministic analysis of one project's own
// data. Rules only, no LLM; `engine` names the generator so another can replace
// it. See docs/superpowers/specs/2026-10-15-project-ai-report-design.md.

export const STALE_UPDATE_DAYS = 3
export const STALE_UPDATE_HIGH_DAYS = 7
export const SCHEDULE_VARIANCE_MEDIUM_POINTS = 10
export const SCHEDULE_VARIANCE_HIGH_POINTS = 25
export const OVERDUE_HIGH_DAYS = 7
export const LATE_START_MEDIUM_DAYS = 3
export const SERIOUS_ISSUE_AGE_DAYS = 7
export const MIN_TASKS_FOR_HIGH_CONFIDENCE = 5

export type ReportStatus = "on-track" | "at-risk" | "behind" | "not-enough-data"
export type SignalSeverity = "medium" | "high"
export type SignalKind =
  | "overdue-task"
  | "blocked-task"
  | "late-start"
  | "stale-updates"
  | "behind-schedule"
  | "aging-issue"

export interface DelaySignal {
  kind: SignalKind
  severity: SignalSeverity
  message: string
  taskId?: EntityId
  issueId?: EntityId
  stageId?: EntityId
}

export interface StageAnalysis {
  stageId: EntityId
  name: string
  percent: number
  baseline: number
  taskCount: number
  dueByToday: number
  doneOfDue: number
}

export interface ProjectReport {
  projectId: EntityId
  asOf: ISODate
  status: ReportStatus
  summary: string[]
  progress: {
    overall: number
    stages: StageAnalysis[]
    lastApprovedUpdate?: ISODate
    daysSinceLastUpdate?: number
  }
  plannedVsActual: {
    dueByToday: number
    doneOfDue: number
    expectedPercent?: number
    actualPercent: number
    variancePoints?: number
  }
  issues: {
    open: number
    bySeverity: Record<Issue["severity"], number>
    byStatus: Record<Issue["status"], number>
    oldestSerious?: { issueId: EntityId; title: string; ageDays: number }
  }
  signals: DelaySignal[]
  source: "ai"
  createdBy: "ai"
  engine: "rules-v1"
  confidence: "low" | "medium" | "high"
  assumptions: string[]
  reviewStatus: "draft" | "approved"
  approvedBy?: EntityId
  approvedAt?: ISODateTime
  generatedAt: ISODateTime
}

const DAY_MS = 86_400_000

function dayNumber(date: string): number {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number)
  return Date.UTC(year, month - 1, day) / DAY_MS
}

function validDate(date: string | undefined): date is string {
  return !!date && /^\d{4}-\d{2}-\d{2}/.test(date) && !Number.isNaN(dayNumber(date))
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
function daysBetween(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from))
}

const NOT_STARTED: ReadonlySet<Task["status"]> = new Set(["draft", "assigned", "accepted", "ready"])
const STATUS_LABEL: Record<ReportStatus, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  behind: "Behind schedule",
  "not-enough-data": "Not enough data",
}

export function analyzeProject(
  state: ConstructionDataState,
  projectId: EntityId,
  today: ISODate,
  generatedAt: ISODateTime = `${today}T00:00:00.000Z`,
): ProjectReport | undefined {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return undefined

  const tasks = state.tasks.filter(
    (task) => task.projectId === projectId && task.status !== "cancelled",
  )
  const isDone = (task: Task) => DONE_STATUSES.has(task.status)
  const signals: DelaySignal[] = []
  const assumptions: string[] = []

  // Progress
  const overall = calculateProjectProgress(project, state.stages, tasks)
  const stages = [...state.stages]
    .sort((a, b) => a.sequence - b.sequence)
    .map((stage) => {
      const stageTasks = tasks.filter((task) => task.stageId === stage.id)
      const baseline = project.stageBaselines[stage.id] ?? 0
      const due = stageTasks.filter((task) => validDate(task.dueDate) && task.dueDate <= today)
      return {
        stageId: stage.id,
        name: stage.name,
        percent: Math.round(stagePercent(baseline, stageTasks)),
        baseline,
        taskCount: stageTasks.length,
        dueByToday: due.length,
        doneOfDue: due.filter(isDone).length,
      }
    })
    .filter((stage) => stage.taskCount > 0 || stage.baseline > 0)

  const approved = state.dailyProgress
    .filter((item) => item.projectId === projectId && item.reviewStatus === "approved")
    .map((item) => item.date)
    .filter(validDate)
    .sort()
  const lastApprovedUpdate = approved[approved.length - 1]
  const daysSinceLastUpdate = lastApprovedUpdate ? daysBetween(lastApprovedUpdate, today) : undefined

  // Planned vs actual
  const due = tasks.filter((task) => validDate(task.dueDate) && task.dueDate <= today)
  const doneOfDue = due.filter(isDone).length
  let expectedPercent: number | undefined
  let variancePoints: number | undefined
  if (
    validDate(project.startDate) &&
    validDate(project.targetDate) &&
    daysBetween(project.startDate, project.targetDate) > 0
  ) {
    const total = daysBetween(project.startDate, project.targetDate)
    const elapsed = daysBetween(project.startDate, today)
    expectedPercent = Math.round(Math.min(100, Math.max(0, (elapsed / total) * 100)))
    variancePoints = expectedPercent - overall
  } else {
    assumptions.push("No start and target date are set, so schedule variance was not computed.")
  }

  // Signals
  for (const task of tasks) {
    if (isDone(task)) continue
    const urgent = task.priority === "high" || task.priority === "critical"
    if (validDate(task.dueDate) && task.dueDate < today) {
      const late = daysBetween(task.dueDate, today)
      signals.push({
        kind: "overdue-task",
        severity: urgent || late > OVERDUE_HIGH_DAYS ? "high" : "medium",
        message: `${task.title} is ${late} day${late === 1 ? "" : "s"} overdue.`,
        taskId: task.id,
        stageId: task.stageId,
      })
    }
    if (task.status === "blocked" || task.status === "delayed") {
      signals.push({
        kind: "blocked-task",
        severity: urgent ? "high" : "medium",
        message: `${task.title} is ${task.status}.`,
        taskId: task.id,
        stageId: task.stageId,
      })
    }
    if (validDate(task.plannedStart) && task.plannedStart < today && NOT_STARTED.has(task.status)) {
      const late = daysBetween(task.plannedStart, today)
      if (late > LATE_START_MEDIUM_DAYS) {
        signals.push({
          kind: "late-start",
          severity: "medium",
          message: `${task.title} was planned to start ${late} days ago and has not started.`,
          taskId: task.id,
          stageId: task.stageId,
        })
      }
    }
  }

  if (project.status === "active") {
    if (daysSinceLastUpdate === undefined) {
      // No update yet is missing data, not evidence of delay, so it never reads as "behind".
      signals.push({
        kind: "stale-updates",
        severity: "medium",
        message: "No site update has been approved yet.",
      })
      assumptions.push("No approved updates yet, so update freshness could not be measured.")
    } else if (daysSinceLastUpdate >= STALE_UPDATE_DAYS) {
      signals.push({
        kind: "stale-updates",
        severity: daysSinceLastUpdate >= STALE_UPDATE_HIGH_DAYS ? "high" : "medium",
        message: `The last approved site update was ${daysSinceLastUpdate} days ago.`,
      })
    }
  }

  if (variancePoints !== undefined && variancePoints > SCHEDULE_VARIANCE_MEDIUM_POINTS) {
    signals.push({
      kind: "behind-schedule",
      severity: variancePoints > SCHEDULE_VARIANCE_HIGH_POINTS ? "high" : "medium",
      message: `Progress is ${overall}% against about ${expectedPercent}% expected by now.`,
    })
  }

  // Issues
  const projectIssues = state.issues.filter((issue) => issue.projectId === projectId)
  const bySeverity: Record<Issue["severity"], number> = { low: 0, medium: 0, high: 0, critical: 0 }
  const byStatus: Record<Issue["status"], number> = { open: 0, "in-progress": 0, resolved: 0, closed: 0 }
  let oldestSerious: ProjectReport["issues"]["oldestSerious"]
  let open = 0
  for (const issue of projectIssues) {
    bySeverity[issue.severity]++
    byStatus[issue.status]++
    if (issue.status !== "open" && issue.status !== "in-progress") continue
    open++
    if (issue.severity !== "high" && issue.severity !== "critical") continue
    const ageDays = daysBetween(issue.createdAt, today)
    if (!oldestSerious || ageDays > oldestSerious.ageDays) {
      oldestSerious = { issueId: issue.id, title: issue.title, ageDays }
    }
    if (ageDays > SERIOUS_ISSUE_AGE_DAYS) {
      signals.push({
        kind: "aging-issue",
        severity: "high",
        message: `${issue.title} (${issue.severity}) has been open ${ageDays} days.`,
        issueId: issue.id,
      })
    }
  }

  // Status, confidence
  const ordered = [
    ...signals.filter((signal) => signal.severity === "high"),
    ...signals.filter((signal) => signal.severity === "medium"),
  ]
  const status: ReportStatus = !tasks.length
    ? "not-enough-data"
    : ordered.some((signal) => signal.severity === "high")
      ? "behind"
      : ordered.length
        ? "at-risk"
        : "on-track"

  const datesValid = expectedPercent !== undefined
  const confidence: ProjectReport["confidence"] = !tasks.length
    ? "low"
    : datesValid && tasks.length >= MIN_TASKS_FOR_HIGH_CONFIDENCE
      ? "high"
      : "medium"
  if (!tasks.length) assumptions.push("The project has no tasks yet, so progress and schedule were not analysed.")
  if (tasks.some((task) => !task.plannedQuantity)) {
    assumptions.push("Tasks without a planned quantity count as 0% until approved or completed.")
  }

  // Summary
  const summary: string[] = [`${STATUS_LABEL[status]}: overall progress is ${overall}%.`]
  if (due.length) summary.push(`${doneOfDue} of ${due.length} tasks due by today are done.`)
  if (expectedPercent !== undefined) {
    summary.push(`Schedule: about ${expectedPercent}% expected by now, ${overall}% actual.`)
  }
  for (const signal of ordered.slice(0, 3)) summary.push(`• ${signal.message}`)
  summary.push(
    open
      ? `${open} open issue${open === 1 ? "" : "s"}${
          oldestSerious ? `; the oldest serious one has been open ${oldestSerious.ageDays} days` : ""
        }.`
      : "No open issues.",
  )

  return {
    projectId,
    asOf: today,
    status,
    summary,
    progress: { overall, stages, lastApprovedUpdate, daysSinceLastUpdate },
    plannedVsActual: {
      dueByToday: due.length,
      doneOfDue,
      expectedPercent,
      actualPercent: overall,
      variancePoints,
    },
    issues: { open, bySeverity, byStatus, oldestSerious },
    signals: ordered,
    source: "ai",
    createdBy: "ai",
    engine: "rules-v1",
    confidence,
    assumptions,
    reviewStatus: "draft",
    generatedAt,
  }
}
