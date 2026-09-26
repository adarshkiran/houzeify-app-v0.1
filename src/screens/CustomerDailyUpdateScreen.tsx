import { useState } from "react"
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CameraOutlined,
} from "@ant-design/icons"
import {
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
} from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import LogoHorizontal from "../components/LogoHorizontal"
import type { EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getEvidenceForProgress,
  getProject,
  getPublishedProgressForCustomer,
  getStageName,
} from "../mock/selectors"

const { Paragraph, Text, Title } = Typography

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T00:00:00`))
}

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
      <div className="evidence-stub-fallback customer-evidence-fallback">
        <CameraOutlined />
        <Text>{caption ?? "Site photo"}</Text>
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

function CustomerDailyUpdate({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  const { state } = useConstructionData()
  const project = getProject(state, projectId)
  const published = getPublishedProgressForCustomer(state, projectId)
  const latest = published[0]
  const evidence = latest
    ? getEvidenceForProgress(state, latest.id, { customerVisibleOnly: true })
    : []

  return (
    <Flex vertical className="customer-daily-update min-h-full">
      <Flex align="center" justify="space-between" className="customer-daily-header">
        <LogoHorizontal height={22} />
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => onNavigate("dashboard-home")}
        >
          Home
        </Button>
      </Flex>

      <Flex vertical gap="large" className="customer-daily-content">
        <Flex vertical gap="small" className="customer-daily-hero">
          <Text className="customer-daily-eyebrow">Daily site update</Text>
          <Title level={2} className="customer-daily-title m-0!">
            {project?.name ?? "Your project"}
          </Title>
          <Paragraph type="secondary" className="m-0! max-w-xl">
            Only published updates appear here. Rejected or private submissions stay
            with the construction company.
          </Paragraph>
          {latest && (
            <Space wrap>
              <Tag icon={<CalendarOutlined />} color="processing">
                {formatDate(latest.date)}
              </Tag>
              <Tag>{getStageName(state, latest.stageId)}</Tag>
              {typeof latest.progressAfter === "number" && (
                <Tag color="success">{latest.progressAfter}% complete</Tag>
              )}
            </Space>
          )}
        </Flex>

        {!latest ? (
          <Card>
            <Empty description="No published daily update yet. Check back after your builder reviews site progress." />
          </Card>
        ) : (
          <>
            <Row gutter={[16, 16]} className="customer-ytt-row">
              <Col xs={24} md={8}>
                <div className="customer-ytt-panel">
                  <Text className="customer-daily-eyebrow">Yesterday</Text>
                  <Paragraph className="customer-ytt-body m-0!">
                    {latest.yesterdaySummary ??
                      "Previous published work will appear here when available."}
                  </Paragraph>
                </div>
              </Col>
              <Col xs={24} md={8}>
                <div className="customer-ytt-panel customer-ytt-today">
                  <Text className="customer-daily-eyebrow">Today</Text>
                  <Paragraph className="customer-ytt-body m-0!">
                    {latest.todaySummary}
                  </Paragraph>
                </div>
              </Col>
              <Col xs={24} md={8}>
                <div className="customer-ytt-panel">
                  <Text className="customer-daily-eyebrow">Tomorrow</Text>
                  <Paragraph className="customer-ytt-body m-0!">
                    {latest.tomorrowPlan}
                  </Paragraph>
                </div>
              </Col>
            </Row>

            {typeof latest.progressAfter === "number" && (
              <div className="customer-progress-block">
                <Flex align="baseline" justify="space-between">
                  <Text strong>Project progress</Text>
                  <Title level={3} className="customer-daily-title m-0!">
                    {latest.progressAfter}%
                  </Title>
                </Flex>
                <Progress percent={latest.progressAfter} showInfo={false} strokeColor="#0F6E56" />
              </div>
            )}

            <Flex vertical gap="middle">
              <Title level={4} className="customer-daily-title m-0!">
                Site photos
              </Title>
              {evidence.length ? (
                <Row gutter={[12, 12]}>
                  {evidence.map((item) => (
                    <Col xs={12} sm={8} md={6} key={item.id}>
                      <div className="customer-evidence-card">
                        <EvidenceThumb url={item.url} caption={item.caption} />
                        <Text type="secondary" className="mt-2! block">
                          {item.caption ?? "Site photo"}
                        </Text>
                      </div>
                    </Col>
                  ))}
                </Row>
              ) : (
                <Text type="secondary">No customer-visible photos for this update.</Text>
              )}
            </Flex>

            {published.length > 1 && (
              <Flex vertical gap="small">
                <Title level={5} className="customer-daily-title m-0!">
                  Earlier published updates
                </Title>
                {published.slice(1).map((item) => (
                  <div key={item.id} className="customer-history-row">
                    <Text strong>{formatDate(item.date)}</Text>
                    <Text type="secondary">{item.todaySummary}</Text>
                  </div>
                ))}
              </Flex>
            )}
          </>
        )}
      </Flex>
    </Flex>
  )
}

export default function CustomerDailyUpdateScreen({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  return (
    <CompanyThemeProvider>
      <CustomerDailyUpdate onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
