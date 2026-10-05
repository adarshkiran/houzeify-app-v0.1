import { Button, Card, Empty, Flex, Typography } from "antd"
import AmbientBg from "../components/homeowner/AmbientBg"
import { formatRupees } from "../components/homeowner/EstimateTotalSummary"
import HIcon from "../components/HIcon"
import HomeownerLayout from "../components/homeowner/HomeownerLayout"
import { areaBand, cityOf } from "../domain/marketplaceVisibility"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getEstimate } from "../mock/selectors"
import { useCommand } from "../session/useCommand"

const { Text, Title } = Typography

export default function MarketplacePostScreen({
  onNavigate,
  estimateId,
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  estimateId?: string
}) {
  const { state, postRequirement } = useConstructionData()
  const run = useCommand()
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

  const existing = state.requirements.find((r) => r.estimateId === estimate.id)

  if (estimate.reviewStatus !== "confirmed") {
    return (
      <HomeownerLayout active="estimates" onNavigate={onNavigate}>
        <Flex align="center" justify="center" className="min-h-full">
          <Empty description="Confirm your estimate before posting it to the marketplace.">
            <Button type="primary" onClick={() => onNavigate("estimate-dashboard", { estimate_id: estimate.id })}>
              Back to estimate
            </Button>
          </Empty>
        </Flex>
      </HomeownerLayout>
    )
  }

  const handlePost = () => {
    const outcome = run(() => postRequirement(estimate.id), { success: "Requirement posted." })
    if (outcome.ok) onNavigate("marketplace-responses", { requirement_id: outcome.value.id })
  }

  return (
    <HomeownerLayout active="estimates" onNavigate={onNavigate}>
      <div className="relative min-h-full" style={{ backgroundColor: "#FBF9F7" }}>
        <AmbientBg variant="marketplace" />
        <Flex vertical gap={24} className="relative z-10 max-w-[1080px] mx-auto! px-4! sm:px-6! lg:px-8! py-6! sm:py-8!">
          <Flex vertical gap={4} style={{ animation: "welcomeFadeUp 0.4s ease-out 0.05s both" }}>
            <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]! block">Marketplace</Text>
            <Title level={2} className="m-0!">Preview what partners see.</Title>
            <Text type="secondary">
              Partners get a summary of your requirement. Your project name stays hidden.
            </Text>
          </Flex>

          <Card
            title={<Title level={5} className="m-0!">Requirement preview</Title>}
            style={{ animation: "welcomeFadeUp 0.4s ease-out 0.08s both" }}
          >
            <Flex vertical gap={12}>
              <Flex justify="space-between" wrap gap={8}>
                <Text type="secondary">Location</Text>
                <Text strong>{cityOf(estimate.location)}</Text>
              </Flex>
              <Flex justify="space-between" wrap gap={8}>
                <Text type="secondary">Property type</Text>
                <Text strong>{estimate.propertyType}</Text>
              </Flex>
              <Flex justify="space-between" wrap gap={8}>
                <Text type="secondary">Area</Text>
                <Text strong>{areaBand(estimate.builtUpAreaSqft)}</Text>
              </Flex>
              <Flex justify="space-between" wrap gap={8}>
                <Text type="secondary">Estimate range</Text>
                <Text strong>
                  {formatRupees(estimate.totalLow)} — {formatRupees(estimate.totalHigh)}
                </Text>
              </Flex>
            </Flex>
          </Card>

          <Card className="bg-[#F3EAFF]! border-0!" style={{ animation: "welcomeFadeUp 0.4s ease-out 0.12s both" }}>
            <Flex vertical gap={12}>
              <Flex align="center" gap={10}>
                <div className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center shrink-0">
                  <HIcon size={20} />
                </div>
                <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">Hozie Insight</Text>
              </Flex>
              <Text>
                Partners see your location, property type, a size range, and your estimate range. Your project name
                stays private until a partner unlocks it.
              </Text>
            </Flex>
          </Card>

          {existing ? (
            <Button
              type="primary"
              block
              onClick={() => onNavigate("marketplace-responses", { requirement_id: existing.id })}
              style={{ animation: "welcomeFadeUp 0.4s ease-out 0.16s both" }}
            >
              View responses
            </Button>
          ) : (
            <Button
              type="primary"
              block
              onClick={handlePost}
              style={{ animation: "welcomeFadeUp 0.4s ease-out 0.16s both" }}
            >
              Post requirement
            </Button>
          )}

          <Button
            block
            onClick={() => onNavigate("estimate-dashboard", { estimate_id: estimate.id })}
            style={{ animation: "welcomeFadeUp 0.4s ease-out 0.2s both" }}
          >
            ← Back to Estimate
          </Button>
        </Flex>
      </div>
    </HomeownerLayout>
  )
}
