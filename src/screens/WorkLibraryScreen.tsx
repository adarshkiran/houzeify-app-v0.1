import { useMemo, useState } from "react"
import { countLabel } from "../components/countLabel"
import {
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons"
import {
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  Listy,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd"
import type { TableProps } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import LogoHorizontal from "../components/LogoHorizontal"
import type { QuantityUnit, WorkType } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import {
  QUANTITY_UNITS,
  WORK_LIBRARY_VERSION,
  getTradesForStage,
  getWorkTypesForStageTrade,
  quantityUnitLabel,
} from "../domain/workLibrary"
import { useCommand } from "../session/useCommand"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getStageName, getTradeName, getWorkTypeName } from "../mock/selectors"

const { Paragraph, Text, Title } = Typography

const NEW_STAGE = "__new_stage__"
const NEW_TRADE = "__new_trade__"

interface AddWorkTypeFormValues {
  stageChoice: string
  newStageName?: string
  tradeChoice: string
  newTradeName?: string
  name: string
  defaultUnit: QuantityUnit
}

function WorkLibrary({ onNavigate }: { onNavigate: Navigate }) {
  const {
    state,
    addLibraryWorkType,
  } = useConstructionData()
  const run = useCommand()
  const [search, setSearch] = useState("")
  const [stageId, setStageId] = useState("all")
  const [tradeId, setTradeId] = useState("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm<AddWorkTypeFormValues>()
  const stageChoice = Form.useWatch("stageChoice", form)
  const tradeChoice = Form.useWatch("tradeChoice", form)

  const tradesForFilter = useMemo(
    () => getTradesForStage(state, stageId === "all" ? undefined : stageId),
    [state, stageId],
  )

  const workTypes = useMemo(
    () =>
      getWorkTypesForStageTrade(
        state,
        stageId === "all" ? undefined : stageId,
        tradeId === "all" ? undefined : tradeId,
      ).filter((workType) =>
        `${workType.name} ${getTradeName(state, workType.tradeId)}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [state, search, stageId, tradeId],
  )

  const templates = useMemo(
    () =>
      state.taskTemplates.filter((template) =>
        workTypes.some((workType) => workType.id === template.workTypeId),
      ),
    [state.taskTemplates, workTypes],
  )

  const openModal = () => {
    form.setFieldsValue({
      stageChoice: stageId !== "all" ? stageId : undefined,
      tradeChoice: tradeId !== "all" ? tradeId : undefined,
      defaultUnit: "nos",
      name: undefined,
      newStageName: undefined,
      newTradeName: undefined,
    })
    setModalOpen(true)
  }

  const handleAdd = (values: AddWorkTypeFormValues) => {
    const outcome = run(
      () =>
        addLibraryWorkType({
          name: values.name.trim(),
          defaultUnit: values.defaultUnit,
          ...(values.stageChoice === NEW_STAGE
            ? { newStageName: values.newStageName!.trim() }
            : { stageId: values.stageChoice }),
          ...(values.tradeChoice === NEW_TRADE
            ? { newTradeName: values.newTradeName!.trim() }
            : { tradeId: values.tradeChoice }),
        }),
      { success: "Work type added" },
    )
    if (!outcome.ok) return
    const { workType } = outcome.value

    setStageId(workType.stageId)
    setTradeId(workType.tradeId)
    setSearch(workType.name)
    setModalOpen(false)
    form.resetFields()
  }

  const columns: TableProps<WorkType>["columns"] = [
    {
      title: "Work type",
      dataIndex: "name",
      key: "name",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Stage",
      key: "stage",
      render: (_, item) => <Tag>{getStageName(state, item.stageId)}</Tag>,
    },
    {
      title: "Trade",
      key: "trade",
      render: (_, item) => <Text className="whitespace-nowrap">{getTradeName(state, item.tradeId)}</Text>,
    },
    {
      title: "Default unit",
      dataIndex: "defaultUnit",
      key: "defaultUnit",
      width: 120,
      render: (unit: string) => <Tag>{unit}</Tag>,
    },
    {
      title: "Template",
      key: "template",
      width: 110,
      // The templates panel beside the table has the details; show this only when there's room.
      responsive: ["xxl"],
      render: (_, item) => {
        const template = state.taskTemplates.find(
          (entry) => entry.workTypeId === item.id,
        )
        // The template list on the right has the details; here, just whether one exists.
        return template ? (
          <Tag color="green" className="m-0!">{template.name.split(" — ").pop()}</Tag>
        ) : (
          <Tag color="orange" className="m-0!">Missing</Tag>
        )
      },
    },
  ]

  return (
    <CompanyLayout
      nav={{ menu: "company", active: "library" }}
      onNavigate={onNavigate}
      header={
        <Flex align="center" justify="space-between" className="h-full gap-3">
          <Flex vertical justify="center">
            <Title level={5} className="company-heading! m-0!">
              Construction Work Library
            </Title>
            <Text type="secondary">
              Stage → Trade → Work type → Template · v{WORK_LIBRARY_VERSION}
            </Text>
          </Flex>
          <Button type="primary" icon={<PlusOutlined />} onClick={openModal}>
            Add work type
          </Button>
        </Flex>
      }
    >
      <Flex vertical gap="middle" className="company-content">
        <Card size="small">
          <Flex gap="small" wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search work types or trades"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="company-project-search"
            />
            <Select
              value={stageId}
              onChange={(value) => {
                setStageId(value)
                setTradeId("all")
              }}
              className="company-project-filter"
              options={[
                { value: "all", label: "All stages" },
                ...state.stages.map((stage) => ({
                  value: stage.id,
                  label: stage.name,
                })),
              ]}
            />
            <Select
              value={tradeId}
              onChange={setTradeId}
              className="company-project-filter"
              options={[
                { value: "all", label: "All trades" },
                ...tradesForFilter.map((trade) => ({
                  value: trade.id,
                  label: trade.name,
                })),
              ]}
            />
          </Flex>
        </Card>

        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} xl={16}>
            <Card
              size="small"
              className="company-equal-height-card"
              title={
                <Title level={5} className="company-heading! m-0!">
                  Standard work types
                </Title>
              }
              extra={
                <Space size="small">
                  <Text type="secondary">{countLabel(workTypes.length, "record")}</Text>
                  <Button
                    size="small"
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={openModal}
                  >
                    Add
                  </Button>
                </Space>
              }
              classNames={{ body: "company-table-card-body-inset" }}
            >
              <Table
                rowKey="id"
                size="small"
                columns={columns}
                dataSource={workTypes}
                pagination={{ pageSize: 12, showSizeChanger: false }}
              />
            </Card>
          </Col>

          <Col xs={24} xl={8} className="company-split-side">
            <Card
              size="small"
              className="company-equal-height-card company-split-side-card"
              title={
                <Title level={5} className="company-heading! m-0!">
                  Task templates
                </Title>
              }
              extra={
                <Text type="secondary">{countLabel(templates.length, "template")}</Text>
              }
              classNames={{
                body: "company-scroll-card-body-fill",
              }}
            >
              <Listy
                items={templates}
                rowKey="id"
                classNames={{ item: "company-listy-item" }}
                itemRender={(template) => (
                  <Flex vertical gap={2} className="company-list-stack">
                    <Text strong>{template.name}</Text>
                    <Text type="secondary" className="text-[13px]!">
                      {getWorkTypeName(state, template.workTypeId)} ·{" "}
                      {countLabel(template.checklist.length, "check")} ·{" "}
                      {template.requiredEvidence.join(", ")}
                    </Text>
                  </Flex>
                )}
              />
            </Card>
          </Col>
        </Row>
      </Flex>

      <Modal
        title="Add work type"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Paragraph type="secondary" className="mt-0! mb-3!">
          Pick an existing stage/trade or create new ones. A standard task
          template is created automatically.
        </Paragraph>
        <Form<AddWorkTypeFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ defaultUnit: "nos" }}
          onFinish={handleAdd}
        >
          <Form.Item
            label="Stage"
            name="stageChoice"
            rules={[{ required: true, message: "Choose or create a stage" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select stage"
              options={[
                ...state.stages.map((stage) => ({
                  value: stage.id,
                  label: stage.name,
                })),
                { value: NEW_STAGE, label: "+ Create new stage" },
              ]}
            />
          </Form.Item>
          {stageChoice === NEW_STAGE ? (
            <Form.Item
              label="New stage name"
              name="newStageName"
              rules={[{ required: true, message: "Enter a stage name" }]}
            >
              <Input placeholder="e.g. Finishing" />
            </Form.Item>
          ) : null}
          <Form.Item
            label="Trade"
            name="tradeChoice"
            rules={[{ required: true, message: "Choose or create a trade" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select trade"
              options={[
                ...state.trades.map((trade) => ({
                  value: trade.id,
                  label: trade.name,
                })),
                { value: NEW_TRADE, label: "+ Create new trade" },
              ]}
            />
          </Form.Item>
          {tradeChoice === NEW_TRADE ? (
            <Form.Item
              label="New trade name"
              name="newTradeName"
              rules={[{ required: true, message: "Enter a trade name" }]}
            >
              <Input placeholder="e.g. Waterproofing" />
            </Form.Item>
          ) : null}
          <Form.Item
            label="Work type"
            name="name"
            rules={[{ required: true, message: "Enter a work type name" }]}
          >
            <Input placeholder="e.g. Terrace waterproofing" />
          </Form.Item>
          <Form.Item
            label="Default unit"
            name="defaultUnit"
            rules={[{ required: true, message: "Choose a unit" }]}
          >
            <Select
              options={QUANTITY_UNITS.map((unit) => ({
                value: unit,
                label: quantityUnitLabel(unit),
              }))}
            />
          </Form.Item>
          <Flex justify="flex-end">
            <Space>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Add work type
              </Button>
            </Space>
          </Flex>
        </Form>
      </Modal>
    </CompanyLayout>
  )
}

export default function WorkLibraryScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <CompanyThemeProvider>
      <WorkLibrary onNavigate={onNavigate} />
    </CompanyThemeProvider>
  )
}
