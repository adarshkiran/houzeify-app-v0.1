import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  HomeOutlined,
  LineChartOutlined,
  ProjectOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from "@ant-design/icons"
import {
  Avatar,
  Button,
  Card,
  Col,
  Flex,
  Layout,
  Listy,
  Menu,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import HIcon from "../components/HIcon"
import LogoHorizontal from "../components/LogoHorizontal"
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
} from "../mock/selectors"

const { Content, Header, Sider } = Layout
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

  const openTasks = getOpenTasks(state, project.id)
  const openIssues = getOpenIssues(state, project.id)
  const progressRecords = getRecentProgress(state, project.id)
  const latestProgress = progressRecords[0]
  const units = getProjectUnits(state, project.id)
  const memberships = getProjectMemberships(state, project.id)
  const stageName = getStageName(state, project.currentStageId)

  return (
    <Layout className="project-overview company-dashboard h-full">
      <Sider
        breakpoint="lg"
        collapsedWidth={72}
        width={240}
        theme="light"
        trigger={null}
        className="hidden md:block company-sider"
      >
        <Flex vertical className="h-full">
          <Flex align="center" justify="center" className="company-logo">
            <LogoHorizontal height={24} className="company-logo-full" />
            <span className="company-logo-mark">
              <HIcon size={28} />
            </span>
          </Flex>
          <Menu
            mode="inline"
            selectedKeys={["overview"]}
            items={[
              { key: "home", icon: <HomeOutlined />, label: "Company Home" },
              { key: "overview", icon: <ProjectOutlined />, label: "Project Overview" },
              { key: "structure", icon: <SafetyCertificateOutlined />, label: "Structure" },
              { key: "work-plan", icon: <LineChartOutlined />, label: "Work Plan" },
              { key: "progress", icon: <LineChartOutlined />, label: "Progress" },
              { key: "tasks", icon: <CheckSquareOutlined />, label: "Tasks" },
              { key: "issues", icon: <ExclamationCircleOutlined />, label: "Issues" },
              { key: "team", icon: <TeamOutlined />, label: "Project Team" },
              { key: "documents", icon: <FileTextOutlined />, label: "Documents" },
            ]}
            inlineIndent={18}
            className="company-main-menu flex-1 border-0!"
            onClick={({ key }) => {
              if (key === "home") onNavigate("company-dashboard")
              if (key === "structure") {
                onNavigate("project-structure", { project_id: projectId })
              }
              if (key === "team") {
                onNavigate("project-team", { project_id: projectId })
              }
              if (key === "work-plan") {
                onNavigate("work-plan", { project_id: projectId })
              }
              if (key === "tasks") {
                onNavigate("tasks", { project_id: projectId })
              }
              if (key === "progress") {
                onNavigate("daily-progress-review", { project_id: projectId })
              }
            }}
          />
        </Flex>
      </Sider>

      <Layout>
        <Header className="company-header">
          <Flex align="center" justify="space-between" gap="middle" className="h-full">
            <Flex align="center" gap="middle" className="min-w-0">
              <Button
                aria-label="Back to company dashboard"
                icon={<ArrowLeftOutlined />}
                onClick={() => onNavigate("company-dashboard")}
              />
              <Flex vertical className="min-w-0">
                <Title level={5} ellipsis className="company-heading! m-0!">
                  {project.name}
                </Title>
                <Text type="secondary" ellipsis>
                  {project.code} · {project.location}
                </Text>
              </Flex>
            </Flex>
            <Tag color={project.status === "active" ? "success" : "processing"}>
              {project.status}
            </Tag>
          </Flex>
        </Header>

        <Content className="overflow-y-auto">
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
              title={
                <Title level={5} className="company-heading! m-0!">
                  Yesterday · Today · Tomorrow
                </Title>
              }
              extra={
                <Space wrap>
                  <Button
                    size="small"
                    type="primary"
                    onClick={() =>
                      onNavigate("daily-progress-submit", { project_id: projectId })
                    }
                  >
                    Log today&apos;s progress
                  </Button>
                  <Button
                    size="small"
                    onClick={() =>
                      onNavigate("daily-progress-review", { project_id: projectId })
                    }
                  >
                    Review queue
                  </Button>
                  {latestProgress && (
                    <Tag color={latestProgress.reviewStatus === "approved" ? "success" : "warning"}>
                      {latestProgress.reviewStatus}
                    </Tag>
                  )}
                </Space>
              }
            >
              <Row gutter={[20, 20]}>
                <Col xs={24} md={8}>
                  <Card size="small" className="project-narrative-card">
                    <Flex vertical gap="small">
                      <Text className="company-eyebrow">Yesterday</Text>
                      <Text>
                        {latestProgress?.yesterdaySummary ??
                          "Previous work is available in the project timeline."}
                      </Text>
                    </Flex>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" className="project-narrative-card project-narrative-today">
                    <Flex vertical gap="small">
                      <Text className="company-eyebrow">Today</Text>
                      <Text>
                        {latestProgress?.todaySummary ??
                          "No progress update has been submitted today."}
                      </Text>
                    </Flex>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" className="project-narrative-card">
                    <Flex vertical gap="small">
                      <Text className="company-eyebrow">Tomorrow</Text>
                      <Text>
                        {latestProgress?.tomorrowPlan ??
                          "The next-day work plan has not been submitted."}
                      </Text>
                    </Flex>
                  </Card>
                </Col>
              </Row>
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
                        <Flex vertical gap={4} className="min-w-0">
                          <Text strong>{task.title}</Text>
                          <Space wrap>
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
                        <Flex align="center" justify="space-between">
                          <Flex align="center" gap="small">
                            <Avatar shape="square" icon={<SafetyCertificateOutlined />} />
                            <Flex vertical>
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
                  >
                    {openIssues.length ? (
                      <Listy
                        items={openIssues}
                        rowKey="id"
                        classNames={{ item: "company-listy-item" }}
                        itemRender={(issue) => (
                          <Flex vertical gap="small">
                            <Text strong>{issue.title}</Text>
                            <Space>
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
        </Content>
      </Layout>
    </Layout>
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
