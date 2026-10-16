// The contract between the client, the edge function and the output guard.
// No imports: this file is shared by the browser bundle and the Deno function.

export type NarrativeKind = "report" | "weekly-company"

type Confidence = "low" | "medium" | "high"

/** Anonymised, computed facts about one project report. Nothing typed by a person. */
export interface ReportFacts {
  kind: "report"
  asOf: string
  status: "on-track" | "at-risk" | "behind" | "not-enough-data"
  confidence: Confidence
  overallPercent: number
  stages: {
    name: string
    percent: number
    baselinePercent: number
    dueByToday: number
    doneOfDue: number
  }[]
  plannedVsActual: {
    dueByToday: number
    doneOfDue: number
    expectedPercent?: number
    actualPercent: number
    variancePoints?: number
  }
  issues: {
    open: number
    bySeverity: Record<"low" | "medium" | "high" | "critical", number>
    byStatus: Record<"open" | "in-progress" | "resolved" | "closed", number>
    oldestSeriousAgeDays?: number
  }
  signals: { kind: string; severity: "medium" | "high" }[]
  daysSinceLastUpdate?: number
  assumptionCount: number
}

/** Anonymised, computed facts about one company-audience weekly summary. */
export interface WeeklyFacts {
  kind: "weekly-company"
  from: string
  to: string
  windowDays: number
  confidence: Confidence
  daysReported: number
  updates: number
  peakWorkers: number
  evidence: number
  issuesRaised: number
  issuesResolved: number
  issuesOpen: number
  tasksCompleted: number
  workerDays: number
  awaitingReview: number
  blockerCount: number
}

export type NarrativeFacts = ReportFacts | WeeklyFacts

/** AI-written prose plus the provenance a reviewer needs. */
export interface Narrative {
  text: string
  /** `claude:<model id>` for the real writer. */
  engine: string
  generatedAt: string
  /** SHA-256 hex of the canonical facts the text was written from. */
  factsHash: string
}

export type NarrativeErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not-included"
  | "limit-reached"
  | "unavailable"
  | "rejected"

export interface NarrativeRequest {
  /** The project's database uuid. */
  projectId: string
  kind: NarrativeKind
  facts: NarrativeFacts
}

export type NarrativeResponse = { narrative: Narrative } | { error: NarrativeErrorCode }
