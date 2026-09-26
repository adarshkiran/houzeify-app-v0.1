import { ArrowLeftOutlined } from "@ant-design/icons"
import {
  Alert,
  Button,
  Card,
  Col,
  Flex,
  Progress,
  Row,
  Typography,
} from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import EvidenceThumb from "../components/EvidenceThumb"
import LogoHorizontal from "../components/LogoHorizontal"
import type { EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getCustomerVisibleEvidence,
  getEvidenceForProgress,
  getProject,
  getPublishedForCustomer,
  getWorkTypeName,
} from "../mock/selectors"

const { Paragraph, Text, Title } = Typography

function Narrative({
  label,
  copy,
  emphasis,
}: {
  label: string
  copy: string
  emphasis?: boolean
}) {
  return (
    <Card
      size="small"
      className={emphasis ? "project-narrative-today" : "project-narrative-card"}
    >
      <Flex vertical gap="small">
        <Text className="company-eyebrow">{label}</Text>
        <Text>{copy}</Text>
      </Flex>
    </Card>
  )
}

function CustomerUpdate({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId?: EntityId
}) {
  const { state } = useConstructionData()
  const published = getPublishedForCustomer(state, projectId)
  const latest = published[0]
  const project = latest ? getProject(state, latest.projectId) : getProject(state, projectId ?? "")
  const evidence = latest
    ? getCustomerVisibleEvidence(getEvidenceForProgress(state, latest))
    : []
  const progress = latest?.progressAfter ?? project?.progress ?? 0

  return (
    <Flex vertical className="company-form-page min-h-full">
      <Flex align="center" justify="space-between" className="business-onboarding-header">
        <LogoHorizontal height={24} />
        <Button icon={<ArrowLeftOutlined />} onClick={() => onNavigate("dashboard-home")}>
          Home
        </Button>
      </Flex>

      <Flex vertical gap="large" className="company-form-content" style={{ maxWidth: 720 }}>
        <Flex vertical gap="small">
          <Title level={2} className="company-heading! m-0!">
            {project?.name ?? "Your site"}
          </Title>
          <Text type="secondary">
            {latest
              ? `${latest.date} · ${getWorkTypeName(state, latest.workTypeId)} · ${project?.location ?? ""}`
              : "Published updates from your contractor appear here."}
          </Text>
        </Flex>

        {latest ? (
          <>
            <Card>
              <Flex vertical gap="small">
                <Flex align="baseline" justify="space-between">
                  <Text strong>Site progress</Text>
                  <Title level={2} className="company-heading! m-0!">
                    {progress}%
                  </Title>
                </Flex>
                <Progress percent={progress} showInfo={false} />
              </Flex>
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Narrative
                  label="Yesterday"
                  copy={
                    latest.yesterdaySummary ||
                    "The previous day was not described in this update."
                  }
                />
              </Col>
              <Col xs={24} md={8}>
                <Narrative label="Today" copy={latest.todaySummary} emphasis />
              </Col>
              <Col xs={24} md={8}>
                <Narrative label="Tomorrow" copy={latest.tomorrowPlan} />
              </Col>
            </Row>

            {latest.blockerSummary && (
              <Alert type="warning" showIcon message={latest.blockerSummary} />
            )}

            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Photos from site
                </Title>
              }
            >
              {evidence.length ? (
                <Row gutter={[16, 16]}>
                  {evidence.map((item) => (
                    <Col key={item.id} xs={12} sm={8}>
                      <EvidenceThumb evidence={item} />
                    </Col>
                  ))}
                </Row>
              ) : (
                <Paragraph type="secondary" className="m-0!">
                  No photos have been shared with you for this update.
                </Paragraph>
              )}
            </Card>
          </>
        ) : (
          <Card>
            <Paragraph className="m-0!">
              Nothing has been published for you yet. Your contractor’s update appears here after it is reviewed.
            </Paragraph>
          </Card>
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
  projectId?: EntityId
}) {
  return (
    <CompanyThemeProvider>
      <CustomerUpdate onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
