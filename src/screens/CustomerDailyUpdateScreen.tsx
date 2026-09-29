import { useState } from "react"
import { ArrowLeftOutlined, FileTextOutlined } from "@ant-design/icons"
import { Button, Card, Flex, List, Progress, Tag, Typography } from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import DocumentViewerModal from "../components/documents/DocumentViewerModal"
import LogoHorizontal from "../components/LogoHorizontal"
import ThreadPanel from "../components/conversations/ThreadPanel"
import DayTimeline from "../components/progress/DayTimeline"
import EvidenceGrid from "../components/progress/EvidenceGrid"
import { findThread, readerMembership } from "../domain/conversations"
import type { Document, EntityId, Issue, Thread } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getProject,
  getPublishedDocuments,
  getPublishedEvidence,
  getPublishedForCustomer,
  getPublishedIssues,
  getStageName,
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
  const [openDocument, setOpenDocument] = useState<Document>()
  const publishedIssues = project ? getPublishedIssues(state, project.id) : []
  const publishedDocuments = project ? getPublishedDocuments(state, project.id) : []
  const stageName = project?.currentStageId ? getStageName(state, project.currentStageId) : undefined

  const issueStatusWord = (status: Issue["status"]) =>
    status === "resolved" || status === "closed" ? "Fixed" : "Being looked into"
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
          {stageName && (
            <Text>
              Current stage: <Text strong>{stageName}</Text>
            </Text>
          )}
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

            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Issues
                </Title>
              }
            >
              {publishedIssues.length ? (
                <List
                  dataSource={publishedIssues}
                  renderItem={(issue) => (
                    <List.Item>
                      <Flex vertical gap={2} className="w-full">
                        <Flex align="center" justify="space-between" gap="small">
                          <Text strong>{issue.title}</Text>
                          <Tag color={issueStatusWord(issue.status) === "Fixed" ? "success" : "warning"}>
                            {issueStatusWord(issue.status)}
                          </Tag>
                        </Flex>
                        <Text type="secondary" className="text-[12px]!">
                          {(issue.status === "resolved" || issue.status === "closed"
                            ? issue.resolvedAt ?? issue.createdAt
                            : issue.createdAt
                          ).slice(0, 10)}
                        </Text>
                      </Flex>
                    </List.Item>
                  )}
                />
              ) : (
                <Paragraph className="m-0!" type="secondary">
                  No issues have been shared for this project yet.
                </Paragraph>
              )}
            </Card>

            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Documents
                </Title>
              }
            >
              {publishedDocuments.length ? (
                <List
                  dataSource={publishedDocuments}
                  renderItem={(document) => (
                    <List.Item>
                      <Button type="link" className="p-0! h-auto!" icon={<FileTextOutlined />} onClick={() => setOpenDocument(document)}>
                        {document.title}
                      </Button>
                      <Text type="secondary" className="text-[12px]!">{document.createdAt.slice(0, 10)}</Text>
                    </List.Item>
                  )}
                />
              ) : (
                <Paragraph className="m-0!" type="secondary">
                  No documents have been shared for this project yet.
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

        {project && canMessageTeam && (
          <Card title="Message your project team">
            <ThreadPanel compact projectId={project.id} subject="homeowner" emptyText="Ask the project team anything about your home." />
          </Card>
        )}

        <DocumentViewerModal document={openDocument} onClose={() => setOpenDocument(undefined)} />
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
