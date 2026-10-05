import { useMemo } from "react"
import { Button, Card, Empty, Flex, Table, Tag, Typography } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import HIcon from "../components/HIcon"
import { countLabel } from "../components/countLabel"
import { UNLOCK_COST_CREDITS, CREDIT_PACKS } from "../domain/billingCommands"
import { getActivePlan, getEntitlements, getWallet } from "../domain/entitlements"
import type { Navigate } from "../domain/navigation"
import type { CreditTransaction, EntitlementKey } from "../domain/models"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { useSession } from "../session/SessionProvider"
import { useCommand } from "../session/useCommand"

const { Text, Title } = Typography

const ENTITLEMENT_LABELS: Record<EntitlementKey, string> = {
  "marketplace.unlock": "Unlock marketplace requirements",
  "marketplace.propose": "Submit proposals",
  "team.members.unlimited": "Unlimited team members",
}

const KIND_LABELS: Record<CreditTransaction["kind"], string> = {
  grant: "Plan credits",
  purchase: "Credit purchase",
  unlock: "Requirement unlock",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function Billing({ onNavigate }: { onNavigate: Navigate }) {
  const { state, purchaseCredits } = useConstructionData()
  const { session } = useSession()
  const run = useCommand()
  const organizationId = session?.organizationId ?? ""

  const plan = useMemo(() => getActivePlan(state, organizationId), [state, organizationId])
  const entitlements = getEntitlements(state, organizationId)
  const balance = getWallet(state, organizationId).balance
  const unlocksLeft = Math.floor(balance / UNLOCK_COST_CREDITS)

  const transactions = useMemo(
    () =>
      state.creditTransactions
        .filter((t) => t.organizationId === organizationId)
        .slice()
        .reverse(),
    [state, organizationId],
  )

  return (
    <CompanyLayout
      nav={{ menu: "company", active: "billing" }}
      onNavigate={onNavigate}
      header={
        <Flex vertical justify="center" className="h-full">
          <Title level={5} className="company-heading! m-0!">
            Billing
          </Title>
          <Text type="secondary">Your plan, credit balance, and recent credit activity</Text>
        </Flex>
      }
    >
      <Flex vertical gap="middle" className="company-content">
        <Card size="small" title="Plan">
          {plan ? (
            <Flex vertical gap={8}>
              <Flex align="center" justify="space-between" wrap gap={8}>
                <Text strong>{plan.name}</Text>
                <Text type="secondary">{plan.priceLabel}</Text>
              </Flex>
              {entitlements.length === 0 ? null : (
                <ul className="m-0 pl-5">
                  {entitlements.map((key) => (
                    <li key={key} className="text-[13px]">
                      {ENTITLEMENT_LABELS[key]}
                    </li>
                  ))}
                </ul>
              )}
            </Flex>
          ) : (
            <Text type="secondary">No active plan</Text>
          )}
        </Card>

        <Card size="small" title="Credit balance">
          <Flex vertical gap={8}>
            <Text strong className="text-[22px]!">
              {balance} credits
            </Text>
            <Text type="secondary" className="text-[13px]!">
              Each unlock uses {UNLOCK_COST_CREDITS} credits.
            </Text>
            <Flex wrap gap="small">
              {CREDIT_PACKS.map((credits) => (
                <Button
                  key={credits}
                  onClick={() =>
                    run(() => purchaseCredits(organizationId, credits), {
                      success: `Added ${credits} credits`,
                    })
                  }
                >
                  Buy {credits} credits
                </Button>
              ))}
            </Flex>
          </Flex>
        </Card>

        <Card size="small" title="Recent credit activity">
          {transactions.length === 0 ? (
            <Empty description="No credit activity yet." />
          ) : (
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={transactions}
              columns={[
                {
                  title: "Activity",
                  dataIndex: "kind",
                  render: (kind: CreditTransaction["kind"]) => <Tag className="m-0!">{KIND_LABELS[kind]}</Tag>,
                },
                {
                  title: "Amount",
                  dataIndex: "amount",
                  render: (amount: number) => (amount > 0 ? `+${amount}` : `${amount}`),
                },
                { title: "Balance after", dataIndex: "balanceAfter" },
                { title: "Date", dataIndex: "createdAt", render: (iso: string) => formatDate(iso) },
              ]}
            />
          )}
          {transactions.length > 0 && (
            <Text type="secondary" className="block mt-2 text-[12px]!">
              {countLabel(transactions.length, "entry", "entries")}
            </Text>
          )}
        </Card>

        <Card size="small" className="bg-[#F3EAFF]! border-0!">
          <Flex vertical gap={8}>
            <Flex align="center" gap={10}>
              <div className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center shrink-0">
                <HIcon size={20} />
              </div>
              <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">Hozie Insight</Text>
            </Flex>
            <Text>
              Your balance covers {unlocksLeft} {unlocksLeft === 1 ? "unlock" : "unlocks"} at {UNLOCK_COST_CREDITS}{" "}
              credits each.
            </Text>
          </Flex>
        </Card>
      </Flex>
    </CompanyLayout>
  )
}

export default function BillingScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <CompanyThemeProvider>
      <Billing onNavigate={onNavigate} />
    </CompanyThemeProvider>
  )
}
