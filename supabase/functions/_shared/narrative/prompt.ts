import { canonicalJson } from "./hash.ts"
import type { NarrativeFacts } from "./types.ts"

export const SYSTEM_PROMPT = `You write the management summary of a construction project for a site manager or project manager in plain, direct English.

Rules:
- Use only the facts in the user message. Do not add anything you were not given.
- Quote every number exactly as given. Never calculate, round, estimate or combine numbers into new ones.
- No names of people, companies or places. Refer to roles generically (for example "the site team").
- Do not speculate about causes and do not give legal or financial advice.
- Where a fact is missing, say there is not enough data for it rather than guessing.
- Describe each delay signal generically from its kind and severity.
- Write dates exactly as given (YYYY-MM-DD) or as a day and a month name. Never use DD-MM-YYYY or slash dates.
- Avoid quantity words such as dozen, half, double or lakh; use only the numbers given.
- No links, email addresses or phone numbers.
- Write two or three short paragraphs: first the overall position, then what is behind or at risk, then what needs attention. Keep the whole summary under 150 words.`

export function buildUserMessage(facts: NarrativeFacts): string {
  return `Write the summary from these facts only.\n\n${canonicalJson(facts)}`
}

export const NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    paragraphs: { type: "array", items: { type: "string" } },
  },
  required: ["paragraphs"],
  additionalProperties: false,
} as const
