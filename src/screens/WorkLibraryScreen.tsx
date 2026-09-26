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
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getStageName, getTradeName } from "../mock/selectors"

const { Content, Header, Sider } = Layout
const { Paragraph, Text, Title } = Typography

function WorkLibrary({ onNavigate }: { onNavigate: Navigate }) {
  const { state } = useConstructionData()
  const [search, setSearch] = useState("")
  const [stageId, setStageId] = useState("all")

  const workTypes = useMemo(
    () =>
      state.workTypes.filter((workType) => {
        const matchesSearch = `${workType.name} ${getTradeName(state, workType.tradeId)}`
          .toLowerCase()
          .includes(search.toLowerCase())
        return matchesSearch && (stageId === "all" || workType.stageId === stageId)
      }),
    [state, search, stageId],
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
      render: (_, item) => (
        <Text type="secondary">
          {state.taskTemplates.some((template) => template.workTypeId === item.id)
            ? "Available"
            : "Not configured"}
        </Text>
      ),
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
            <Text type="secondary">Standard stages, trades, work types, and task templates</Text>
          </Flex>
        </Header>

        <Content className="overflow-y-auto">
          <Flex vertical gap="large" className="company-content">
            <Card>
              <Flex gap="middle" wrap>
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
                  onChange={setStageId}
                  className="company-project-filter"
                  options={[
                    { value: "all", label: "All stages" },
                    ...state.stages.map((stage) => ({
                      value: stage.id,
                      label: stage.name,
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
                    items={state.taskTemplates}
                    rowKey="id"
                    classNames={{ item: "company-listy-item" }}
                    itemRender={(template) => (
                      <Flex vertical gap="small">
                        <Text strong>{template.name}</Text>
                        <Paragraph type="secondary" className="m-0!">
                          {template.checklist.length} checks ·{" "}
                          {template.requiredEvidence.join(", ")} evidence
                        </Paragraph>
                        <Space wrap>
                          <Tag>{template.defaultUnit}</Tag>
                          <Tag>{template.dependencyWorkTypeIds.length} dependencies</Tag>
                        </Space>
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
