import type { MouseEvent, ReactNode } from "react"
import {
  CalendarOutlined,
  EnvironmentOutlined,
  LogoutOutlined,
  MessageOutlined,
} from "@ant-design/icons"
import { Alert, Badge, Button, Card, Flex, Tag, Typography } from "antd"
import WorkerShell from "../components/worker/WorkerShell"
import {
  priorityColor,
  workerStatusColor,
  workerStatusLabel,
} from "../components/worker/workerLabels"
import type { Task } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { workerDay, workerNextAction } from "../domain/workerTasks"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getUnreadTotal } from "../mock/conversationSelectors"
import {
  getChangesRequested,
  getMyMembershipIds,
  getProject,
  getProjectUnits,
  getWorkTypeName,
} from "../mock/selectors"
import { useSession } from "../session/SessionProvider"
import { useCommand } from "../session/useCommand"
import { useSignedInWorker } from "../session/useWorker"

const { Text, Title } = Typography

function greeting(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function TaskCard({
  task,
  onOpen,
  action,
}: {
  task: Task
  onOpen: () => void
  action?: { label: string; primary?: boolean; onClick: () => void }
}) {
  const { state } = useConstructionData()
  const project = getProject(state, task.projectId)
  const unit = getProjectUnits(state, task.projectId).find(
    (item) => item.id === task.projectUnitId,
  )
  return (
    <Card
      size="small"
      hoverable
      className="worker-task-card"
      onClick={onOpen}
      role="button"
      aria-label={`Open ${task.title}`}
    >
      <Flex vertical gap="small">
        <Flex align="flex-start" justify="space-between" gap="small">
          <Text strong>{task.title}</Text>
          <Tag color={workerStatusColor(task.status)} className="m-0! shrink-0">
            {workerStatusLabel[task.status]}
          </Tag>
        </Flex>
        <Text type="secondary" className="text-[13px]!">
          <EnvironmentOutlined /> {project?.name} · {unit?.name ?? "Site"}
        </Text>
        <Flex align="center" justify="space-between" gap="small" wrap>
          <Flex gap={6} wrap>
            <Tag className="m-0!">
              {getWorkTypeName(state, task.workTypeId)}
            </Tag>
            {task.dueDate && (
              <Tag icon={<CalendarOutlined />} className="m-0!">
                Due {task.dueDate}
              </Tag>
            )}
            {priorityColor(task.priority) && (
              <Tag color={priorityColor(task.priority)} className="m-0!">
                {task.priority}
              </Tag>
            )}
          </Flex>
          {action && (
            <Button
              size="small"
              type={action.primary ? "primary" : "default"}
              onClick={(event: MouseEvent) => {
                event.stopPropagation()
                action.onClick()
              }}
            >
              {action.label}
            </Button>
          )}
        </Flex>
      </Flex>
    </Card>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: ReactNode
}) {
  return (
    <Flex vertical gap="small">
      <Text className="company-eyebrow">
        {title} · {count}
      </Text>
      {children}
    </Flex>
  )
}

function Today({ onNavigate }: { onNavigate: Navigate }) {
  const { state, acceptTaskAssignment, startTask } = useConstructionData()
  const { session } = useSession()
  const worker = useSignedInWorker()
  const run = useCommand()

  if (!worker) {
    return (
      <Alert
        type="warning"
        showIcon
        message="This sign-in isn't linked to a worker profile"
        description="Ask your supervisor to add your phone number to the workforce list."
        action={<Button onClick={() => onNavigate("welcome")}>Sign out</Button>}
      />
    )
  }

  const day = workerDay(state, worker.id)
  const mine = getMyMembershipIds(state, session?.personId)
  const sentBack = getChangesRequested(state, mine)
  const open = (task: Task) =>
    onNavigate("worker-task", { project_id: task.projectId, task_id: task.id })
  const nothingToDo = day.toAccept.length + day.today.length === 0

  const actionFor = (task: Task) => {
    switch (workerNextAction(task.status)) {
      case "accept":
        return {
          label: "Accept",
          primary: true,
          onClick: () =>
            run(() => acceptTaskAssignment(task.id), {
              success: "Task accepted",
            }),
        }
      case "start":
        return {
          label: task.status === "blocked" ? "Resume" : "Start",
          primary: true,
          onClick: () => {
            const outcome = run(() => startTask(task.id), {
              success: "Work started",
            })
            if (outcome.ok) open(task)
          },
        }
      case "submit":
        return {
          label: "Log progress",
          primary: true,
          onClick: () =>
            onNavigate("worker-submit", {
              project_id: task.projectId,
              task_id: task.id,
            }),
        }
      default:
        return undefined
    }
  }

  return (
    <>
      <Flex vertical gap={4}>
        <Text className="company-eyebrow">
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </Text>
        <Title level={3} className="company-heading! m-0!">
          {greeting(new Date())}, {worker.name.split(" ")[0]}
        </Title>
        <Text type="secondary">
          {nothingToDo
            ? "Nothing assigned for today. Your supervisor will send new tasks here."
            : `${day.today.length} task${
                day.today.length === 1 ? "" : "s"
              } to work on` +
              (day.toAccept.length
                ? ` · ${day.toAccept.length} new to accept`
                : "")}
        </Text>
      </Flex>

      {sentBack.length > 0 && (
        <Section title="Changes requested" count={sentBack.length}>
          {sentBack.map((item) => {
            const task = state.tasks.find((t) => t.id === item.taskId)
            if (!task) return null
            return (
              <Alert
                key={item.id}
                type="warning"
                showIcon
                message={task.title}
                description={item.review?.note}
                action={
                  <Button
                    size="small"
                    type="primary"
                    onClick={() =>
                      onNavigate("worker-submit", {
                        project_id: task.projectId,
                        task_id: task.id,
                      })
                    }
                  >
                    Fix and resend
                  </Button>
                }
              />
            )
          })}
        </Section>
      )}

      {day.toAccept.length > 0 && (
        <Section title="New tasks" count={day.toAccept.length}>
          {day.toAccept.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={() => open(task)}
              action={actionFor(task)}
            />
          ))}
        </Section>
      )}

      <Section title="Today's work" count={day.today.length}>
        {day.today.length ? (
          day.today.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={() => open(task)}
              action={actionFor(task)}
            />
          ))
        ) : (
          <Text type="secondary" className="text-[13px]!">
            No tasks in progress.
          </Text>
        )}
      </Section>

      {day.waiting.length > 0 && (
        <Section title="Waiting for supervisor" count={day.waiting.length}>
          {day.waiting.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={() => open(task)} />
          ))}
        </Section>
      )}

      {day.done.length > 0 && (
        <Section title="Done" count={day.done.length}>
          {day.done.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={() => open(task)} />
          ))}
        </Section>
      )}
    </>
  )
}

export default function WorkerTodayScreen({
  onNavigate,
}: {
  onNavigate: Navigate
}) {
  const { state } = useConstructionData()
  const { session } = useSession()
  const unread = getUnreadTotal(state, session)
  return (
    <WorkerShell
      headerAction={
        <Flex gap="small">
          <Badge count={unread} size="small">
            <Button icon={<MessageOutlined />} onClick={() => onNavigate("worker-messages")}>
              Messages
            </Button>
          </Badge>
          <Button icon={<LogoutOutlined />} onClick={() => onNavigate("welcome")}>
            Sign out
          </Button>
        </Flex>
      }
    >
      <Today onNavigate={onNavigate} />
    </WorkerShell>
  )
}
