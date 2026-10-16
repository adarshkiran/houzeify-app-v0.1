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

function paragraphsFor(facts: NarrativeFacts): string[] {
  if (facts.kind === "report") {
    return [
      `The project is ${STATUS_WORDS[facts.status]}, with overall progress at ${facts.overallPercent} percent as of ${facts.asOf}.`,
      `${facts.issues.open} issues are open and ${facts.signals.length} delay signals were raised.`,
    ]
  }
  return [
    `Over the past ${facts.windowDays} days there were ${facts.updates} updates across ${facts.daysReported} days, with up to ${facts.peakWorkers} workers on site.`,
    `${facts.tasksCompleted} tasks were completed and ${facts.issuesOpen} issues remain open.`,
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
