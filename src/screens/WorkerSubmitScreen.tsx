import { useState } from "react"
import { ArrowLeftOutlined } from "@ant-design/icons"
import {
  Alert,
  Button,
  Card,
  Flex,
  Form,
  Input,
  InputNumber,
  Tag,
  Typography,
} from "antd"
import EvidenceCapture, {
  type DraftEvidence,
} from "../components/EvidenceCapture"
import VoiceNoteRecorder from "../components/VoiceNoteRecorder"
import VoiceTextArea from "../components/VoiceTextArea"
import WorkerShell from "../components/worker/WorkerShell"
import { formatQuantity } from "../components/worker/workerLabels"
import type { EntityId, QuantityUnit } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import {
  missingRequiredEvidence,
  templateForTask,
  workerAssignment,
  workerNextAction,
} from "../domain/workerTasks"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getProject, getProjectUnits, getWorkTypeName } from "../mock/selectors"
import { useCommand } from "../session/useCommand"
import { useSession } from "../session/SessionProvider"
import { useSignedInWorker } from "../session/useWorker"

const { Text, Title } = Typography

interface WorkerProgressValues {
  completedQuantity: number
  workersPresent: number
  todaySummary: string
  tomorrowPlan: string
  blockerSummary?: string
}

const timeLabel = () => new Date().toLocaleTimeString("en-IN")

function SubmitWork({
  onNavigate,
  projectId,
  taskId,
}: {
  onNavigate: Navigate
  projectId: EntityId
  taskId: EntityId
}) {
  const { state, submitDailyProgress } = useConstructionData()
  const { session } = useSession()
  const worker = useSignedInWorker()
  const run = useCommand()
  const [evidence, setEvidence] = useState<DraftEvidence[]>([])
  const [evidenceError, setEvidenceError] = useState<string>()
  const [form] = Form.useForm<WorkerProgressValues>()

  const found = state.tasks.find(
    (item) => item.id === taskId && item.projectId === projectId,
  )
  const task =
    found && worker && workerAssignment(state, worker.id, found.id)
      ? found
      : undefined
  const backToTask = () =>
    onNavigate("worker-task", { project_id: projectId, task_id: taskId })

  if (!task) {
    return (
      <Alert
        type="error"
        showIcon
        message="Task not available"
        description="This task isn't assigned to you."
        action={
          <Button onClick={() => onNavigate("worker-today")}>
            Back to today
          </Button>
        }
      />
    )
  }
  if (workerNextAction(task.status) !== "submit") {
    return (
      <Alert
        type="info"
        showIcon
        message="Start the task before logging progress"
        description="Progress can be sent while the work is in progress."
        action={<Button onClick={backToTask}>Open task</Button>}
      />
    )
  }

  const project = getProject(state, task.projectId)
  const unit = getProjectUnits(state, task.projectId).find(
    (item) => item.id === task.projectUnitId,
  )
  const template = templateForTask(state, task)
  const workType = state.workTypes.find((item) => item.id === task.workTypeId)
  const unitOfMeasure: QuantityUnit =
    task.plannedQuantity?.unit ??
    template?.defaultUnit ??
    workType?.defaultUnit ??
    "nos"
  const required = template?.requiredEvidence ?? []
  // Yesterday = the worker's own last note on this task.
  const myMembershipIds = new Set(
    state.memberships
      .filter(
        (item) =>
          item.principalType === "person" &&
          item.principalId === session?.personId,
      )
      .map((item) => item.id),
  )
  const previous = state.dailyProgress
    .filter(
      (item) =>
        item.taskId === task.id &&
        myMembershipIds.has(item.submittedByMembershipId),
    )
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))[0]

  const updateEvidence = (next: DraftEvidence[]) => {
    setEvidence(next)
    setEvidenceError(undefined)
  }

  const handleSubmit = (values: WorkerProgressValues) => {
    const missing = missingRequiredEvidence(required, evidence)
    if (missing.length) {
      setEvidenceError(
        `Add at least one ${missing.join(" and one ")} before sending.`,
      )
      return
    }
    const outcome = run(
      () =>
        submitDailyProgress({
          projectId: task.projectId,
          projectUnitId: task.projectUnitId,
          taskId: task.id,
          stageId: task.stageId,
          tradeId: task.tradeId,
          workTypeId: task.workTypeId,
          workersPresent: values.workersPresent,
          completedQuantity: {
            value: values.completedQuantity,
            unit: unitOfMeasure,
          },
          todaySummary: values.todaySummary.trim(),
          tomorrowPlan: values.tomorrowPlan.trim(),
          yesterdaySummary: previous?.todaySummary,
          blockerSummary: values.blockerSummary?.trim() || undefined,
          evidence: evidence.map(({ type, url, caption }) => ({
            type,
            url,
            caption,
          })),
        }),
      { success: "Sent to your supervisor for review" },
    )
    if (outcome.ok) backToTask()
  }

  return (
    <>
      <Flex vertical gap={4}>
        <Text className="company-eyebrow">Today’s progress</Text>
        <Title level={3} className="company-heading! m-0!">
          {task.title}
        </Title>
        <Text type="secondary">
          {project?.name} · {unit?.name ?? "Site"} ·{" "}
          {getWorkTypeName(state, task.workTypeId)}
        </Text>
      </Flex>

      <Form<WorkerProgressValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ workersPresent: 1 }}
        onFinish={handleSubmit}
      >
        <Card size="small">
          <Form.Item
            label={`Work done today (${unitOfMeasure})`}
            name="completedQuantity"
            extra={`Done so far ${formatQuantity(task.completedQuantity)} of ${formatQuantity(task.plannedQuantity)} planned`}
            rules={[
              { required: true, message: "Enter how much work was done today" },
            ]}
          >
            <InputNumber
              min={0}
              step={0.5}
              className="w-full!"
              suffix={unitOfMeasure}
              inputMode="decimal"
            />
          </Form.Item>
          <Form.Item
            label="People working with you (including you)"
            name="workersPresent"
            rules={[
              { required: true, message: "Enter how many people worked" },
            ]}
          >
            <InputNumber
              min={1}
              max={200}
              className="w-full!"
              inputMode="numeric"
            />
          </Form.Item>
          <Form.Item
            label="What did you do today?"
            name="todaySummary"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Say or type what you did today",
              },
            ]}
          >
            <VoiceTextArea
              rows={3}
              placeholder="Tap the mic and speak, or type"
            />
          </Form.Item>
          <Form.Item
            label="Plan for tomorrow"
            name="tomorrowPlan"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Say or type tomorrow's plan",
              },
            ]}
          >
            <VoiceTextArea rows={2} placeholder="What you will do next" />
          </Form.Item>
          <Form.Item
            label="Any problem on site?"
            name="blockerSummary"
            className="mb-0!"
          >
            <Input placeholder="Leave blank if everything is fine" />
          </Form.Item>
        </Card>

        <Card
          size="small"
          className="mt-4!"
          title={
            <Flex align="center" justify="space-between" gap="small" wrap>
              <Text strong>Photos, video and voice</Text>
              {required.length > 0 && (
                <Flex gap={6} wrap>
                  {required.map((type) => (
                    <Tag key={type} className="m-0!">
                      {type} needed
                    </Tag>
                  ))}
                </Flex>
              )}
            </Flex>
          }
        >
          <Flex vertical gap="small">
            <EvidenceCapture
              value={evidence}
              onChange={updateEvidence}
              extraActions={
                <VoiceNoteRecorder
                  onRecorded={(url) => {
                    setEvidenceError(undefined)
                    setEvidence((current) => [
                      ...current,
                      {
                        type: "audio",
                        url,
                        caption: `Voice note ${timeLabel()}`,
                      },
                    ])
                  }}
                />
              }
            />
            <Text type="secondary" className="text-[12px]!">
              Voice notes go only to your supervisor. Photos and video are shown
              to the homeowner after approval.
            </Text>
            {evidenceError && (
              <Alert type="error" showIcon message={evidenceError} />
            )}
          </Flex>
        </Card>

        <Button
          type="primary"
          size="large"
          block
          htmlType="submit"
          className="mt-4!"
        >
          Send to supervisor
        </Button>
      </Form>
    </>
  )
}

export default function WorkerSubmitScreen({
  onNavigate,
  projectId,
  taskId,
}: {
  onNavigate: Navigate
  projectId: EntityId
  taskId: EntityId
}) {
  return (
    <WorkerShell
      headerAction={
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() =>
            onNavigate("worker-task", {
              project_id: projectId,
              task_id: taskId,
            })
          }
        >
          Task
        </Button>
      }
    >
      <SubmitWork
        onNavigate={onNavigate}
        projectId={projectId}
        taskId={taskId}
      />
    </WorkerShell>
  )
}
