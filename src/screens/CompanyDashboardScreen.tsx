import { useState, type ReactNode } from "react"
import {
  ArrowRightOutlined,
  BarChartOutlined,
  BellOutlined,
  CameraOutlined,
  CheckSquareOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  HomeOutlined,
  LineChartOutlined,
  MenuOutlined,
  PlusOutlined,
  ProjectOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SnippetsOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons"
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Drawer,
  Flex,
  Layout,
  Listy,
  Menu,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Timeline,
  Typography,
} from "antd"
import type { MenuProps } from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import HIcon from "../components/HIcon"
import LogoHorizontal from "../components/LogoHorizontal"
import type { DailyProgress, Issue, Task } from "../domain/models"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { ACTIVE_ORGANIZATION_ID } from "../mock/seed"
import {
  type DashboardProject,
  getOrganizationDashboard,
  getProject,
  getWorkTypeName,
} from "../mock/selectors"

const { Header, Content, Sider } = Layout
const { Paragraph, Text, Title } = Typography

function buildMenuItems(
  projectCount: number,
  issueCount: number,
): MenuProps["items"] {
  return [
    { key: "home", icon: <HomeOutlined />, label: "Home" },
    {
      key: "projects",
      icon: <ProjectOutlined />,
      label: (
        <Flex align="center" justify="space-between">
          <span>Projects</span>
          <Badge count={projectCount} size="small" />
        </Flex>
      ),
    },
    { key: "library", icon: <SnippetsOutlined />, label: "Work Library" },
    { key: "progress", icon: <LineChartOutlined />, label: "Progress" },
    {
      key: "site-ops",
      icon: <SafetyCertificateOutlined />,
      label: (
        <Flex align="center" justify="space-between">
          <span>Site Operations</span>
          <Badge count={issueCount} size="small" />
        </Flex>
      ),
    },
    { key: "workforce", icon: <TeamOutlined />, label: "Workforce" },
    { key: "live-site", icon: <VideoCameraOutlined />, label: "Live Site" },
    { key: "documents", icon: <FileTextOutlined />, label: "Documents" },
    { key: "reports", icon: <BarChartOutlined />, label: "Reports" },
    { key: "team", icon: <UsergroupAddOutlined />, label: "Team" },
    { key: "hozie", icon: <RobotOutlined />, label: "Hozie AI" },
  ]
}

function getStageTone(stageName: string) {
  if (stageName === "Foundation") return "warning"
  if (stageName === "RCC Structure") return "success"
  if (stageName === "Site Preparation") return "default"
  return "processing"
}

function getDateLabel(value?: string) {
  if (!value) return "No update"
  if (value === "2026-09-20") return "Today"
  if (value === "2026-09-19") return "Yesterday"
  if (value === "2026-09-18") return "2 days ago"

  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    new Date(`${value}T00:00:00`),
  )
}

function getTaskTone(priority: Task["priority"]) {
  if (priority === "critical" || priority === "high") return "error"
  if (priority === "medium") return "warning"
  return "default"
}

function getIssueTone(severity: Issue["severity"]) {
  if (severity === "critical" || severity === "high") return "error"
  if (severity === "medium") return "warning"
  return "default"
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Title level={5} className="company-heading! m-0!">
      {children}
    </Title>
  )
}

function SectionAction({
  children,
  onClick,
}: {
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <Button type="link" size="small" onClick={onClick}>
      {children} <ArrowRightOutlined />
    </Button>
  )
}

function KpiCard({
  label,
  value,
  description,
  icon,
}: {
  label: string
  value: number
  description: string
  icon: ReactNode
}) {
  return (
    <Card className="company-kpi-card h-full" variant="outlined">
      <Flex vertical gap="middle">
        <Flex align="center" justify="space-between">
          <Text type="secondary" className="company-eyebrow">
            {label}
          </Text>
          <Avatar className="company-kpi-icon" icon={icon} shape="square" />
        </Flex>
        <Statistic value={value} classNames={{ content: "company-heading" }} />
        <Text type="secondary">{description}</Text>
      </Flex>
    </Card>
  )
}

function ProjectRow({
  item,
  onNavigate,
}: {
  item: DashboardProject
  onNavigate: () => void
}) {
  const { project } = item

  return (
    <Button type="text" block className="company-project-row" onClick={onNavigate}>
      <Avatar shape="square" size={40} className="company-project-avatar">
        {project.name.charAt(0)}
      </Avatar>
      <Flex vertical gap={4} className="min-w-0 flex-1">
        <Flex align="center" gap="small" wrap>
          <Text strong className="company-heading truncate">
            {project.name}
          </Text>
          <Tag color={getStageTone(item.stageName)}>{item.stageName}</Tag>
        </Flex>
        <Flex align="center" gap="small">
          <Progress percent={project.progress} showInfo={false} size="small" />
          <Text type="secondary" className="shrink-0 whitespace-nowrap">
            {project.progress}%
          </Text>
        </Flex>
        <Text type="secondary" ellipsis>
          {project.location} · {item.workforceCount} workers ·{" "}
          {getDateLabel(item.lastProgress?.date)}
        </Text>
      </Flex>
      <Space className="company-project-stats">
        <Text type="secondary">
          <CheckSquareOutlined /> {item.openTaskCount}
        </Text>
        {item.openIssueCount > 0 && (
          <Text type="danger">
            <ExclamationCircleOutlined /> {item.openIssueCount}
          </Text>
        )}
        <ArrowRightOutlined />
      </Space>
    </Button>
  )
}

function CompanyDashboard({
  onNavigate,
}: {
  onNavigate: (screen: string, data?: Record<string, string>) => void
}) {
  const { state } = useConstructionData()
  const dashboard = getOrganizationDashboard(state, ACTIVE_ORGANIZATION_ID)
  const navItems = buildMenuItems(
    dashboard.projects.length,
    dashboard.openIssues.length,
  )
  const visibleTasks = dashboard.openTasks.slice(0, 3)
  const visibleIssues = dashboard.openIssues.slice(0, 3)
  const visibleProgress = dashboard.recentProgress.slice(0, 3)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const handleNavigation = (key: string) => {
    setMobileNavOpen(false)
    if (key === "home") onNavigate("company-dashboard")
    if (key === "projects") onNavigate("company-projects")
    if (key === "library") onNavigate("work-library")
    if (key === "progress") onNavigate("daily-progress-review", { project_id: "" })
  }

  return (
    <Layout className="company-dashboard h-full">
      <Drawer
        title={<LogoHorizontal height={24} />}
        placement="left"
        size={300}
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        classNames={{ body: "company-mobile-nav-body" }}
      >
        <Menu
          mode="inline"
          selectedKeys={["home"]}
          items={navItems}
          onClick={({ key }) => handleNavigation(key)}
        />
        <Divider />
        <Menu
          mode="inline"
          selectable={false}
          items={[{ key: "settings", icon: <SettingOutlined />, label: "Settings" }]}
        />
      </Drawer>

      <Sider
        breakpoint="lg"
        collapsedWidth={72}
        width={240}
        theme="light"
        trigger={null}
        className="hidden md:block company-sider"
      >
        <Flex vertical className="h-full">
          <Flex align="center" className="company-logo">
            <LogoHorizontal height={24} className="company-logo-full" />
            <span className="company-logo-mark">
              <HIcon size={28} />
            </span>
          </Flex>
          <Menu
            mode="inline"
            selectedKeys={["home"]}
            items={navItems}
            inlineIndent={18}
            className="company-main-menu flex-1 border-0!"
            onClick={({ key }) => handleNavigation(key)}
          />
          <Menu
            mode="inline"
            selectable={false}
            items={[{ key: "settings", icon: <SettingOutlined />, label: "Settings" }]}
            className="company-settings-menu"
          />
        </Flex>
      </Sider>

      <Layout>
        <Header className="company-header">
          <Flex align="center" justify="space-between" gap="middle" className="h-full">
            <Flex align="center" gap="middle" className="min-w-0">
              <Button
                aria-label="Open navigation"
                icon={<MenuOutlined />}
                className="md:hidden!"
                onClick={() => setMobileNavOpen(true)}
              />
              <Flex vertical className="min-w-0">
                <Title level={5} ellipsis className="company-heading! m-0!">
                  Good morning, Arjun
                </Title>
                <Text type="secondary" ellipsis>
                  Saturday, 20 September 2026 · Hyderabad
                </Text>
              </Flex>
            </Flex>
            <Space size="middle">
              <Button type="primary" icon={<PlusOutlined />}>
                <span className="hidden sm:inline">Add Progress</span>
              </Button>
              <Badge dot>
                <Button aria-label="Notifications" icon={<BellOutlined />} />
              </Badge>
              <Divider orientation="vertical" className="hidden sm:inline-block!" />
              <Avatar className="company-user-avatar">A</Avatar>
            </Space>
          </Flex>
        </Header>

        <Content className="overflow-y-auto">
          <Flex vertical gap="large" className="company-content">
            <Row gutter={[16, 16]}>
              <Col xs={12} lg={6}>
                <KpiCard
                  label="Active Projects"
                  value={dashboard.activeProjectCount}
                  description="Across this workspace"
                  icon={<ProjectOutlined />}
                />
              </Col>
              <Col xs={12} lg={6}>
                <KpiCard
                  label="Open Tasks"
                  value={dashboard.openTasks.length}
                  description="Work requiring attention"
                  icon={<CheckSquareOutlined />}
                />
              </Col>
              <Col xs={12} lg={6}>
                <KpiCard
                  label="Open Issues"
                  value={dashboard.openIssues.length}
                  description={`${dashboard.openIssues.filter((issue) => issue.severity === "high" || issue.severity === "critical").length} high severity`}
                  icon={<ExclamationCircleOutlined />}
                />
              </Col>
              <Col xs={12} lg={6}>
                <KpiCard
                  label="Site Workforce"
                  value={dashboard.workforceCount}
                  description="Across all projects"
                  icon={<TeamOutlined />}
                />
              </Col>
            </Row>

            <Row gutter={[24, 24]} align="top">
              <Col xs={24} xl={14}>
                <Flex vertical gap="large">
                  <Card
                    title={<SectionTitle>Active Projects</SectionTitle>}
                    extra={
                      <SectionAction onClick={() => onNavigate("company-projects")}>
                        View all
                      </SectionAction>
                    }
                    className="company-section-card"
                    classNames={{ body: "company-list-card-body" }}
                  >
                    <Flex vertical>
                      {dashboard.projects.map((item) => (
                        <ProjectRow
                          key={item.project.id}
                          item={item}
                          onNavigate={() =>
                            onNavigate("project-overview", {
                              project_id: item.project.id,
                              project_name: item.project.name,
                            })
                          }
                        />
                      ))}
                    </Flex>
                  </Card>

                  <Card
                    title={<SectionTitle>Recent Site Progress</SectionTitle>}
                    extra={
                      <SectionAction onClick={() => onNavigate("daily-progress-review", { project_id: "" })}>
                        Review
                      </SectionAction>
                    }
                    className="company-section-card"
                  >
                    <Timeline
                      items={visibleProgress.map((entry: DailyProgress) => {
                        const project = getProject(state, entry.projectId)
                        const workTypeName = getWorkTypeName(state, entry.workTypeId)

                        return {
                          content: (
                            <Flex vertical gap={4}>
                              <Space wrap>
                                <Text type="secondary">{getDateLabel(entry.date)}</Text>
                                <Tag>{project?.name ?? "Project"}</Tag>
                              </Space>
                              <Text strong className="company-heading">
                                {workTypeName}
                              </Text>
                              <Paragraph
                                type="secondary"
                                ellipsis={{ rows: 2 }}
                                className="m-0!"
                              >
                                {entry.todaySummary}
                              </Paragraph>
                              <Space>
                                <Text type="secondary">
                                  <CameraOutlined /> {entry.evidenceIds.length} evidence
                                </Text>
                                <Text type="secondary">
                                  <TeamOutlined /> {entry.workersPresent} workers
                                </Text>
                              </Space>
                            </Flex>
                          ),
                        }
                      })}
                    />
                  </Card>
                </Flex>
              </Col>

              <Col xs={24} xl={10}>
                <Flex vertical gap="large">
                  <Card
                    title={<SectionTitle>Open Tasks ({dashboard.openTasks.length})</SectionTitle>}
                    extra={<SectionAction>View all</SectionAction>}
                    className="company-section-card"
                    classNames={{ body: "company-list-card-body" }}
                  >
                    <Listy
                      items={visibleTasks}
                      rowKey="id"
                      classNames={{ item: "company-listy-item" }}
                      itemRender={(task) => (
                        <Flex align="flex-start" gap="middle">
                          <Checkbox aria-label={`Complete ${task.title}`} />
                          <Flex vertical gap={4} className="company-list-stack">
                            <Button
                              type="link"
                              className="company-task-link"
                              onClick={() =>
                                onNavigate("task-detail", {
                                  project_id: task.projectId,
                                  task_id: task.id,
                                })
                              }
                            >
                              {task.title}
                            </Button>
                            <Space size={8} wrap>
                              <Tag color={getTaskTone(task.priority)}>{task.priority}</Tag>
                              <Text type="secondary">Due {getDateLabel(task.dueDate)}</Text>
                            </Space>
                          </Flex>
                        </Flex>
                      )}
                    />
                    <Button
                      block
                      variant="dashed"
                      icon={<PlusOutlined />}
                      className="company-add-action"
                    >
                      Add task
                    </Button>
                  </Card>

                  <Card
                    title={<SectionTitle>Open Issues ({dashboard.openIssues.length})</SectionTitle>}
                    extra={<SectionAction>View all</SectionAction>}
                    className="company-section-card"
                    classNames={{ body: "company-list-card-body" }}
                  >
                    <Listy
                      items={visibleIssues}
                      rowKey="id"
                      classNames={{ item: "company-listy-item" }}
                      itemRender={(issue) => (
                        <Flex align="flex-start" gap="middle">
                          <Avatar
                            shape="square"
                            className="company-issue-icon"
                            icon={<ExclamationCircleOutlined />}
                          />
                          <Flex vertical gap={4} className="company-list-stack">
                            <Text>{issue.title}</Text>
                            <Space size={8} wrap>
                              <Tag color={getIssueTone(issue.severity)}>{issue.severity}</Tag>
                              <Text type="secondary">
                                {getProject(state, issue.projectId)?.name ?? "Project"} ·{" "}
                                {getDateLabel(issue.createdAt.slice(0, 10))}
                              </Text>
                            </Space>
                          </Flex>
                        </Flex>
                      )}
                    />
                  </Card>

                  <Card className="company-hozie-card" variant="borderless">
                    <Flex vertical gap="middle">
                      <Flex align="center" gap="small">
                        <Avatar className="company-hozie-icon" shape="square">
                          <HIcon size={18} />
                        </Avatar>
                        <Text className="company-eyebrow">Hozie Summary</Text>
                      </Flex>
                      <Paragraph className="m-0!">
                        Tech Park Block C is ahead of schedule. Sharma Residence has one
                        open issue requiring your attention today. Reddy Villa&apos;s
                        plinth beam milestone has been completed.
                      </Paragraph>
                      <Button type="link" className="company-inline-link">
                        Ask Hozie <ArrowRightOutlined />
                      </Button>
                    </Flex>
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

export default function CompanyDashboardScreen({
  onNavigate,
}: {
  onNavigate: (screen: string, data?: Record<string, string>) => void
}) {
  return (
    <CompanyThemeProvider>
      <CompanyDashboard onNavigate={onNavigate} />
    </CompanyThemeProvider>
  )
}
