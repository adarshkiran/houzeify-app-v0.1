import Gated from "../components/Gated"
import { clickableRow, stopRowClick } from "../components/company/clickableRow"
import { countLabel } from "../components/countLabel"
import { Permissions } from "../domain/permissions"
import { useAccess, useActableUnits } from "../session/useCan"
import { useScopedLibrary } from "../session/useScopedLibrary"
import { useCommand } from "../session/useCommand"
import { useMemo, useState } from "react"
import {
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
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import WorkTypeCascadeFields from "../components/WorkTypeCascadeFields"
import type {
  EntityId,
  QuantityUnit,
  Task,
  TaskStatus,
} from "../domain/models"
import type { Navigate } from "../domain/navigation"
import {
  QUANTITY_UNITS,
  quantityUnitLabel,
} from "../domain/workLibrary"
import {
  useConstructionData,
  type CreateTaskInput,
} from "../mock/ConstructionDataProvider"
import {
  getProjectUnits,
  getStageName,
  getTradeName,
  getWorkTypeName,
} from "../mock/selectors"

const { Text, Title } = Typography

interface TaskFormValues {
  projectUnitId: EntityId
  stageId: EntityId
  tradeId: EntityId
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
  const run = useCommand()
  const can = useAccess()
  const creatableUnits = useActableUnits(Permissions.TASK_MANAGE, projectId)
  const creatableLibrary = useScopedLibrary(Permissions.TASK_MANAGE, projectId)
  const canManage = creatableUnits.length > 0
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<TaskStatus | "all">("all")
  const [unitId, setUnitId] = useState<EntityId | "all">("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm<TaskFormValues>()
  // Reading follows scope too: a scoped member sees only their own tasks/locations.
  const units = getProjectUnits(state, projectId).filter((unit) =>
    can(Permissions.PROJECT_READ, projectId, { projectUnitId: unit.id }),
  )
  const tasks = state.tasks.filter(
    (task) =>
      task.projectId === projectId && can(Permissions.PROJECT_READ, projectId, task),
  )

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
      responsive: ["sm"],
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
      // The whole row opens the task; the arrow is just the hint.
      render: () => <ArrowRightOutlined aria-hidden className="clickable-row-arrow" />,
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
    const outcome = run(() => createTask(input), { success: "Task created" })
    if (!outcome.ok) return
    form.resetFields()
    setModalOpen(false)
    onNavigate("task-detail", { project_id: projectId, task_id: outcome.value.id })
  }

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "tasks" }}
      onNavigate={onNavigate}
      description="Work across locations, trades and teams"
      actions={
        <Gated allowed={canManage}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Create task
          </Button>
        </Gated>
      }
    >
      <Flex vertical gap="large" className="company-content">

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
          extra={<Text type="secondary">{countLabel(filteredTasks.length, "task")}</Text>}
          classNames={{ body: "company-table-card-body" }}
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredTasks}
            onRow={(task) =>
              clickableRow(
                () => onNavigate("task-detail", { project_id: projectId, task_id: task.id }),
                `Open ${task.title}`,
              )
            }
            pagination={{ pageSize: 10, showSizeChanger: false }}
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
            <Select options={creatableUnits.map((unit) => ({ value: unit.id, label: unit.name }))} />
          </Form.Item>
          <WorkTypeCascadeFields state={creatableLibrary} form={form} includeTitle />
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
                  options={QUANTITY_UNITS.map((value) => ({
                    value,
                    label: quantityUnitLabel(value),
                  }))}
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
    </CompanyLayout>
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
