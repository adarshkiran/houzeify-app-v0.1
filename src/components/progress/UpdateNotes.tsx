import type { ReactNode } from "react"
import { Card, Col, Flex, Row, Typography } from "antd"
import type { DailyProgress } from "../../domain/models"
import { addDays, formatDay, localToday } from "../../mock/dayStory"

const { Text } = Typography

/**
 * One Yesterday / Today / Tomorrow card: label left, calendar date right.
 * Only the card for the real current date is tinted, wherever it sits.
 */
export function NoteCard({
  label,
  date,
  children,
}: {
  label: string
  date: string
  children: ReactNode
}) {
  const isToday = date === localToday()
  return (
    <Card size="small" className={isToday ? "project-narrative-card project-narrative-today" : "project-narrative-card"}>
      <Flex vertical gap="small" className="h-full">
        <Flex align="baseline" justify="space-between" gap="small">
          <Text className="company-eyebrow">{label}</Text>
          <Text type="secondary" className="text-[13px]!">{formatDay(date)}</Text>
        </Flex>
        {children}
      </Flex>
    </Card>
  )
}

/**
 * The Yesterday / Today / Tomorrow notes of one update, dated from the day it
 * was written, so reading it later doesn't make "Today" ambiguous.
 */
export default function UpdateNotes({
  progress,
  showYesterday = true,
}: {
  progress: DailyProgress
  /** The homeowner preview leaves out a missing previous-day note. */
  showYesterday?: boolean
}) {
  const notes = [
    ...(showYesterday
      ? [{
          label: "Yesterday",
          date: addDays(progress.date, -1),
          text: progress.yesterdaySummary,
          empty: "No previous-day note was included.",
        }]
      : []),
    { label: "Today", date: progress.date, text: progress.todaySummary, empty: "No note." },
    { label: "Tomorrow", date: addDays(progress.date, 1), text: progress.tomorrowPlan, empty: "No plan was included." },
  ]
  const span = 24 / notes.length

  return (
    <Row gutter={[12, 12]}>
      {notes.map((note) => (
        <Col key={note.label} xs={24} md={span}>
          <NoteCard label={note.label} date={note.date}>
            {note.text?.trim() ? <Text>{note.text}</Text> : <Text type="secondary">{note.empty}</Text>}
          </NoteCard>
        </Col>
      ))}
    </Row>
  )
}
