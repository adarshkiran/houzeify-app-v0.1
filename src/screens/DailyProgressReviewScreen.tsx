import { useState } from "react"
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Row,
  Tag,
  Typography,
} from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import EvidenceThumb from "../components/EvidenceThumb"
import type { EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { Permissions } from "../domain/permissions"
import Gated from "../components/Gated"
import { useAccess } from "../session/useCan"
import { useCommand } from "../session/useCommand"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getEvidenceForProgress,
  getMembershipName,
  getPendingReview,
  getProject,
  getWorkTypeName,
} from "../mock/selectors"

const { Paragraph, Text, Title } = Typography

function ReviewQueue({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId?: EntityId
}) {
  const { state, reviewDailyProgress } = useConstructionData()
  const run = useCommand()
  const can = useAccess()
  // Item-level: a scoped reviewer only sees items inside their scope.
  const pending = getPendingReview(state, projectId).filter((item) =>
    can(Permissions.PROGRESS_REVIEW, item.projectId, item),
  )
  const [selectedId, setSelectedId] = useState<EntityId | undefined>(pending[0]?.id)
  const selected = pending.find((item) => item.id === selectedId) ?? pending[0]
  const project = selected ? getProject(state, selected.projectId) : undefined
  const evidence = selected ? getEvidenceForProgress(state, selected) : []
  // Company-wide queue: no project is implied until an item is selected.
  const homeownerViewProjectId = projectId ?? selected?.projectId

  const submitter = selected
    ? state.memberships.find((item) => item.id === selected.submittedByMembershipId)
    : undefined
  const submitterLabel = submitter
    ? `${getMembershipName(state, submitter.id) ?? "Unknown"} · ${submitter.role.replace("-", " ")}`
    : "—"

  const canReview = selected
    ? can(Permissions.PROGRESS_REVIEW, selected.projectId, selected)
    : false

  const decide = (decision: "approve" | "reject") => {
    if (!selected) return
    const outcome = run(() => reviewDailyProgress(selected.id, decision), {
      success: decision === "approve" ? "Progress approved" : "Progress rejected",
    })
    if (outcome.ok) setSelectedId(undefined)
  }

  return (
    <CompanyLayout
      nav={projectId ? { menu: "project", projectId, active: "progress" } : { menu: "company", active: "progress" }}
      onNavigate={onNavigate}
      description="Approve site updates before the homeowner sees them"
      actions={
        <Button
          disabled={!homeownerViewProjectId}
          onClick={() =>
            homeownerViewProjectId &&
            onNavigate("customer-daily-update", {
              project_id: homeownerViewProjectId,
            })
          }
        >
          Homeowner view
        </Button>
      }
    >
      <Flex vertical gap="large" className="company-content">
        <Alert
          type="info"
          showIcon
          message="Approved updates are published to the homeowner. Rejected updates stay off their record, and voice notes are never shared with them."
        />

        {pending.length === 0 ? (
          <Card>
            <Empty description="No updates are waiting for review." />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={9}>
              <Flex vertical gap="small">
                {pending.map((item) => {
                  const itemProject = getProject(state, item.projectId)
                  const active = item.id === selected?.id
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
                          {itemProject?.name ?? "Project"}
                        </Text>
                        <Text className={active ? "text-inherit!" : undefined} type={active ? undefined : "secondary"}>
                          {item.date} · {getWorkTypeName(state, item.workTypeId)}
                          {getMembershipName(state, item.submittedByMembershipId)
                            ? ` · ${getMembershipName(state, item.submittedByMembershipId)}`
                            : ""}
                        </Text>
                      </Flex>
                    </Button>
                  )
                })}
              </Flex>
            </Col>
            <Col xs={24} lg={15}>
              {selected && (
                <Card>
                  <Flex vertical gap="large">
                    <Flex align="center" justify="space-between" gap="middle" wrap>
                      <Title level={4} className="company-heading! m-0!">
                        {project?.name}
                      </Title>
                      <Tag>{selected.reviewStatus}</Tag>
                    </Flex>
                    <Descriptions
                      column={{ xs: 1, sm: 2 }}
                      items={[
                        { key: "work", label: "Work", children: getWorkTypeName(state, selected.workTypeId) },
                        { key: "by", label: "Submitted by", children: submitterLabel },
                        { key: "workers", label: "Workers", children: selected.workersPresent },
                        ...(selected.completedQuantity
                          ? [
                              {
                                key: "quantity",
                                label: "Done today",
                                children: `${selected.completedQuantity.value} ${selected.completedQuantity.unit}${
                                  selected.plannedQuantity
                                    ? ` of ${selected.plannedQuantity.value} ${selected.plannedQuantity.unit} planned`
                                    : ""
                                }`,
                              },
                            ]
                          : []),
                        ...(typeof selected.progressAfter === "number"
                          ? [
                              {
                                key: "delta",
                                label: "Progress",
                                children: `${selected.progressBefore ?? "—"}% → ${selected.progressAfter}%`,
                              },
                            ]
                          : []),
                        { key: "date", label: "Date", children: selected.date },
                      ]}
                    />
                    <Flex vertical gap="small">
                      <Text className="company-eyebrow">Yesterday</Text>
                      <Paragraph className="m-0!">
                        {selected.yesterdaySummary || "No previous-day note was included."}
                      </Paragraph>
                      <Text className="company-eyebrow">Today</Text>
                      <Paragraph className="m-0!">{selected.todaySummary}</Paragraph>
                      <Text className="company-eyebrow">Tomorrow</Text>
                      <Paragraph className="m-0!">{selected.tomorrowPlan}</Paragraph>
                      {selected.blockerSummary && (
                        <Alert type="warning" showIcon message={selected.blockerSummary} />
                      )}
                    </Flex>
                    <Row gutter={[16, 16]}>
                      {evidence.length ? (
                        evidence.map((item) => (
                          <Col key={item.id} xs={12} sm={8}>
                            <EvidenceThumb evidence={item} />
                          </Col>
                        ))
                      ) : (
                        <Col span={24}>
                          <Text type="secondary">No evidence was attached.</Text>
                        </Col>
                      )}
                    </Row>
                    <Flex gap="small" wrap>
                      <Gated allowed={canReview}>
                        <Button type="primary" onClick={() => decide("approve")}>
                          Approve and publish
                        </Button>
                      </Gated>
                      <Gated allowed={canReview}>
                        <Button danger onClick={() => decide("reject")}>
                          Reject
                        </Button>
                      </Gated>
                    </Flex>
                  </Flex>
                </Card>
              )}
            </Col>
          </Row>
        )}
      </Flex>
    </CompanyLayout>
  )
}

export default function DailyProgressReviewScreen({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId?: EntityId
}) {
  return (
    <CompanyThemeProvider>
      <ReviewQueue onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
