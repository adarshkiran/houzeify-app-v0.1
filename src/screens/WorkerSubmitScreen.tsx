import { useState } from "react"
import { ArrowLeftOutlined } from "@ant-design/icons"
import {
  Alert,
  Button,
  Card,
  Checkbox,
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
import { quantityProgress } from "../components/worker/workerLabels"
import type { EntityId, QuantityUnit } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import {
  missingRequiredEvidence,
  templateForTask,
  workerAssignment,
  workerNextAction,
} from "../domain/workerTasks"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getChangesRequested,
  getEvidenceForProgress,
  getProject,
  getProjectUnits,
  getWorkTypeName,
} from "../mock/selectors"
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
  const { state, submitDailyProgress, resubmitDailyProgress } =
    useConstructionData()
  const { session } = useSession()
  const worker = useSignedInWorker()
  const run = useCommand()
  const [evidence, setEvidence] = useState<DraftEvidence[]>([])
  const [evidenceError, setEvidenceError] = useState<string>()
  // Tied to the sent-back update it was made for, so a choice made for one
  // update is never applied to another.
  const [keptChoice, setKeptChoice] = useState<{ forId: EntityId; ids: string[] } | null>(null)
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
        myMembershipIds.has(item.submittedByMembershipId) &&
        item.reviewStatus !== "changes-requested" &&
        item.reviewStatus !== "superseded",
    )
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))[0]

  const sentBack = getChangesRequested(state, myMembershipIds, task.id)[0]
  const sentBackEvidence = sentBack ? getEvidenceForProgress(state, sentBack) : []
  const kept =
    keptChoice && sentBack && keptChoice.forId === sentBack.id
      ? keptChoice.ids
      : sentBack?.evidenceIds ?? []

  const updateEvidence = (next: DraftEvidence[]) => {
    setEvidence(next)
    setEvidenceError(undefined)
  }

  const handleSubmit = (values: WorkerProgressValues) => {
    const keptDrafts = sentBackEvidence
      .filter((item) => kept.includes(item.id))
      .map(({ type, url, caption }) => ({ type, url, caption: caption ?? "" }))
    const missing = missingRequiredEvidence(required, [...keptDrafts, ...evidence])
    if (missing.length) {
      setEvidenceError(
        `Add at least one ${missing.join(" and one ")} before sending.`,
      )
      return
    }
    const fields = {
      workersPresent: values.workersPresent,
      completedQuantity: { value: values.completedQuantity, unit: unitOfMeasure },
      todaySummary: values.todaySummary.trim(),
      tomorrowPlan: values.tomorrowPlan.trim(),
      yesterdaySummary: previous?.todaySummary,
      blockerSummary: values.blockerSummary?.trim() || undefined,
      evidence: evidence.map(({ type, url, caption }) => ({
        type,
        url,
        caption,
      })),
    }
    const outcome = run(
      () =>
        sentBack
          ? resubmitDailyProgress(sentBack.id, { ...fields, keepEvidenceIds: kept })
          : submitDailyProgress({
              ...fields,
              projectId: task.projectId,
              projectUnitId: task.projectUnitId,
              taskId: task.id,
              stageId: task.stageId,
              tradeId: task.tradeId,
              workTypeId: task.workTypeId,
            }),
      {
        success: sentBack
          ? "Sent again to your supervisor"
          : "Sent to your supervisor for review",
      },
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

      {sentBack && (
        <Alert
          type="warning"
          showIcon
          message="Your supervisor asked for changes"
          description={sentBack.review?.note}
        />
      )}

      <Form<WorkerProgressValues>
        key={sentBack?.id ?? "new"}
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={
          sentBack
            ? {
                workersPresent: sentBack.workersPresent,
                completedQuantity: sentBack.completedQuantity?.value,
                todaySummary: sentBack.todaySummary,
                tomorrowPlan: sentBack.tomorrowPlan,
                blockerSummary: sentBack.blockerSummary,
              }
            : { workersPresent: 1 }
        }
        onFinish={handleSubmit}
      >
        <Card size="small">
          <Form.Item
            label="Work done today"
            name="completedQuantity"
            extra={
              task.plannedQuantity || task.completedQuantity
                ? `So far: ${quantityProgress(task.completedQuantity, task.plannedQuantity)}`
                : "No planned amount for this task."
            }
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
            {sentBackEvidence.length > 0 && (
              <Flex vertical gap={6}>
                <Text type="secondary" className="text-[12px]!">
                  From your last update — untick to leave out
                </Text>
                <Checkbox.Group
                  value={kept}
                  onChange={(values) =>
                    sentBack && setKeptChoice({ forId: sentBack.id, ids: values as string[] })
                  }
                  options={sentBackEvidence.map((item) => ({
                    value: item.id,
                    label: item.caption || item.type,
                  }))}
                />
              </Flex>
            )}
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
              Voice notes go only to your supervisor. Photos and video are shared
              with the homeowner only after your supervisor reviews and publishes
              them.
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
          {sentBack ? "Send again" : "Send to supervisor"}
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
