import { useMemo, useState } from "react"
import { SearchOutlined } from "@ant-design/icons"
import { Card, Empty, Flex, Input, Tag, Typography } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import HIcon from "../components/HIcon"
import { formatRupees } from "../components/homeowner/EstimateTotalSummary"
import { countLabel } from "../components/countLabel"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { useSession } from "../session/SessionProvider"

const { Text, Title } = Typography

function Opportunities({ onNavigate }: { onNavigate: Navigate }) {
  const { state, viewRequirement } = useConstructionData()
  const { session } = useSession()
  const organizationId = session?.organizationId
  const [locationFilter, setLocationFilter] = useState("")

  const cards = useMemo(() => {
    if (!organizationId) return []
    return state.requirements
      .filter((requirement) => requirement.status === "posted")
      .map((requirement) => viewRequirement(requirement.id, organizationId))
      .filter((view) => view !== undefined)
      .filter((view) => view.location.toLowerCase().includes(locationFilter.trim().toLowerCase()))
  }, [state, viewRequirement, organizationId, locationFilter])

  return (
    <CompanyLayout
      nav={{ menu: "company", active: "opportunities" }}
      onNavigate={onNavigate}
      header={
        <Flex vertical justify="center" className="h-full">
          <Title level={5} className="company-heading! m-0!">
            Opportunities
          </Title>
          <Text type="secondary">Posted homeowner requirements open to contractors and builders</Text>
        </Flex>
      }
    >
      <Flex vertical gap="middle" className="company-content">
        <Card size="small">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Filter by location"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            className="company-project-search"
          />
        </Card>

        <Flex align="center" justify="space-between" wrap gap="small">
          <Text type="secondary">{countLabel(cards.length, "requirement")}</Text>
        </Flex>

        {cards.length === 0 ? (
          <Card size="small">
            <Empty description="No open requirements match this filter." />
          </Card>
        ) : (
          <Flex vertical gap="small">
            {cards.map((view) => (
              <Card
                key={view.id}
                size="small"
                hoverable
                onClick={() => onNavigate("marketplace-requirement", { requirement_id: view.id })}
                className="cursor-pointer"
              >
                <Flex vertical gap={6}>
                  <Flex align="center" justify="space-between" wrap gap={8}>
                    <Text strong>{view.location}</Text>
                    {view.kind === "full" ? <Tag color="green" className="m-0!">Unlocked</Tag> : null}
                  </Flex>
                  <Text type="secondary" className="text-[13px]!">
                    {view.propertyType}
                    {view.kind === "preview" ? ` · ${view.areaBand}` : ""}
                  </Text>
                  <Text className="text-[13px]!">
                    Estimate {formatRupees(view.estimateTotalLow)} — {formatRupees(view.estimateTotalHigh)}
                  </Text>
                </Flex>
              </Card>
            ))}
          </Flex>
        )}

        <Card size="small" className="bg-[#F3EAFF]! border-0!">
          <Flex vertical gap={8}>
            <Flex align="center" gap={10}>
              <div className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center shrink-0">
                <HIcon size={20} />
              </div>
              <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">Hozie Insight</Text>
            </Flex>
            <Text>
              Each requirement shows a location and area band before you unlock it. Unlocking reveals the scope and
              line items so you can prepare a proposal.
            </Text>
          </Flex>
        </Card>
      </Flex>
    </CompanyLayout>
  )
}

export default function MarketplaceOpportunitiesScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <CompanyThemeProvider>
      <Opportunities onNavigate={onNavigate} />
    </CompanyThemeProvider>
  )
}
