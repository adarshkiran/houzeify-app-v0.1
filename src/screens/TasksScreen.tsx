import { useMemo, useState } from "react"
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons"
import {
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd"
import type { TableProps } from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import LogoHorizontal from "../components/LogoHorizontal"
import type {
  EntityId,
  QuantityUnit,
  Task,
  TaskStatus,
} from "../domain/models"
import type { Navigate } from "../domain/navigation"
import {
  useConstructionData,
  type CreateTaskInput,
} from "../mock/ConstructionDataProvider"
import {
  getProject,
  getProjectUnits,
  getStageName,
  getTradeName,
  getWorkTypeName,
} from "../mock/selectors"

const { Paragraph, Text, Title } = Typography

interface TaskFormValues {
  projectUnitId: EntityId
  workTypeId: EntityId
  title: string
  priority: Task["priority"]
  plannedValue?: number
  unit?: QuantityUnit
  plannedStart?: string
  dueDate?: string
}

const statusOptions: Array<{ value: TaskStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "assigned", label: "Assigned" },
  { value: "ready", label: "Ready" },
  { value: "in-progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "review", label: "Review" },
  { value: "blocked", label: "Blocked" },
  { value: "delayed", label: "Delayed" },
  { value: "completed", label: "Completed" },
]

function taskStatusColor(status: TaskStatus) {
  if (status === "blocked" || status === "cancelled") return "error"
  if (status === "delayed") return "warning"
  if (status === "completed" || status === "approved") return "success"
  if (status === "in-progress" || status === "submitted" || status === "review") {
    return "processing"
  }
  return "default"
}

function Tasks({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  const { state, createTask } = useConstructionData()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<TaskStatus | "all">("all")
  const [unitId, setUnitId] = useState<EntityId | "all">("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm<TaskFormValues>()
  const project = getProject(state, projectId)
  const units = getProjectUnits(state, projectId)
  const tasks = state.tasks.filter((task) => task.projectId === projectId)

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const matchesSearch = `${task.title} ${getWorkTypeName(state, task.workTypeId)}`
          .toLowerCase()
          .includes(search.toLowerCase())
        return (
          matchesSearch &&
          (status === "all" || task.status === status) &&
          (unitId === "all" || task.projectUnitId === unitId)
        )
      }),
    [tasks, state, search, status, unitId],
  )

  const columns: TableProps<Task>["columns"] = [
    {
      title: "Task",
      key: "task",
      render: (_, task) => (
        <Flex vertical gap={2}>
          <Text strong>{task.title}</Text>
          <Text type="secondary">
            {getStageName(state, task.stageId)} · {getTradeName(state, task.tradeId)}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Location",
      key: "location",
      responsive: ["md"],
      render: (_, task) => (
        <Text>{units.find((unit) => unit.id === task.projectUnitId)?.name ?? "Location"}</Text>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (priority: Task["priority"]) => (
        <Tag color={priority === "high" || priority === "critical" ? "error" : "default"}>
          {priority}
        </Tag>
      ),
    },
    {
      title: "Due",
      dataIndex: "dueDate",
      key: "dueDate",
      responsive: ["lg"],
      render: (dueDate?: string) => <Text type="secondary">{dueDate ?? "Not set"}</Text>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (taskStatus: TaskStatus) => (
        <Tag color={taskStatusColor(taskStatus)}>{taskStatus}</Tag>
      ),
    },
    {
      key: "action",
      width: 48,
      render: (_, task) => (
        <Button
          type="text"
          aria-label={`Open ${task.title}`}
          icon={<ArrowRightOutlined />}
          onClick={() =>
            onNavigate("task-detail", {
              project_id: projectId,
              task_id: task.id,
            })
          }
        />
      ),
    },
  ]

  const handleCreate = (values: TaskFormValues) => {
    const workType = state.workTypes.find((item) => item.id === values.workTypeId)
    if (!workType) return
    const template = state.taskTemplates.find(
      (item) => item.workTypeId === workType.id,
    )
    const input: CreateTaskInput = {
      projectId,
      projectUnitId: values.projectUnitId,
      stageId: workType.stageId,
      tradeId: workType.tradeId,
      workTypeId: workType.id,
      templateId: template?.id,
      title: values.title,
      priority: values.priority,
      plannedQuantity:
        values.plannedValue != null && values.unit
          ? { value: values.plannedValue, unit: values.unit }
          : undefined,
      plannedStart: values.plannedStart,
      dueDate: values.dueDate,
    }
    const task = createTask(input)
    form.resetFields()
    setModalOpen(false)
    onNavigate("task-detail", { project_id: projectId, task_id: task.id })
  }

  return (
    <Flex vertical className="company-form-page min-h-full">
      <Flex align="center" justify="space-between" className="business-onboarding-header">
        <LogoHorizontal height={24} />
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => onNavigate("project-overview", { project_id: projectId })}
        >
          Project overview
        </Button>
      </Flex>

      <Flex vertical gap="large" className="company-form-content">
        <Flex align="flex-start" justify="space-between" gap="middle" wrap>
          <Flex vertical gap="small">
            <Text className="company-eyebrow">Project tasks</Text>
            <Title level={2} className="company-heading! m-0!">
              {project?.name ?? "Project"}
            </Title>
            <Paragraph type="secondary" className="m-0!">
              Structured work across locations, trades, and responsible teams.
            </Paragraph>
          </Flex>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Create task
          </Button>
        </Flex>

        <Card>
          <Flex gap="middle" wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search tasks"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="company-project-search"
            />
            <Select
              value={status}
              onChange={setStatus}
              options={statusOptions}
              className="company-project-filter"
            />
            <Select
              value={unitId}
              onChange={setUnitId}
              className="company-project-filter"
              options={[
                { value: "all", label: "All locations" },
                ...units.map((unit) => ({ value: unit.id, label: unit.name })),
              ]}
            />
          </Flex>
        </Card>

        <Card
          title={
            <Title level={5} className="company-heading! m-0!">
              Task register
            </Title>
          }
          extra={<Text type="secondary">{filteredTasks.length} tasks</Text>}
          classNames={{ body: "company-table-card-body" }}
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredTasks}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 780 }}
          />
        </Card>
      </Flex>

      <Modal
        title="Create structured task"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form<TaskFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ priority: "medium" }}
          onFinish={handleCreate}
        >
          <Form.Item label="Project location" name="projectUnitId" rules={[{ required: true }]}>
            <Select options={units.map((unit) => ({ value: unit.id, label: unit.name }))} />
          </Form.Item>
          <Form.Item label="Standard work" name="workTypeId" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={state.workTypes.map((workType) => ({
                value: workType.id,
                label: `${getStageName(state, workType.stageId)} · ${workType.name}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="Task title" name="title" rules={[{ required: true }]}>
            <Input placeholder="Complete slab reinforcement — Level 3" />
          </Form.Item>
          <Form.Item label="Priority" name="priority">
            <Select
              options={["low", "medium", "high", "critical"].map((value) => ({
                value,
                label: value,
              }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item label="Planned quantity" name="plannedValue">
                <InputNumber min={0} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="Unit" name="unit">
                <Select
                  options={["nos", "m", "m2", "m3", "kg", "tonne", "day", "percentage"].map(
                    (value) => ({ value, label: value }),
                  )}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Planned start" name="plannedStart">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Due date" name="dueDate">
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>
          <Flex justify="flex-end">
            <Space>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Create task</Button>
            </Space>
          </Flex>
        </Form>
      </Modal>
    </Flex>
  )
}

export default function TasksScreen({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  return (
    <CompanyThemeProvider>
      <Tasks onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
