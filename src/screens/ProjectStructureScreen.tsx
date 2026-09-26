import { useMemo, useState } from "react"
import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  HomeOutlined,
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
  Modal,
  Row,
  Select,
  Space,
  Steps,
  Tag,
  Tree,
  Typography,
} from "antd"
import type { TreeDataNode } from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import LogoHorizontal from "../components/LogoHorizontal"
import type { EntityId, ProjectUnitKind } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import {
  useConstructionData,
  type AddProjectUnitInput,
} from "../mock/ConstructionDataProvider"
import { getProject, getProjectUnits } from "../mock/selectors"

const { Paragraph, Text, Title } = Typography

interface UnitFormValues {
  parentUnitId?: EntityId
  kind: ProjectUnitKind
  code: string
  name: string
}

function buildTreeData(units: ReturnType<typeof getProjectUnits>): TreeDataNode[] {
  const makeChildren = (parentUnitId?: EntityId): TreeDataNode[] =>
    units
      .filter((unit) => unit.parentUnitId === parentUnitId)
      .map((unit) => ({
        key: unit.id,
        icon: unit.kind === "house" || unit.kind === "villa"
          ? <HomeOutlined />
          : <ApartmentOutlined />,
        title: (
          <Space>
            <Text strong>{unit.name}</Text>
            <Tag>{unit.kind}</Tag>
            <Text type="secondary">{unit.code}</Text>
          </Space>
        ),
        children: makeChildren(unit.id),
      }))

  return makeChildren()
}

function ProjectStructure({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  const { state, addProjectUnit } = useConstructionData()
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm<UnitFormValues>()
  const project = getProject(state, projectId)
  const units = getProjectUnits(state, projectId)
  const treeData = useMemo(() => buildTreeData(units), [units])

  const handleAddUnit = (values: UnitFormValues) => {
    const input: AddProjectUnitInput = { ...values, projectId }
    addProjectUnit(input)
    form.resetFields()
    setModalOpen(false)
  }

  return (
    <Flex vertical className="company-form-page min-h-full">
      <Flex align="center" justify="space-between" className="business-onboarding-header">
        <LogoHorizontal height={24} />
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() =>
            onNavigate("project-overview", { project_id: projectId })
          }
        >
          Project overview
        </Button>
      </Flex>

      <Flex vertical gap="large" className="company-form-content">
        <Steps
          current={1}
          items={[
            { title: "Project details" },
            { title: "Structure" },
            { title: "Team" },
          ]}
        />

        <Row gutter={[32, 24]} align="top">
          <Col xs={24} lg={8}>
            <Flex vertical gap="middle" className="business-onboarding-intro">
              <Text className="company-eyebrow">Project structure</Text>
              <Title className="company-heading! m-0!">
                Define where construction happens
              </Title>
              <Paragraph type="secondary">
                Structure {project?.name ?? "this project"} using phases, blocks, towers,
                units, floors, zones, and locations. Tasks and progress will attach to
                these records.
              </Paragraph>
            </Flex>
          </Col>

          <Col xs={24} lg={16}>
            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Units and locations
                </Title>
              }
              extra={
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setModalOpen(true)}
                >
                  Add location
                </Button>
              }
            >
              {treeData.length ? (
                <Tree
                  showIcon
                  blockNode
                  defaultExpandAll
                  treeData={treeData}
                  className="company-structure-tree"
                />
              ) : (
                <Empty
                  description="No project locations yet"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setModalOpen(true)}
                  >
                    Add first location
                  </Button>
                </Empty>
              )}
            </Card>

            <Flex justify="flex-end" className="company-form-actions">
              <Button
                type="primary"
                disabled={!units.length}
                onClick={() =>
                  onNavigate("project-team", { project_id: projectId })
                }
              >
                Continue to project team
              </Button>
            </Flex>
          </Col>
        </Row>
      </Flex>

      <Modal
        title="Add project location"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form<UnitFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ kind: "block" }}
          onFinish={handleAddUnit}
        >
          <Form.Item label="Parent location" name="parentUnitId">
            <Select
              allowClear
              placeholder="Top-level location"
              options={units.map((unit) => ({
                value: unit.id,
                label: `${unit.name} · ${unit.kind}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="Location type"
            name="kind"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                "phase", "block", "tower", "villa", "house", "apartment",
                "floor", "zone", "room", "location",
              ].map((value) => ({ value, label: value }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Code"
                name="code"
                rules={[{ required: true, message: "Enter a code" }]}
              >
                <Input placeholder="A" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                label="Name"
                name="name"
                rules={[{ required: true, message: "Enter a name" }]}
              >
                <Input placeholder="Block A" />
              </Form.Item>
            </Col>
          </Row>
          <Flex justify="flex-end">
            <Space>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Add location</Button>
            </Space>
          </Flex>
        </Form>
      </Modal>
    </Flex>
  )
}

export default function ProjectStructureScreen({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  return (
    <CompanyThemeProvider>
      <ProjectStructure onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
