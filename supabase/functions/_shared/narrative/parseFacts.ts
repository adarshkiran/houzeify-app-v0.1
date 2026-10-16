import type { NarrativeFacts, ReportFacts, SignalKindName, WeeklyFacts } from "./types.ts"

// Server-side privacy boundary (spec §2). The edge function receives facts from
// a client that could have been modified, so the packet is rebuilt field by
// field from validated values. Nothing is spread; unknown keys are dropped.

const MAX_VALUE = 1_000_000
const MAX_ENTRIES = 50

const STATUSES = ["on-track", "at-risk", "behind", "not-enough-data"] as const
const CONFIDENCES = ["low", "medium", "high"] as const
const SEVERITIES = ["medium", "high"] as const
const SIGNAL_KINDS: readonly SignalKindName[] = [
  "overdue-task",
  "blocked-task",
  "late-start",
  "stale-updates",
  "behind-schedule",
  "aging-issue",
]

class Invalid extends Error {}

const fail = (): never => {
  throw new Invalid()
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : fail()
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fail()
}

function date(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fail()
}

function num(value: unknown, options: { integer?: boolean; min?: number } = {}): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fail()
  if (value < (options.min ?? 0) || value > MAX_VALUE) return fail()
  if (options.integer && !Number.isInteger(value)) return fail()
  return value
}

const count = (value: unknown) => num(value, { integer: true })

function optional<T>(value: unknown, read: (value: unknown) => T): T | undefined {
  return value === undefined || value === null ? undefined : read(value)
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) && value.length <= MAX_ENTRIES ? value : fail()
}

// Staff-typed names may carry a short number ("Phase 2") but never a run of 4+ digits (phone-like).
function stageName(value: unknown): string {
  return typeof value === "string" && value.length >= 1 && value.length <= 40 && /^[A-Za-z0-9][A-Za-z0-9 &/()+-]*$/.test(value) && !/\d{4}/.test(value)
    ? value
    : fail()
}

function parseReport(input: Record<string, unknown>): ReportFacts {
  const planned = record(input.plannedVsActual)
  const issues = record(input.issues)
  const bySeverity = record(issues.bySeverity)
  const byStatus = record(issues.byStatus)
  return {
    kind: "report",
    asOf: date(input.asOf),
    status: oneOf(input.status, STATUSES),
    confidence: oneOf(input.confidence, CONFIDENCES),
    overallPercent: num(input.overallPercent),
    stages: list(input.stages).map((raw) => {
      const stage = record(raw)
      return {
        name: stageName(stage.name),
        percent: num(stage.percent),
        baselinePercent: num(stage.baselinePercent),
        dueByToday: count(stage.dueByToday),
        doneOfDue: count(stage.doneOfDue),
      }
    }),
    plannedVsActual: {
      dueByToday: count(planned.dueByToday),
      doneOfDue: count(planned.doneOfDue),
      expectedPercent: optional(planned.expectedPercent, (v) => num(v)),
      actualPercent: num(planned.actualPercent),
      variancePoints: optional(planned.variancePoints, (v) => num(v, { min: -1000 })),
    },
    issues: {
      open: count(issues.open),
      bySeverity: {
        low: count(bySeverity.low),
        medium: count(bySeverity.medium),
        high: count(bySeverity.high),
        critical: count(bySeverity.critical),
      },
      byStatus: {
        open: count(byStatus.open),
        "in-progress": count(byStatus["in-progress"]),
        resolved: count(byStatus.resolved),
        closed: count(byStatus.closed),
      },
      oldestSeriousAgeDays: optional(issues.oldestSeriousAgeDays, count),
    },
    signals: list(input.signals).map((raw) => {
      const signal = record(raw)
      return { kind: oneOf(signal.kind, SIGNAL_KINDS), severity: oneOf(signal.severity, SEVERITIES) }
    }),
    daysSinceLastUpdate: optional(input.daysSinceLastUpdate, count),
    assumptionCount: count(input.assumptionCount),
  }
}

function parseWeekly(input: Record<string, unknown>): WeeklyFacts {
  return {
    kind: "weekly-company",
    from: date(input.from),
    to: date(input.to),
    windowDays: count(input.windowDays),
    confidence: oneOf(input.confidence, CONFIDENCES),
    daysReported: count(input.daysReported),
    updates: count(input.updates),
    peakWorkers: count(input.peakWorkers),
    evidence: count(input.evidence),
    issuesRaised: count(input.issuesRaised),
    issuesResolved: count(input.issuesResolved),
    issuesOpen: count(input.issuesOpen),
    tasksCompleted: count(input.tasksCompleted),
    workerDays: count(input.workerDays),
    awaitingReview: count(input.awaitingReview),
    blockerCount: count(input.blockerCount),
  }
}

/** Validated, freshly built facts, or undefined when anything is missing, malformed or out of range. */
export function parseNarrativeFacts(value: unknown): NarrativeFacts | undefined {
  try {
    const input = record(value)
    if (input.kind === "report") return parseReport(input)
    if (input.kind === "weekly-company") return parseWeekly(input)
    return undefined
  } catch (error) {
    if (error instanceof Invalid) return undefined
    throw error
  }
}
