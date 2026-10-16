import type { ProjectReport } from "../domain/projectAnalysis"
import type {
  NarrativeFacts,
  ReportFacts,
  WeeklyFacts,
} from "../../supabase/functions/_shared/narrative/types"
import { SUMMARY_WINDOW_DAYS, type WeeklySummary } from "./weeklySummary"

// The privacy boundary for the LLM narrative (spec §2). Every field is copied
// explicitly: anything not listed here is never sent. Do not spread inputs.

const oneDecimal = (value: number) => Math.round(value * 10) / 10

function reportFacts(report: ProjectReport): ReportFacts {
  const { plannedVsActual, issues, progress } = report
  return {
    kind: "report",
    asOf: report.asOf,
    status: report.status,
    confidence: report.confidence,
    overallPercent: oneDecimal(progress.overall),
    stages: progress.stages.map((stage) => ({
      name: stage.name,
      percent: oneDecimal(stage.percent),
      baselinePercent: oneDecimal(stage.baseline),
      dueByToday: stage.dueByToday,
      doneOfDue: stage.doneOfDue,
    })),
    plannedVsActual: {
      dueByToday: plannedVsActual.dueByToday,
      doneOfDue: plannedVsActual.doneOfDue,
      expectedPercent:
        plannedVsActual.expectedPercent === undefined ? undefined : oneDecimal(plannedVsActual.expectedPercent),
      actualPercent: oneDecimal(plannedVsActual.actualPercent),
      variancePoints:
        plannedVsActual.variancePoints === undefined ? undefined : oneDecimal(plannedVsActual.variancePoints),
    },
    issues: {
      open: issues.open,
      bySeverity: {
        low: issues.bySeverity.low,
        medium: issues.bySeverity.medium,
        high: issues.bySeverity.high,
        critical: issues.bySeverity.critical,
      },
      byStatus: {
        open: issues.byStatus.open,
        "in-progress": issues.byStatus["in-progress"],
        resolved: issues.byStatus.resolved,
        closed: issues.byStatus.closed,
      },
      oldestSeriousAgeDays: issues.oldestSerious?.ageDays,
    },
    signals: report.signals.map((signal) => ({ kind: signal.kind, severity: signal.severity })),
    daysSinceLastUpdate: progress.daysSinceLastUpdate,
    assumptionCount: report.assumptions.length,
  }
}

function weeklyFacts(summary: WeeklySummary): WeeklyFacts {
  const { totals } = summary
  return {
    kind: "weekly-company",
    from: summary.from,
    to: summary.to,
    windowDays: SUMMARY_WINDOW_DAYS,
    confidence: summary.confidence,
    daysReported: totals.daysReported,
    updates: totals.updates,
    peakWorkers: totals.peakWorkers,
    evidence: totals.evidence,
    issuesRaised: totals.issuesRaised,
    issuesResolved: totals.issuesResolved,
    issuesOpen: totals.issuesOpen,
    tasksCompleted: totals.tasksCompleted ?? 0,
    workerDays: totals.workerDays ?? 0,
    awaitingReview: totals.awaitingReview ?? 0,
    blockerCount: summary.blockers?.length ?? 0,
  }
}

/** Anonymised facts for the narrative writer; undefined where AI text is not allowed (homeowner audience). */
export function buildNarrativeFacts(input: ProjectReport | WeeklySummary): NarrativeFacts | undefined {
  if ("signals" in input) return reportFacts(input)
  return input.audience === "company" ? weeklyFacts(input) : undefined
}
