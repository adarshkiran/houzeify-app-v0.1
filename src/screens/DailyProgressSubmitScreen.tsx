import { useMemo, useRef, useState } from "react"
import {
  ArrowLeftOutlined,
  CameraOutlined,
  DeleteOutlined,
  PictureOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons"
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
  Upload,
} from "antd"
import CameraCaptureModal, {
  type CameraCaptureMode,
} from "../components/CameraCaptureModal"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import LogoHorizontal from "../components/LogoHorizontal"
import VoiceTextArea from "../components/VoiceTextArea"
import type { EntityId, EvidenceType } from "../domain/models"
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

interface DraftEvidence {
  type: EvidenceType
  url: string
  caption: string
}

interface ProgressFormValues {
  taskId?: EntityId
  workersPresent: number
  progressAfter: number
  todaySummary: string
  tomorrowPlan: string
  blockerSummary?: string
}

function isTouchDevice() {
  return (
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0)
  )
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
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraMode, setCameraMode] = useState<CameraCaptureMode>("photo")
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
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

  const addEvidenceFile = (file: File) => {
    const type: EvidenceType = file.type.startsWith("video/") ? "video" : "photo"
    setEvidence((current) => [
      ...current,
      {
        type,
        url: URL.createObjectURL(file),
        caption:
          type === "video"
            ? `Video ${new Date().toLocaleTimeString("en-IN")}`
            : file.name,
      },
    ])
  }

  const openCapture = (mode: CameraCaptureMode) => {
    setCameraMode(mode)
    if (isTouchDevice()) {
      if (mode === "video") videoInputRef.current?.click()
      else cameraInputRef.current?.click()
      return
    }
    setCameraOpen(true)
  }

  const removeEvidence = (url: string) => {
    setEvidence((current) => {
      const next = current.filter((item) => item.url !== url)
      URL.revokeObjectURL(url)
      return next
    })
  }

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
    <Flex vertical className="company-form-page min-h-full">
      <Flex align="center" justify="space-between" className="business-onboarding-header">
        <LogoHorizontal height={24} />
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
      </Flex>

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
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              aria-hidden
              tabIndex={-1}
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) addEvidenceFile(file)
                event.target.value = ""
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              aria-hidden
              tabIndex={-1}
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) addEvidenceFile(file)
                event.target.value = ""
              }}
            />

            <Flex vertical gap="middle">
              <Flex gap="small" wrap>
                <Button
                  type="primary"
                  icon={<CameraOutlined />}
                  onClick={() => openCapture("photo")}
                >
                  Photo
                </Button>
                <Button
                  icon={<VideoCameraOutlined />}
                  onClick={() => openCapture("video")}
                >
                  Record video
                </Button>
                <Upload
                  accept="image/*,video/*"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    addEvidenceFile(file)
                    return false
                  }}
                >
                  <Button icon={<PictureOutlined />}>Gallery</Button>
                </Upload>
              </Flex>

              {evidence.length ? (
                <Flex gap="small" wrap>
                  {evidence.map((item) => (
                    <div key={item.url} className="relative shrink-0">
                      {item.type === "video" ? (
                        <video
                          src={item.url}
                          controls
                          playsInline
                          preload="metadata"
                          className="h-24 w-36 object-cover bg-[#1C1917]"
                          style={{ borderRadius: "var(--ant-border-radius-lg)" }}
                        />
                      ) : (
                        <img
                          src={item.url}
                          alt={item.caption}
                          className="h-24 w-36 object-cover"
                          style={{ borderRadius: "var(--ant-border-radius-lg)" }}
                        />
                      )}
                      <Tag className="absolute! left-1 bottom-1 m-0!">{item.type}</Tag>
                      <Button
                        size="small"
                        danger
                        type="primary"
                        icon={<DeleteOutlined />}
                        aria-label={`Remove ${item.caption}`}
                        className="absolute! top-1 right-1"
                        onClick={() => removeEvidence(item.url)}
                      />
                    </div>
                  ))}
                </Flex>
              ) : (
                <Text type="secondary" className="m-0! text-[13px]!">
                  No files yet — use Photo, Record video, or Gallery above.
                </Text>
              )}
            </Flex>
          </Card>

          <Flex className="company-form-actions" justify="flex-end">
            <Button type="primary" htmlType="submit">
              Send for review
            </Button>
          </Flex>
        </Form>
      </Flex>

      <CameraCaptureModal
        open={cameraOpen}
        mode={cameraMode}
        onClose={() => setCameraOpen(false)}
        onCapture={(_file, previewUrl, kind) => {
          setEvidence((current) => [
            ...current,
            {
              type: kind,
              url: previewUrl,
              caption: `${kind === "video" ? "Video" : "Photo"} ${new Date().toLocaleTimeString("en-IN")}`,
            },
          ])
        }}
      />
    </Flex>
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
