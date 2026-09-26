import { useMemo, useState } from "react"
import {
  HomeOutlined,
  PlusOutlined,
  ProjectOutlined,
  SearchOutlined,
  SnippetsOutlined,
  TeamOutlined,
} from "@ant-design/icons"
import {
  Avatar,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
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
import type {
  EntityId,
  Worker,
  WorkerProjectAssignment,
} from "../domain/models"
import type { Navigate } from "../domain/navigation"
import {
  getActiveAssignmentsForWorker,
  getOrganizationWorkers,
  workerMatchesProject,
} from "../domain/workforce"
import Gated from "../components/Gated"
import { Permissions } from "../domain/permissions"
import { useAccess } from "../session/useCan"
import { useCommand } from "../session/useCommand"
import {
  useConstructionData,
  type AddWorkerInput,
} from "../mock/ConstructionDataProvider"
import { ACTIVE_ORGANIZATION_ID } from "../mock/seed"
import {
  getOrganizationProjects,
  getProjectUnits,
  getTradeName,
} from "../mock/selectors"

const { Content, Header, Sider } = Layout
const { Paragraph, Text, Title } = Typography

interface AddWorkerFormValues {
  name: string
  phone?: string
  tradeIds: EntityId[]
  preferredLanguage: string
  projectId?: EntityId
  projectUnitIds?: EntityId[]
  role: WorkerProjectAssignment["role"]
}

interface AssignFormValues {
  workerId: EntityId
  projectId: EntityId
  projectUnitIds?: EntityId[]
  tradeIds: EntityId[]
  role: WorkerProjectAssignment["role"]
}

function Workforce({ onNavigate }: { onNavigate: Navigate }) {
  const { state, addWorker, assignWorkerToProject } = useConstructionData()
  const run = useCommand()
  const can = useAccess()
  const [search, setSearch] = useState("")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [tradeFilter, setTradeFilter] = useState<string>("all")
  const [assignmentFilter, setAssignmentFilter] = useState<
    "all" | "assigned" | "unassigned"
  >("all")
  const [addOpen, setAddOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [addForm] = Form.useForm<AddWorkerFormValues>()
  const [assignForm] = Form.useForm<AssignFormValues>()
  const addProjectId = Form.useWatch("projectId", addForm)
  const assignProjectId = Form.useWatch("projectId", assignForm)

  const projects = getOrganizationProjects(state, ACTIVE_ORGANIZATION_ID)
  // Only projects where the person may manage workforce can be chosen in dialogs.
  const manageableProjects = projects.filter((project) =>
    can(Permissions.WORKFORCE_MANAGE, project.id),
  )
  const workers = getOrganizationWorkers(state, ACTIVE_ORGANIZATION_ID)

  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      const haystack = `${worker.name} ${worker.phone ?? ""}`.toLowerCase()
      if (search && !haystack.includes(search.toLowerCase())) return false
      if (
        tradeFilter !== "all" &&
        !worker.tradeIds.includes(tradeFilter)
      ) {
        return false
      }
      const assigned = getActiveAssignmentsForWorker(state, worker.id).length > 0
      if (assignmentFilter === "assigned" && !assigned) return false
      if (assignmentFilter === "unassigned" && assigned) return false
      if (
        projectFilter !== "all" &&
        !workerMatchesProject(state, worker.id, projectFilter)
      ) {
        return false
      }
      return true
    })
  }, [workers, search, tradeFilter, assignmentFilter, projectFilter, state])

  const openAdd = () => {
    addForm.setFieldsValue({
      preferredLanguage: "en",
      role: "worker",
      tradeIds: undefined,
      projectId: undefined,
      projectUnitIds: undefined,
      name: undefined,
      phone: undefined,
    })
    setAddOpen(true)
  }

  const openAssign = (worker?: Worker) => {
    assignForm.setFieldsValue({
      workerId: worker?.id,
      tradeIds: worker?.tradeIds,
      role: "worker",
      projectId: undefined,
      projectUnitIds: undefined,
    })
    setAssignOpen(true)
  }

  const handleAdd = (values: AddWorkerFormValues) => {
    const input: AddWorkerInput = {
      organizationId: ACTIVE_ORGANIZATION_ID,
      name: values.name,
      phone: values.phone,
      tradeIds: values.tradeIds,
      preferredLanguage: values.preferredLanguage,
      onboardingMethod: "manual",
      projectId: values.projectId,
      projectUnitIds: values.projectUnitIds,
      role: values.role,
    }
    const outcome = run(() => addWorker(input), {
      success: `${values.name} added`,
    })
    if (!outcome.ok) return
    setAddOpen(false)
    addForm.resetFields()
  }

  const handleAssign = (values: AssignFormValues) => {
    const outcome = run(
      () =>
        assignWorkerToProject({
          workerId: values.workerId,
          projectId: values.projectId,
          projectUnitIds: values.projectUnitIds,
          tradeIds: values.tradeIds,
          role: values.role,
        }),
      { success: "Worker assigned" },
    )
    if (!outcome.ok) return
    setAssignOpen(false)
    assignForm.resetFields()
  }

  const columns: TableProps<Worker>["columns"] = [
    {
      title: "Worker",
      key: "worker",
      render: (_, worker) => (
        <Flex align="center" gap="small" className="min-w-0">
          <Avatar>{worker.name.charAt(0)}</Avatar>
          <Flex vertical gap={2} className="min-w-0">
            <Text strong className="company-heading">
              {worker.name}
            </Text>
            <Text type="secondary">{worker.phone ?? "No phone"}</Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: "Trades",
      key: "trades",
      responsive: ["md"],
      render: (_, worker) => (
        <Space size={[4, 4]} wrap>
          {worker.tradeIds.map((tradeId) => (
            <Tag key={tradeId}>{getTradeName(state, tradeId)}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Projects",
      key: "projects",
      render: (_, worker) => {
        const assignments = getActiveAssignmentsForWorker(state, worker.id)
        if (!assignments.length) {
          return <Text type="secondary">Unassigned</Text>
        }
        return (
          <Space size={[4, 4]} wrap>
            {assignments.map((assignment) => {
              const project = state.projects.find(
                (item) => item.id === assignment.projectId,
              )
              return (
                <Tag key={assignment.id} color="processing">
                  {project?.name ?? "Project"} · {assignment.role}
                </Tag>
              )
            })}
          </Space>
        )
      },
    },
    {
      title: "Language",
      dataIndex: "preferredLanguage",
      key: "preferredLanguage",
      width: 100,
      responsive: ["lg"],
      render: (language: string) => <Tag>{language.toUpperCase()}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: Worker["status"]) => (
        <Tag color={status === "active" ? "success" : "default"}>{status}</Tag>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 110,
      render: (_, worker) => (
        <Button
          type="link"
          size="small"
          className="company-inline-link"
          onClick={() => openAssign(worker)}
        >
          Assign
        </Button>
      ),
    },
  ]

  const addUnits = addProjectId ? getProjectUnits(state, addProjectId) : []
  const assignUnits = assignProjectId
    ? getProjectUnits(state, assignProjectId)
    : []

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
            <span className="company-logo-mark">
              <HIcon size={28} />
            </span>
          </Flex>
          <Menu
            mode="inline"
            selectedKeys={["workforce"]}
            inlineIndent={18}
            className="company-main-menu flex-1 border-0!"
            items={[
              { key: "home", icon: <HomeOutlined />, label: "Company Home" },
              { key: "projects", icon: <ProjectOutlined />, label: "Projects" },
              { key: "library", icon: <SnippetsOutlined />, label: "Work Library" },
              { key: "workforce", icon: <TeamOutlined />, label: "Workforce" },
            ]}
            onClick={({ key }) => {
              if (key === "home") onNavigate("company-dashboard")
              if (key === "projects") onNavigate("company-projects")
              if (key === "library") onNavigate("work-library")
            }}
          />
        </Flex>
      </Sider>

      <Layout>
        <Header className="company-header">
          <Flex align="center" justify="space-between" className="h-full gap-3">
            <Flex vertical justify="center">
              <Title level={5} className="company-heading! m-0!">
                Site Workforce
              </Title>
              <Text type="secondary">
                Add workers and assign them to projects by trade
              </Text>
            </Flex>
            <Space>
              <Gated
                allowed={manageableProjects.length > 0}
                reason="You don't manage workforce on any project."
              >
                <Button onClick={() => openAssign()}>Assign existing</Button>
              </Gated>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                Add worker
              </Button>
            </Space>
          </Flex>
        </Header>

        <Content className="overflow-y-auto">
          <Flex vertical gap="middle" className="company-content">
            <Card size="small">
              <Flex gap="small" wrap>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Search workers"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="company-project-search"
                />
                <Select
                  value={projectFilter}
                  onChange={setProjectFilter}
                  className="company-project-filter"
                  options={[
                    { value: "all", label: "All projects" },
                    ...projects.map((project) => ({
                      value: project.id,
                      label: project.name,
                    })),
                  ]}
                />
                <Select
                  value={tradeFilter}
                  onChange={setTradeFilter}
                  className="company-project-filter"
                  options={[
                    { value: "all", label: "All trades" },
                    ...state.trades.map((trade) => ({
                      value: trade.id,
                      label: trade.name,
                    })),
                  ]}
                />
                <Select
                  value={assignmentFilter}
                  onChange={setAssignmentFilter}
                  className="company-project-filter"
                  options={[
                    { value: "all", label: "All assignments" },
                    { value: "assigned", label: "Assigned" },
                    { value: "unassigned", label: "Unassigned" },
                  ]}
                />
              </Flex>
            </Card>

            <Card
              size="small"
              title={
                <Title level={5} className="company-heading! m-0!">
                  Workers
                </Title>
              }
              extra={
                <Text type="secondary">{filteredWorkers.length} workers</Text>
              }
              classNames={{ body: "company-table-card-body-inset" }}
            >
              <Table
                rowKey="id"
                size="small"
                columns={columns}
                dataSource={filteredWorkers}
                pagination={{ pageSize: 10, showSizeChanger: false }}
                scroll={{ x: 880 }}
              />
            </Card>
          </Flex>
        </Content>
      </Layout>

      <Modal
        title="Add worker"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Paragraph type="secondary" className="mt-0! mb-3!">
          Create a site worker and optionally assign them to a project.
        </Paragraph>
        <Form<AddWorkerFormValues>
          form={addForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{ preferredLanguage: "en", role: "worker" }}
          onFinish={handleAdd}
        >
          <Form.Item
            label="Full name"
            name="name"
            rules={[{ required: true, message: "Enter the worker's name" }]}
          >
            <Input placeholder="Ramesh Kumar" />
          </Form.Item>
          <Form.Item label="Mobile number" name="phone">
            <Input placeholder="+91 98765 43210" />
          </Form.Item>
          <Form.Item
            label="Trades"
            name="tradeIds"
            rules={[{ required: true, message: "Select at least one trade" }]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="e.g. Reinforcement"
              options={state.trades.map((trade) => ({
                value: trade.id,
                label: trade.name,
              }))}
            />
          </Form.Item>
          <Form.Item label="Preferred language" name="preferredLanguage">
            <Select
              options={[
                { value: "en", label: "English" },
                { value: "hi", label: "Hindi" },
                { value: "te", label: "Telugu" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Assign to project" name="projectId">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Optional"
              options={manageableProjects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
              onChange={() => addForm.setFieldValue("projectUnitIds", undefined)}
            />
          </Form.Item>
          {addProjectId ? (
            <>
              <Form.Item label="Location scope" name="projectUnitIds">
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Entire project"
                  options={addUnits.map((unit) => ({
                    value: unit.id,
                    label: `${unit.name} · ${unit.kind}`,
                  }))}
                />
              </Form.Item>
              <Form.Item label="Site role" name="role" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: "worker", label: "Worker" },
                    { value: "lead", label: "Lead" },
                    { value: "supervisor-assist", label: "Supervisor assist" },
                  ]}
                />
              </Form.Item>
            </>
          ) : null}
          <Flex justify="flex-end">
            <Space>
              <Button onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Add worker
              </Button>
            </Space>
          </Flex>
        </Form>
      </Modal>

      <Modal
        title="Assign worker to project"
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form<AssignFormValues>
          form={assignForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{ role: "worker" }}
          onFinish={handleAssign}
        >
          <Form.Item
            label="Worker"
            name="workerId"
            rules={[{ required: true, message: "Choose a worker" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select worker"
              options={workers.map((worker) => ({
                value: worker.id,
                label: worker.name,
              }))}
              onChange={(workerId) => {
                const worker = workers.find((item) => item.id === workerId)
                if (worker) {
                  assignForm.setFieldValue("tradeIds", worker.tradeIds)
                }
              }}
            />
          </Form.Item>
          <Form.Item
            label="Project"
            name="projectId"
            rules={[{ required: true, message: "Choose a project" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select project"
              options={manageableProjects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
              onChange={() =>
                assignForm.setFieldValue("projectUnitIds", undefined)
              }
            />
          </Form.Item>
          <Form.Item
            label="Trades on this project"
            name="tradeIds"
            rules={[{ required: true, message: "Select at least one trade" }]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              options={state.trades.map((trade) => ({
                value: trade.id,
                label: trade.name,
              }))}
            />
          </Form.Item>
          {assignProjectId ? (
            <Form.Item label="Location scope" name="projectUnitIds">
              <Select
                mode="multiple"
                allowClear
                placeholder="Entire project"
                options={assignUnits.map((unit) => ({
                  value: unit.id,
                  label: `${unit.name} · ${unit.kind}`,
                }))}
              />
            </Form.Item>
          ) : null}
          <Form.Item label="Site role" name="role" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "worker", label: "Worker" },
                { value: "lead", label: "Lead" },
                { value: "supervisor-assist", label: "Supervisor assist" },
              ]}
            />
          </Form.Item>
          <Flex justify="flex-end">
            <Space>
              <Button onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Assign worker
              </Button>
            </Space>
          </Flex>
        </Form>
      </Modal>
    </Layout>
  )
}

export default function WorkforceScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <CompanyThemeProvider>
      <Workforce onNavigate={onNavigate} />
    </CompanyThemeProvider>
  )
}
