import { useState } from "react"
import { Button, Card, Col, Drawer, Empty, Flex, Row, Table, Tabs, Tag, Typography } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import Gated from "../components/Gated"
import ProgressDetail from "../components/progress/ProgressDetail"
import PublishPanel from "../components/progress/PublishPanel"
import ReviewDecisionModal from "../components/progress/ReviewDecisionModal"
import { reviewStatusLabel } from "../components/progress/progressLabels"
import type { DailyProgress, EntityId, ReviewDecision } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { Permissions } from "../domain/permissions"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getMembershipName,
  getPendingReview,
  getProgressHistory,
  getProject,
  getReadyToPublish,
  getWorkTypeName,
} from "../mock/selectors"
import { useAccess } from "../session/useCan"
import { useCommand } from "../session/useCommand"

const { Text } = Typography

const SUCCESS: Record<ReviewDecision, string> = {
  approve: "Approved — ready to publish",
  "request-changes": "Sent back to the submitter",
  reject: "Update rejected",
}

function ReviewTab({ items }: { items: DailyProgress[] }) {
  const { state, reviewDailyProgress } = useConstructionData()
  const run = useCommand()
  const can = useAccess()
  const [selectedId, setSelectedId] = useState<EntityId>()
  const [decision, setDecision] = useState<ReviewDecision | null>(null)
  const selected = items.find((item) => item.id === selectedId) ?? items[0]

  if (!items.length) return <Card><Empty description="No updates are waiting for review." /></Card>

  const canReview = can(Permissions.PROGRESS_REVIEW, selected.projectId, selected)
  const confirm = (note?: string) => {
    if (!decision) return
    const outcome = run(() => reviewDailyProgress(selected.id, decision, note), { success: SUCCESS[decision] })
    if (outcome.ok) {
      setDecision(null)
      setSelectedId(undefined)
    }
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={9}>
        <Flex vertical gap="small">
          {items.map((item) => {
            const active = item.id === selected.id
            return (
              <Button
                key={item.id}
                block
                type={active ? "primary" : "default"}
                className="h-auto! py-3! text-left! whitespace-normal!"
                onClick={() => setSelectedId(item.id)}
              >
                <Flex vertical align="flex-start" gap={2}>
                  <Text strong className={active ? "text-inherit!" : undefined}>
                    {getProject(state, item.projectId)?.name ?? "Project"}
                    {item.version > 1 ? ` · v${item.version}` : ""}
                  </Text>
                  <Text className={active ? "text-inherit!" : undefined} type={active ? undefined : "secondary"}>
                    {item.date} · {getWorkTypeName(state, item.workTypeId)}
                    {getMembershipName(state, item.submittedByMembershipId) ? ` · ${getMembershipName(state, item.submittedByMembershipId)}` : ""}
                  </Text>
                </Flex>
              </Button>
            )
          })}
        </Flex>
      </Col>
      <Col xs={24} lg={15}>
        <Card>
          <Flex vertical gap="large">
            <ProgressDetail progress={selected} />
            <Flex gap="small" wrap>
              <Gated allowed={canReview}>
                <Button type="primary" onClick={() => setDecision("approve")}>Approve</Button>
              </Gated>
              <Gated allowed={canReview}>
                <Button onClick={() => setDecision("request-changes")}>Request changes</Button>
              </Gated>
              <Gated allowed={canReview}>
                <Button danger onClick={() => setDecision("reject")}>Reject</Button>
              </Gated>
            </Flex>
          </Flex>
        </Card>
      </Col>
      <ReviewDecisionModal decision={decision} onCancel={() => setDecision(null)} onConfirm={confirm} />
    </Row>
  )
}

function PublishTab({ items }: { items: DailyProgress[] }) {
  if (!items.length) return <Card><Empty description="Nothing is waiting to be published." /></Card>
  return (
    <Flex vertical gap="middle">
      {items.map((item) => <PublishPanel key={item.id} progress={item} />)}
    </Flex>
  )
}

function HistoryTab({ items }: { items: DailyProgress[] }) {
  const { state } = useConstructionData()
  const [openId, setOpenId] = useState<EntityId>()
  const open = items.find((item) => item.id === openId)
  return (
    <Card classNames={{ body: "company-table-card-body" }}>
      <Table<DailyProgress>
        rowKey="id"
        dataSource={items}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        scroll={{ x: 760 }}
        onRow={(record) => ({ onClick: () => setOpenId(record.id), className: "cursor-pointer" })}
        columns={[
          { title: "Date", dataIndex: "date" },
          { title: "Project", render: (_, record) => getProject(state, record.projectId)?.name },
          { title: "Work", render: (_, record) => getWorkTypeName(state, record.workTypeId) },
          { title: "Submitted by", render: (_, record) => getMembershipName(state, record.submittedByMembershipId) ?? "—" },
          { title: "Version", render: (_, record) => `v${record.version}` },
          {
            title: "Review",
            render: (_, record) => (
              <Tag color={reviewStatusLabel[record.reviewStatus].color}>{reviewStatusLabel[record.reviewStatus].text}</Tag>
            ),
          },
          {
            title: "Homeowner",
            render: (_, record) =>
              record.publication ? (
                <Tag color="success">
                  Published · {record.publication.evidenceIds.length}{" "}
                  {record.publication.evidenceIds.length === 1 ? "item" : "items"}
                </Tag>
              ) : (
                <Text type="secondary">Not published</Text>
              ),
          },
        ]}
      />
      <Drawer open={Boolean(open)} size={640} title="Daily update" onClose={() => setOpenId(undefined)}>
        {open && <ProgressDetail progress={open} />}
      </Drawer>
    </Card>
  )
}

function ProgressPage({ onNavigate, projectId }: { onNavigate: Navigate; projectId?: EntityId }) {
  const { state } = useConstructionData()
  const can = useAccess()
  // Item-level: a scoped reviewer only sees items inside their scope.
  const visible = (item: DailyProgress) => can(Permissions.PROGRESS_REVIEW, item.projectId, item)
  const pending = getPendingReview(state, projectId).filter(visible)
  const ready = getReadyToPublish(state, projectId).filter(visible)
  const history = getProgressHistory(state, projectId).filter(visible)
  const homeownerProjectId = projectId ?? pending[0]?.projectId ?? ready[0]?.projectId

  return (
    <CompanyLayout
      nav={projectId ? { menu: "project", projectId, active: "progress" } : { menu: "company", active: "progress" }}
      onNavigate={onNavigate}
      description="Review site updates, then choose what the homeowner sees"
      actions={
        <Button
          disabled={!homeownerProjectId}
          onClick={() => homeownerProjectId && onNavigate("customer-daily-update", { project_id: homeownerProjectId })}
        >
          Homeowner view
        </Button>
      }
    >
      <Flex vertical gap="large" className="company-content">
        <Tabs
          items={[
            { key: "review", label: `Waiting for review (${pending.length})`, children: <ReviewTab items={pending} /> },
            { key: "publish", label: `Ready to publish (${ready.length})`, children: <PublishTab items={ready} /> },
            { key: "history", label: "History", children: <HistoryTab items={history} /> },
          ]}
        />
      </Flex>
    </CompanyLayout>
  )
}

export default function DailyProgressReviewScreen({ onNavigate, projectId }: { onNavigate: Navigate; projectId?: EntityId }) {
  return (
    <CompanyThemeProvider>
      <ProgressPage onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
