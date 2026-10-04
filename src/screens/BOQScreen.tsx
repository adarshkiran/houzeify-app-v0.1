import { Button, Card, Empty, Flex, Table, Typography } from "antd"
import AmbientBg from "../components/homeowner/AmbientBg"
import HIcon from "../components/HIcon"
import HomeownerLayout from "../components/homeowner/HomeownerLayout"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getEstimate } from "../mock/selectors"
import type { EstimateLine, EstimateLineCategory } from "../domain/models"

const { Text, Title } = Typography

const CATEGORY_LABEL: Record<EstimateLineCategory, string> = {
  materials: "Materials",
  labour: "Labour",
  finishing: "Finishing",
  contingency: "Contingency",
}

const CATEGORY_ORDER: EstimateLineCategory[] = ["materials", "labour", "finishing", "contingency"]

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`
}

const columns = [
  { title: "Item", dataIndex: "item", key: "item" },
  {
    title: "Quantity",
    dataIndex: "quantity",
    key: "quantity",
    align: "right" as const,
    render: (value: number, row: EstimateLine) => `${value.toLocaleString("en-IN")} ${row.unit}`,
  },
  { title: "Rate", dataIndex: "rate", key: "rate", align: "right" as const, render: formatCurrency },
  { title: "Amount", dataIndex: "amount", key: "amount", align: "right" as const, render: formatCurrency },
  { title: "Source", dataIndex: "source", key: "source" },
]

export default function BOQScreen({
  onNavigate,
  estimateId,
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  estimateId?: string
}) {
  const { state } = useConstructionData()
  const estimate = estimateId ? getEstimate(state, estimateId) : undefined

  if (!estimate) {
    return (
      <HomeownerLayout active="estimates" onNavigate={onNavigate}>
        <Flex align="center" justify="center" className="min-h-full">
          <Empty description="We couldn't find that estimate.">
            <Button type="primary" onClick={() => onNavigate("estimate-dashboard")}>Back to estimate</Button>
          </Empty>
        </Flex>
      </HomeownerLayout>
    )
  }

  return (
    <HomeownerLayout active="estimates" onNavigate={onNavigate}>
      <div className="relative min-h-full" style={{ backgroundColor: "#FBF9F7" }}>
        <AmbientBg variant="boq" />
        <Flex vertical gap={24} className="relative z-10 max-w-[1080px] mx-auto! px-4! sm:px-6! lg:px-8! py-6! sm:py-8!">
          <Flex vertical gap={4} style={{ animation: "welcomeFadeUp 0.4s ease-out 0.05s both" }}>
            <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]! block">Bill of Quantities</Text>
            <Title level={2} className="m-0!">What&apos;s in your estimate.</Title>
            <Text type="secondary">
              {estimate.projectName} · {estimate.location} · {estimate.builtUpAreaSqft.toLocaleString("en-IN")} sq ft
            </Text>
          </Flex>

          <Card
            className="bg-[#F3EAFF]! border-0!"
            style={{ animation: "welcomeFadeUp 0.4s ease-out 0.08s both" }}
          >
            <Flex vertical gap={12}>
              <Flex align="center" gap={10}>
                <div className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center shrink-0">
                  <HIcon size={20} />
                </div>
                <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">Hozie Insight</Text>
              </Flex>
              <Text>
                These quantities scale with your built-up area. Confirm the estimate on the dashboard before you share this list.
              </Text>
            </Flex>
          </Card>

          {CATEGORY_ORDER.map((category, i) => {
            const rows = estimate.lines.filter((line) => line.category === category)
            if (rows.length === 0) return null
            return (
              <Flex
                key={category}
                vertical
                gap={8}
                style={{ animation: `welcomeFadeUp 0.4s ease-out ${0.1 + i * 0.06}s both` }}
              >
                <Text strong>{CATEGORY_LABEL[category]}</Text>
                <Table rowKey="id" columns={columns} dataSource={rows} pagination={false} size="small" />
              </Flex>
            )
          })}

          <Text
            type="secondary"
            className="text-[10px]! block"
            style={{ animation: "welcomeFadeUp 0.4s ease-out 0.4s both" }}
          >
            Rates reflect a single representative Houzeify rate card, not brand-specific pricing. Effective date:{" "}
            {new Date(estimate.lines[0]?.effectiveDate ?? estimate.createdAt).toLocaleDateString("en-IN")}.
          </Text>

          <Button
            type="primary"
            block
            onClick={() => onNavigate("estimate-dashboard", { estimate_id: estimate.id })}
            style={{ animation: "welcomeFadeUp 0.4s ease-out 0.46s both" }}
          >
            ← Back to Estimate
          </Button>
        </Flex>
      </div>
    </HomeownerLayout>
  )
}
