import { useEffect } from "react"
import { App, Button, Col, Flex, Form, Input, InputNumber, Modal, Row, Select, Space } from "antd"
import { useCommand } from "../../session/useCommand"
import { useActableUnits } from "../../session/useCan"
import { useScopedLibrary } from "../../session/useScopedLibrary"
import { Permissions } from "../../domain/permissions"
import type { EntityId, MessageSource, QuantityUnit, Task } from "../../domain/models"
import type { TaskDraftValues, VoiceDraft } from "../../domain/voice/types"
import {
  useConstructionData,
  type CreateTaskInput,
} from "../../mock/ConstructionDataProvider"
import { QUANTITY_UNITS, quantityUnitLabel } from "../../domain/workLibrary"
import { getWorkersForProject } from "../../mock/selectors"
import WorkTypeCascadeFields from "../WorkTypeCascadeFields"
import VoiceFieldMark, { voiceLabel, VoiceDraftBanner } from "../voice/VoiceFieldMark"

interface TaskFormValues {
  projectUnitId: EntityId
  stageId: EntityId
  tradeId: EntityId
  workTypeId: EntityId
  title: string
  priority: Task["priority"]
  plannedValue?: number
  unit?: QuantityUnit
  plannedStart?: string
  dueDate?: string
  assigneeId?: EntityId
}

export default function CreateTaskModal({
  open,
  onClose,
  projectId,
  draft,
  source,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  projectId: EntityId
  draft?: VoiceDraft<TaskDraftValues>
  source?: MessageSource
  onCreated?: (task: Task) => void
}) {
  const { state, createTask, assignTask } = useConstructionData()
  const run = useCommand()
  const { message } = App.useApp()
  const creatableUnits = useActableUnits(Permissions.TASK_MANAGE, projectId)
  const creatableLibrary = useScopedLibrary(Permissions.TASK_MANAGE, projectId)
  const [form] = Form.useForm<TaskFormValues>()

  useEffect(() => {
    if (!open || !draft) return
    const workType = state.workTypes.find((w) => w.id === draft.values.workTypeId)
    form.setFieldsValue({
      ...draft.values,
      stageId: workType?.stageId,
      tradeId: workType?.tradeId,
    })
  }, [open, draft, form, state.workTypes])

  const handleCreate = (values: TaskFormValues) => {
    const workType = state.workTypes.find((item) => item.id === values.workTypeId)
    if (!workType) return
    const template = state.taskTemplates.find(
      (item) => item.workTypeId === workType.id,
    )
    const input: CreateTaskInput = {
      projectId,
      projectUnitId: values.projectUnitId,
      stageId: workType.stageId,
      tradeId: workType.tradeId,
      workTypeId: workType.id,
      templateId: template?.id,
      title: values.title,
      priority: values.priority,
      plannedQuantity:
        values.plannedValue != null && values.unit
          ? { value: values.plannedValue, unit: values.unit }
          : undefined,
      plannedStart: values.plannedStart,
      dueDate: values.dueDate,
      source,
    }
    const outcome = run(() => createTask(input), {
      success: values.assigneeId ? undefined : "Task created",
    })
    if (!outcome.ok) return
    const task = outcome.value
    if (values.assigneeId) {
      const assigned = run(() => assignTask(task.id, "worker", values.assigneeId!), {
        success: "Task created and assigned",
      })
      if (!assigned.ok) message.warning("Task created, but it couldn't be assigned — assign it from the task page.")
    }
    form.resetFields()
    onClose()
    onCreated?.(task)
  }

  return (
    <Modal
      title="Create structured task"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      {draft ? <VoiceDraftBanner transcript={draft.transcript} /> : null}
      <Form<TaskFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ priority: "medium" }}
        onFinish={handleCreate}
      >
        <Form.Item
          label={draft ? voiceLabel("Project location", draft.fields.projectUnitId) : "Project location"}
          name="projectUnitId"
          rules={[{ required: true }]}
        >
          <Select options={creatableUnits.map((unit) => ({ value: unit.id, label: unit.name }))} />
        </Form.Item>
        <WorkTypeCascadeFields
          state={creatableLibrary}
          form={form}
          includeTitle
          workTypeMark={draft ? <VoiceFieldMark field={draft.fields.workTypeId} /> : undefined}
          titleMark={draft ? <VoiceFieldMark field={draft.fields.title} /> : undefined}
        />
        <Form.Item
          label={draft ? voiceLabel("Priority", draft.fields.priority) : "Priority"}
          name="priority"
        >
          <Select
            options={["low", "medium", "high", "critical"].map((value) => ({
              value,
              label: value,
            }))}
          />
        </Form.Item>
        <Form.Item label={voiceLabel("Assign to (optional)", draft?.fields.assigneeId)} name="assigneeId">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Not assigned yet"
            options={getWorkersForProject(state, projectId).map((w) => ({ value: w.id, label: w.name }))}
          />
        </Form.Item>
        <Row gutter={16}>
          <Col span={14}>
            <Form.Item
              label={draft ? voiceLabel("Planned quantity", draft.fields.plannedValue) : "Planned quantity"}
              name="plannedValue"
            >
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item label="Unit" name="unit">
              <Select
                options={QUANTITY_UNITS.map((value) => ({
                  value,
                  label: quantityUnitLabel(value),
                }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label={draft ? voiceLabel("Planned start", draft.fields.plannedStart) : "Planned start"}
              name="plannedStart"
            >
              <Input type="date" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={draft ? voiceLabel("Due date", draft.fields.dueDate) : "Due date"}
              name="dueDate"
            >
              <Input type="date" />
            </Form.Item>
          </Col>
        </Row>
        <Flex justify="flex-end">
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit">Create task</Button>
          </Space>
        </Flex>
      </Form>
    </Modal>
  )
}
