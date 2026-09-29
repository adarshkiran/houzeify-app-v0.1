import { Card, Flex, Tag, Typography } from "antd"
import type { Estimate } from "../../domain/models"

const { Text, Title } = Typography

export function formatRupees(value: number): string {
  return `₹${(value / 100000).toFixed(1)}L`
}

/**
 * The estimate's headline total range, per-sq-ft range and construction-level
 * badge — the exact same figures on both the Dashboard and Cost Breakdown
 * screens, computed once here so the two can never disagree.
 */
export default function EstimateTotalSummary({ estimate }: { estimate: Estimate }) {
  const perSqftLow = Math.round(estimate.totalLow / estimate.builtUpAreaSqft)
  const perSqftHigh = Math.round(estimate.totalHigh / estimate.builtUpAreaSqft)

  return (
    <Card style={{ background: "linear-gradient(135deg, rgba(243,234,255,0.3) 0%, #ffffff 50%)" }}>
      <Flex justify="space-between" align="flex-start" gap={16} wrap>
        <Flex vertical gap={4}>
          <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">AI Estimate</Text>
          <Title level={2} className="m-0! text-[#722ED1]!">
            {formatRupees(estimate.totalLow)} — {formatRupees(estimate.totalHigh)}
          </Title>
          <Text type="secondary">Estimated construction cost</Text>
          <Title level={4} className="m-0!">
            ₹{perSqftLow.toLocaleString("en-IN")} — ₹{perSqftHigh.toLocaleString("en-IN")} / sq ft
          </Title>
        </Flex>
        <Tag color="purple" className="capitalize">{estimate.constructionLevel} finish</Tag>
      </Flex>
      <Text type="secondary" className="text-[12px]! block mt-3">
        Based on current project details and regional construction assumptions for {estimate.location}. Final cost
        depends on design, materials, and contractor rates.
      </Text>
    </Card>
  )
}
