import {
  CalendarOutlined,
  CheckSquareOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  ProjectOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from "@ant-design/icons"
import DayTimeline from "../components/progress/DayTimeline"
import {
  Avatar,
  Button,
  Card,
  Col,
  Flex,
  Listy,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import { reviewStatusLabel } from "../components/progress/progressLabels"
import type { EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getOpenIssues,
  getOpenTasks,
  getProject,
  getProjectMemberships,
  getProjectUnits,
  getRecentProgress,
  getStageName,
  getTradeName,
  getWorkTypeName,
} from "../mock/selectors"
import { useScopedData } from "../session/useScopedData"

const { Paragraph, Text, Title } = Typography

function formatDate(value?: string) {
  if (!value) return "Not set"
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`))
}

function ProjectOverview({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  const { state } = useConstructionData()
  const scoped = useScopedData() // counts and lists follow the viewer's scope
  const project = getProject(state, projectId)

  if (!project) {
    return (
      <Flex align="center" justify="center" className="project-overview-empty">
        <Card>
          <Flex vertical align="center" gap="middle">
            <ProjectOutlined className="project-overview-empty-icon" />
            <Title level={3} className="company-heading! m-0!">
              Project not found
            </Title>
            <Text type="secondary">
              The selected project is not available in the current workspace.
            </Text>
            <Button type="primary" onClick={() => onNavigate("company-dashboard")}>
              Return to dashboard
            </Button>
          </Flex>
        </Card>
      </Flex>
    )
  }

  const openTasks = getOpenTasks(scoped, project.id)
  const openIssues = getOpenIssues(scoped, project.id)
  const progressRecords = getRecentProgress(scoped, project.id)
  // Replaced or rejected versions don't describe the day any more.
  const liveProgress = progressRecords.filter(
    (item) => item.reviewStatus !== "superseded" && item.reviewStatus !== "rejected",
  )
  const projectTasks = scoped.tasks.filter((task) => task.projectId === project.id)
  const units = getProjectUnits(scoped, project.id)
  const memberships = getProjectMemberships(scoped, project.id)
  const stageName = getStageName(state, project.currentStageId)

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "overview" }}
      onNavigate={onNavigate}
      className="project-overview"
      header={
        <Flex align="center" justify="space-between" gap="middle" className="h-full">
          <Flex vertical className="min-w-0">
            <Title level={5} ellipsis className="company-heading! m-0!">
              {project.name}
            </Title>
            <Text type="secondary" ellipsis>
              {project.code} · {project.location}
            </Text>
          </Flex>
          <Tag color={project.status === "active" ? "success" : "processing"}>
            {project.status}
          </Tag>
        </Flex>
      }
    >
      <Flex vertical gap="large" className="company-content">
        <Card className="project-overview-hero">
          <Row gutter={[24, 24]} align="middle">
            <Col xs={24} lg={16}>
              <Flex vertical gap="middle">
                <Flex align="center" gap="small" wrap>
                  <Tag color="processing">{stageName}</Tag>
                  <Text type="secondary">
                    <EnvironmentOutlined /> {project.location}
                  </Text>
                </Flex>
                <Title level={2} className="company-heading! m-0!">
                  {project.name}
                </Title>
                <Text type="secondary">
                  Current project record across work, people, progress, evidence, and
                  customer updates.
                </Text>
                <Space wrap>
                  <Text type="secondary">
                    <CalendarOutlined /> Started {formatDate(project.startDate)}
                  </Text>
                  <Text type="secondary">
                    Target {formatDate(project.targetDate)}
                  </Text>
                </Space>
              </Flex>
            </Col>
            <Col xs={24} lg={8}>
              <Flex vertical gap="small">
                <Flex align="baseline" justify="space-between">
                  <Text strong>Overall progress</Text>
                  <Title level={2} className="company-heading! m-0!">
                    {project.progress}%
                  </Title>
                </Flex>
                <Progress percent={project.progress} showInfo={false} />
                <Text type="secondary">Currently in {stageName}</Text>
              </Flex>
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="Open tasks" value={openTasks.length} prefix={<CheckSquareOutlined />} />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="Open issues" value={openIssues.length} prefix={<ExclamationCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="Locations" value={units.length} prefix={<ProjectOutlined />} />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="Project team" value={memberships.length} prefix={<TeamOutlined />} />
            </Card>
          </Col>
        </Row>

        <Card
          title={<Title level={5} className="company-heading! m-0!">Daily progress</Title>}
          extra={
            <Button size="small" onClick={() => onNavigate("daily-progress-submit", { project_id: projectId })}>
              Log today’s progress
            </Button>
          }
        >
          <DayTimeline
            updates={liveProgress}
            audience="company"
            tasks={projectTasks}
            noteMeta={(note) => {
              const update = liveProgress.find((item) => item.id === note.progressId)
              if (!update) return null
              const status = reviewStatusLabel[update.reviewStatus]
              return (
                <Space size={6} wrap>
                  <Text type="secondary" className="text-[12px]!">{getWorkTypeName(state, update.workTypeId)}</Text>
                  <Tag color={status.color} className="m-0!">{status.text}</Tag>
                </Space>
              )
            }}
          />
        </Card>

        <Row gutter={[24, 24]} align="top">
          <Col xs={24} xl={14}>
            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Work requiring attention
                </Title>
              }
            >
              <Listy
                items={openTasks.slice(0, 6)}
                rowKey="id"
                classNames={{ item: "company-listy-item" }}
                itemRender={(task) => (
                  <Flex align="center" justify="space-between" gap="middle">
                    <Flex vertical gap={4} className="company-list-stack">
                      <Text strong>{task.title}</Text>
                      <Space size={8} wrap>
                        <Tag>{getTradeName(state, task.tradeId)}</Tag>
                        <Text type="secondary">Due {formatDate(task.dueDate)}</Text>
                      </Space>
                    </Flex>
                    <Tag color={task.status === "blocked" ? "error" : "processing"}>
                      {task.status}
                    </Tag>
                  </Flex>
                )}
              />
            </Card>
          </Col>

          <Col xs={24} xl={10}>
            <Flex vertical gap="large">
              <Card
                title={
                  <Title level={5} className="company-heading! m-0!">
                    Project structure
                  </Title>
                }
              >
                <Listy
                  items={units}
                  rowKey="id"
                  classNames={{ item: "company-listy-item" }}
                  itemRender={(unit) => (
                    <Flex align="center" justify="space-between" gap="middle">
                      <Flex align="center" gap="small" className="company-list-stack">
                        <Avatar shape="square" icon={<SafetyCertificateOutlined />} />
                        <Flex vertical gap={2} className="min-w-0">
                          <Text strong>{unit.name}</Text>
                          <Text type="secondary">{unit.kind}</Text>
                        </Flex>
                      </Flex>
                      <Tag>{unit.status}</Tag>
                    </Flex>
                  )}
                />
              </Card>

              <Card
                title={
                  <Title level={5} className="company-heading! m-0!">
                    Open issues
                  </Title>
                }
                extra={
                  <Button
                    type="link"
                    onClick={() => onNavigate("issues", { project_id: projectId })}
                  >
                    View all
                  </Button>
                }
              >
                {openIssues.length ? (
                  <Listy
                    items={openIssues}
                    rowKey="id"
                    classNames={{ item: "company-listy-item" }}
                    itemRender={(issue) => (
                      <Flex vertical gap={4} className="company-list-stack">
                        <Button
                          type="link"
                          className="p-0! h-auto! justify-start!"
                          onClick={() =>
                            onNavigate("issue-detail", {
                              project_id: projectId,
                              issue_id: issue.id,
                            })
                          }
                        >
                          {issue.title}
                        </Button>
                        <Space size={8} wrap>
                          <Tag color={issue.severity === "high" ? "error" : "warning"}>
                            {issue.severity}
                          </Tag>
                          <Text type="secondary">{issue.status}</Text>
                        </Space>
                      </Flex>
                    )}
                  />
                ) : (
                  <Paragraph type="secondary" className="m-0!">
                    No open issues for this project.
                  </Paragraph>
                )}
              </Card>
            </Flex>
          </Col>
        </Row>
      </Flex>
    </CompanyLayout>
  )
}

export default function ProjectOverviewScreen({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  return (
    <CompanyThemeProvider>
      <ProjectOverview onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
