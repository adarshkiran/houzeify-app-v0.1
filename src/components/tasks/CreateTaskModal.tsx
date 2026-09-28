import { Button, Col, Flex, Form, Input, InputNumber, Modal, Row, Select, Space } from "antd"
import { useCommand } from "../../session/useCommand"
import { useActableUnits } from "../../session/useCan"
import { useScopedLibrary } from "../../session/useScopedLibrary"
import { Permissions } from "../../domain/permissions"
import type { EntityId, QuantityUnit, Task } from "../../domain/models"
import {
  useConstructionData,
  type CreateTaskInput,
} from "../../mock/ConstructionDataProvider"
import { QUANTITY_UNITS, quantityUnitLabel } from "../../domain/workLibrary"
import WorkTypeCascadeFields from "../WorkTypeCascadeFields"

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
}

export default function CreateTaskModal({
  open,
  onClose,
  projectId,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  projectId: EntityId
  onCreated?: (task: Task) => void
}) {
  const { state, createTask } = useConstructionData()
  const run = useCommand()
  const creatableUnits = useActableUnits(Permissions.TASK_MANAGE, projectId)
  const creatableLibrary = useScopedLibrary(Permissions.TASK_MANAGE, projectId)
  const [form] = Form.useForm<TaskFormValues>()

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
    }
    const outcome = run(() => createTask(input), { success: "Task created" })
    if (!outcome.ok) return
    form.resetFields()
    onClose()
    onCreated?.(outcome.value)
  }

  return (
    <Modal
      title="Create structured task"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Form<TaskFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ priority: "medium" }}
        onFinish={handleCreate}
      >
        <Form.Item label="Project location" name="projectUnitId" rules={[{ required: true }]}>
          <Select options={creatableUnits.map((unit) => ({ value: unit.id, label: unit.name }))} />
        </Form.Item>
        <WorkTypeCascadeFields state={creatableLibrary} form={form} includeTitle />
        <Form.Item label="Priority" name="priority">
          <Select
            options={["low", "medium", "high", "critical"].map((value) => ({
              value,
              label: value,
            }))}
          />
        </Form.Item>
        <Row gutter={16}>
          <Col span={14}>
            <Form.Item label="Planned quantity" name="plannedValue">
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
            <Form.Item label="Planned start" name="plannedStart">
              <Input type="date" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Due date" name="dueDate">
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
