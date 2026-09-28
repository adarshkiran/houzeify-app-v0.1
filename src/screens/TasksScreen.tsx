import Gated from "../components/Gated"
import { clickableRow, stopRowClick } from "../components/company/clickableRow"
import { countLabel } from "../components/countLabel"
import { Permissions } from "../domain/permissions"
import { useAccess, useActableUnits } from "../session/useCan"
import { useMemo, useState } from "react"
import {
  ArrowRightOutlined,
  AudioOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons"
import {
  Button,
  Card,
  Flex,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd"
import type { TableProps } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import CreateTaskModal from "../components/tasks/CreateTaskModal"
import VoiceCapture from "../components/voice/VoiceCapture"
import { useVoiceContext } from "../components/voice/useVoiceContext"
import type {
  EntityId,
  Task,
  TaskStatus,
} from "../domain/models"
import type { Navigate } from "../domain/navigation"
import type { TaskDraftValues, VoiceDraft } from "../domain/voice/types"
import { voiceExtractor } from "../domain/voice/extract"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getProjectUnits,
  getStageName,
  getTradeName,
  getWorkTypeName,
} from "../mock/selectors"

const { Text, Title } = Typography

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
  if (status === "in-progress") return "orange"
  if (status === "submitted" || status === "review") return "processing"
  return "default"
}

function Tasks({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  const { state } = useConstructionData()
  const can = useAccess()
  const creatableUnits = useActableUnits(Permissions.TASK_MANAGE, projectId)
  const canManage = creatableUnits.length > 0
  const voiceContext = useVoiceContext(projectId)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<TaskStatus | "all">("all")
  const [unitId, setUnitId] = useState<EntityId | "all">("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [draft, setDraft] = useState<VoiceDraft<TaskDraftValues>>()
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

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "tasks" }}
      onNavigate={onNavigate}
      description="Work across locations, trades and teams"
      actions={
        <Space>
          <Gated allowed={canManage}>
            <Button icon={<AudioOutlined />} onClick={() => setCapturing(true)}>Speak a task</Button>
          </Gated>
          <Gated allowed={canManage}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              Create task
            </Button>
          </Gated>
        </Space>
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

      <CreateTaskModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setDraft(undefined)
        }}
        projectId={projectId}
        draft={draft}
        onCreated={(task) => {
          setDraft(undefined)
          onNavigate("task-detail", { project_id: projectId, task_id: task.id })
        }}
      />

      <VoiceCapture
        open={capturing}
        title="Speak a task"
        placeholder="e.g. Ravi, pour the Block B columns tomorrow, urgent"
        onCancel={() => setCapturing(false)}
        onDraft={(text) => {
          setCapturing(false)
          setDraft(voiceExtractor.task(text, voiceContext))
          setModalOpen(true)
        }}
      />
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
