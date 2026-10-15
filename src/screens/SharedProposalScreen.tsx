import { useEffect, useState } from "react"
import { Alert, Card, Flex, Spin, Table, Tag, Typography } from "antd"
import type { TableProps } from "antd"
import LogoHorizontal from "../components/LogoHorizontal"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import type { SharedProposal, SharedProposalLine } from "../domain/models"
import { useConstructionData } from "../mock/ConstructionDataProvider"

const { Paragraph, Text, Title } = Typography

type Loaded = { kind: "loading" } | { kind: "unavailable" } | { kind: "ready"; proposal: SharedProposal }

const dateOnly = (iso: string) => iso.slice(0, 10)

// Exact rupees: per-unit rates are small (a bag of cement), so a lakh-style
// summary would show them as zero.
const rupees = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)

function SharedProposalView({ token }: { token?: string }) {
  const { getSharedProposal } = useConstructionData()
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" })

  useEffect(() => {
    let active = true
    if (!token) {
      setLoaded({ kind: "unavailable" })
      return
    }
    setLoaded({ kind: "loading" })
    getSharedProposal(token)
      .then((proposal) => {
        if (active) setLoaded(proposal ? { kind: "ready", proposal } : { kind: "unavailable" })
      })
      .catch(() => {
        if (active) setLoaded({ kind: "unavailable" })
      })
    return () => {
      active = false
    }
  }, [token, getSharedProposal])

  const columns: TableProps<SharedProposalLine>["columns"] = [
    { title: "Item", dataIndex: "item", key: "item" },
    { title: "Category", dataIndex: "category", key: "category", render: (value: string) => <Tag>{value}</Tag> },
    { title: "Qty", key: "qty", render: (_, line) => `${line.quantity} ${line.unit}` },
    { title: "Rate", dataIndex: "rate", key: "rate", render: (value: number) => rupees(value) },
    { title: "Amount", dataIndex: "amount", key: "amount", render: (value: number) => rupees(value) },
  ]

  return (
    <Flex vertical align="center" className="min-h-full" style={{ background: "#FBF9F7", padding: "24px 16px" }}>
      <Flex vertical gap="large" style={{ width: "100%", maxWidth: 880 }}>
        <LogoHorizontal height={28} />

        {loaded.kind === "loading" ? (
          <Flex justify="center" style={{ padding: 48 }}>
            <Spin />
          </Flex>
        ) : loaded.kind === "unavailable" ? (
          <Alert
            type="info"
            showIcon
            message="This link is no longer available"
            description="It may have expired or been withdrawn. Ask the contractor to send you a new link."
          />
        ) : (
          <>
            <Card>
              <Flex vertical gap={4}>
                <Text type="secondary">Proposal from</Text>
                <Title level={3} className="m-0!">
                  {loaded.proposal.partnerName}
                </Title>
                <Text type="secondary">
                  {loaded.proposal.propertyType} · {loaded.proposal.location} · {loaded.proposal.areaBand}
                </Text>
                <Text type="secondary">
                  Submitted {dateOnly(loaded.proposal.submittedAt)} · link valid until{" "}
                  {dateOnly(loaded.proposal.expiresAt)}
                </Text>
              </Flex>
            </Card>

            <Card title="Scope and price" classNames={{ body: "company-table-card-body" }}>
              <Table
                rowKey={(line) => `${line.category}-${line.item}`}
                size="small"
                columns={columns}
                dataSource={loaded.proposal.lines}
                pagination={false}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4}>
                      <Text strong>Total</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <Text strong>{rupees(loaded.proposal.total)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </Card>

            <Card title="Assumptions and exclusions">
              <Flex vertical gap="middle">
                <Flex vertical gap={4}>
                  <Text type="secondary">Assumptions</Text>
                  {loaded.proposal.assumptions.length ? (
                    loaded.proposal.assumptions.map((item) => <Text key={item}>• {item}</Text>)
                  ) : (
                    <Text>None stated.</Text>
                  )}
                </Flex>
                <Flex vertical gap={4}>
                  <Text type="secondary">Exclusions</Text>
                  {loaded.proposal.exclusions.length ? (
                    loaded.proposal.exclusions.map((item) => <Text key={item}>• {item}</Text>)
                  ) : (
                    <Text>None stated.</Text>
                  )}
                </Flex>
              </Flex>
            </Card>

            <Paragraph type="secondary" className="m-0!">
              Prices come from the Houzeify shared rate card and are an estimate, not a contract.
            </Paragraph>
          </>
        )}
      </Flex>
    </Flex>
  )
}

export default function SharedProposalScreen({ token }: { token?: string }) {
  return (
    <CompanyThemeProvider>
      <SharedProposalView token={token} />
    </CompanyThemeProvider>
  )
}
