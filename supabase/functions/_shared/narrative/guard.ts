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
  "doubled", "doubling", "tripled", "tripling", "trebled", "trebling", "treble", "quadruple", "quadrupled",
  "quadrupling", "halved", "halving", "halves", "dozens", "millions", "billions",
  "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth",
  "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth",
])
const FOLD_WORD = /^(?:two|three|four|five|six|seven|eight|nine|ten|hundred|thousand)fold$/
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
    "approval removal arrival proposal renewal general overall total final formal typical normal local central additional potential structural initial electrical specific mechanical critical physical partial annual manual natural optional minimal optimal original personal seasonal several usual visual " +
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
  "ful", "less", "ial", "ical", "ional", "ural", "ernal", "ual", "ic", "ize", "ise", "ure", "ship", "hood",
]
// Person names (six or more letters) that end in one of the suffixes above and would
// otherwise pass as ordinary words. Every entry must match a suffix; a test enforces it.
export const NAME_COLLISIONS = new Set(
  (
    "mohammed muhammed mohamed mehmed ahamed ahammed naveed rasheed waheed majeed hameed shaheed fareed zaheed sayeed javeed tauheed " +
    "jamshed khurshed waleed khaled abdulhameed abdulmajeed abdulrasheed abdulwaheed " +
    "sterling fleming harding browning kipling spalding irving channing golding stirling darling redding pickering " +
    "beverly kimberly " +
    "charity trinity felicity chastity serenity verity " +
    "lawrence clarence florence laurence terrance terence constance prudence patience clemence providence " +
    "denise louise cerise clement " +
    "alfred mildred winifred manfred wilfred " +
    "frederic dominic cedric alaric roderic"
  ).split(" "),
)
export function looksLikeOrdinaryOpener(lower: string, collisions: ReadonlySet<string> = NAME_COLLISIONS): boolean {
  return lower.length >= 6 && !collisions.has(lower) && OPENER_SUFFIXES.some((suffix) => lower.endsWith(suffix))
}
// Abbreviations after which the next word is NOT a new sentence ("e.g. Agarwal", "Mr. Rao", "A. Rao").
const ABBREVIATION_END = /(?:^|[^A-Za-z])(?:e\.g|i\.e|etc|vs|approx|incl|no|cf|viz|ca|mr|mrs|ms|dr|prof|sr|jr|[a-z])\.$/i
const REPORTING_VERBS = new Set(
  "reported said says noted stated confirmed flagged raised mentioned informed told asked wrote added claimed complained replied explained observed warned".split(" "),
)
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
    if (QUANTITY_WORDS.has(word) || FOLD_WORD.test(word)) return { ok: false, reason: "number" }
    const value = has(WORD_NUMBERS, word) ? WORD_NUMBERS[word] : undefined
    if (value !== undefined && !allowedNumbers.has(value)) return { ok: false, reason: "number" }
  }

  const words = allowedWords(facts)
  let previous = ""
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const afterAbbreviation = ABBREVIATION_END.test(previous)
    previous = sentence
    const tokens = [...sentence.matchAll(/[A-Za-z]+/g)]
    for (const [index, match] of tokens.entries()) {
      const token = match[0]
      if (!/^[A-Z]/.test(token)) continue
      const lower = token.toLowerCase()
      if (words.has(lower) || has(WORD_NUMBERS, lower) || has(TENS, lower) || has(UNITS, lower)) continue
      if (index === 0 && !afterAbbreviation) {
        if (SENTENCE_OPENERS.has(lower) || MORE_OPENERS.has(lower)) continue
        if (looksLikeOrdinaryOpener(lower)) {
          // Accepted by shape alone: reject the shapes of a person doing something.
          const rest = sentence.slice(match.index! + token.length)
          const next = tokens[1]?.[0].toLowerCase() ?? ""
          if (!REPORTING_VERBS.has(next) && !/^['\u2019]s\b/.test(rest) && !/^-(?:led|run|based)\b/i.test(rest)) continue
        }
        return { ok: false, reason: "name" }
      }
      if (token.length === 1) continue
      return { ok: false, reason: "name" }
    }
  }

  return { ok: true, text }
}
