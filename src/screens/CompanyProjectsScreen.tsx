import { useMemo, useState } from "react"
import { clickableRow, stopRowClick } from "../components/company/clickableRow"
import { countLabel } from "../components/countLabel"
import {
  ArrowRightOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons"
import {
  Button,
  Card,
  Flex,
  Input,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd"
import type { TableProps } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
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
      responsive: ["sm"],
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
          <Text type="secondary">{countLabel(getOpenTasks(scoped, project.id).length, "task")}</Text>
          <Button
            type="link"
            className="p-0!"
            danger={getOpenIssues(scoped, project.id).length > 0}
            onClick={(event) => {
              stopRowClick(event)
              onNavigate("issues", { project_id: project.id })
            }}
          >
            {countLabel(getOpenIssues(scoped, project.id).length, "issue")}
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
      // The whole row opens the project; the arrow is just the hint.
      render: () => <ArrowRightOutlined aria-hidden className="clickable-row-arrow" />,
    },
  ]

  return (
    <CompanyLayout
      nav={{ menu: "company", active: "projects" }}
      onNavigate={onNavigate}
      header={
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
      }
    >
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
          extra={<Text type="secondary">{countLabel(filteredProjects.length, "project")}</Text>}
          className="company-section-card"
          classNames={{ body: "company-table-card-body" }}
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredProjects}
            pagination={false}
            onRow={(project) =>
              clickableRow(
                () => onNavigate("project-overview", { project_id: project.id, project_name: project.name }),
                `Open ${project.name}`,
              )
            }
          />
        </Card>
      </Flex>
    </CompanyLayout>
  )
}

export default function CompanyProjectsScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <CompanyThemeProvider>
      <CompanyProjects onNavigate={onNavigate} />
    </CompanyThemeProvider>
  )
}
