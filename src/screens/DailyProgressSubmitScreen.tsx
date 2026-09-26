import { useMemo, useState } from "react"
import {
  ArrowLeftOutlined,
  CameraOutlined,
  DeleteOutlined,
  PlusOutlined,
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
  Space,
  Tag,
  Typography,
  Upload,
  message,
} from "antd"
import type { UploadFile } from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import LogoHorizontal from "../components/LogoHorizontal"
import type { EntityId, EvidenceType } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import {
  getProject,
  getProjectUnits,
  getStageName,
  getTradeName,
  getWorkTypeName,
} from "../mock/selectors"

const { Paragraph, Text, Title } = Typography
const { TextArea } = Input

interface ProgressFormValues {
  projectId: EntityId
  projectUnitId: EntityId
  taskId?: EntityId
  date: string
  workersPresent: number
  progressAfter: number
  yesterdaySummary?: string
  todaySummary: string
  tomorrowPlan: string
  blockerSummary?: string
}

interface EvidenceStub {
  uid: string
  url: string
  caption: string
  type: EvidenceType
}

function DailyProgressSubmit({
  onNavigate,
  projectId,
  taskId,
}: {
  onNavigate: Navigate
  projectId: EntityId
  taskId?: EntityId
}) {
  const { state, submitDailyProgress } = useConstructionData()
  const [form] = Form.useForm<ProgressFormValues>()
  const [evidenceStubs, setEvidenceStubs] = useState<EvidenceStub[]>([])
  const [submitting, setSubmitting] = useState(false)

  const selectedProjectId = Form.useWatch("projectId", form) ?? projectId
  const selectedTaskId = Form.useWatch("taskId", form) ?? taskId
  const project = getProject(state, selectedProjectId)
  const units = getProjectUnits(state, selectedProjectId)
  const projectTasks = state.tasks.filter((task) => task.projectId === selectedProjectId)
  const selectedTask = state.tasks.find((task) => task.id === selectedTaskId)
  const template = state.taskTemplates.find(
    (item) => item.id === selectedTask?.templateId,
  )
  const requiredEvidence = template?.requiredEvidence ?? ["photo"]

  const initialValues = useMemo<ProgressFormValues>(
    () => ({
      projectId,
      projectUnitId: selectedTask?.projectUnitId ?? units[0]?.id ?? "",
      taskId: taskId,
      date: "2026-09-21",
      workersPresent: 6,
      progressAfter: Math.min(100, (project?.progress ?? 0) + 2),
      yesterdaySummary: "",
      todaySummary: "",
      tomorrowPlan: "",
      blockerSummary: "",
    }),
    [project?.progress, projectId, selectedTask?.projectUnitId, taskId, units],
  )

  const handleUpload = (file: UploadFile) => {
    const raw = file.originFileObj
    if (!raw) return false
    const url = URL.createObjectURL(raw)
    setEvidenceStubs((current) => [
      ...current,
      {
        uid: file.uid,
        url,
        caption: raw.name,
        type: raw.type.startsWith("video/") ? "video" : "photo",
      },
    ])
    return false
  }

  const removeEvidence = (uid: string) => {
    setEvidenceStubs((current) => {
      const target = current.find((item) => item.uid === uid)
      if (target?.url.startsWith("blob:")) URL.revokeObjectURL(target.url)
      return current.filter((item) => item.uid !== uid)
    })
  }

  const handleFinish = (values: ProgressFormValues) => {
    const task = state.tasks.find((item) => item.id === values.taskId)
    if (!task && !values.taskId) {
      message.error("Select a task for this progress update.")
      return
    }

    const resolvedTask = task ?? selectedTask
    if (!resolvedTask) {
      message.error("Select a task for this progress update.")
      return
    }

    setSubmitting(true)
    try {
      const progress = submitDailyProgress({
        projectId: values.projectId,
        projectUnitId: values.projectUnitId || resolvedTask.projectUnitId,
        taskId: resolvedTask.id,
        stageId: resolvedTask.stageId,
        tradeId: resolvedTask.tradeId,
        workTypeId: resolvedTask.workTypeId,
        date: values.date,
        workersPresent: values.workersPresent,
        plannedQuantity: resolvedTask.plannedQuantity,
        completedQuantity: resolvedTask.completedQuantity,
        progressBefore: project?.progress,
        progressAfter: values.progressAfter,
        yesterdaySummary: values.yesterdaySummary,
        todaySummary: values.todaySummary,
        tomorrowPlan: values.tomorrowPlan,
        blockerSummary: values.blockerSummary,
        evidence: evidenceStubs.map((item) => ({
          type: item.type,
          url: item.url,
          caption: item.caption,
        })),
      })

      message.success("Daily progress submitted for review")
      onNavigate("daily-progress-review", {
        project_id: progress.projectId,
        progress_id: progress.id,
      })
    } finally {
      setSubmitting(false)
    }
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
          Back
        </Button>
      </Flex>

      <Flex vertical gap="large" className="company-form-content">
        <Row gutter={[32, 24]} align="top">
          <Col xs={24} lg={8}>
            <Flex vertical gap="middle" className="business-onboarding-intro">
              <Text className="company-eyebrow">Site progress</Text>
              <Title className="company-heading! m-0!">
                Log today&apos;s progress with evidence
              </Title>
              <Paragraph type="secondary">
                Capture workforce, percentage complete, the Y/T/T narrative, and photo
                stubs. Submissions stay private until company review.
              </Paragraph>
              {selectedTask && (
                <Alert
                  type="info"
                  showIcon
                  message={selectedTask.title}
                  description={`${getStageName(state, selectedTask.stageId)} · ${getTradeName(state, selectedTask.tradeId)} · ${getWorkTypeName(state, selectedTask.workTypeId)}`}
                />
              )}
            </Flex>
          </Col>

          <Col xs={24} lg={16}>
            <Card>
              <Form<ProgressFormValues>
                form={form}
                layout="vertical"
                initialValues={initialValues}
                onFinish={handleFinish}
                requiredMark="optional"
              >
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="projectId"
                      label="Project"
                      rules={[{ required: true, message: "Select a project" }]}
                    >
                      <Select
                        options={state.projects.map((item) => ({
                          value: item.id,
                          label: item.name,
                        }))}
                        onChange={(value) => {
                          const nextUnits = getProjectUnits(state, value)
                          const nextTasks = state.tasks.filter(
                            (task) => task.projectId === value,
                          )
                          form.setFieldsValue({
                            projectUnitId: nextUnits[0]?.id,
                            taskId: nextTasks[0]?.id,
                          })
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="projectUnitId"
                      label="Location / unit"
                      rules={[{ required: true, message: "Select a unit" }]}
                    >
                      <Select
                        options={units.map((unit) => ({
                          value: unit.id,
                          label: unit.name,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="taskId"
                      label="Task"
                      rules={[{ required: true, message: "Select a task" }]}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        options={projectTasks.map((task) => ({
                          value: task.id,
                          label: task.title,
                        }))}
                        onChange={(value) => {
                          const task = state.tasks.find((item) => item.id === value)
                          if (task) {
                            form.setFieldsValue({ projectUnitId: task.projectUnitId })
                          }
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="date"
                      label="Work date"
                      rules={[{ required: true, message: "Pick a date" }]}
                    >
                      <Input type="date" />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={8}>
                    <Form.Item
                      name="workersPresent"
                      label="Workers present"
                      rules={[{ required: true, message: "Enter workforce" }]}
                    >
                      <InputNumber min={1} max={200} className="w-full" />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={8}>
                    <Form.Item
                      name="progressAfter"
                      label="Progress after (%)"
                      rules={[{ required: true, message: "Enter progress %" }]}
                    >
                      <InputNumber min={0} max={100} className="w-full" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="yesterdaySummary" label="Yesterday">
                  <TextArea rows={2} placeholder="What was completed previously" />
                </Form.Item>
                <Form.Item
                  name="todaySummary"
                  label="Today"
                  rules={[{ required: true, message: "Summarize today's work" }]}
                >
                  <TextArea rows={3} placeholder="What was completed today" />
                </Form.Item>
                <Form.Item
                  name="tomorrowPlan"
                  label="Tomorrow"
                  rules={[{ required: true, message: "Add tomorrow's plan" }]}
                >
                  <TextArea rows={2} placeholder="Planned work for tomorrow" />
                </Form.Item>
                <Form.Item name="blockerSummary" label="Blocker (optional)">
                  <TextArea rows={2} placeholder="Anything blocking progress" />
                </Form.Item>

                <Flex vertical gap="middle" className="mb-6">
                  <Flex align="center" justify="space-between" wrap gap="small">
                    <Title level={5} className="company-heading! m-0!">
                      Evidence
                    </Title>
                    <Space wrap>
                      {requiredEvidence.map((type) => (
                        <Tag key={type} icon={<CameraOutlined />}>
                          Required: {type}
                        </Tag>
                      ))}
                    </Space>
                  </Flex>
                  <Upload
                    accept="image/*,video/*"
                    beforeUpload={() => false}
                    showUploadList={false}
                    onChange={({ file }) => handleUpload(file)}
                  >
                    <Button icon={<PlusOutlined />}>Add photo stub</Button>
                  </Upload>
                  {evidenceStubs.length ? (
                    <Row gutter={[12, 12]}>
                      {evidenceStubs.map((item) => (
                        <Col xs={12} sm={8} md={6} key={item.uid}>
                          <Card
                            size="small"
                            cover={
                              <div className="evidence-stub-thumb">
                                <img src={item.url} alt={item.caption} />
                              </div>
                            }
                            actions={[
                              <Button
                                key="remove"
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => removeEvidence(item.uid)}
                              />,
                            ]}
                          >
                            <Text ellipsis>{item.caption}</Text>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <Text type="secondary">
                      Add photo stubs from the device gallery. Files stay local as object
                      URLs for this prototype.
                    </Text>
                  )}
                </Flex>

                <Flex gap="middle" wrap className="company-form-actions">
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={submitting}
                    size="large"
                  >
                    Submit for review
                  </Button>
                  <Button
                    size="large"
                    onClick={() =>
                      onNavigate("daily-progress-review", { project_id: projectId })
                    }
                  >
                    Open review queue
                  </Button>
                </Flex>
              </Form>
            </Card>
          </Col>
        </Row>
      </Flex>
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
      <DailyProgressSubmit
        onNavigate={onNavigate}
        projectId={projectId}
        taskId={taskId}
      />
    </CompanyThemeProvider>
  )
}
