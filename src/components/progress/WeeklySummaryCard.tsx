import { useMemo, useState } from "react"
import { LeftOutlined, RightOutlined } from "@ant-design/icons"
import { Button, Card, Flex, Tag, Typography } from "antd"
import type { ConstructionDataState, EntityId } from "../../domain/models"
import { addDays, formatDay, localToday } from "../../mock/dayStory"
import { SUMMARY_WINDOW_DAYS, summarizeWeek, type SummaryAudience } from "../../mock/weeklySummary"

const { Text, Title } = Typography

/**
 * The Site AI weekly summary for one project: the seven days ending on a chosen
 * date, built only from what `state` already lets this viewer read. For the
 * homeowner, `state` is still the full data; `summarizeWeek` narrows it to
 * published updates and shared issues itself.
 */
export default function WeeklySummaryCard({
  state,
  projectId,
  audience,
  title,
}: {
  state: ConstructionDataState
  projectId: EntityId
  audience: SummaryAudience
  title?: string
}) {
  const today = localToday()
  const [weekEnd, setWeekEnd] = useState(today)

  const summary = useMemo(
    () => summarizeWeek(state, projectId, weekEnd, { audience, today, generatedAt: new Date().toISOString() }),
    [state, projectId, weekEnd, audience, today],
  )
  if (!summary) return null

  const atCurrentWeek = weekEnd >= today
  const shift = (days: number) => {
    const next = addDays(weekEnd, days)
    setWeekEnd(next > today ? today : next)
  }

  return (
    <Card
      title={
        <Title level={5} className="company-heading! m-0!">
          {title ?? "Weekly summary"}
        </Title>
      }
      extra={
        <Flex align="center" gap="small">
          <Button
            size="small"
            icon={<LeftOutlined />}
            aria-label="Previous summary week"
            onClick={() => shift(-SUMMARY_WINDOW_DAYS)}
          />
          <Text type="secondary" className="text-[13px]!">
            {formatDay(summary.from)} – {formatDay(summary.to)}
          </Text>
          <Button
            size="small"
            icon={<RightOutlined />}
            aria-label="Next summary week"
            disabled={atCurrentWeek}
            onClick={() => shift(SUMMARY_WINDOW_DAYS)}
          />
        </Flex>
      }
    >
      <Flex vertical gap="middle">
        <Flex gap={8} wrap>
          {summary.days.map((day) => (
            <Flex
              key={day.date}
              vertical
              align="center"
              gap={2}
              style={{ minWidth: 56, padding: "6px 8px", borderRadius: 8, border: "1px solid #E3DDD7" }}
            >
              <Text type="secondary" className="text-[11px]!">
                {formatDay(day.date).split(" ")[0]}
              </Text>
              <Text strong>{day.date.slice(8)}</Text>
              <span
                aria-label={day.notes.length ? "Update reported" : "No update"}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: day.notes.length ? "#722ED1" : "#E3DDD7",
                }}
              />
            </Flex>
          ))}
        </Flex>

        <Flex vertical gap={4}>
          {summary.lines.map((line) => (
            <Text key={line} className={line.startsWith("•") ? "pl-2" : undefined}>
              {line}
            </Text>
          ))}
        </Flex>

        <Flex gap="small" wrap align="center">
          <Tag>Automatic summary</Tag>
          <Tag>Confidence {summary.confidence}</Tag>
        </Flex>

        {summary.assumptions.length ? (
          <Flex vertical gap={2}>
            {summary.assumptions.map((assumption) => (
              <Text key={assumption} type="secondary" className="text-[12px]!">
                {assumption}
              </Text>
            ))}
          </Flex>
        ) : null}
      </Flex>
    </Card>
  )
}
