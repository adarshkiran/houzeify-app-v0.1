import Gated from "../components/Gated"
import { Permissions } from "../domain/permissions"
import { useAccess, useActableUnits } from "../session/useCan"
import { useCommand } from "../session/useCommand"
import { useMemo, useState } from "react"
import {
  ApartmentOutlined,
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
  InputNumber,
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
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import type { EntityId, ProjectUnitKind } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import {
  buildBatchUnitLabels,
  isMultiUnitProjectKind,
} from "../domain/projectSetup"
import {
  useConstructionData,
  type AddProjectUnitInput,
} from "../mock/ConstructionDataProvider"
import { getProject, getProjectUnits } from "../mock/selectors"

const { Text, Title } = Typography

interface UnitFormValues {
  parentUnitId?: EntityId
  kind: ProjectUnitKind
  code: string
  name: string
  count?: number
}

function buildTreeData(units: ReturnType<typeof getProjectUnits>): TreeDataNode[] {
  // A unit whose parent is hidden (outside the viewer's scope) becomes a root.
  const visibleIds = new Set(units.map((unit) => unit.id))
  const makeChildren = (parentUnitId?: EntityId): TreeDataNode[] =>
    units
      .filter((unit) =>
        parentUnitId === undefined
          ? !unit.parentUnitId || !visibleIds.has(unit.parentUnitId)
          : unit.parentUnitId === parentUnitId,
      )
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
  setup,
}: {
  onNavigate: Navigate
  projectId: EntityId
  /** Reached from project creation: show the steps and the continue button. */
  setup: boolean
}) {
  const { state, addProjectUnit, addProjectUnits, setStageBaselines } = useConstructionData()
  const run = useCommand()
  const can = useAccess()
  const manageableUnits = useActableUnits(Permissions.PROJECT_MANAGE, projectId)
  // A top-level location is a whole-project change; scoped members add beneath their units.
  const canAddTopLevel = can(Permissions.PROJECT_MANAGE, projectId)
  const canManage = canAddTopLevel || manageableUnits.length > 0
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm<UnitFormValues>()
  const project = getProject(state, projectId)
  const units = getProjectUnits(state, projectId).filter((unit) =>
    can(Permissions.PROJECT_READ, projectId, { projectUnitId: unit.id }),
  )
  const treeData = useMemo(() => buildTreeData(units), [units])
  const allowBulk = Boolean(project && isMultiUnitProjectKind(project.kind))
  const stages = [...state.stages].sort((a, b) => a.sequence - b.sequence)
  const [baselines, setBaselines] = useState<Record<string, number>>(() => project?.stageBaselines ?? {})
  const saveBaselines = () =>
    run(() => setStageBaselines(projectId, baselines), { success: "Work already done saved" })

  const handleAddUnit = (values: UnitFormValues) => {
    const count = values.count && values.count > 1 ? Math.floor(values.count) : 1
    const outcome = run(
      () => {
        if (count > 1) {
          const labels = buildBatchUnitLabels({
            count,
            kind: values.kind,
            codePrefix: values.code,
            namePrefix: values.name,
          })
          return addProjectUnits(
            labels.map((label) => ({
              projectId,
              parentUnitId: values.parentUnitId,
              kind: values.kind,
              code: label.code,
              name: label.name,
            })),
          )
        }
        const input: AddProjectUnitInput = {
          projectId,
          parentUnitId: values.parentUnitId,
          kind: values.kind,
          code: values.code,
          name: values.name,
        }
        return addProjectUnit(input)
      },
      { success: count > 1 ? `${count} locations added` : "Location added" },
    )
    if (!outcome.ok) return
    form.resetFields()
    setModalOpen(false)
  }

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "structure" }}
      onNavigate={onNavigate}
      description="Where construction happens — tasks and progress attach here"
      actions={
        <Gated allowed={canManage}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Add location
          </Button>
        </Gated>
      }
    >
      <Flex vertical gap="large" className="company-content">
        {setup && (
          <Card>
            <Steps
              current={1}
              items={[
                { title: "Project details" },
                { title: "Structure" },
                { title: "Team" },
              ]}
            />
          </Card>
        )}

        {setup && project?.trackingStartedMidProject && (
          <Card
            title={<Title level={5} className="company-heading! m-0!">Work already done</Title>}
            extra={<Text type="secondary">Project progress now: {project.progress}%</Text>}
          >
            <Flex vertical gap="middle">
              <Text type="secondary">
                How complete was each stage when you started tracking? Leave 0 for stages not started.
              </Text>
              <Row gutter={[16, 8]}>
                {stages.map((stage) => (
                  <Col key={stage.id} xs={24} sm={12} lg={8}>
                    <Flex align="center" justify="space-between" gap="small">
                      <Text>{stage.name}</Text>
                      <InputNumber
                        min={0}
                        max={100}
                        suffix="%"
                        value={baselines[stage.id] ?? 0}
                        onChange={(value) => setBaselines((current) => ({ ...current, [stage.id]: value ?? 0 }))}
                        aria-label={`${stage.name} already complete`}
                      />
                    </Flex>
                  </Col>
                ))}
              </Row>
              <Flex justify="flex-end">
                <Gated allowed={canAddTopLevel}>
                  <Button onClick={saveBaselines}>Save</Button>
                </Gated>
              </Flex>
            </Flex>
          </Card>
        )}

        <Card
          title={
            <Title level={5} className="company-heading! m-0!">
              Units and locations
            </Title>
          }
          extra={<Text type="secondary">{units.length} {units.length === 1 ? "location" : "locations"}</Text>}
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
            <Empty description="No project locations yet" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Gated allowed={canManage}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
                  Add first location
                </Button>
              </Gated>
            </Empty>
          )}
        </Card>

        {setup && (
          <Flex justify="flex-end">
            <Button
              type="primary"
              disabled={!units.length}
              onClick={() => onNavigate("project-team", { project_id: projectId, setup: "1" })}
            >
              Continue to project team
            </Button>
          </Flex>
        )}
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
          initialValues={{ kind: allowBulk ? "villa" : "block", count: 1 }}
          onFinish={handleAddUnit}
        >
          <Form.Item
            label="Parent location"
            name="parentUnitId"
            rules={[{ required: !canAddTopLevel, message: "Choose a parent location" }]}
          >
            <Select
              allowClear={canAddTopLevel}
              placeholder={canAddTopLevel ? "Top-level location" : "Choose a location"}
              options={manageableUnits.map((unit) => ({
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
          {allowBulk ? (
            <Form.Item
              label="How many to add"
              name="count"
              extra="Use more than 1 to create sequenced villas/blocks under the parent."
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={200} className="w-full" placeholder="1" />
            </Form.Item>
          ) : null}
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label={allowBulk ? "Code prefix" : "Code"}
                name="code"
                rules={[{ required: true, message: "Enter a code" }]}
              >
                <Input placeholder={allowBulk ? "V" : "A"} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                label={allowBulk ? "Name prefix" : "Name"}
                name="name"
                rules={[{ required: true, message: "Enter a name" }]}
              >
                <Input placeholder={allowBulk ? "Villa" : "Block A"} />
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
    </CompanyLayout>
  )
}

export default function ProjectStructureScreen({
  onNavigate,
  projectId,
  setup = false,
}: {
  onNavigate: Navigate
  projectId: EntityId
  setup?: boolean
}) {
  return (
    <CompanyThemeProvider>
      <ProjectStructure onNavigate={onNavigate} projectId={projectId} setup={setup} />
    </CompanyThemeProvider>
  )
}
