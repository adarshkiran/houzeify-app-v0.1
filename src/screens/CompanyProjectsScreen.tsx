import { useMemo, useState } from "react"
import {
  ArrowRightOutlined,
  HomeOutlined,
  PlusOutlined,
  ProjectOutlined,
  SearchOutlined,
} from "@ant-design/icons"
import {
  Button,
  Card,
  Flex,
  Input,
  Layout,
  Menu,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd"
import type { TableProps } from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import HIcon from "../components/HIcon"
import LogoHorizontal from "../components/LogoHorizontal"
import type { Project, ProjectStatus } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { useOrganizationId } from "../session/SessionProvider"
import { useScopedData } from "../session/useScopedData"
import {
  getOpenIssues,
  getOpenTasks,
  getOrganizationProjects,
  getStageName,
} from "../mock/selectors"

const { Content, Header, Sider } = Layout
const { Text, Title } = Typography

function statusColor(status: ProjectStatus) {
  if (status === "active") return "success"
  if (status === "planning") return "processing"
  if (status === "on-hold") return "warning"
  if (status === "completed") return "default"
  return "default"
}

function CompanyProjects({ onNavigate }: { onNavigate: Navigate }) {
  const { state } = useConstructionData()
  const scoped = useScopedData() // counts follow the viewer's scope
  const organizationId = useOrganizationId()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<ProjectStatus | "all">("all")
  const projects = getOrganizationProjects(state, organizationId)

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const matchesSearch = `${project.name} ${project.code} ${project.location}`
          .toLowerCase()
          .includes(search.toLowerCase())
        return matchesSearch && (status === "all" || project.status === status)
      }),
    [projects, search, status],
  )

  const columns: TableProps<Project>["columns"] = [
    {
      title: "Project",
      key: "project",
      render: (_, project) => (
        <Flex vertical gap={2}>
          <Text strong className="company-heading">
            {project.name}
          </Text>
          <Text type="secondary">{project.code} · {project.location}</Text>
        </Flex>
      ),
    },
    {
      title: "Stage",
      key: "stage",
      responsive: ["md"],
      render: (_, project) => <Tag>{getStageName(state, project.currentStageId)}</Tag>,
    },
    {
      title: "Progress",
      key: "progress",
      width: 180,
      render: (_, project) => (
        <Flex align="center" gap="small" className="min-w-0">
          <Progress
            percent={project.progress}
            showInfo={false}
            size="small"
            className="m-0! min-w-0 flex-1"
          />
          <Text className="shrink-0 whitespace-nowrap">{project.progress}%</Text>
        </Flex>
      ),
    },
    {
      title: "Attention",
      key: "attention",
      responsive: ["lg"],
      render: (_, project) => (
        <Space>
          <Text type="secondary">{getOpenTasks(scoped, project.id).length} tasks</Text>
          <Button
            type="link"
            className="p-0!"
            danger={getOpenIssues(scoped, project.id).length > 0}
            onClick={() => onNavigate("issues", { project_id: project.id })}
          >
            {getOpenIssues(scoped, project.id).length} issues
          </Button>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (value: ProjectStatus) => <Tag color={statusColor(value)}>{value}</Tag>,
    },
    {
      key: "action",
      width: 48,
      render: (_, project) => (
        <Button
          type="text"
          aria-label={`Open ${project.name}`}
          icon={<ArrowRightOutlined />}
          onClick={() =>
            onNavigate("project-overview", {
              project_id: project.id,
              project_name: project.name,
            })
          }
        />
      ),
    },
  ]

  return (
    <Layout className="company-dashboard h-full">
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
            <span className="company-logo-mark"><HIcon size={28} /></span>
          </Flex>
          <Menu
            mode="inline"
            selectedKeys={["projects"]}
            inlineIndent={18}
            className="company-main-menu flex-1 border-0!"
            items={[
              { key: "home", icon: <HomeOutlined />, label: "Company Home" },
              { key: "projects", icon: <ProjectOutlined />, label: "Projects" },
            ]}
            onClick={({ key }) => {
              if (key === "home") onNavigate("company-dashboard")
            }}
          />
        </Flex>
      </Sider>

      <Layout>
        <Header className="company-header">
          <Flex align="center" justify="space-between" gap="middle" className="h-full">
            <Flex vertical>
              <Title level={5} className="company-heading! m-0!">Projects</Title>
              <Text type="secondary">Manage all projects in this workspace</Text>
            </Flex>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => onNavigate("company-create-project")}
            >
              New project
            </Button>
          </Flex>
        </Header>

        <Content className="overflow-y-auto">
          <Flex vertical gap="large" className="company-content">
            <Card>
              <Flex gap="middle" wrap>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Search projects"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="company-project-search"
                />
                <Select
                  value={status}
                  onChange={setStatus}
                  className="company-project-filter"
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "active", label: "Active" },
                    { value: "planning", label: "Planning" },
                    { value: "on-hold", label: "On hold" },
                    { value: "completed", label: "Completed" },
                  ]}
                />
              </Flex>
            </Card>

            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Project portfolio
                </Title>
              }
              extra={<Text type="secondary">{filteredProjects.length} projects</Text>}
              className="company-section-card"
              classNames={{ body: "company-table-card-body" }}
            >
              <Table
                rowKey="id"
                columns={columns}
                dataSource={filteredProjects}
                pagination={false}
                scroll={{ x: 840 }}
                onRow={(project) => ({
                  onDoubleClick: () =>
                    onNavigate("project-overview", { project_id: project.id }),
                })}
              />
            </Card>
          </Flex>
        </Content>
      </Layout>
    </Layout>
  )
}

export default function CompanyProjectsScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <CompanyThemeProvider>
      <CompanyProjects onNavigate={onNavigate} />
    </CompanyThemeProvider>
  )
}
