import { useState } from "react"
import { Button, Card, Empty, Flex, Input, Table, Tag, Typography } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import { formatRupees } from "../components/homeowner/EstimateTotalSummary"
import type { Navigate } from "../domain/navigation"
import type { EstimateLine } from "../domain/models"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { useCommand } from "../session/useCommand"
import { useSession } from "../session/SessionProvider"

const { Text, Title } = Typography

const splitLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

function Requirement({ onNavigate, requirementId }: { onNavigate: Navigate; requirementId?: string }) {
  const { state, unlockRequirement, submitProposal, viewRequirement: viewForOrg } = useConstructionData()
  const { session } = useSession()
  const run = useCommand()
  const organizationId = session?.organizationId
  const [assumptionsText, setAssumptionsText] = useState("")
  const [exclusionsText, setExclusionsText] = useState("")

  const view =
    requirementId && organizationId ? viewForOrg(requirementId, organizationId) : undefined
  const submitted =
    view && organizationId
      ? state.proposals.find(
          (proposal) =>
            proposal.requirementId === view.id && proposal.partnerOrganizationId === organizationId,
        )
      : undefined

  const handleUnlock = () => {
    if (!view || !organizationId) return
    run(() => unlockRequirement(view.id, organizationId), { success: "Requirement unlocked" })
  }

  const handleSubmit = () => {
    if (!view || !organizationId) return
    const outcome = run(
      () =>
        submitProposal(view.id, organizationId, {
          assumptions: splitLines(assumptionsText),
          exclusions: splitLines(exclusionsText),
        }),
      { success: "Proposal submitted" },
    )
    if (outcome.ok) {
      setAssumptionsText("")
      setExclusionsText("")
    }
  }

  if (!view) {
    return (
      <CompanyLayout
        nav={{ menu: "company", active: "opportunities" }}
        onNavigate={onNavigate}
        header={
          <Title level={5} className="company-heading! m-0!">
            Requirement
          </Title>
        }
      >
        <Flex align="center" justify="center" className="company-content">
          <Empty description="We couldn't find that requirement.">
            <Button type="primary" onClick={() => onNavigate("marketplace-opportunities")}>
              Back to opportunities
            </Button>
          </Empty>
        </Flex>
      </CompanyLayout>
    )
  }

  const lineColumns = [
    { title: "Item", dataIndex: "item", key: "item", render: (text: string) => <Text strong>{text}</Text> },
    {
      title: "Qty",
      key: "quantity",
      align: "right" as const,
      render: (_: unknown, line: EstimateLine) => `${line.quantity} ${line.unit}`,
    },
    {
      title: "Rate",
      dataIndex: "rate",
      key: "rate",
      align: "right" as const,
      render: (value: number) => formatRupees(value),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      align: "right" as const,
      render: (value: number) => formatRupees(value),
    },
  ]

  return (
    <CompanyLayout
      nav={{ menu: "company", active: "opportunities" }}
      onNavigate={onNavigate}
      header={
        <Flex vertical justify="center" className="h-full">
          <Title level={5} className="company-heading! m-0!">
            {view.location}
          </Title>
          <Text type="secondary">
            {view.propertyType} · Estimate {formatRupees(view.estimateTotalLow)} — {formatRupees(view.estimateTotalHigh)}
          </Text>
        </Flex>
      }
    >
      <Flex vertical gap="middle" className="company-content">
        {view.kind === "preview" ? (
          <Card size="small" title={<Title level={5} className="company-heading! m-0!">Preview</Title>}>
            <Flex vertical gap="middle">
              <Flex justify="space-between" wrap gap={8}>
                <Text type="secondary">Location</Text>
                <Text>{view.location}</Text>
              </Flex>
              <Flex justify="space-between" wrap gap={8}>
                <Text type="secondary">Property type</Text>
                <Text>{view.propertyType}</Text>
              </Flex>
              <Flex justify="space-between" wrap gap={8}>
                <Text type="secondary">Built-up area</Text>
                <Text>{view.areaBand}</Text>
              </Flex>
              <Text type="secondary">
                Unlock this requirement to see the project scope and line items.
              </Text>
              <Button type="primary" onClick={handleUnlock}>
                Unlock requirement
              </Button>
            </Flex>
          </Card>
        ) : (
          <>
            <Card
              size="small"
              title={<Title level={5} className="company-heading! m-0!">Scope</Title>}
              extra={<Tag color="green" className="m-0!">Unlocked</Tag>}
            >
              <Flex vertical gap="small">
                <Flex justify="space-between" wrap gap={8}>
                  <Text type="secondary">Project</Text>
                  <Text>{view.projectName}</Text>
                </Flex>
                <Flex justify="space-between" wrap gap={8}>
                  <Text type="secondary">Location</Text>
                  <Text>{view.location}</Text>
                </Flex>
                <Flex justify="space-between" wrap gap={8}>
                  <Text type="secondary">Built-up area</Text>
                  <Text>{view.builtUpAreaSqft.toLocaleString("en-IN")} sq ft</Text>
                </Flex>
                <Flex justify="space-between" wrap gap={8}>
                  <Text type="secondary">Construction level</Text>
                  <Text className="capitalize">{view.constructionLevel}</Text>
                </Flex>
              </Flex>
            </Card>

            <Card
              size="small"
              title={<Title level={5} className="company-heading! m-0!">Line items</Title>}
              classNames={{ body: "company-table-card-body-inset" }}
            >
              <Table
                rowKey="id"
                size="small"
                columns={lineColumns}
                dataSource={view.lines}
                pagination={false}
              />
            </Card>

            {submitted ? (
              <Card
                size="small"
                title={<Title level={5} className="company-heading! m-0!">Your proposal</Title>}
                extra={<Tag color="blue" className="m-0!">Submitted</Tag>}
              >
                <Flex vertical gap="small">
                  <Flex justify="space-between" wrap gap={8}>
                    <Text type="secondary">Total</Text>
                    <Text strong>{formatRupees(submitted.total)}</Text>
                  </Flex>
                  {submitted.assumptions.length > 0 && (
                    <Flex vertical gap={4}>
                      <Text type="secondary">Assumptions</Text>
                      {submitted.assumptions.map((item) => (
                        <Text key={item}>• {item}</Text>
                      ))}
                    </Flex>
                  )}
                  {submitted.exclusions.length > 0 && (
                    <Flex vertical gap={4}>
                      <Text type="secondary">Exclusions</Text>
                      {submitted.exclusions.map((item) => (
                        <Text key={item}>• {item}</Text>
                      ))}
                    </Flex>
                  )}
                </Flex>
              </Card>
            ) : (
              <Card
                size="small"
                title={<Title level={5} className="company-heading! m-0!">Build your proposal</Title>}
              >
                <Flex vertical gap="middle">
                  <Flex vertical gap={6}>
                    <Text strong>Assumptions</Text>
                    <Input.TextArea
                      rows={4}
                      placeholder="One assumption per line"
                      value={assumptionsText}
                      onChange={(event) => setAssumptionsText(event.target.value)}
                    />
                  </Flex>
                  <Flex vertical gap={6}>
                    <Text strong>Exclusions</Text>
                    <Input.TextArea
                      rows={4}
                      placeholder="One exclusion per line"
                      value={exclusionsText}
                      onChange={(event) => setExclusionsText(event.target.value)}
                    />
                  </Flex>
                  <Flex justify="flex-end">
                    <Button type="primary" onClick={handleSubmit}>
                      Submit proposal
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            )}
          </>
        )}

        <Card size="small" className="bg-[#F3EAFF]! border-0!">
          <Flex vertical gap={8}>
            <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">Hozie Insight</Text>
            <Text>
              {view.kind === "preview"
                ? "Unlocking shows the scope and line items. Proposals are priced from the shared rate card."
                : "Proposals are priced from the shared rate card. Be explicit about assumptions and exclusions so the homeowner can compare totals."}
            </Text>
          </Flex>
        </Card>
      </Flex>
    </CompanyLayout>
  )
}

export default function MarketplaceRequirementScreen({
  onNavigate,
  requirementId,
}: {
  onNavigate: Navigate
  requirementId?: string
}) {
  return (
    <CompanyThemeProvider>
      <Requirement onNavigate={onNavigate} requirementId={requirementId} />
    </CompanyThemeProvider>
  )
}
