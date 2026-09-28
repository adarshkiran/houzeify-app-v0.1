import type { ISODate, Issue, ProjectUnit, QuantityUnit, Task, WorkType } from "../models"
import type { VoicePerson } from "./types"

/**
 * Pure rules that pull structured values out of an English instruction
 * (speech is recognised as en-IN). Each helper returns what it matched so
 * the title can be cleaned and the UI can mark fields Heard / Guessed.
 */

const addDays = (date: ISODate, days: number): ISODate => {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10)
}
const weekdayOf = (date: ISODate) => new Date(`${date}T00:00:00Z`).getUTCDay()
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const START_WORDS = /\b(start|starting|begin|from)\b[^.,]*$/i

export function findDate(text: string, today: ISODate) {
  const lower = text.toLowerCase()
  const startsBefore = (index: number) => START_WORDS.test(lower.slice(0, index))
  const hit = (date: ISODate, match: RegExpMatchArray, guessed?: string) => ({
    date,
    start: startsBefore(match.index ?? 0),
    guessed,
    matched: match[0],
  })

  let m = lower.match(/\bday after tomorrow\b/)
  if (m) return hit(addDays(today, 2), m)
  m = lower.match(/\btomorrow\b/)
  if (m) return hit(addDays(today, 1), m)
  m = lower.match(/\btoday\b/)
  if (m) return hit(today, m)
  m = lower.match(/\bnext week\b/)
  if (m) {
    const toMonday = ((8 - weekdayOf(today)) % 7) || 7
    return hit(addDays(today, toMonday), m, "Read 'next week' as next Monday")
  }
  m = lower.match(new RegExp(`\\b(?:on |by |this |next )?(${WEEKDAYS.join("|")})\\b`))
  if (m) {
    const target = WEEKDAYS.indexOf(m[1]!)
    const ahead = (target - weekdayOf(today) + 7) % 7
    return ahead === 0
      ? hit(addDays(today, 7), m, `Today is ${m[1]}, so read as next week`)
      : hit(addDays(today, ahead), m)
  }
  m = lower.match(/\b(?:by |on )?(?:the )?(\d{1,2})(?:st|nd|rd|th)\b/)
  if (m) {
    const day = Number(m[1])
    const [y, mo, d] = today.split("-").map(Number)
    const sameMonth = day >= d!
    const date = new Date(Date.UTC(y!, mo! - 1 + (sameMonth ? 0 : 1), day)).toISOString().slice(0, 10)
    return hit(date, m, sameMonth ? undefined : "That day has passed this month, so next month")
  }
  return undefined
}

const UNITS: Array<[RegExp, QuantityUnit, number?, string?]> = [
  [/cubic met(?:er|re)s?|cu\.? ?m\b|\bm3\b|\bcum\b/, "m3"],
  [/sq(?:uare)?\.? ?f(?:ee|oo)?t\b|\bsqft\b/, "m2", 0.092903, "square feet"],
  [/sq(?:uare)?\.? ?met(?:er|re)s?|\bsqm\b|\bm2\b/, "m2"],
  [/running met(?:er|re)s?|\bmet(?:er|re)s?\b|\brm\b/, "m"],
  [/\bkgs?\b|\bkilo(?:gram)?s?\b/, "kg"],
  [/\btonnes?\b|\btons?\b/, "tonne"],
  [/\bhours?\b|\bhrs?\b/, "hour"],
  [/\bdays?\b/, "day"],
  [/\bnos\b|\bnumbers?\b|\bpieces?\b|\bpcs\b|\bbags?\b|\bblocks?\b|\bbricks?\b/, "nos"],
]

export function findQuantity(text: string) {
  const lower = text.toLowerCase()
  for (const match of lower.matchAll(/(\d+(?:\.\d+)?)\s*/g)) {
    const rest = lower.slice((match.index ?? 0) + match[0].length)
    for (const [pattern, unit, factor, label] of UNITS) {
      const u = rest.match(new RegExp(`^(?:${pattern.source})`))
      if (!u) continue
      const raw = Number(match[1])
      const value = factor ? Math.round(raw * factor * 100) / 100 : raw
      return {
        value,
        unit,
        matched: `${match[0]}${u[0]}`.trim(),
        converted: factor ? `Converted ${raw} ${label} to ${value} m²` : undefined,
      }
    }
  }
  return undefined
}

export function findPerson(text: string, people: VoicePerson[]) {
  const lower = text.toLowerCase()
  const full = people.filter((p) => new RegExp(`\\b${escape(p.name.toLowerCase())}\\b`).test(lower))
  if (full.length === 1) return { kind: "one" as const, person: full[0]!, matched: full[0]!.name }
  const byFirst = new Map<string, VoicePerson[]>()
  for (const p of people) {
    const first = p.name.split(/\s+/)[0]!.toLowerCase()
    byFirst.set(first, [...(byFirst.get(first) ?? []), p])
  }
  for (const [first, group] of byFirst) {
    const m = lower.match(new RegExp(`\\b${escape(first)}\\b`))
    if (!m) continue
    const matched = text.slice(m.index, (m.index ?? 0) + first.length)
    return group.length === 1
      ? { kind: "one" as const, person: group[0]!, matched }
      : { kind: "many" as const, options: group, matched }
  }
  const unknown = text.match(/\b(?:assign(?:ed)? (?:it )?to|ask|tell)\s+([A-Z][a-z]+)/)
  if (unknown) return { kind: "unknown" as const, name: unknown[1]!, matched: unknown[1]! }
  return undefined
}

export function findUnit(text: string, units: ProjectUnit[]) {
  const lower = text.toLowerCase()
  const byLength = [...units].sort((a, b) => b.name.length - a.name.length)
  for (const unit of byLength) {
    for (const label of [unit.name, unit.code]) {
      const m = lower.match(new RegExp(`\\b${escape(label.toLowerCase())}\\b`))
      if (m) return { unit, how: "heard" as const, matched: text.slice(m.index, (m.index ?? 0) + label.length) }
    }
  }
  if (units.length === 1) return { unit: units[0]!, how: "only-one" as const }
  return undefined
}

const ELEMENTS = ["footing", "column", "beam", "slab"] as const
const ELEMENT_ACTIONS: Array<[RegExp, (element: string) => string]> = [
  [/\b(pour|pouring|concret\w*|cast\w*)\b/, (e) => (e === "footing" ? "Footing Concrete" : `${cap(e)} Casting`)],
  [/\b(shutter\w*|formwork)\b/, (e) => `${cap(e)} Shuttering`],
  [/\b(rebar|reinforc\w*|steel)\b/, (e) => `${cap(e)} Reinforcement`],
]
const KEYWORDS: Array<[RegExp, string[]]> = [
  [/\bcur(e|ing)\b/, ["Curing"]],
  [/\bbackfill\w*\b/, ["Backfilling"]],
  [/\bbrick\w*\b/, ["Brick Masonry"]],
  [/\b(aac|block ?work)\b/, ["AAC Block Work"]],
  [/\bplaster\w*\b/, ["Internal Plaster", "External Plaster"]],
  [/\bexcavat\w*\b/, ["Foundation Excavation", "Site Excavation"]],
  [/\bwaterproof\w*\b/, ["Waterproofing"]],
  [/\btil(e|es|ing)\b/, ["Floor Tiling", "Tiling"]],
  [/\bpaint\w*\b/, ["Painting", "Interior Painting"]],
  [/\b(wiring|electrical)\b/, ["Electrical Wiring", "Wiring"]],
  [/\bplumb\w*\b/, ["Plumbing"]],
  [/\bde-?shutter\w*\b/, ["De-shuttering"]],
]
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

export function findWorkType(text: string, workTypes: WorkType[]) {
  const lower = text.toLowerCase()
  const byName = (name: string) => workTypes.find((w) => w.name.toLowerCase() === name.toLowerCase())
  const named = [...workTypes]
    .sort((a, b) => b.name.length - a.name.length)
    .find((w) => new RegExp(`\\b${escape(w.name.toLowerCase())}\\b`).test(lower))
  if (named) return { workType: named, how: "name" as const, keyword: named.name }
  for (const element of ELEMENTS) {
    if (!new RegExp(`\\b${element}s?\\b`).test(lower)) continue
    for (const [action, nameFor] of ELEMENT_ACTIONS) {
      const a = lower.match(action)
      const found = a && byName(nameFor(element))
      if (found) return { workType: found, how: "keyword" as const, keyword: `${a![0]} … ${element}` }
    }
  }
  for (const [pattern, names] of KEYWORDS) {
    const k = lower.match(pattern)
    if (!k) continue
    const found = names.map(byName).find(Boolean)
    if (found) return { workType: found, how: "keyword" as const, keyword: k[0] }
  }
  return undefined
}

export function findPriority(text: string): { priority: Task["priority"]; matched?: string } {
  const lower = text.toLowerCase()
  const m = (re: RegExp) => lower.match(re)?.[0]
  const critical = m(/\bcritical\b/)
  if (critical) return { priority: "critical", matched: critical }
  const high = m(/\b(urgent(?:ly)?|asap|immediately|high priority)\b/)
  if (high) return { priority: "high", matched: high }
  const low = m(/\b(low priority|when free|no rush)\b/)
  if (low) return { priority: "low", matched: low }
  return { priority: "medium" }
}

export function findSeverity(text: string): { severity: Issue["severity"]; matched?: string } {
  const lower = text.toLowerCase()
  const m = (re: RegExp) => lower.match(re)?.[0]
  const critical = m(/\b(unsafe|danger\w*|collaps\w*|injur\w*)\b/)
  if (critical) return { severity: "critical", matched: critical }
  const high = m(/\b(leak\w*|crack\w*|damaged|broken|short|stopped)\b/)
  if (high) return { severity: "high", matched: high }
  const medium = m(/\b(delay\w*|late|missing)\b/)
  if (medium) return { severity: "medium", matched: medium }
  return { severity: "medium" }
}

export function findPeopleCount(text: string) {
  const m =
    text.match(/\b(\d+)\s+(?:of us|workers?|people|men|labou?rers|members)\b/i) ??
    text.match(/\bwe were\s+(\d+)\b/i)
  return m ? { count: Number(m[1]), matched: m[0] } : undefined
}

const TOMORROW = /^(tomorrow|next|we will|will)\b/i
const BLOCKER = /^(problem|issue|blocked|waiting for|stuck|no )\b/i

export function splitProgress(text: string) {
  const clauses = text
    .split(/[.;!?]+|,\s*(?=(?:tomorrow|next|problem|issue|blocked|waiting for|stuck)\b)/i)
    .map((c) => c.trim())
    .filter(Boolean)
  const out = { today: [] as string[], tomorrow: [] as string[], blocker: [] as string[] }
  for (const clause of clauses) {
    if (TOMORROW.test(clause)) out.tomorrow.push(clause)
    else if (BLOCKER.test(clause)) out.blocker.push(clause)
    else out.today.push(clause)
  }
  return out
}

const FILLER = /^(?:(?:ok(?:ay)?|so|hey|please|pls|can you|could you|we need to|need to|i want you to)[\s,]+)+/i

export function cleanTitle(text: string, remove: string[]) {
  let title = text
  for (const part of remove.filter(Boolean)) {
    title = title.replace(new RegExp(`\\b${escape(part)}\\b`, "i"), " ")
  }
  title = title
    .replace(/\b(?:by|on|before|for|at)\s*(?=[,.]|$)/gi, " ")
    .replace(/[,.;!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(FILLER, "")
    .trim()
  if (!title) return ""
  return (title[0]!.toUpperCase() + title.slice(1)).slice(0, 120)
}
