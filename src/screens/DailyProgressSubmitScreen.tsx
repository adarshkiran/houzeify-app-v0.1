import { useMemo, useState } from "react"
import { ArrowLeftOutlined } from "@ant-design/icons"
import {
  Alert,
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Tag,
  Typography,
} from "antd"
import EvidenceCapture, { type DraftEvidence } from "../components/EvidenceCapture"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import VoiceTextArea from "../components/VoiceTextArea"
import type { EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { Permissions } from "../domain/permissions"
import { useAccess } from "../session/useCan"
import { useCommand } from "../session/useCommand"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getProject,
  getProjectUnits,
  getRecentProgress,
  getStageName,
  getWorkTypeName,
} from "../mock/selectors"

const { Text, Title } = Typography

interface ProgressFormValues {
  taskId?: EntityId
  workersPresent: number
  progressAfter: number
  todaySummary: string
  tomorrowPlan: string
  blockerSummary?: string
}

function SubmitProgress({
  onNavigate,
  projectId,
  taskId,
}: {
  onNavigate: Navigate
  projectId: EntityId
  taskId?: EntityId
}) {
  const { state, submitDailyProgress } = useConstructionData()
  const run = useCommand()
  const can = useAccess()
  const [evidence, setEvidence] = useState<DraftEvidence[]>([])
  const [form] = Form.useForm<ProgressFormValues>()
  const project = getProject(state, projectId)
  // Only tasks the person may submit progress on (their own scope).
  const tasks = state.tasks.filter(
    (task) =>
      task.projectId === projectId &&
      can(Permissions.PROGRESS_SUBMIT, projectId, task),
  )
  const selectedTaskId = Form.useWatch("taskId", form) ?? taskId
  const task = tasks.find((item) => item.id === selectedTaskId)
  const unit = getProjectUnits(state, projectId).find(
    (item) => item.id === task?.projectUnitId,
  )
  const template = state.taskTemplates.find(
    (item) => item.workTypeId === task?.workTypeId,
  )
  const previous = useMemo(
    () =>
      getRecentProgress(state, projectId).find((item) => item.taskId === task?.id),
    [projectId, state, task?.id],
  )

  if (!project) {
    return (
      <Flex align="center" justify="center" className="project-overview-empty">
        <Alert type="error" showIcon message="Project not found" />
      </Flex>
    )
  }

  const handleSubmit = (values: ProgressFormValues) => {
    const activeTask = tasks.find((item) => item.id === (values.taskId ?? taskId))
    if (!activeTask) return

    const outcome = run(
      () =>
        submitDailyProgress({
          projectId,
          projectUnitId: activeTask.projectUnitId,
          taskId: activeTask.id,
          stageId: activeTask.stageId,
          tradeId: activeTask.tradeId,
          workTypeId: activeTask.workTypeId,
          workersPresent: values.workersPresent,
          progressAfter: values.progressAfter,
          todaySummary: values.todaySummary.trim(),
          tomorrowPlan: values.tomorrowPlan.trim(),
          yesterdaySummary: previous?.todaySummary,
          blockerSummary: values.blockerSummary?.trim() || undefined,
          evidence,
        }),
      { success: "Progress submitted for review" },
    )
    if (!outcome.ok) return
    onNavigate("daily-progress-review", { project_id: projectId })
  }

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "tasks" }}
      onNavigate={onNavigate}
      actions={
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() =>
            taskId
              ? onNavigate("task-detail", { project_id: projectId, task_id: taskId })
              : onNavigate("project-overview", { project_id: projectId })
          }
        >
          {taskId ? "Task" : "Project"}
        </Button>
      }
    >
      <Flex vertical gap="large" className="company-form-content">
        <Flex vertical gap="small">
          <Text className="company-eyebrow">Daily progress</Text>
          <Title level={2} className="company-heading! m-0!">
            Log today’s work
          </Title>
          <Text type="secondary">
            {project.name}
            {unit ? ` · ${unit.name}` : ""}
            {task ? ` · ${getStageName(state, task.stageId)}` : ""}
          </Text>
        </Flex>

        <Form<ProgressFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{
            taskId:
              taskId && tasks.some((item) => item.id === taskId)
                ? taskId
                : tasks[0]?.id,
            workersPresent: 1,
            progressAfter: project.progress,
          }}
          onFinish={handleSubmit}
        >
          <Row gutter={[16, 0]}>
            <Col span={24}>
              <Form.Item
                label="Task"
                name="taskId"
                rules={[
                  {
                    required: true,
                    message: "Choose the task this update belongs to",
                  },
                ]}
              >
                <Select
                  disabled={Boolean(taskId)}
                  options={tasks.map((item) => ({
                    value: item.id,
                    label: item.title,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Workers on site"
                name="workersPresent"
                rules={[
                  {
                    required: true,
                    message: "Enter how many workers were present",
                  },
                ]}
              >
                <InputNumber min={0} max={500} className="w-full!" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Progress after today (%)"
                name="progressAfter"
                rules={[
                  {
                    required: true,
                    message: "Enter progress after today’s work",
                  },
                ]}
              >
                <InputNumber min={0} max={100} className="w-full!" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                label="What was done today"
                name="todaySummary"
                rules={[
                  {
                    required: true,
                    message: "Describe the work completed today",
                  },
                ]}
              >
                <VoiceTextArea rows={3} placeholder="Work completed on site today" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                label="Plan for tomorrow"
                name="tomorrowPlan"
                rules={[{ required: true, message: "Describe tomorrow’s plan" }]}
              >
                <VoiceTextArea rows={3} placeholder="Work planned for the next day" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Blocker, if any" name="blockerSummary">
                <Input placeholder="Leave blank if nothing is blocking the work" />
              </Form.Item>
            </Col>
          </Row>

          <Card
            title={
              <Flex align="center" justify="space-between" gap="middle" wrap>
                <Flex vertical gap={2}>
                  <Text strong className="m-0!">
                    Evidence
                  </Text>
                  <Text type="secondary" className="text-[13px]!">
                    {task
                      ? getWorkTypeName(state, task.workTypeId)
                      : "Photo or video from site"}
                  </Text>
                </Flex>
                <Flex gap={6} wrap>
                  {(template?.requiredEvidence ?? ["photo", "video"]).map((type) => (
                    <Tag key={type} className="m-0!">
                      {type}
                    </Tag>
                  ))}
                </Flex>
              </Flex>
            }
            styles={{ body: { paddingTop: 16 } }}
          >
            <EvidenceCapture value={evidence} onChange={setEvidence} />
          </Card>

          <Flex className="company-form-actions" justify="flex-end">
            <Button type="primary" htmlType="submit">
              Send for review
            </Button>
          </Flex>
        </Form>
      </Flex>
    </CompanyLayout>
  )
}

export default function DailyProgressSubmitScreen({
  onNavigate,
  projectId,
  taskId,
}: {
  onNavigate: Navigate
  projectId: EntityId
  taskId?: EntityId
}) {
  return (
    <CompanyThemeProvider>
      <SubmitProgress onNavigate={onNavigate} projectId={projectId} taskId={taskId} />
    </CompanyThemeProvider>
  )
}
