import { ArrowLeftOutlined } from "@ant-design/icons"
import { Button, Card, Flex, Progress, Typography } from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import LogoHorizontal from "../components/LogoHorizontal"
import ThreadPanel from "../components/conversations/ThreadPanel"
import DayTimeline from "../components/progress/DayTimeline"
import EvidenceGrid from "../components/progress/EvidenceGrid"
import { findThread, readerMembership } from "../domain/conversations"
import type { EntityId, Thread } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getProject,
  getPublishedEvidence,
  getPublishedForCustomer,
  getWorkTypeName,
} from "../mock/selectors"
import { useSession } from "../session/SessionProvider"

const { Paragraph, Text, Title } = Typography

function CustomerUpdate({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId?: EntityId
}) {
  const { state } = useConstructionData()
  const { session } = useSession()
  const published = getPublishedForCustomer(state, projectId)
  const latest = published[0]
  const project = latest ? getProject(state, latest.projectId) : getProject(state, projectId ?? "")
  const evidence = latest ? getPublishedEvidence(state, latest) : []
  const progress = project?.progress ?? 0
  // Only the homeowner gets a composer here; company staff use Messages.
  const homeownerThread: Thread | undefined = project
    ? findThread(state, project.id, "homeowner") ?? {
        id: "draft",
        projectId: project.id,
        subject: "homeowner",
        audience: "homeowner",
        createdAt: "",
      }
    : undefined
  const canMessageTeam =
    homeownerThread !== undefined && readerMembership(state, session, homeownerThread)?.role === "homeowner"

  return (
    <Flex vertical className="company-form-page min-h-full">
      <Flex align="center" justify="space-between" className="business-onboarding-header">
        <LogoHorizontal height={24} />
        <Button icon={<ArrowLeftOutlined />} onClick={() => onNavigate("dashboard-home")}>
          Dashboard
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

            <DayTimeline
              updates={published}
              audience="homeowner"
              noteMeta={(note) => {
                const update = published.find((item) => item.id === note.progressId)
                return update ? (
                  <Text type="secondary" className="text-[12px]!">{getWorkTypeName(state, update.workTypeId)}</Text>
                ) : null
              }}
            />

            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Latest photos from site
                </Title>
              }
            >
              <EvidenceGrid items={evidence} audience="homeowner" empty="No photos were shared with this update." />
            </Card>
          </>
        ) : (
          <Card>
            <Paragraph className="m-0!">
              Nothing has been published for you yet. Your contractor’s update appears here after it is reviewed.
            </Paragraph>
          </Card>
        )}

        {project && canMessageTeam && (
          <Card title="Message your project team">
            <ThreadPanel compact projectId={project.id} subject="homeowner" emptyText="Ask the project team anything about your home." />
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
