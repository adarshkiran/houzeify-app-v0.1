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
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const FIXED_WORDS = ["AI", "Hozie", "Houzeify", ...MONTHS, ...WEEKDAYS].map((word) => word.toLowerCase())

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

  // ISO dates (2026-10-15) are legitimate; remove them before looking for phone-like digit runs.
  const withoutDates = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
  if (/(https?:\/\/|www\.|\S+@\S+\.\S+)/i.test(text) || /\+?\d(?:[\s().-]?\d){7,}/.test(withoutDates)) {
    return { ok: false, reason: "link" }
  }

  const allowedNumbers = new Set<number>()
  collectNumbers(facts, allowedNumbers)
  for (const match of text.matchAll(/\d+(?:\.\d+)?/g)) {
    if (!allowedNumbers.has(norm(Number(match[0])))) return { ok: false, reason: "number" }
  }
  for (const match of text.matchAll(/\b[A-Za-z]+\b/g)) {
    const value = WORD_NUMBERS[match[0].toLowerCase()]
    if (value !== undefined && !allowedNumbers.has(value)) return { ok: false, reason: "number" }
  }

  const words = allowedWords(facts)
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const tokens = [...sentence.matchAll(/[A-Za-z][A-Za-z'-]*/g)].map((m) => m[0])
    for (const token of tokens.slice(1)) {
      if (token.length > 1 && /^[A-Z]/.test(token) && !words.has(token.toLowerCase())) {
        return { ok: false, reason: "name" }
      }
    }
  }

  return { ok: true, text }
}
