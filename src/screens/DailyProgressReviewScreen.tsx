import { useMemo, useState } from "react"
import { ArrowLeftOutlined } from "@ant-design/icons"
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
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import EvidenceThumb from "../components/EvidenceThumb"
import LogoHorizontal from "../components/LogoHorizontal"
import type { EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { Permissions } from "../domain/permissions"
import { projectIdsWithPermission } from "../domain/session"
import { useSession } from "../session/SessionProvider"
import Gated from "../components/Gated"
import { useAccess } from "../session/useCan"
import { useCommand } from "../session/useCommand"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getEvidenceForProgress,
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
  const { session } = useSession()
  const reviewable = useMemo(
    () =>
      projectIdsWithPermission(session, state.memberships, Permissions.PROGRESS_REVIEW),
    [session, state.memberships],
  )
  const pending = getPendingReview(state, projectId, reviewable)
  const [selectedId, setSelectedId] = useState<EntityId | undefined>(pending[0]?.id)
  const selected = pending.find((item) => item.id === selectedId) ?? pending[0]
  const project = selected ? getProject(state, selected.projectId) : undefined
  const evidence = selected ? getEvidenceForProgress(state, selected) : []
  // Company-wide queue: no project is implied until an item is selected.
  const homeownerViewProjectId = projectId ?? selected?.projectId

  const canReview = selected
    ? can(Permissions.PROGRESS_REVIEW, selected.projectId)
    : false

  const decide = (decision: "approve" | "reject") => {
    if (!selected) return
    const outcome = run(() => reviewDailyProgress(selected.id, decision), {
      success: decision === "approve" ? "Progress approved" : "Progress rejected",
    })
    if (outcome.ok) setSelectedId(undefined)
  }

  return (
    <Flex vertical className="company-form-page min-h-full">
      <Flex align="center" justify="space-between" className="business-onboarding-header">
        <LogoHorizontal height={24} />
        <Flex gap="small">
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
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() =>
              projectId
                ? onNavigate("project-overview", { project_id: projectId })
                : onNavigate("company-dashboard")
            }
          >
            {projectId ? "Project" : "Company home"}
          </Button>
        </Flex>
      </Flex>

      <Flex vertical gap="large" className="company-form-content">
        <Flex vertical gap="small">
          <Text className="company-eyebrow">Review</Text>
          <Title level={2} className="company-heading! m-0!">
            Site updates waiting
          </Title>
          <Text type="secondary">
            Approve an update to publish it for the homeowner. Rejected updates stay off their record.
          </Text>
        </Flex>

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
                        { key: "workers", label: "Workers", children: selected.workersPresent },
                        {
                          key: "delta",
                          label: "Progress",
                          children: `${selected.progressBefore ?? "—"}% → ${selected.progressAfter ?? "—"}%`,
                        },
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
    </Flex>
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
