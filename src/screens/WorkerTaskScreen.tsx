import { useEffect, useState } from "react"
import {
  ArrowLeftOutlined,
  AudioOutlined,
  CheckCircleFilled,
  EnvironmentOutlined,
  SoundOutlined,
} from "@ant-design/icons"
import { Alert, Button, Card, Descriptions, Flex, Tag, Typography } from "antd"
import Gated from "../components/Gated"
import ThreadPanel from "../components/conversations/ThreadPanel"
import ReportIssueModal from "../components/ReportIssueModal"
import VoiceCapture from "../components/voice/VoiceCapture"
import { useVoiceContext } from "../components/voice/useVoiceContext"
import type { IssueDraftValues, VoiceDraft } from "../domain/voice/types"
import { voiceExtractor } from "../domain/voice/extract"
import WorkerShell from "../components/worker/WorkerShell"
import {
  formatQuantity,
  quantityProgress,
  priorityColor,
  reviewLabel,
  workerStatusColor,
  workerStatusLabel,
} from "../components/worker/workerLabels"
import type { EntityId, Task } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { canTransitionTask } from "../domain/taskTransitions"
import {
  taskChecklist,
  templateForTask,
  workerAssignment,
  workerNextAction,
} from "../domain/workerTasks"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getProject,
  getProjectUnits,
  getStageName,
  getTradeName,
  getWorkTypeName,
} from "../mock/selectors"
import { useSession } from "../session/SessionProvider"
import { useCommand } from "../session/useCommand"
import { useSignedInWorker } from "../session/useWorker"

const { Text, Title, Paragraph } = Typography

const canSpeak = () =>
  typeof window !== "undefined" && "speechSynthesis" in window

/** Reads the task instructions aloud (browser speech; no audio service yet). */
function ListenButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => () => window.speechSynthesis?.cancel(), [])
  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-IN"
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }
  return (
    <Gated allowed={canSpeak()} reason="This browser can't read text aloud.">
      <Button icon={<SoundOutlined />} onClick={toggle}>
        {speaking ? "Stop" : "Listen"}
      </Button>
    </Gated>
  )
}

function WorkerTask({
  onNavigate,
  projectId,
  taskId,
}: {
  onNavigate: Navigate
  projectId: EntityId
  taskId: EntityId
}) {
  const { state, acceptTaskAssignment, startTask, transitionTask } =
    useConstructionData()
  const { session } = useSession()
  const worker = useSignedInWorker()
  const run = useCommand()
  const [reportOpen, setReportOpen] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [draft, setDraft] = useState<VoiceDraft<IssueDraftValues>>()
  const voiceContext = useVoiceContext(projectId, taskId)

  const found = state.tasks.find(
    (item) => item.id === taskId && item.projectId === projectId,
  )
  // Workers only see tasks assigned to them.
  const task: Task | undefined =
    found && worker && workerAssignment(state, worker.id, found.id)
      ? found
      : undefined

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

  const project = getProject(state, task.projectId)
  const unit = getProjectUnits(state, task.projectId).find(
    (item) => item.id === task.projectUnitId,
  )
  const template = templateForTask(state, task)
  const checklist = taskChecklist(state, task)
  const workTypeName = getWorkTypeName(state, task.workTypeId)
  const myMembershipIds = new Set(
    state.memberships
      .filter(
        (item) =>
          item.principalType === "person" &&
          item.principalId === session?.personId,
      )
      .map((item) => item.id),
  )
  const myUpdates = state.dailyProgress
    .filter(
      (item) =>
        item.taskId === task.id &&
        myMembershipIds.has(item.submittedByMembershipId),
    )
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))

  const action = workerNextAction(task.status)
  const instructions = [
    task.title,
    `Location: ${project?.name ?? ""}, ${unit?.name ?? ""}.`,
    `Work: ${workTypeName}.`,
    task.plannedQuantity
      ? `Quantity: ${formatQuantity(task.plannedQuantity)}.`
      : "",
    task.dueDate ? `Due ${task.dueDate}.` : "",
    checklist.length
      ? `Checklist: ${checklist.map((item) => item.label).join(". ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ")

  const goSubmit = () =>
    onNavigate("worker-submit", {
      project_id: task.projectId,
      task_id: task.id,
    })

  const primary = (() => {
    switch (action) {
      case "accept":
        return (
          <Button
            type="primary"
            size="large"
            block
            onClick={() =>
              run(() => acceptTaskAssignment(task.id), {
                success: "Task accepted",
              })
            }
          >
            Accept task
          </Button>
        )
      case "start":
        return (
          <Button
            type="primary"
            size="large"
            block
            onClick={() =>
              run(() => startTask(task.id), { success: "Work started" })
            }
          >
            {task.status === "blocked" ? "Resume work" : "Start work"}
          </Button>
        )
      case "submit":
        return (
          <Button type="primary" size="large" block onClick={goSubmit}>
            Log today’s progress
          </Button>
        )
      case "waiting":
        return (
          <Alert
            type="info"
            showIcon
            message="Sent to your supervisor"
            description="You'll see the result here once they review your update."
          />
        )
      default:
        return <Alert type="success" showIcon message="This task is done." />
    }
  })()

  return (
    <>
      <Flex vertical gap="small">
        <Flex gap={6} wrap>
          <Tag color={workerStatusColor(task.status)} className="m-0!">
            {workerStatusLabel[task.status]}
          </Tag>
          {priorityColor(task.priority) && (
            <Tag color={priorityColor(task.priority)} className="m-0!">
              {task.priority} priority
            </Tag>
          )}
        </Flex>
        <Title level={3} className="company-heading! m-0!">
          {task.title}
        </Title>
        <Text type="secondary">
          <EnvironmentOutlined /> {project?.name} · {unit?.name ?? "Site"}
        </Text>
      </Flex>

      {primary}

      <Flex gap="small" wrap>
        <ListenButton text={instructions} />
        {(action === "start" || action === "submit") &&
          canTransitionTask(task.status, "blocked") && (
            <Button
              onClick={() =>
                run(() => transitionTask(task.id, "blocked"), {
                  success:
                    "Marked blocked — tell your supervisor what's needed",
                })
              }
            >
              I'm blocked
            </Button>
          )}
        <Button icon={<AudioOutlined />} onClick={() => setCapturing(true)}>Speak an issue</Button>
        <Button onClick={() => setReportOpen(true)}>Report a problem</Button>
      </Flex>

      <Card size="small" title="Work">
        <Descriptions
          size="small"
          column={1}
          items={[
            { key: "work", label: "Work type", children: workTypeName },
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
              key: "quantity",
              label: "Progress",
              children: quantityProgress(task.completedQuantity, task.plannedQuantity),
            },
            { key: "due", label: "Due", children: task.dueDate ?? "—" },
          ]}
        />
      </Card>

      <Card size="small" title="Checklist">
        {checklist.length ? (
          <Flex vertical gap={6}>
            {checklist.map((item) => (
              <Flex key={item.id} gap="small" align="flex-start">
                <CheckCircleFilled
                  style={{
                    color: item.completed ? "#16A34A" : "#D6D3D1",
                    marginTop: 4,
                  }}
                />
                <Text>{item.label}</Text>
              </Flex>
            ))}
          </Flex>
        ) : (
          <Text type="secondary">No checklist for this task.</Text>
        )}
        {template?.requiredEvidence.length ? (
          <Flex gap={6} wrap align="center" className="mt-3!">
            <Text type="secondary" className="text-[13px]!">
              Evidence needed:
            </Text>
            {template.requiredEvidence.map((type) => (
              <Tag key={type} className="m-0!">
                {type}
              </Tag>
            ))}
          </Flex>
        ) : null}
      </Card>

      <Card size="small" title="My updates">
        {myUpdates.length ? (
          <Flex vertical gap="middle">
            {myUpdates.map((item) => (
              <Flex key={item.id} vertical gap={2}>
                <Flex align="center" justify="space-between" gap="small">
                  <Text strong>
                    {item.date}
                    {item.completedQuantity
                      ? ` · ${formatQuantity(item.completedQuantity)}`
                      : ""}
                  </Text>
                  <Tag
                    color={reviewLabel[item.reviewStatus].color}
                    className="m-0!"
                  >
                    {reviewLabel[item.reviewStatus].text}
                  </Tag>
                </Flex>
                <Paragraph
                  type="secondary"
                  className="m-0!"
                  ellipsis={{ rows: 2 }}
                >
                  {item.todaySummary}
                </Paragraph>
                {item.review?.note && item.reviewStatus !== "approved" && (
                  <Text type="secondary" className="text-[13px]!">
                    “{item.review.note}”
                  </Text>
                )}
              </Flex>
            ))}
          </Flex>
        ) : (
          <Text type="secondary">No updates sent yet.</Text>
        )}
      </Card>

      <Card size="small" title="Discussion">
        <ThreadPanel
          key={task.id}
          compact
          projectId={task.projectId}
          subject="task"
          targetId={task.id}
          emptyText="Ask your supervisor about this task."
          // Workers open tasks from a message's chips; issue chips stay plain text.
          openableKinds={["task"]}
          onOpenRecord={(kind, id) => {
            if (kind === "task") onNavigate("worker-task", { project_id: task.projectId, task_id: id })
          }}
        />
      </Card>

      <ReportIssueModal
        open={reportOpen}
        onClose={() => {
          setReportOpen(false)
          setDraft(undefined)
        }}
        projectId={task.projectId}
        taskId={task.id}
        draft={draft}
        onReported={() => setDraft(undefined)}
      />

      <VoiceCapture
        open={capturing}
        title="Speak an issue"
        placeholder="e.g. Water leak in the Block B basement, pump stopped"
        onCancel={() => setCapturing(false)}
        onDraft={(text) => {
          setCapturing(false)
          setDraft(voiceExtractor.issue(text, voiceContext))
          setReportOpen(true)
        }}
      />
    </>
  )
}

export default function WorkerTaskScreen({
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
          onClick={() => onNavigate("worker-today")}
        >
          Today
        </Button>
      }
    >
      <WorkerTask
        onNavigate={onNavigate}
        projectId={projectId}
        taskId={taskId}
      />
    </WorkerShell>
  )
}
