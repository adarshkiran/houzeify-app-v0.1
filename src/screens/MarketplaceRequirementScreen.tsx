import { useMemo, useState } from "react"
import { Alert, Button, Card, Empty, Flex, Input, Table, Tag, Typography } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import { formatRupees } from "../components/homeowner/EstimateTotalSummary"
import { UNLOCK_COST_CREDITS } from "../domain/billingCommands"
import { activeShareFor } from "../domain/proposalShareCommands"
import { getWallet, hasEntitlement } from "../domain/entitlements"
import type { Navigate } from "../domain/navigation"
import type { EstimateLine, ProposalStatus } from "../domain/models"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { useCommand } from "../session/useCommand"
import { useSession } from "../session/SessionProvider"

const { Text, Title } = Typography

const PROPOSAL_TAG: Record<ProposalStatus, { color: string; label: string }> = {
  submitted: { color: "blue", label: "Submitted" },
  selected: { color: "green", label: "Selected" },
  rejected: { color: "default", label: "Not selected" },
}

const splitLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

function Requirement({ onNavigate, requirementId }: { onNavigate: Navigate; requirementId?: string }) {
  const {
    state,
    unlockRequirement,
    submitProposal,
    createProposalShare,
    revokeProposalShare,
    viewRequirement: viewForOrg,
  } = useConstructionData()
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

  // The raw link is only known right after creating it; the database keeps a hash.
  const [freshLink, setFreshLink] = useState<{ proposalId: string; url: string } | null>(null)
  const activeShare = useMemo(
    () => (submitted ? activeShareFor(state, submitted.id, new Date().toISOString()) : undefined),
    [state, submitted],
  )

  const shareUrl = (token: string) =>
    `${window.location.origin}${window.location.pathname}#shared-proposal?token=${token}`

  const handleShare = async () => {
    if (!submitted) return
    const outcome = await run(() => createProposalShare(submitted.id), { success: "Share link created" })
    if (outcome.ok) setFreshLink({ proposalId: submitted.id, url: shareUrl(outcome.value.token) })
  }

  const handleRevoke = async () => {
    if (!submitted) return
    const outcome = await run(() => revokeProposalShare(submitted.id), { success: "Link revoked" })
    if (outcome.ok) setFreshLink(null)
  }

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      await run(() => undefined, { success: "Link copied" })
    } catch {
      await run(() => {
        throw new Error("Copy failed. Select the link and copy it manually.")
      })
    }
  }

  const wallet = getWallet(state, organizationId ?? "")
  const canUnlockPlan = hasEntitlement(state, organizationId ?? "", "marketplace.unlock")
  const canAfford = wallet.balance >= UNLOCK_COST_CREDITS

  const handleUnlock = async () => {
    if (!view || !organizationId) return
    await run(() => unlockRequirement(view.id, organizationId), { success: "Requirement unlocked" })
  }

  const handleSubmit = async () => {
    if (!view || !organizationId) return
    const outcome = await run(
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
              {!canUnlockPlan ? (
                <Flex align="center" justify="space-between" wrap gap={8}>
                  <Text type="secondary">Your plan doesn't include marketplace unlocks.</Text>
                  <Button onClick={() => onNavigate("billing")}>View plan</Button>
                </Flex>
              ) : (
                <Flex vertical gap="small">
                  <Flex align="center" justify="space-between" wrap gap={8}>
                    <Button type="primary" disabled={!canAfford} onClick={handleUnlock}>
                      Unlock · {UNLOCK_COST_CREDITS} credits
                    </Button>
                    <Text type="secondary">Balance: {wallet.balance} credits</Text>
                  </Flex>
                  {!canAfford && (
                    <Flex align="center" justify="space-between" wrap gap={8}>
                      <Text type="secondary">
                        You need {UNLOCK_COST_CREDITS} credits. You have {wallet.balance}.
                      </Text>
                      <Button type="link" className="p-0!" onClick={() => onNavigate("billing")}>
                        Buy credits
                      </Button>
                    </Flex>
                  )}
                </Flex>
              )}
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
                extra={<Tag color={PROPOSAL_TAG[submitted.status].color} className="m-0!">{PROPOSAL_TAG[submitted.status].label}</Tag>}
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

                  {submitted.status !== "rejected" && (
                    <Flex vertical gap="small" className="mt-2!">
                      <Text type="secondary">Share with the customer</Text>
                      {freshLink && freshLink.proposalId === submitted.id && activeShare ? (
                        <Alert
                          type="success"
                          showIcon
                          message="Anyone with this link can view the proposal until it expires."
                          description={
                            <Flex vertical gap="small">
                              <Text copyable={false} style={{ wordBreak: "break-all" }}>
                                {freshLink.url}
                              </Text>
                              <Text type="secondary">
                                Valid until {activeShare.expiresAt.slice(0, 10)}. This link is shown only once;
                                create a new one if you lose it.
                              </Text>
                              <Flex gap="small" wrap>
                                <Button size="small" type="primary" onClick={() => void handleCopy(freshLink.url)}>
                                  Copy link
                                </Button>
                                <Button size="small" danger onClick={() => void handleRevoke()}>
                                  Revoke
                                </Button>
                              </Flex>
                            </Flex>
                          }
                        />
                      ) : activeShare ? (
                        <Flex vertical gap="small">
                          <Text>A link is active until {activeShare.expiresAt.slice(0, 10)}.</Text>
                          <Flex gap="small" wrap>
                            <Button size="small" onClick={() => void handleShare()}>
                              Create new link
                            </Button>
                            <Button size="small" danger onClick={() => void handleRevoke()}>
                              Revoke
                            </Button>
                          </Flex>
                          <Text type="secondary">Creating a new link turns the old one off.</Text>
                        </Flex>
                      ) : (
                        <Flex>
                          <Button size="small" type="primary" onClick={() => void handleShare()}>
                            Share proposal
                          </Button>
                        </Flex>
                      )}
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
