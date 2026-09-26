import { useState } from "react"
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  EnvironmentOutlined,
  TeamOutlined,
} from "@ant-design/icons"
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Flex,
  Progress,
  Row,
  Select,
  Space,
  Tag,
  Timeline,
  Typography,
} from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import LogoHorizontal from "../components/LogoHorizontal"
import type { EntityId, TaskStatus } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import Gated from "../components/Gated"
import { Permissions } from "../domain/permissions"
import { useCan } from "../session/useCan"
import { useCommand } from "../session/useCommand"
import {
  getAllowedTaskTransitions,
  useConstructionData,
} from "../mock/ConstructionDataProvider"
import {
  getProject,
  getProjectUnits,
  getStageName,
  getTradeName,
  getWorkTypeName,
  getWorkersForProject,
} from "../mock/selectors"

const { Paragraph, Text, Title } = Typography

function statusColor(status: TaskStatus) {
  if (status === "blocked" || status === "cancelled") return "error"
  if (status === "delayed") return "warning"
  if (status === "completed" || status === "approved") return "success"
  return "processing"
}

function TaskDetail({
  onNavigate,
  projectId,
  taskId,
}: {
  onNavigate: Navigate
  projectId: EntityId
  taskId: EntityId
}) {
  const { state, assignTask, transitionTask } = useConstructionData()
  const run = useCommand()
  const canManageTasks = useCan(Permissions.TASK_MANAGE, projectId)
  const canSubmitProgress = useCan(Permissions.PROGRESS_SUBMIT, projectId)
  // Workers who can submit progress may also start/pause their own work.
  const canMoveTask = canManageTasks || canSubmitProgress
  const [assigneeId, setAssigneeId] = useState<EntityId>()
  const task = state.tasks.find((item) => item.id === taskId)
  const project = getProject(state, projectId)
  const unit = getProjectUnits(state, projectId).find(
    (item) => item.id === task?.projectUnitId,
  )

  if (!task) {
    return (
      <Flex align="center" justify="center" className="project-overview-empty">
        <Alert
          type="error"
          showIcon
          message="Task not found"
          description="The selected task is not available in this project."
          action={
            <Button onClick={() => onNavigate("tasks", { project_id: projectId })}>
              Return to tasks
            </Button>
          }
        />
      </Flex>
    )
  }

  const transitions = getAllowedTaskTransitions(task.status)
  const assignments = state.assignments.filter(
    (assignment) => assignment.taskId === task.id,
  )
  const progressRecords = state.dailyProgress.filter(
    (progress) => progress.taskId === task.id,
  )

  const handleAssign = () => {
    if (!assigneeId) return
    const outcome = run(() => assignTask(task.id, "worker", assigneeId), {
      success: "Worker assigned",
    })
    if (outcome.ok) setAssigneeId(undefined)
  }

  return (
    <Flex vertical className="company-form-page min-h-full">
      <Flex align="center" justify="space-between" className="business-onboarding-header">
        <LogoHorizontal height={24} />
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => onNavigate("tasks", { project_id: projectId })}
        >
          Task register
        </Button>
      </Flex>

      <Flex vertical gap="large" className="company-form-content">
        <Flex align="flex-start" justify="space-between" gap="middle" wrap>
          <Flex vertical gap="small">
            <Space wrap>
              <Tag color={statusColor(task.status)}>{task.status}</Tag>
              <Tag>{task.priority} priority</Tag>
            </Space>
            <Title level={2} className="company-heading! m-0!">{task.title}</Title>
            <Text type="secondary">
              {project?.name} · {unit?.name ?? "Project location"}
            </Text>
          </Flex>
          <Space wrap>
            <Button
              type="primary"
              onClick={() =>
                onNavigate("daily-progress-submit", {
                  project_id: projectId,
                  task_id: task.id,
                })
              }
            >
              Log today’s progress
            </Button>
            {transitions.slice(0, 3).map((nextStatus) => (
              <Gated key={nextStatus} allowed={canMoveTask}>
                <Button
                  type={nextStatus === "in-progress" || nextStatus === "completed" ? "primary" : "default"}
                  danger={nextStatus === "cancelled"}
                  onClick={() => run(() => transitionTask(task.id, nextStatus))}
                >
                  Move to {nextStatus}
                </Button>
              </Gated>
            ))}
          </Space>
        </Flex>

        <Row gutter={[24, 24]} align="top">
          <Col xs={24} xl={16}>
            <Flex vertical gap="large">
              <Card
                title={
                  <Title level={5} className="company-heading! m-0!">Task scope</Title>
                }
              >
                <Descriptions
                  column={{ xs: 1, sm: 2 }}
                  items={[
                    {
                      key: "location",
                      label: "Location",
                      children: <Text><EnvironmentOutlined /> {unit?.name}</Text>,
                    },
                    {
                      key: "stage",
                      label: "Stage",
                      children: getStageName(state, task.stageId),
                    },
                    {
                      key: "trade",
                      label: "Trade",
                      children: getTradeName(state, task.tradeId),
                    },
                    {
                      key: "work",
                      label: "Work type",
                      children: getWorkTypeName(state, task.workTypeId),
                    },
                    {
                      key: "start",
                      label: "Planned start",
                      children: task.plannedStart ?? "Not set",
                    },
                    {
                      key: "due",
                      label: "Due date",
                      children: <Text><CalendarOutlined /> {task.dueDate ?? "Not set"}</Text>,
                    },
                    {
                      key: "quantity",
                      label: "Planned quantity",
                      children: task.plannedQuantity
                        ? `${task.plannedQuantity.value} ${task.plannedQuantity.unit}`
                        : "Not set",
                    },
                    {
                      key: "completed",
                      label: "Completed quantity",
                      children: task.completedQuantity
                        ? `${task.completedQuantity.value} ${task.completedQuantity.unit}`
                        : "Not reported",
                    },
                  ]}
                />
              </Card>

              <Card
                title={
                  <Title level={5} className="company-heading! m-0!">Checklist</Title>
                }
              >
                {task.checklist.length ? (
                  <Flex vertical gap="middle">
                    {task.checklist.map((item) => (
                      <Checkbox key={item.id} checked={item.completed} disabled>
                        {item.label}
                      </Checkbox>
                    ))}
                  </Flex>
                ) : (
                  <Text type="secondary">No checklist is configured for this task.</Text>
                )}
              </Card>

              <Card
                title={
                  <Title level={5} className="company-heading! m-0!">Progress history</Title>
                }
              >
                {progressRecords.length ? (
                  <Timeline
                    items={progressRecords.map((record) => ({
                      title: record.date,
                      content: (
                        <Flex vertical gap="small">
                          <Text>{record.todaySummary}</Text>
                          <Progress
                            percent={record.progressAfter}
                            size="small"
                            status="active"
                          />
                        </Flex>
                      ),
                    }))}
                  />
                ) : (
                  <Paragraph type="secondary" className="m-0!">
                    No daily progress has been submitted against this task.
                  </Paragraph>
                )}
              </Card>
            </Flex>
          </Col>

          <Col xs={24} xl={8}>
            <Flex vertical gap="large">
              <Card
                title={
                  <Title level={5} className="company-heading! m-0!">
                    Assignments
                  </Title>
                }
              >
                <Flex vertical gap="middle">
                  {assignments.map((assignment) => {
                    const worker = state.workers.find(
                      (item) => item.id === assignment.assigneeId,
                    )
                    return (
                      <Flex key={assignment.id} align="center" gap="small">
                        <TeamOutlined />
                        <Flex vertical>
                          <Text strong>{worker?.name ?? "Project member"}</Text>
                          <Text type="secondary">{assignment.status}</Text>
                        </Flex>
                      </Flex>
                    )
                  })}
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Select worker"
                    value={assigneeId}
                    onChange={setAssigneeId}
                    options={getWorkersForProject(state, projectId).map((worker) => ({
                      value: worker.id,
                      label: worker.name,
                    }))}
                  />
                  <Gated allowed={canManageTasks}>
                    <Button
                      block
                      icon={<TeamOutlined />}
                      disabled={!assigneeId}
                      onClick={handleAssign}
                    >
                      Assign worker
                    </Button>
                  </Gated>
                </Flex>
              </Card>

              <Card
                title={
                  <Title level={5} className="company-heading! m-0!">
                    Evidence requirements
                  </Title>
                }
              >
                <Flex vertical gap="small">
                  {state.taskTemplates
                    .find((template) => template.id === task.templateId)
                    ?.requiredEvidence.map((type) => (
                      <Tag key={type} icon={<CheckSquareOutlined />}>{type}</Tag>
                    )) ?? <Text type="secondary">No evidence rule configured.</Text>}
                </Flex>
              </Card>
            </Flex>
          </Col>
        </Row>
      </Flex>
    </Flex>
  )
}

export default function TaskDetailScreen({
  onNavigate,
  projectId,
  taskId,
}: {
  onNavigate: Navigate
  projectId: EntityId
  taskId: EntityId
}) {
  return (
    <CompanyThemeProvider>
      <TaskDetail onNavigate={onNavigate} projectId={projectId} taskId={taskId} />
    </CompanyThemeProvider>
  )
}
