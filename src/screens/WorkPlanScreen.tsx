import { useState } from "react"
import {
  ArrowLeftOutlined,
  PlusOutlined,
} from "@ant-design/icons"
import {
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd"
import type { TableProps } from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import LogoHorizontal from "../components/LogoHorizontal"
import WorkTypeCascadeFields from "../components/WorkTypeCascadeFields"
import type { EntityId, QuantityUnit, WorkPlanItem } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import {
  useConstructionData,
  type AddWorkPlanItemInput,
} from "../mock/ConstructionDataProvider"
import {
  getProject,
  getProjectUnits,
  getStageName,
  getTradeName,
  getWorkTypeName,
} from "../mock/selectors"

const { Paragraph, Text, Title } = Typography

interface PlanFormValues {
  projectUnitId: EntityId
  stageId: EntityId
  tradeId: EntityId
  workTypeId: EntityId
  plannedValue: number
  unit: QuantityUnit
  plannedStart?: string
  dueDate?: string
}

function WorkPlan({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  const { state, addWorkPlanItem } = useConstructionData()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm<PlanFormValues>()
  const project = getProject(state, projectId)
  const units = getProjectUnits(state, projectId)
  const items = state.workPlanItems.filter((item) => item.projectId === projectId)

  const columns: TableProps<WorkPlanItem>["columns"] = [
    {
      title: "Planned work",
      key: "work",
      render: (_, item) => (
        <Flex vertical gap={2}>
          <Text strong>{getWorkTypeName(state, item.workTypeId)}</Text>
          <Text type="secondary">
            {getStageName(state, item.stageId)} · {getTradeName(state, item.tradeId)}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Location",
      key: "location",
      render: (_, item) => (
        <Text>{units.find((unit) => unit.id === item.projectUnitId)?.name ?? "Location"}</Text>
      ),
    },
    {
      title: "Quantity",
      key: "quantity",
      render: (_, item) => (
        <Text>{item.plannedQuantity.value} {item.plannedQuantity.unit}</Text>
      ),
    },
    {
      title: "Dates",
      key: "dates",
      responsive: ["md"],
      render: (_, item) => (
        <Text type="secondary">{item.plannedStart ?? "TBD"} → {item.dueDate ?? "TBD"}</Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: WorkPlanItem["status"]) => <Tag color="processing">{status}</Tag>,
    },
  ]

  const handleAdd = (values: PlanFormValues) => {
    const workType = state.workTypes.find((item) => item.id === values.workTypeId)
    if (!workType) return
    const template = state.taskTemplates.find(
      (item) => item.workTypeId === workType.id,
    )
    const input: AddWorkPlanItemInput = {
      projectId,
      projectUnitId: values.projectUnitId,
      stageId: workType.stageId,
      tradeId: workType.tradeId,
      workTypeId: workType.id,
      templateId: template?.id,
      plannedQuantity: { value: values.plannedValue, unit: values.unit },
      plannedStart: values.plannedStart,
      dueDate: values.dueDate,
    }
    addWorkPlanItem(input)
    form.resetFields()
    setModalOpen(false)
  }

  return (
    <Flex vertical className="company-form-page min-h-full">
      <Flex align="center" justify="space-between" className="business-onboarding-header">
        <LogoHorizontal height={24} />
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => onNavigate("project-overview", { project_id: projectId })}
        >
          Project overview
        </Button>
      </Flex>

      <Flex vertical gap="large" className="company-form-content">
        <Flex align="flex-start" justify="space-between" gap="middle" wrap>
          <Flex vertical gap="small">
            <Text className="company-eyebrow">Project work plan</Text>
            <Title level={2} className="company-heading! m-0!">
              {project?.name ?? "Project"}
            </Title>
            <Paragraph type="secondary" className="m-0!">
              Apply standardized construction work to project locations.
            </Paragraph>
          </Flex>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Add planned work
          </Button>
        </Flex>

        <Card
          title={
            <Title level={5} className="company-heading! m-0!">
              Planned construction work
            </Title>
          }
          classNames={{ body: items.length ? "company-table-card-body" : undefined }}
        >
          {items.length ? (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={items}
              pagination={false}
              scroll={{ x: 760 }}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No planned work yet">
              <Button type="primary" onClick={() => setModalOpen(true)}>
                Add planned work
              </Button>
            </Empty>
          )}
        </Card>
      </Flex>

      <Modal
        title="Add planned work"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form<PlanFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleAdd}
        >
          <Form.Item label="Project location" name="projectUnitId" rules={[{ required: true }]}>
            <Select
              options={units.map((unit) => ({
                value: unit.id,
                label: `${unit.name} · ${unit.kind}`,
              }))}
            />
          </Form.Item>
          <WorkTypeCascadeFields state={state} form={form} />
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item label="Planned quantity" name="plannedValue" rules={[{ required: true }]}>
                <InputNumber min={0} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                label="Unit"
                name="unit"
                rules={[{ required: true }]}
              >
                <Select
                  options={["nos", "m", "m2", "m3", "kg", "tonne", "day", "percentage"].map(
                    (unit) => ({ value: unit, label: unit }),
                  )}
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
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Add to work plan</Button>
            </Space>
          </Flex>
        </Form>
      </Modal>
    </Flex>
  )
}

export default function WorkPlanScreen({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  return (
    <CompanyThemeProvider>
      <WorkPlan onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
