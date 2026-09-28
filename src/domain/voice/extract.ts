import {
  cleanTitle, findDate, findPeopleCount, findPerson, findPriority, findQuantity,
  findSeverity, findUnit, findWorkType, splitProgress,
} from "./rules"
import type {
  FieldState, IssueDraftValues, ProgressDraftValues, TaskDraftValues, VoiceContext, VoiceDraft, VoiceExtractor,
} from "./types"

const heard: FieldState = { state: "heard" }
const missing: FieldState = { state: "missing" }
const guessed = (reason: string): FieldState => ({ state: "guessed", reason })

function task(text: string, ctx: VoiceContext): VoiceDraft<TaskDraftValues> {
  const transcript = text.trim()
  const values: TaskDraftValues = {}
  const fields: VoiceDraft<TaskDraftValues>["fields"] = {}
  if (!transcript) return { transcript, values, fields }
  const remove: string[] = []

  const person = findPerson(transcript, ctx.people)
  if (person?.kind === "one") {
    values.assigneeId = person.person.id
    fields.assigneeId = heard
    remove.push(person.matched)
  } else if (person?.kind === "many") {
    fields.assigneeId = { state: "choose", options: person.options.map((p) => ({ value: p.id, label: p.name })) }
    remove.push(person.matched)
  } else if (person?.kind === "unknown") {
    fields.assigneeId = { state: "missing", note: `Nobody named '${person.name}' on this project` }
    remove.push(person.matched)
  }

  const date = findDate(transcript, ctx.today)
  if (date) {
    const key = date.start ? "plannedStart" : "dueDate"
    values[key] = date.date
    fields[key] = date.guessed ? guessed(date.guessed) : heard
    remove.push(date.matched)
  }

  const unit = findUnit(transcript, ctx.units)
  if (unit) {
    values.projectUnitId = unit.unit.id
    fields.projectUnitId = unit.how === "heard" ? heard : guessed("The project's only location")
  } else fields.projectUnitId = missing

  const workType = findWorkType(transcript, ctx.workTypes)
  if (workType) {
    values.workTypeId = workType.workType.id
    fields.workTypeId = workType.how === "name" ? heard : guessed(`From "${workType.keyword}"`)
  } else fields.workTypeId = missing

  const priority = findPriority(transcript)
  values.priority = priority.priority
  fields.priority = priority.matched ? heard : guessed("No priority said — medium")
  if (priority.matched) remove.push(priority.matched)

  const quantity = findQuantity(transcript)
  if (quantity) {
    values.plannedValue = quantity.value
    values.unit = quantity.unit
    fields.plannedValue = quantity.converted ? guessed(quantity.converted) : heard
    fields.unit = quantity.converted ? guessed(quantity.converted) : heard
    remove.push(quantity.matched)
  } else if (workType) {
    values.unit = workType.workType.defaultUnit
    fields.unit = guessed("The work type's usual unit")
  }

  remove.push("assign to", "assign it to", "ask", "tell", "start", "starting")
  values.title = cleanTitle(transcript, remove)
  fields.title = values.title ? heard : missing
  return { transcript, values, fields }
}

function issue(text: string, ctx: VoiceContext): VoiceDraft<IssueDraftValues> {
  const transcript = text.trim()
  const values: IssueDraftValues = {}
  const fields: VoiceDraft<IssueDraftValues>["fields"] = {}
  if (!transcript) return { transcript, values, fields }

  const firstSentence = transcript.split(/[.!?]/)[0] ?? transcript
  values.title = cleanTitle(firstSentence, [])
  fields.title = values.title ? heard : missing
  values.description = transcript
  fields.description = heard

  const severity = findSeverity(transcript)
  values.severity = severity.severity
  fields.severity = severity.matched ? heard : guessed("No severity word — medium")

  if (ctx.currentTaskId) {
    values.taskId = ctx.currentTaskId
    fields.taskId = heard
  } else {
    const words = (s: string) => s.toLowerCase().split(/\W+/).filter((w) => w.length >= 4)
    const said = new Set(words(transcript))
    const match = ctx.tasks.find((t) => words(t.title).filter((w) => said.has(w)).length >= 2)
    if (match) {
      values.taskId = match.id
      fields.taskId = guessed(`Sounds like "${match.title}"`)
    }
  }

  if (!values.taskId) {
    const unit = findUnit(transcript, ctx.units)
    if (unit) {
      values.projectUnitId = unit.unit.id
      fields.projectUnitId = unit.how === "heard" ? heard : guessed("The project's only location")
    }
  }
  return { transcript, values, fields }
}

function progress(text: string, _ctx: VoiceContext): VoiceDraft<ProgressDraftValues> {
  const transcript = text.trim()
  const values: ProgressDraftValues = {}
  const fields: VoiceDraft<ProgressDraftValues>["fields"] = {}
  if (!transcript) return { transcript, values, fields }

  const parts = splitProgress(transcript)
  const join = (list: string[]) => list.join(". ")
  if (parts.today.length) {
    values.todaySummary = join(parts.today)
    fields.todaySummary = heard
  } else fields.todaySummary = missing
  if (parts.tomorrow.length) {
    values.tomorrowPlan = join(parts.tomorrow)
    fields.tomorrowPlan = heard
  } else fields.tomorrowPlan = missing
  if (parts.blocker.length) {
    values.blockerSummary = join(parts.blocker)
    fields.blockerSummary = heard
  }

  const people = findPeopleCount(transcript)
  if (people) {
    values.workersPresent = people.count
    fields.workersPresent = heard
  }
  const quantity = findQuantity(join(parts.today) || transcript)
  if (quantity) {
    values.completedQuantity = quantity.value
    values.unit = quantity.unit
    fields.completedQuantity = quantity.converted ? guessed(quantity.converted) : heard
  }
  return { transcript, values, fields }
}

export const rulesExtractor: VoiceExtractor = { task, issue, progress }

/** What the screens use. Swap for an AI extractor later without touching them. */
export const voiceExtractor: VoiceExtractor = rulesExtractor
