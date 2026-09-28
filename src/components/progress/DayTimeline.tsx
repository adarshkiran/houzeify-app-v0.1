import { useMemo, useState, type ReactNode } from "react"
import { CalendarOutlined, LeftOutlined, RightOutlined, WarningOutlined } from "@ant-design/icons"
import { Button, Col, Flex, Popover, Row, Tag, Typography } from "antd"
import type { DailyProgress, ISODate, Task } from "../../domain/models"
import { addDays, datesWithUpdates, dayStory, formatDay, latestUpdateDate, localToday, type DayAudience, type DayNote } from "../../mock/dayStory"
import { NoteCard } from "./UpdateNotes"

const { Text } = Typography

const asDate = (date: ISODate) => new Date(`${date}T00:00:00Z`)
const fmt = (date: ISODate, options: Intl.DateTimeFormatOptions) =>
  asDate(date).toLocaleDateString("en-IN", { timeZone: "UTC", ...options })
const weekday = (date: ISODate) => fmt(date, { weekday: "short" })
const longLabel = formatDay

const STORY_TAG = {
  planned: "Planned",
  scheduled: "Scheduled tasks",
} as const

/** Month grid for jumping to any date (Monday first). */
function MonthPicker({
  selected,
  today,
  marked,
  onPick,
}: {
  selected: ISODate
  today: ISODate
  marked: Set<ISODate>
  onPick: (date: ISODate) => void
}) {
  const [month, setMonth] = useState(selected.slice(0, 7) + "-01")
  const first = asDate(month)
  const offset = (first.getUTCDay() + 6) % 7 // Monday = 0
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const cells = [
    ...Array.from({ length: offset }, () => undefined),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(month, i)),
  ]
  const shiftMonth = (by: number) => {
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + by, 1))
    setMonth(next.toISOString().slice(0, 10))
  }

  return (
    <div className="month-picker">
      <Flex align="center" justify="space-between" className="mb-2">
        <Button type="text" size="small" shape="circle" icon={<LeftOutlined />} aria-label="Previous month" onClick={() => shiftMonth(-1)} />
        <Text strong>{fmt(month, { month: "long", year: "numeric" })}</Text>
        <Button type="text" size="small" shape="circle" icon={<RightOutlined />} aria-label="Next month" onClick={() => shiftMonth(1)} />
      </Flex>
      <div className="month-picker-grid" role="grid" aria-label="Pick a date">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <span key={d} className="month-picker-head">{d}</span>
        ))}
        {cells.map((date, index) =>
          date ? (
            <button
              key={date}
              type="button"
              className={[
                "month-picker-day",
                date === selected && "is-selected",
                date === today && "is-today",
                marked.has(date) && "has-update",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={longLabel(date)}
              aria-pressed={date === selected}
              onClick={() => onPick(date)}
            >
              {Number(date.slice(8))}
            </button>
          ) : (
            <span key={`blank-${index}`} />
          ),
        )}
      </div>
      {selected !== today && (
        <Button type="link" size="small" className="mt-2 p-0!" onClick={() => onPick(today)}>
          Go to today
        </Button>
      )}
    </div>
  )
}

/**
 * Date strip (three days either side of the selected date, week arrows, month
 * picker) above Yesterday / Today / Tomorrow cards for the selected date.
 */
export default function DayTimeline({
  updates,
  audience,
  tasks,
  noteMeta,
}: {
  /** Updates this viewer may see. */
  updates: readonly DailyProgress[]
  audience: DayAudience
  /** Company only: open tasks fill days with no update. */
  tasks?: readonly Task[]
  /** Small line under a note, e.g. the work type and review status. */
  noteMeta?: (note: DayNote) => ReactNode
}) {
  const today = localToday()
  const [selected, setSelected] = useState(today)
  const [pickerOpen, setPickerOpen] = useState(false)
  const marked = useMemo(() => datesWithUpdates(updates), [updates])
  const onToday = selected === today
  // Only the update written that day can report that day's blocker.
  const blockerOn = (note: DayNote, date: ISODate) =>
    updates.find((u) => u.id === note.progressId && u.date === date)?.blockerSummary

  const pill = (offset: number) => {
    const date = addDays(selected, offset)
    return (
      <button
        key={offset}
        type="button"
        className={[
          "day-strip-day",
          Math.abs(offset) > 1 && "is-far",
          date === today && "is-today",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={`${longLabel(date)}${marked.has(date) ? ", has an update" : ""}`}
        onClick={() => setSelected(date)}
      >
        <span className="day-strip-weekday">{weekday(date)}</span>
        <span className="day-strip-number">{Number(date.slice(8))}</span>
        <span className={`day-strip-dot${marked.has(date) ? " is-on" : ""}`} aria-hidden />
      </button>
    )
  }

  const stories = [-1, 0, 1].map((offset) => dayStory(addDays(selected, offset), updates, { today, audience, tasks }))
  const allEmpty = stories.every((story) => story.kind === "empty")
  const latest = latestUpdateDate(updates)

  const columns = [
    { offset: -1, label: onToday ? "Yesterday" : "Day before" },
    { offset: 0, label: onToday ? "Today" : "Selected day" },
    { offset: 1, label: onToday ? "Tomorrow" : "Day after" },
  ]

  return (
    <Flex vertical gap="middle">
      <div className="day-strip">
        <Button type="text" shape="circle" icon={<LeftOutlined />} aria-label="Previous week" onClick={() => setSelected(addDays(selected, -7))} />
        <div className="day-strip-side">{[-3, -2, -1].map(pill)}</div>
        <Flex align="center" justify="center" gap={8} className="day-strip-center">
          <span className="day-strip-selected" aria-live="polite">{longLabel(selected)}</span>
          <Popover
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            trigger="click"
            placement="bottom"
            content={
              <MonthPicker
                key={selected}
                selected={selected}
                today={today}
                marked={marked}
                onPick={(date) => {
                  setSelected(date)
                  setPickerOpen(false)
                }}
              />
            }
          >
            <Button type="text" shape="circle" icon={<CalendarOutlined />} aria-label="Pick a date" className="text-[18px]!" />
          </Popover>
        </Flex>
        <div className="day-strip-side">{[1, 2, 3].map(pill)}</div>
        <Button type="text" shape="circle" icon={<RightOutlined />} aria-label="Next week" onClick={() => setSelected(addDays(selected, 7))} />
      </div>

      <Row gutter={[16, 16]}>
        {columns.map(({ offset, label }, index) => {
          const date = addDays(selected, offset)
          const story = stories[index]!
          return (
            <Col key={offset} xs={24} md={8}>
              <NoteCard label={label} date={date} emphasis={offset === 0}>
                {story.kind === "empty" ? (
                  <div className="note-empty">
                    <span className="note-empty-dash" aria-hidden>—</span>
                    <Text type="secondary" className="text-[12px]!">{story.message}</Text>
                  </div>
                ) : (
                  <Flex vertical gap="middle">
                    {story.kind !== "done" && <Tag className="m-0! self-start">{STORY_TAG[story.kind]}</Tag>}
                    {story.notes.map((note, index) => (
                      <Flex key={note.progressId ?? note.taskId ?? index} vertical gap={4}>
                        <Text>{note.text}</Text>
                        {noteMeta?.(note)}
                        {story.kind === "done" && blockerOn(note, date) && (
                          <Text type="warning" className="text-[13px]!">
                            <WarningOutlined /> {blockerOn(note, date)}
                          </Text>
                        )}
                      </Flex>
                    ))}
                  </Flex>
                )}
              </NoteCard>
            </Col>
          )
        })}
      </Row>

      {/* Three dashes in a row can read like a failed load, so say it and offer the way out. */}
      {allEmpty && (
        <Flex align="center" justify="center" gap={6} wrap className="text-center">
          <Text type="secondary">{latest ? "No updates around this date." : "No updates yet."}</Text>
          {latest && (
            <Button type="link" size="small" className="p-0!" onClick={() => setSelected(latest)}>
              Latest update: {formatDay(latest)} →
            </Button>
          )}
        </Flex>
      )}
    </Flex>
  )
}
