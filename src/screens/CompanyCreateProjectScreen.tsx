import {
  CalendarOutlined,
  EnvironmentOutlined,
  ProjectOutlined,
} from "@ant-design/icons"
import {
  Button,
  Card,
  Checkbox,
  Col,
  Flex,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Steps,
  Typography,
} from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import type { ProjectKind, ProjectStatus } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useCommand } from "../session/useCommand"
import {
  useConstructionData,
  type CreateProjectInput,
} from "../mock/ConstructionDataProvider"
import { useOrganizationId } from "../session/SessionProvider"

const { Paragraph, Text, Title } = Typography

interface ProjectFormValues {
  name: string
  code: string
  kind: ProjectKind
  location: string
  status: ProjectStatus
  startDate?: string
  targetDate?: string
  trackingStartedMidProject?: boolean
}

function CompanyCreateProject({ onNavigate }: { onNavigate: Navigate }) {
  const { createProject } = useConstructionData()
  const run = useCommand()
  const organizationId = useOrganizationId()

  const handleFinish = (values: ProjectFormValues) => {
    const input: CreateProjectInput = {
      ...values,
      organizationId,
      trackingStartedMidProject: Boolean(values.trackingStartedMidProject),
    }
    const outcome = run(() => createProject(input), { success: "Project created" })
    if (!outcome.ok) return
    onNavigate("project-structure", {
      project_id: outcome.value.id,
      project_name: outcome.value.name,
    })
  }

  return (
    <CompanyLayout
      nav={{ menu: "company", active: "projects" }}
      onNavigate={onNavigate}
    >
      <Flex vertical gap="large" className="company-form-content">
        <Steps
          current={0}
          items={[
            { title: "Project details" },
            { title: "Structure" },
            { title: "Team" },
          ]}
        />

        <Row gutter={[32, 24]} align="top">
          <Col xs={24} lg={8}>
            <Flex vertical gap="middle" className="business-onboarding-intro">
              <Text className="company-eyebrow">Create project</Text>
              <Title className="company-heading! m-0!">
                Start a connected construction record
              </Title>
              <Paragraph type="secondary">
                Create a new project or start tracking construction that is already
                underway. Both use the same project engine.
              </Paragraph>
            </Flex>
          </Col>

          <Col xs={24} lg={16}>
            <Card>
              <Form<ProjectFormValues>
                layout="vertical"
                requiredMark={false}
                initialValues={{
                  kind: "individual-house",
                  status: "planning",
                  trackingStartedMidProject: false,
                }}
                onFinish={handleFinish}
              >
                <Row gutter={16}>
                  <Col xs={24} sm={16}>
                    <Form.Item
                      label="Project name"
                      name="name"
                      rules={[{ required: true, message: "Enter a project name" }]}
                    >
                      <Input prefix={<ProjectOutlined />} placeholder="Green Valley Villas" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      label="Project code"
                      name="code"
                      rules={[{ required: true, message: "Enter a project code" }]}
                    >
                      <Input placeholder="GVV-01" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="Project type"
                  name="kind"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={[
                      { value: "individual-house", label: "Individual house" },
                      { value: "multiple-houses", label: "Multiple houses" },
                      { value: "villa-development", label: "Villa development" },
                      { value: "apartment", label: "Apartment project" },
                      { value: "multi-block", label: "Multi-block project" },
                      { value: "commercial", label: "Commercial project" },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  label="Project location"
                  name="location"
                  rules={[{ required: true, message: "Enter the project location" }]}
                >
                  <Input prefix={<EnvironmentOutlined />} placeholder="Hyderabad, Telangana" />
                </Form.Item>

                <Form.Item label="Project state" name="status">
                  <Radio.Group
                    options={[
                      { value: "planning", label: "Planning" },
                      { value: "active", label: "Active construction" },
                      { value: "on-hold", label: "On hold" },
                    ]}
                  />
                </Form.Item>

                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Start date" name="startDate">
                      <Input type="date" prefix={<CalendarOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Target completion" name="targetDate">
                      <Input type="date" prefix={<CalendarOutlined />} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="trackingStartedMidProject" valuePropName="checked">
                  <Checkbox>
                    Construction has already started and I am beginning tracking mid-project
                  </Checkbox>
                </Form.Item>

                <Flex justify="flex-end">
                  <Space>
                    <Button onClick={() => onNavigate("company-projects")}>Cancel</Button>
                    <Button type="primary" htmlType="submit">
                      Continue to structure
                    </Button>
                  </Space>
                </Flex>
              </Form>
            </Card>
          </Col>
        </Row>
      </Flex>
    </CompanyLayout>
  )
}

export default function CompanyCreateProjectScreen({
  onNavigate,
}: {
  onNavigate: Navigate
}) {
  return (
    <CompanyThemeProvider>
      <CompanyCreateProject onNavigate={onNavigate} />
    </CompanyThemeProvider>
  )
}
