import { CameraOutlined } from "@ant-design/icons"
import { Button, Flex, Form, Input, Modal, Select, Space, Typography, Upload } from "antd"
import type { UploadFile } from "antd"
import { useState } from "react"
import type { EntityId, Issue } from "../domain/models"
import { ISSUE_REPORT_PERMISSIONS } from "../domain/permissions"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { useAccess, useActableUnits } from "../session/useCan"
import { useCommand } from "../session/useCommand"
import { useScopedData } from "../session/useScopedData"
import { filesToEvidence } from "./issueEvidence"

const { Text } = Typography

interface IssueFormValues {
  title: string
  description: string
  severity: Issue["severity"]
  projectUnitId?: EntityId
  taskId?: EntityId
}

const severityOptions: Array<{ value: Issue["severity"]; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
]

/**
 * Report an issue. Its location comes from the linked task when there is one;
 * otherwise the person picks a location they may report against. Scoped
 * members must choose one, since a whole-project issue needs project-wide
 * access. Used from the Issues register and from Task Detail.
 */
export default function ReportIssueModal({
  open,
  onClose,
  projectId,
  taskId,
  dailyProgressId,
  onReported,
}: {
  open: boolean
  onClose: () => void
  projectId: EntityId
  /** Fixes the task (and so the location), e.g. when opened from Task Detail. */
  taskId?: EntityId
  dailyProgressId?: EntityId
  onReported?: (issue: Issue) => void
}) {
  const { state, reportIssue } = useConstructionData()
  const scoped = useScopedData()
  const run = useCommand()
  const can = useAccess()
  const reportableUnits = useActableUnits(ISSUE_REPORT_PERMISSIONS, projectId)
  const canWholeProject = can(ISSUE_REPORT_PERMISSIONS, projectId)
  const [form] = Form.useForm<IssueFormValues>()
  const [files, setFiles] = useState<UploadFile[]>([])
  const chosenTaskId = Form.useWatch("taskId", form) ?? taskId
  const task = chosenTaskId ? state.tasks.find((item) => item.id === chosenTaskId) : undefined
  const taskUnit = task
    ? state.projectUnits.find((unit) => unit.id === task.projectUnitId)
    : undefined

  const reportableTasks = scoped.tasks.filter(
    (item) => item.projectId === projectId && can(ISSUE_REPORT_PERMISSIONS, projectId, item),
  )

  const handleFinish = (values: IssueFormValues) => {
    const outcome = run(
      () =>
        reportIssue({
          projectId,
          // A linked task decides the location; otherwise use the chosen one.
          projectUnitId: chosenTaskId ? undefined : values.projectUnitId,
          taskId: chosenTaskId,
          dailyProgressId,
          title: values.title,
          description: values.description ?? "",
          severity: values.severity,
          evidence: filesToEvidence(files),
        }),
      { success: "Issue reported" },
    )
    if (!outcome.ok) return
    setFiles([])
    form.resetFields()
    onClose()
    onReported?.(outcome.value)
  }

  return (
    <Modal
      title="Report an issue"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Form<IssueFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ severity: "medium", taskId }}
        onFinish={handleFinish}
      >
        <Form.Item
          label="What is the problem?"
          name="title"
          rules={[{ required: true, message: "Give the issue a short title" }]}
        >
          <Input placeholder="e.g. Cracked lintel above the east window" />
        </Form.Item>
        <Form.Item label="Details" name="description">
          <Input.TextArea rows={3} placeholder="What you saw, and what needs to happen" />
        </Form.Item>
        <Form.Item label="Severity" name="severity" rules={[{ required: true }]}>
          <Select options={severityOptions} />
        </Form.Item>
        {taskId ? (
          <Text type="secondary">
            Linked to task: {task?.title ?? "Task"}
          </Text>
        ) : (
          <Form.Item label="Linked task (optional)" name="taskId">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Not linked to a task"
              options={reportableTasks.map((item) => ({ value: item.id, label: item.title }))}
            />
          </Form.Item>
        )}
        {chosenTaskId ? (
          <Text type="secondary" className="block">
            Location: {taskUnit?.name ?? "From the task"}
          </Text>
        ) : (
          <Form.Item
            label="Location"
            name="projectUnitId"
            rules={[{ required: !canWholeProject, message: "Choose where the problem is" }]}
          >
            <Select
              allowClear={canWholeProject}
              placeholder={canWholeProject ? "Whole project" : "Choose a location"}
              options={reportableUnits.map((unit) => ({
                value: unit.id,
                label: `${unit.name} · ${unit.kind}`,
              }))}
            />
          </Form.Item>
        )}
        <Form.Item label="Photos or video">
          <Upload
            multiple
            maxCount={6}
            accept="image/*,video/*"
            listType="picture"
            beforeUpload={() => false}
            fileList={files}
            onChange={({ fileList }) => setFiles(fileList)}
          >
            <Button icon={<CameraOutlined />}>Add photos or video</Button>
          </Upload>
        </Form.Item>
        <Flex justify="flex-end">
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit">
              Report issue
            </Button>
          </Space>
        </Flex>
      </Form>
    </Modal>
  )
}
