import type { NarrativeFacts } from "./types.ts"

// Deterministic accuracy check on model output (spec §4). Conservative on
// purpose: a false reject costs one refunded click; a false accept puts an
// invented figure in a report.

export const MAX_PARAGRAPHS = 4
export const MAX_CHARS = 1200

export type GuardResult =
  | { ok: true; text: string }
  | { ok: false; reason: "shape" | "too-long" | "link" | "number" | "name" }

const WORD_NUMBERS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
}
// Vague or large quantities that can never be checked against a fact.
const QUANTITY_WORDS = new Set([
  "dozen", "score", "half", "quarter", "million", "billion", "lakh", "lakhs", "crore", "crores",
  "twice", "double", "triple", "thrice", "hundred", "hundreds", "thousand", "thousands",
])
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}
const UNITS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
}
const TENS_COMPOUND = new RegExp(
  `\\b(${Object.keys(TENS).join("|")})\\b(?:[-\\s]+(${Object.keys(UNITS).join("|")})\\b)?`,
  "gi",
)
// Common English sentence starters. A capitalised first word outside this set
// (and outside the allowed words) is treated as a possible invented name.
const SENTENCE_OPENERS = new Set(
  (
    "the a an this that these those it its there overall progress work no not all some most several with while as over in on at by for from of to " +
    "one two three four five six seven eight nine ten issues tasks updates workers delay signals stages currently however also additionally meanwhile today since after before " +
    "because although if when where which what both each every more less any only still about around nearly almost roughly recent latest last next key main further finally " +
    "first second third schedule quality safety site team project report week month day days risk risks status " +
    "expected planned actual open high medium low critical peak during across attention stage issue task update variance evidence confidence blocker blockers signal delays " +
    "despite under against none nothing workforce attendance completion completed delivery overdue severity please compared activity without"
  ).split(" "),
)
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
// Wider vocabulary of ordinary reporting prose, learned from real model output.
// Kept separate from the list above. Names stay rejected: none of these are names.
const MORE_OPENERS = new Set(
  (
    "recorded reported logged noted submitted raised flagged pending outstanding confirmed taken based looking considering assuming noting treating counting excluding including allowing ensuring keeping bringing asking requiring recommending suggesting indicating showing covering spanning stating tracking reviewing checking updating filing submitting " +
    "figures numbers totals counts reports picture position assumptions absence lack gap summary overview outlook priority priorities action actions remaining current previous stale minor major small large limited little few many either neither other another such same whole " +
    "therefore thus hence otherwise instead yet even just presently recently so whereas though unless until once whether within among above below beyond per via throughout approximately"
  ).split(" "),
)
// Structural check for the first word of a sentence. Model prose has no fixed
// set of opening words ("Establishing", "Absence", "Reliable"...), and listing
// them one by one never ends. The name rule exists to stop invented NAMES; names
// in the middle of a sentence are still caught, and a model fed only anonymised
// facts and told not to use names essentially never opens a sentence with one.
// So a sentence-initial word of six or more letters with an ordinary English
// suffix passes, unless it is a common person name that happens to share a suffix.
// Residual risk (accepted): an unlisted suffix-shaped name could pass at sentence start.
const OPENER_SUFFIXES = [
  "ing", "ed", "tion", "sion", "ment", "ness", "ity", "ly", "ous", "ive", "able", "ible", "ance", "ence",
  "ful", "less", "ial", "ical", "al", "ic", "ize", "ise", "ure", "ship", "hood",
]
const NAME_COLLISIONS = new Set(
  (
    "ahmed mohammed muhammed mohammad mohamed mehmed hamed naveed rasheed waheed majeed hameed shaheed fareed zaheed sayeed javed saeed " +
    "sterling fleming harding manning browning kipling spalding " +
    "kelly molly holly sally billy willy tommy johnny sunny bobby harry jerry terry lary gary rowley ashley bradley stanley wesley shirley beverly beverley kimberly emily " +
    "hartley bentley huntley kingsley whitley barkley berkeley hadley marley hurley bailey " +
    "brittany patricia alicia felicia julia maria sofia olivia victoria valerie " +
    "vishal nirmal faisal kaushal crystal krystal chantal marshal dayal " +
    "lawrence clarence florence laurence terrance constance clement " +
    "denise louise elise alfred mildred winifred frederic"
  ).split(" "),
)
function looksLikeOrdinaryOpener(lower: string): boolean {
  return lower.length >= 6 && !NAME_COLLISIONS.has(lower) && OPENER_SUFFIXES.some((suffix) => lower.endsWith(suffix))
}
const MONTH_ABBREVIATIONS = ["Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec"]
const FIXED_WORDS = ["AI", "Hozie", "Houzeify", ...MONTHS, ...MONTH_ABBREVIATIONS, ...WEEKDAYS].map((word) => word.toLowerCase())

const has = (table: object, key: string) => Object.prototype.hasOwnProperty.call(table, key)
const norm = (value: number) => Number(value.toFixed(6))

function collectNumbers(value: unknown, into: Set<number>): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    into.add(norm(value))
    into.add(norm(Math.round(value)))
  } else if (typeof value === "string") {
    const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    if (date) for (const part of date.slice(1)) into.add(Number(part))
  } else if (Array.isArray(value)) {
    into.add(value.length)
    for (const member of value) collectNumbers(member, into)
  } else if (value && typeof value === "object") {
    for (const member of Object.values(value)) collectNumbers(member, into)
  }
}

function allowedWords(facts: NarrativeFacts): Set<string> {
  const words = new Set(FIXED_WORDS)
  if (facts.kind === "report") {
    for (const stage of facts.stages) {
      for (const word of stage.name.split(/[^A-Za-z]+/)) if (word) words.add(word.toLowerCase())
    }
  }
  return words
}

export function checkNarrative(paragraphs: unknown, facts: NarrativeFacts): GuardResult {
  if (
    !Array.isArray(paragraphs) ||
    paragraphs.length < 1 ||
    paragraphs.length > MAX_PARAGRAPHS ||
    paragraphs.some((p) => typeof p !== "string" || !p.trim())
  ) {
    return { ok: false, reason: "shape" }
  }
  const text = (paragraphs as string[]).map((p) => p.trim()).join("\n\n")
  if (text.length > MAX_CHARS) return { ok: false, reason: "too-long" }

  // Zero-width, formatting and control characters (other than newline) can hide lookalike digits.
  if (/[\p{Cf}\u0000-\u0009\u000B-\u001F\u007F-\u009F]/u.test(text)) return { ok: false, reason: "name" }

  // Non-ASCII letters or digits can disguise names and figures (accents, fullwidth digits).
  if (/(?![A-Za-z])\p{L}/u.test(text)) return { ok: false, reason: "name" }
  if (/(?![0-9])\p{N}/u.test(text)) return { ok: false, reason: "number" }

  // ISO dates (2026-10-15) are legitimate; remove them before looking for phone-like digit runs.
  const withoutDates = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
  const looksLikeLink =
    /(https?:\/\/|www\.|\S+@\S+\.\S+)/i.test(text) ||
    /\b[a-z0-9-]+\.(com|in|org|net|io|co|app|dev|ai)\b/i.test(text) ||
    /\+?\d(?:[\s().-]?\d){7,}/.test(withoutDates)
  if (looksLikeLink) return { ok: false, reason: "link" }

  const allowedNumbers = new Set<number>()
  collectNumbers(facts, allowedNumbers)
  // Grouped numbers first (4,000 and 1,00,000), so a comma can never split a figure in two.
  for (const match of text.matchAll(/\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
    if (!allowedNumbers.has(norm(Number(match[0].replace(/,/g, ""))))) return { ok: false, reason: "number" }
  }
  // Compounds such as "twenty-one" or "thirty two" are checked as one value.
  let compoundRejected = false
  const withoutCompounds = text.replace(TENS_COMPOUND, (_match, tens: string, unit?: string) => {
    const value = TENS[tens.toLowerCase()] + (unit ? UNITS[unit.toLowerCase()] : 0)
    if (!allowedNumbers.has(value)) compoundRejected = true
    return " "
  })
  if (compoundRejected) return { ok: false, reason: "number" }
  for (const match of withoutCompounds.matchAll(/\b[A-Za-z]+\b/g)) {
    const word = match[0].toLowerCase()
    if (QUANTITY_WORDS.has(word)) return { ok: false, reason: "number" }
    const value = has(WORD_NUMBERS, word) ? WORD_NUMBERS[word] : undefined
    if (value !== undefined && !allowedNumbers.has(value)) return { ok: false, reason: "number" }
  }

  const words = allowedWords(facts)
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const tokens = [...sentence.matchAll(/[A-Za-z]+/g)].map((m) => m[0])
    for (const [index, token] of tokens.entries()) {
      if (!/^[A-Z]/.test(token)) continue
      const lower = token.toLowerCase()
      if (words.has(lower) || has(WORD_NUMBERS, lower) || has(TENS, lower) || has(UNITS, lower)) continue
      if (index === 0
          ? SENTENCE_OPENERS.has(lower) || MORE_OPENERS.has(lower) || looksLikeOrdinaryOpener(lower)
          : token.length === 1) continue
      return { ok: false, reason: "name" }
    }
  }

  return { ok: true, text }
}
