import { Button, Card, Empty, Flex, Table, Tag, Typography } from "antd"
import AmbientBg from "../components/homeowner/AmbientBg"
import { formatRupees } from "../components/homeowner/EstimateTotalSummary"
import HIcon from "../components/HIcon"
import HomeownerLayout from "../components/homeowner/HomeownerLayout"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { useCommand } from "../session/useCommand"
import type { Proposal, ProposalStatus } from "../domain/models"

const { Text, Title } = Typography

const STATUS_LABEL: Record<ProposalStatus, string> = {
  submitted: "Submitted",
  selected: "Selected",
  rejected: "Not selected",
}

const STATUS_COLOR: Record<ProposalStatus, string> = {
  submitted: "default",
  selected: "success",
  rejected: "default",
}

export default function MarketplaceResponsesScreen({
  onNavigate,
  requirementId,
  proposalId,
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  requirementId?: string
  proposalId?: string
}) {
  const { state, selectProposal } = useConstructionData()
  const run = useCommand()
  const requirement = requirementId ? state.requirements.find((r) => r.id === requirementId) : undefined

  if (!requirement) {
    return (
      <HomeownerLayout active="estimates" onNavigate={onNavigate}>
        <Flex align="center" justify="center" className="min-h-full">
          <Empty description="We couldn't find that requirement.">
            <Button type="primary" onClick={() => onNavigate("dashboard-home")}>Back to home</Button>
          </Empty>
        </Flex>
      </HomeownerLayout>
    )
  }

  const proposals = state.proposals.filter((p) => p.requirementId === requirement.id)
  const selected = proposalId ? proposals.find((p) => p.id === proposalId) : undefined
  const awardedProject =
    requirement.status === "awarded"
      ? state.projects.find((p) => p.name === requirement.projectName && p.location === requirement.location)
      : undefined
  const organizationName = (id: string) => state.organizations.find((o) => o.id === id)?.name ?? "Partner"

  const handleSelect = (proposal: Proposal) => {
    const outcome = run(() => selectProposal(proposal.id), { success: "Partner selected." })
    if (outcome.ok) onNavigate("customer-daily-update", { project_id: outcome.value.id })
  }

  const columns = [
    {
      title: "Partner",
      dataIndex: "partnerOrganizationId",
      key: "partner",
      render: (id: string, row: Proposal) => (
        <Button
          type="link"
          className="p-0!"
          onClick={() => onNavigate("marketplace-responses", { requirement_id: requirement.id, proposal_id: row.id })}
        >
          {organizationName(id)}
        </Button>
      ),
    },
    { title: "Total", dataIndex: "total", key: "total", align: "right" as const, render: (value: number) => formatRupees(value) },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: ProposalStatus) => <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>,
    },
  ]

  return (
    <HomeownerLayout active="estimates" onNavigate={onNavigate}>
      <div className="relative min-h-full" style={{ backgroundColor: "#FBF9F7" }}>
        <AmbientBg variant="marketplace" />
        <Flex vertical gap={24} className="relative z-10 max-w-[1080px] mx-auto! px-4! sm:px-6! lg:px-8! py-6! sm:py-8!">
          <Flex vertical gap={4} style={{ animation: "welcomeFadeUp 0.4s ease-out 0.05s both" }}>
            <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]! block">Marketplace</Text>
            <Title level={2} className="m-0!">Partner responses.</Title>
            <Text type="secondary">
              {requirement.location} · {requirement.propertyType} · {formatRupees(requirement.estimateTotalLow)} —{" "}
              {formatRupees(requirement.estimateTotalHigh)}
            </Text>
          </Flex>

          <Card className="bg-[#F3EAFF]! border-0!" style={{ animation: "welcomeFadeUp 0.4s ease-out 0.06s both" }}>
            <Flex vertical gap={12}>
              <Flex align="center" gap={10}>
                <div className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center shrink-0">
                  <HIcon size={20} />
                </div>
                <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">Hozie Insight</Text>
              </Flex>
              <Text>
                Partners' proposals are priced from the same rate card as your estimate. Compare the totals and
                assumptions before you select one.
              </Text>
            </Flex>
          </Card>

          {proposals.length === 0 ? (
            <Flex align="center" justify="center" style={{ animation: "welcomeFadeUp 0.4s ease-out 0.08s both" }}>
              <Empty description="No partner responses yet. Your requirement is visible to partners on the marketplace." />
            </Flex>
          ) : (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={proposals}
              pagination={false}
              size="small"
              style={{ animation: "welcomeFadeUp 0.4s ease-out 0.08s both" }}
            />
          )}

          {selected && (
            <Card
              title={<Title level={5} className="m-0!">{organizationName(selected.partnerOrganizationId)}</Title>}
              style={{ animation: "welcomeFadeUp 0.4s ease-out 0.12s both" }}
            >
              <Flex vertical gap={12}>
                <Flex justify="space-between" wrap gap={8}>
                  <Text type="secondary">Total</Text>
                  <Text strong>{formatRupees(selected.total)}</Text>
                </Flex>
                {selected.assumptions.length > 0 && (
                  <Flex vertical gap={4}>
                    <Text type="secondary">Assumptions</Text>
                    {selected.assumptions.map((item) => (
                      <Text key={item}>• {item}</Text>
                    ))}
                  </Flex>
                )}
                {selected.exclusions.length > 0 && (
                  <Flex vertical gap={4}>
                    <Text type="secondary">Exclusions</Text>
                    {selected.exclusions.map((item) => (
                      <Text key={item}>• {item}</Text>
                    ))}
                  </Flex>
                )}
                {requirement.status === "posted" && selected.status === "submitted" && (
                  <Button type="primary" block onClick={() => handleSelect(selected)}>
                    Select this partner
                  </Button>
                )}
              </Flex>
            </Card>
          )}

          {awardedProject && (
            <Button type="primary" block onClick={() => onNavigate("customer-daily-update", { project_id: awardedProject.id })}>
              View your project
            </Button>
          )}

          <Button block onClick={() => onNavigate("marketplace-post", { estimate_id: requirement.estimateId })}>
            ← Back to requirement
          </Button>
        </Flex>
      </div>
    </HomeownerLayout>
  )
}
