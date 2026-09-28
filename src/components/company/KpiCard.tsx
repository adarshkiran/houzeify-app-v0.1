import type { ReactNode } from "react"
import { Card, Flex, Statistic, Typography } from "antd"

const { Text } = Typography

export type KpiTone = "violet" | "amber" | "rose" | "green"

/**
 * Soft KPI card: one colour per card, washing in from the bottom-right corner
 * (styles: .company-kpi-* in index.css). Used on the dashboard and project overview.
 */
export default function KpiCard({
  label,
  value,
  description,
  accent,
  icon,
  tone,
}: {
  label: string
  value: number
  description: string
  /** Short lead-in shown in the card's colour, e.g. "1" before "high severity". */
  accent?: string
  icon: ReactNode
  tone: KpiTone
}) {
  return (
    <Card className={`company-kpi-card company-kpi-${tone} h-full`} variant="outlined">
      <Flex vertical justify="space-between" gap="large" className="company-kpi-inner">
        <Flex align="flex-start" justify="space-between" gap="small">
          <Text className="company-kpi-label">{label}</Text>
          <span className="company-kpi-icon">{icon}</span>
        </Flex>
        <Flex vertical gap={4}>
          <Statistic value={value} classNames={{ content: "company-kpi-value" }} />
          <Text type="secondary">
            {accent && <span className="company-kpi-accent">{accent} </span>}
            {description}
          </Text>
        </Flex>
      </Flex>
    </Card>
  )
}
