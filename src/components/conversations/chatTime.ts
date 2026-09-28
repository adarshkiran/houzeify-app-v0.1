/** Time labels for conversations. `now` is injectable for tests. */

const DAY = 24 * 60 * 60 * 1000
const startOfDay = (time: number) => {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "Mon", "25 Sept". */
export function relativeTime(iso: string, now = Date.now()): string {
  const time = Date.parse(iso)
  const diff = now - time
  if (diff < 60_000) return "Just now"
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} min ago`
  const days = Math.round((startOfDay(now) - startOfDay(time)) / DAY)
  if (days === 0) return `${Math.floor(diff / (60 * 60_000))} h ago`
  if (days === 1) return "Yesterday"
  if (days < 7) return new Date(time).toLocaleDateString("en-IN", { weekday: "short" })
  return new Date(time).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

/** Divider label between days in a conversation. */
export function dayLabel(iso: string, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(Date.parse(iso))) / DAY)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
}

export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })

export const sameDay = (a: string, b: string) => startOfDay(Date.parse(a)) === startOfDay(Date.parse(b))
