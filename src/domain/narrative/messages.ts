import type { NarrativeErrorCode } from "../../../supabase/functions/_shared/narrative/types"

const MESSAGES: Record<NarrativeErrorCode, string> = {
  unauthorized: "Please sign in again to use AI summaries.",
  forbidden: "You don't have permission to write AI summaries for this project.",
  "not-included": "AI summaries aren't included in your plan.",
  "limit-reached": "You've used all your AI summaries this month. The standard summary is shown.",
  unavailable: "The AI writer isn't available right now. The standard summary is shown.",
  rejected: "The AI text didn't pass our accuracy check. The standard summary is shown.",
}

export function narrativeErrorMessage(code: NarrativeErrorCode): string {
  return MESSAGES[code]
}
