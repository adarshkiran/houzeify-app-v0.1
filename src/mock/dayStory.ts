import type { DailyProgress, EntityId, ISODate, Task } from "../domain/models"

/**
 * What the Yesterday / Today / Tomorrow cards say for one calendar date.
 * Pure: the caller passes the updates the viewer may see (company: every
 * live version; homeowner: published only) and, for company viewers, tasks.
 */

export type DayNote = { text: string; progressId?: EntityId; taskId?: EntityId }

export type DayStory =
  /** Work reported for this date. */
  | { kind: "done"; notes: DayNote[] }
  /** The plan written the day before ("Tomorrow" in that update). */
  | { kind: "planned"; notes: DayNote[] }
  /** Open tasks scheduled on this date (company only). */
  | { kind: "scheduled"; notes: DayNote[] }
  | { kind: "empty"; message: string }

export type DayAudience = "company" | "homeowner"

const DONE_TASK: ReadonlySet<Task["status"]> = new Set(["completed", "approved", "cancelled"])

/** `YYYY-MM-DD` plus `days` (calendar arithmetic in UTC, so no DST drift). */
export function addDays(date: ISODate, days: number): ISODate {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10)
}

/** Today's date on this device as `YYYY-MM-DD`. */
export function localToday(now = new Date()): ISODate {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** "Fri 25 Sept" for a `YYYY-MM-DD` date (read as a calendar day, not a time). */
export function formatDay(date: ISODate): string {
  const day = new Date(`${date}T00:00:00Z`)
  const part = (options: Intl.DateTimeFormatOptions) => day.toLocaleDateString("en-IN", { timeZone: "UTC", ...options })
  return `${part({ weekday: "short" })} ${part({ day: "numeric", month: "short" })}`
}

/** Dates that have at least one update, for the dots on the date strip. */
export function datesWithUpdates(updates: readonly DailyProgress[]): Set<ISODate> {
  return new Set(updates.map((update) => update.date))
}

export function dayStory(
  date: ISODate,
  updates: readonly DailyProgress[],
  options: { today: ISODate; audience: DayAudience; tasks?: readonly Task[] },
): DayStory {
  const on = (day: ISODate) => updates.filter((update) => update.date === day)

  const reported = on(date).filter((update) => update.todaySummary.trim())
  if (reported.length) {
    return { kind: "done", notes: reported.map((u) => ({ text: u.todaySummary, progressId: u.id, taskId: u.taskId })) }
  }

  const plannedDayBefore = on(addDays(date, -1)).filter((update) => update.tomorrowPlan.trim())
  if (plannedDayBefore.length) {
    return {
      kind: "planned",
      notes: plannedDayBefore.map((u) => ({ text: u.tomorrowPlan, progressId: u.id, taskId: u.taskId })),
    }
  }

  // The next day's update may say what happened on this one ("Yesterday").
  const recalledDayAfter = on(addDays(date, 1)).filter((update) => update.yesterdaySummary?.trim())
  if (recalledDayAfter.length) {
    return {
      kind: "done",
      notes: recalledDayAfter.map((u) => ({ text: u.yesterdaySummary!, progressId: u.id, taskId: u.taskId })),
    }
  }

  const scheduled = (options.tasks ?? []).filter((task) => {
    if (DONE_TASK.has(task.status) || !task.dueDate) return false
    const start = task.plannedStart ?? task.dueDate
    return start <= date && date <= task.dueDate
  })
  if (scheduled.length) {
    return { kind: "scheduled", notes: scheduled.map((task) => ({ text: task.title, taskId: task.id })) }
  }

  const future = date > options.today
  if (options.audience === "homeowner") {
    return { kind: "empty", message: future ? "Nothing planned yet for this day." : "No update was shared for this day." }
  }
  return { kind: "empty", message: future ? "No task was assigned for this day." : "No update was submitted for this day." }
}
