import { useMemo, useState } from "react"
import {
  HomeOutlined,
  ProjectOutlined,
  SearchOutlined,
  SnippetsOutlined,
} from "@ant-design/icons"
import {
  Card,
  Col,
  Flex,
  Input,
  Layout,
  Listy,
  Menu,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd"
import type { TableProps } from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import HIcon from "../components/HIcon"
import LogoHorizontal from "../components/LogoHorizontal"
import type { WorkType } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import {
  WORK_LIBRARY_VERSION,
  getTradesForStage,
  getWorkTypesForStageTrade,
} from "../domain/workLibrary"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getStageName, getTradeName, getWorkTypeName } from "../mock/selectors"

const { Content, Header, Sider } = Layout
const { Paragraph, Text, Title } = Typography

function WorkLibrary({ onNavigate }: { onNavigate: Navigate }) {
  const { state } = useConstructionData()
  const [search, setSearch] = useState("")
  const [stageId, setStageId] = useState("all")
  const [tradeId, setTradeId] = useState("all")

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
      render: (_, item) => <Text>{getTradeName(state, item.tradeId)}</Text>,
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
      responsive: ["md"],
      render: (_, item) => {
        const template = state.taskTemplates.find(
          (entry) => entry.workTypeId === item.id,
        )
        return (
          <Text type="secondary">
            {template ? template.name.replace(" — Standard", "") : "Missing"}
          </Text>
        )
      },
    },
  ]

  return (
    <Layout className="company-dashboard h-full">
      <Sider
        breakpoint="lg"
        collapsedWidth={72}
        width={240}
        theme="light"
        trigger={null}
        className="hidden md:block company-sider"
      >
        <Flex vertical className="h-full">
          <Flex align="center" className="company-logo">
            <LogoHorizontal height={24} className="company-logo-full" />
            <span className="company-logo-mark"><HIcon size={28} /></span>
          </Flex>
          <Menu
            mode="inline"
            selectedKeys={["library"]}
            inlineIndent={18}
            className="company-main-menu flex-1 border-0!"
            items={[
              { key: "home", icon: <HomeOutlined />, label: "Company Home" },
              { key: "projects", icon: <ProjectOutlined />, label: "Projects" },
              { key: "library", icon: <SnippetsOutlined />, label: "Work Library" },
            ]}
            onClick={({ key }) => {
              if (key === "home") onNavigate("company-dashboard")
              if (key === "projects") onNavigate("company-projects")
            }}
          />
        </Flex>
      </Sider>

      <Layout>
        <Header className="company-header">
          <Flex vertical justify="center" className="h-full">
            <Title level={5} className="company-heading! m-0!">Construction Work Library</Title>
            <Text type="secondary">
              Stage → Trade → Work type → Template · v{WORK_LIBRARY_VERSION}
            </Text>
          </Flex>
        </Header>

        <Content className="overflow-y-auto">
          <Flex vertical gap="large" className="company-content">
            <Card>
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

            <Row gutter={[24, 24]} align="top">
              <Col xs={24} xl={17}>
                <Card
                  title={
                    <Title level={5} className="company-heading! m-0!">
                      Standard work types
                    </Title>
                  }
                  extra={<Text type="secondary">{workTypes.length} records</Text>}
                  classNames={{ body: "company-table-card-body" }}
                >
                  <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={workTypes}
                    pagination={{ pageSize: 12, showSizeChanger: false }}
                    scroll={{ x: 720 }}
                  />
                </Card>
              </Col>

              <Col xs={24} xl={7}>
                <Card
                  title={
                    <Title level={5} className="company-heading! m-0!">
                      Task templates
                    </Title>
                  }
                >
                  <Listy
                    items={templates}
                    rowKey="id"
                    classNames={{ item: "company-listy-item" }}
                    itemRender={(template) => (
                      <Flex vertical gap={4}>
                        <Text strong>{template.name}</Text>
                        <Text type="secondary" className="text-[13px]!">
                          {getWorkTypeName(state, template.workTypeId)} ·{" "}
                          {template.checklist.length} checks ·{" "}
                          {template.requiredEvidence.join(", ")}
                        </Text>
                      </Flex>
                    )}
                  />
                </Card>
              </Col>
            </Row>
          </Flex>
        </Content>
      </Layout>
    </Layout>
  )
}

export default function WorkLibraryScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <CompanyThemeProvider>
      <WorkLibrary onNavigate={onNavigate} />
    </CompanyThemeProvider>
  )
}
