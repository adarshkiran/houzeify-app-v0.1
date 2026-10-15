import type {
  ConstructionDataState,
  DailyProgress,
  EntityId,
  ISODate,
  ISODateTime,
  Issue,
} from "../domain/models"
import { addDays, formatDay } from "./dayStory"
import { getPublishedEvidence, getPublishedForCustomer } from "./selectors"

// Site AI weekly summary (build plan §10.3 "→ Summary"; master plan §11
// "Progress summarization ... and weekly summary"). Deterministic and on
// demand, like the day cards in dayStory.ts, so nothing is stored.
// Spec: docs/superpowers/specs/2026-10-16-site-ai-weekly-summary-design.md

export const SUMMARY_WINDOW_DAYS = 7
export const HIGH_CONFIDENCE_DAYS = 5
const MAX_HIGHLIGHTS = 3
const MAX_BLOCKERS = 3

export type SummaryAudience = "company" | "homeowner"

export interface WeeklySummaryDay {
  date: ISODate
  notes: string[]
  workersPresent?: number
}

export interface WeeklySummary {
  projectId: EntityId
  from: ISODate
  to: ISODate
  audience: SummaryAudience
  days: WeeklySummaryDay[]
  totals: {
    updates: number
    daysReported: number
    peakWorkers: number
    evidence: number
    issuesRaised: number
    issuesResolved: number
    issuesOpen: number
    /** Company only. */
    tasksCompleted?: number
    workerDays?: number
    awaitingReview?: number
  }
  /** Company only. */
  blockers?: string[]
  lines: string[]
  source: "ai"
  createdBy: "ai"
  engine: "rules-v1"
  confidence: "low" | "medium" | "high"
  assumptions: string[]
  generatedAt: ISODateTime
}

const DONE_TASK = new Set(["approved", "completed"])
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`
const within = (iso: string, from: ISODate, to: ISODate) => {
  const day = iso.slice(0, 10)
  return day >= from && day <= to
}

export function summarizeWeek(
  state: ConstructionDataState,
  projectId: EntityId,
  weekEnd: ISODate,
  options: { audience: SummaryAudience; today: ISODate; generatedAt?: ISODateTime },
): WeeklySummary | undefined {
  if (!state.projects.some((project) => project.id === projectId)) return undefined

  const { audience } = options
  const to = weekEnd
  const from = addDays(weekEnd, -(SUMMARY_WINDOW_DAYS - 1))
  const dates = Array.from({ length: SUMMARY_WINDOW_DAYS }, (_, index) => addDays(from, index))
  const isCompany = audience === "company"

  // What this audience may be built from. The homeowner's inputs are filtered
  // before anything is computed, so nothing private can reach their summary.
  const counted: DailyProgress[] = (
    isCompany
      ? state.dailyProgress.filter(
          (item) =>
            item.projectId === projectId &&
            item.reviewStatus !== "draft" &&
            item.reviewStatus !== "superseded" &&
            item.reviewStatus !== "rejected",
        )
      : getPublishedForCustomer(state, projectId)
  )
    .filter((item) => item.date >= from && item.date <= to)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))

  const issues: Issue[] = state.issues.filter(
    (issue) =>
      issue.projectId === projectId && (isCompany || issue.customerVisibility === "customer-visible"),
  )

  const days: WeeklySummaryDay[] = dates.map((date) => {
    const onDay = counted.filter((item) => item.date === date)
    const notes = onDay.map((item) => item.todaySummary.trim()).filter(Boolean)
    const workers = onDay.length ? Math.max(...onDay.map((item) => item.workersPresent)) : undefined
    return { date, notes, workersPresent: workers }
  })

  const evidenceIds = new Set<EntityId>()
  for (const update of counted) {
    if (isCompany) {
      for (const id of update.evidenceIds) evidenceIds.add(id)
      for (const item of state.evidence) {
        if (item.dailyProgressId === update.id) evidenceIds.add(item.id)
      }
    } else {
      for (const item of getPublishedEvidence(state, update)) evidenceIds.add(item.id)
    }
  }

  const raised = issues.filter((issue) => within(issue.createdAt, from, to)).length
  const resolved = issues.filter(
    (issue) =>
      (issue.status === "resolved" || issue.status === "closed") &&
      issue.updatedAt !== undefined &&
      within(issue.updatedAt, from, to),
  ).length
  const open = issues.filter((issue) => issue.status === "open" || issue.status === "in-progress").length

  const daysReported = days.filter((day) => counted.some((item) => item.date === day.date)).length
  const peakWorkers = counted.length ? Math.max(...counted.map((item) => item.workersPresent)) : 0

  const totals: WeeklySummary["totals"] = {
    updates: counted.length,
    daysReported,
    peakWorkers,
    evidence: evidenceIds.size,
    issuesRaised: raised,
    issuesResolved: resolved,
    issuesOpen: open,
  }
  const assumptions: string[] = []
  let blockers: string[] | undefined

  if (isCompany) {
    totals.tasksCompleted = state.tasks.filter(
      (task) =>
        task.projectId === projectId && DONE_TASK.has(task.status) && within(task.updatedAt, from, to),
    ).length
    totals.workerDays = state.workerAttendance.filter(
      (record) =>
        record.projectId === projectId &&
        (record.status === "present" || record.status === "half-day") &&
        record.date >= from &&
        record.date <= to,
    ).length
    totals.awaitingReview = counted.filter((item) => item.reviewStatus === "submitted").length
    blockers = [
      ...new Set(counted.map((item) => item.blockerSummary?.trim()).filter((text): text is string => !!text)),
    ]
    assumptions.push(
      "Tasks are counted as completed by the date they were last updated; completion dates are not recorded.",
    )
  }
  if (!counted.length) {
    assumptions.push(
      isCompany
        ? "No site updates were reported in this period, so there is little to summarise."
        : "Your contractor has not published an update in this period.",
    )
  }

  const confidence: WeeklySummary["confidence"] = !counted.length
    ? "low"
    : daysReported >= HIGH_CONFIDENCE_DAYS
      ? "high"
      : "medium"

  // Templated sentences, in reading order. Every figure comes from `totals`.
  const lines: string[] = []
  const range = `${formatDay(from)} to ${formatDay(to)}`
  if (!counted.length) {
    lines.push(
      isCompany
        ? `No site updates were reported from ${range}.`
        : `No updates were shared from ${range}.`,
    )
  } else if (isCompany) {
    lines.push(
      `${plural(totals.updates, "site update")} across ${daysReported} of ${SUMMARY_WINDOW_DAYS} days, with up to ${plural(peakWorkers, "worker")} on site.`,
    )
    const extras: string[] = []
    if (totals.tasksCompleted) extras.push(`${plural(totals.tasksCompleted, "task")} completed`)
    if (totals.workerDays) extras.push(`${plural(totals.workerDays, "worker day")} recorded`)
    if (totals.awaitingReview) extras.push(`${totals.awaitingReview} awaiting review`)
    if (extras.length) lines.push(`${extras.join(", ")}.`)
  } else {
    lines.push(
      `Your contractor shared ${plural(totals.updates, "update")} across ${daysReported} of ${SUMMARY_WINDOW_DAYS} days.`,
    )
  }
  const highlights = days.flatMap((day) => day.notes.map((note) => `${formatDay(day.date)}: ${note}`))
  for (const note of highlights.slice(-MAX_HIGHLIGHTS)) lines.push(`• ${note}`)
  if (totals.evidence) {
    lines.push(`${plural(totals.evidence, "attachment")} (photos or files) shared with the updates.`)
  }
  if (isCompany) {
    if (raised || resolved || open) {
      lines.push(`Issues: ${raised} raised, ${resolved} resolved, ${open} open.`)
    } else {
      lines.push("No issues raised or open.")
    }
    if (blockers?.length) lines.push(`Blockers reported: ${blockers.slice(0, MAX_BLOCKERS).join("; ")}.`)
  } else if (raised || resolved || open) {
    lines.push(`${plural(raised + open, "issue")} shared with you: ${resolved} fixed, ${open} being looked into.`)
  }

  return {
    projectId,
    from,
    to,
    audience,
    days,
    totals,
    blockers,
    lines,
    source: "ai",
    createdBy: "ai",
    engine: "rules-v1",
    confidence,
    assumptions,
    generatedAt: options.generatedAt ?? `${options.today}T00:00:00.000Z`,
  }
}
