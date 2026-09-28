import { useState } from "react"
import { taskChecklist, templateForTask } from "../domain/workerTasks"
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
  Row,
  Select,
  Space,
  Tag,
  Timeline,
  Typography,
} from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import ThreadPanel from "../components/conversations/ThreadPanel"
import { reviewStatusLabel } from "../components/progress/progressLabels"
import type { EntityId, TaskStatus } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { isSiteTaskStatus } from "../domain/taskTransitions"
import Gated from "../components/Gated"
import { ISSUE_REPORT_PERMISSIONS, Permissions } from "../domain/permissions"
import { useAccess } from "../session/useCan"
import { useScopedData } from "../session/useScopedData"
import { useSession } from "../session/SessionProvider"
import ReportIssueModal from "../components/ReportIssueModal"
import { issueSeverityColor, issueStatusColor, issueStatusLabel } from "../components/issueLabels"
import { useCommand } from "../session/useCommand"
import {
  getAllowedTaskTransitions,
  useConstructionData,
} from "../mock/ConstructionDataProvider"
import {
  getMyMembershipIds,
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
  const can = useAccess()
  const { session } = useSession()
  const mine = getMyMembershipIds(state, session?.personId)
  const [assigneeId, setAssigneeId] = useState<EntityId>()
  const [reportOpen, setReportOpen] = useState(false)
  const scoped = useScopedData()
  // A task outside the viewer's scope is treated as not available.
  const found = state.tasks.find((item) => item.id === taskId)
  const task =
    found && can(Permissions.PROJECT_READ, projectId, found) ? found : undefined
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

  // Scope-aware: what the person may do to *this* task.
  const canManageTasks = can(Permissions.TASK_MANAGE, projectId, task)
  const canSubmitProgress = can(Permissions.PROGRESS_SUBMIT, projectId, task)
  // Site members who can only log progress may make the site moves
  // (accept, start, flag a block); everything else needs task.manage.
  const canMoveTo = (nextStatus: TaskStatus) =>
    canManageTasks || (canSubmitProgress && isSiteTaskStatus(nextStatus))
  const canReportIssue = can(ISSUE_REPORT_PERMISSIONS, projectId, task)
  const taskIssues = scoped.issues.filter((issue) => issue.taskId === task.id)
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

  const checklist = taskChecklist(state, task)
  const requiredEvidence = templateForTask(state, task)?.requiredEvidence ?? []

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "tasks" }}
      onNavigate={onNavigate}
      actions={
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => onNavigate("tasks", { project_id: projectId })}
        >
          Task register
        </Button>
      }
    >
      <Flex vertical gap="large" className="company-content">
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
            <Gated allowed={canReportIssue} reason="You can't report issues on this task.">
              <Button onClick={() => setReportOpen(true)}>Report issue</Button>
            </Gated>
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
              <Gated key={nextStatus} allowed={canMoveTo(nextStatus)}>
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
                {checklist.length ? (
                  <Flex vertical gap="middle">
                    {checklist.map((item) => (
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
                    items={progressRecords
                      .slice()
                      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
                      .map((record) => ({
                        key: record.id,
                        title: `${record.date} · v${record.version}`,
                        content: (
                          <Flex vertical gap="small">
                            <Flex gap="small" wrap>
                              <Tag color={reviewStatusLabel[record.reviewStatus].color} className="m-0!">
                                {reviewStatusLabel[record.reviewStatus].text}
                              </Tag>
                              {record.publicationStatus === "published" && <Tag color="success" className="m-0!">Published</Tag>}
                            </Flex>
                            <Text>{record.todaySummary}</Text>
                            {record.review?.note && <Text type="secondary">“{record.review.note}”</Text>}
                            {record.reviewStatus === "changes-requested" && mine.has(record.submittedByMembershipId) && (
                              <Button
                                size="small"
                                type="primary"
                                className="self-start"
                                onClick={() => onNavigate("daily-progress-submit", { project_id: projectId, task_id: task.id })}
                              >
                                Resubmit
                              </Button>
                            )}
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

              <Card
                title={<Title level={5} className="company-heading! m-0!">Discussion</Title>}
              >
                <ThreadPanel
                  key={task.id}
                  compact
                  projectId={projectId}
                  subject="task"
                  targetId={task.id}
                  emptyText="No messages about this task yet."
                />
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
                    Issues on this task
                  </Title>
                }
              >
                {taskIssues.length ? (
                  <Flex vertical gap="small">
                    {taskIssues.map((issue) => (
                      <Flex key={issue.id} justify="space-between" align="center" gap="small">
                        <Button
                          type="link"
                          className="p-0!"
                          onClick={() =>
                            onNavigate("issue-detail", { project_id: projectId, issue_id: issue.id })
                          }
                        >
                          {issue.title}
                        </Button>
                        <Space size={4}>
                          <Tag color={issueSeverityColor(issue.severity)}>{issue.severity}</Tag>
                          <Tag color={issueStatusColor(issue.status)}>{issueStatusLabel[issue.status]}</Tag>
                        </Space>
                      </Flex>
                    ))}
                  </Flex>
                ) : (
                  <Text type="secondary">No issues reported on this task.</Text>
                )}
              </Card>

              <Card
                title={
                  <Title level={5} className="company-heading! m-0!">
                    Evidence requirements
                  </Title>
                }
              >
                <Flex vertical gap="small">
                  {requiredEvidence.length ? (
                    <Space wrap>
                      {requiredEvidence.map((type) => (
                        <Tag key={type} icon={<CheckSquareOutlined />}>{type}</Tag>
                      ))}
                    </Space>
                  ) : (
                    <Text type="secondary">No evidence rule configured.</Text>
                  )}
                </Flex>
              </Card>
            </Flex>
          </Col>
        </Row>
      </Flex>
      <ReportIssueModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        projectId={projectId}
        taskId={task.id}
        onReported={(issue) =>
          onNavigate("issue-detail", { project_id: projectId, issue_id: issue.id })
        }
      />
    </CompanyLayout>
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
