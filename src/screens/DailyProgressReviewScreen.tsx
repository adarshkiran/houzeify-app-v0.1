import { useMemo, useState } from "react"
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  TeamOutlined,
} from "@ant-design/icons"
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Progress,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import LogoHorizontal from "../components/LogoHorizontal"
import type { EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getEvidenceForProgress,
  getPendingReviewProgress,
  getProject,
  getProjectUnits,
  getRecentProgress,
  getStageName,
  getTradeName,
  getWorkTypeName,
} from "../mock/selectors"

const { Paragraph, Text, Title } = Typography

function EvidenceThumb({
  url,
  caption,
}: {
  url: string
  caption?: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed || url.startsWith("/mock-evidence/")) {
    return (
      <div className="evidence-stub-fallback">
        <Text strong>{caption ?? "Photo evidence"}</Text>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={caption ?? "Evidence"}
      className="evidence-stub-image"
      onError={() => setFailed(true)}
    />
  )
}

function DailyProgressReview({
  onNavigate,
  projectId,
  progressId,
}: {
  onNavigate: Navigate
  projectId: EntityId
  progressId?: EntityId
}) {
  const { state, reviewDailyProgress } = useConstructionData()
  const project = getProject(state, projectId)
  const pending = getPendingReviewProgress(state, projectId)
  const recent = getRecentProgress(state, projectId)
  const [selectedId, setSelectedId] = useState<EntityId | undefined>(
    progressId ?? pending[0]?.id ?? recent.find((item) => item.reviewStatus === "submitted")?.id,
  )

  const selected = useMemo(
    () => state.dailyProgress.find((item) => item.id === selectedId),
    [selectedId, state.dailyProgress],
  )
  const evidence = selected
    ? getEvidenceForProgress(state, selected.id)
    : []
  const unit = getProjectUnits(state, projectId).find(
    (item) => item.id === selected?.projectUnitId,
  )

  const handleReview = (decision: "approve" | "reject") => {
    if (!selected) return
    const currentId = selected.id
    reviewDailyProgress(currentId, decision)
    message.success(
      decision === "approve"
        ? "Progress approved and published for the homeowner"
        : "Progress rejected — it stays hidden from the homeowner",
    )
    setSelectedId(pending.find((item) => item.id !== currentId)?.id)
  }

  return (
    <Flex vertical className="company-form-page min-h-full">
      <Flex align="center" justify="space-between" className="business-onboarding-header">
        <LogoHorizontal height={24} />
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => onNavigate("project-overview", { project_id: projectId })}
        >
          Project overview
        </Button>
      </Flex>

      <Flex vertical gap="large" className="company-form-content">
        <Flex vertical gap="small">
          <Text className="company-eyebrow">Company review</Text>
          <Title level={2} className="company-heading! m-0!">
            Daily progress queue
          </Title>
          <Paragraph type="secondary" className="m-0!">
            {project?.name ?? "Project"} — approve to publish Yesterday / Today / Tomorrow
            for the homeowner. Rejected updates stay private.
          </Paragraph>
        </Flex>

        <Row gutter={[24, 24]} align="top">
          <Col xs={24} lg={8}>
            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Pending review ({pending.length})
                </Title>
              }
            >
              {pending.length ? (
                <Flex vertical gap="small">
                  {pending.map((item) => (
                    <Button
                      key={item.id}
                      type={item.id === selectedId ? "primary" : "default"}
                      block
                      className="text-left! h-auto! py-3!"
                      onClick={() => setSelectedId(item.id)}
                    >
                      <Flex vertical align="flex-start" gap={4}>
                        <Text strong className={item.id === selectedId ? "text-inherit!" : undefined}>
                          {item.date}
                        </Text>
                        <Text
                          type={item.id === selectedId ? undefined : "secondary"}
                          className={item.id === selectedId ? "text-inherit! opacity-90" : undefined}
                          ellipsis
                        >
                          {item.todaySummary}
                        </Text>
                      </Flex>
                    </Button>
                  ))}
                </Flex>
              ) : (
                <Empty description="No submissions waiting for review" />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={16}>
            {selected ? (
              <Card>
                <Flex vertical gap="large">
                  <Flex align="flex-start" justify="space-between" gap="middle" wrap>
                    <Flex vertical gap="small">
                      <Space wrap>
                        <Tag color="warning">{selected.reviewStatus}</Tag>
                        <Tag>{selected.publicationStatus}</Tag>
                        <Tag icon={<TeamOutlined />}>{selected.workersPresent} workers</Tag>
                      </Space>
                      <Title level={4} className="company-heading! m-0!">
                        {selected.date} · {unit?.name ?? "Location"}
                      </Title>
                      <Text type="secondary">
                        {getStageName(state, selected.stageId)} ·{" "}
                        {getTradeName(state, selected.tradeId)} ·{" "}
                        {getWorkTypeName(state, selected.workTypeId)}
                      </Text>
                    </Flex>
                    <Space wrap>
                      <Button
                        danger
                        icon={<CloseOutlined />}
                        onClick={() => handleReview("reject")}
                        disabled={selected.reviewStatus !== "submitted" && selected.reviewStatus !== "draft"}
                      >
                        Reject
                      </Button>
                      <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        onClick={() => handleReview("approve")}
                        disabled={selected.reviewStatus !== "submitted" && selected.reviewStatus !== "draft"}
                      >
                        Approve & publish
                      </Button>
                    </Space>
                  </Flex>

                  {typeof selected.progressAfter === "number" && (
                    <Progress
                      percent={selected.progressAfter}
                      status="active"
                      format={(percent) =>
                        `${selected.progressBefore ?? "—"}% → ${percent}%`
                      }
                    />
                  )}

                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={8}>
                      <Card size="small" className="project-narrative-card">
                        <Text className="company-eyebrow">Yesterday</Text>
                        <Paragraph className="m-0! mt-2!">
                          {selected.yesterdaySummary ?? "Not provided"}
                        </Paragraph>
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card size="small" className="project-narrative-card project-narrative-today">
                        <Text className="company-eyebrow">Today</Text>
                        <Paragraph className="m-0! mt-2!">
                          {selected.todaySummary}
                        </Paragraph>
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card size="small" className="project-narrative-card">
                        <Text className="company-eyebrow">Tomorrow</Text>
                        <Paragraph className="m-0! mt-2!">
                          {selected.tomorrowPlan}
                        </Paragraph>
                      </Card>
                    </Col>
                  </Row>

                  {selected.blockerSummary && (
                    <Alert type="warning" showIcon message={selected.blockerSummary} />
                  )}

                  <Flex vertical gap="middle">
                    <Title level={5} className="company-heading! m-0!">
                      Evidence
                    </Title>
                    {evidence.length ? (
                      <Row gutter={[12, 12]}>
                        {evidence.map((item) => (
                          <Col xs={12} sm={8} md={6} key={item.id}>
                            <Card size="small" className="overflow-hidden">
                              <EvidenceThumb url={item.url} caption={item.caption} />
                              <Text type="secondary" ellipsis className="mt-2! block">
                                {item.caption ?? item.type}
                              </Text>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    ) : (
                      <Text type="secondary">No evidence attached.</Text>
                    )}
                  </Flex>

                  <Button
                    type="link"
                    className="self-start! px-0!"
                    onClick={() =>
                      onNavigate("customer-daily-update", { project_id: projectId })
                    }
                  >
                    Preview homeowner published view →
                  </Button>
                </Flex>
              </Card>
            ) : (
              <Card>
                <Empty description="Select a submission to review" />
              </Card>
            )}
          </Col>
        </Row>
      </Flex>
    </Flex>
  )
}

export default function DailyProgressReviewScreen({
  onNavigate,
  projectId,
  progressId,
}: {
  onNavigate: Navigate
  projectId: EntityId
  progressId?: EntityId
}) {
  return (
    <CompanyThemeProvider>
      <DailyProgressReview
        onNavigate={onNavigate}
        projectId={projectId}
        progressId={progressId}
      />
    </CompanyThemeProvider>
  )
}
