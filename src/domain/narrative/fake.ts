import { checkNarrative } from "../../../supabase/functions/_shared/narrative/guard"
import { hashFacts } from "../../../supabase/functions/_shared/narrative/hash"
import type {
  NarrativeErrorCode,
  NarrativeFacts,
  NarrativeResponse,
} from "../../../supabase/functions/_shared/narrative/types"
import type { NarrativeService } from "./service"

const STATUS_WORDS = {
  "on-track": "on track",
  "at-risk": "at risk",
  behind: "behind schedule",
  "not-enough-data": "short of data",
} as const

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

function paragraphsFor(facts: NarrativeFacts): string[] {
  if (facts.kind === "report") {
    const open = facts.issues.open
    const signals = facts.signals.length
    return [
      `The project is ${STATUS_WORDS[facts.status]}, with overall progress at ${facts.overallPercent} percent as of ${facts.asOf}.`,
      `${plural(open, "issue is", "issues are")} open and ${plural(signals, "delay signal was", "delay signals were")} raised.`,
    ]
  }
  return [
    `Over the past ${plural(facts.windowDays, "day", "days")} there ${facts.updates === 1 ? "was" : "were"} ${plural(facts.updates, "update", "updates")} across ${plural(facts.daysReported, "day", "days")}, with up to ${plural(facts.peakWorkers, "worker", "workers")} on site.`,
    `${plural(facts.tasksCompleted, "task was", "tasks were")} completed and ${plural(facts.issuesOpen, "issue remains", "issues remain")} open.`,
  ]
}

/** Deterministic stand-in for the model: offline, free, and always guard-clean. */
export function createFakeNarrativeService(
  options: { now?: () => string; failWith?: NarrativeErrorCode } = {},
): NarrativeService {
  const now = options.now ?? (() => new Date().toISOString())
  return {
    async narrate({ facts }): Promise<NarrativeResponse> {
      if (options.failWith) return { error: options.failWith }
      const checked = checkNarrative(paragraphsFor(facts), facts)
      if (!checked.ok) return { error: "rejected" }
      return {
        narrative: {
          text: checked.text,
          engine: "claude:fake",
          generatedAt: now(),
          factsHash: await hashFacts(facts),
        },
      }
    },
  }
}
