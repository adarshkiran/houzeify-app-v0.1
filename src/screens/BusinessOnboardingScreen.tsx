import {
  ArrowLeftOutlined,
  BankOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  TeamOutlined,
} from "@ant-design/icons"
import {
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Space,
  Steps,
  Typography,
} from "antd"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import LogoHorizontal from "../components/LogoHorizontal"
import type { OrganizationKind } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { ACTIVE_ORGANIZATION_ID } from "../mock/seed"
import { DEMO_IDENTITIES, useSession } from "../session/SessionProvider"

const { Paragraph, Text, Title } = Typography

interface BusinessFormValues {
  name: string
  kind: OrganizationKind
  city: string
  phone: string
  teamSize: string
}

function BusinessOnboarding({ onNavigate }: { onNavigate: Navigate }) {
  const { state, updateOrganizationProfile } = useConstructionData()
  const { signIn } = useSession()
  const organization = state.organizations.find(
    (item) => item.id === ACTIVE_ORGANIZATION_ID,
  )

  const handleFinish = (values: BusinessFormValues) => {
    updateOrganizationProfile(ACTIVE_ORGANIZATION_ID, values)
    signIn({ ...DEMO_IDENTITIES.business, phone: values.phone })
    onNavigate("company-dashboard")
  }

  return (
    <Flex vertical className="business-onboarding min-h-full">
      <Flex align="center" justify="space-between" className="business-onboarding-header">
        <LogoHorizontal height={24} />
        <Text type="secondary">Business workspace setup</Text>
      </Flex>

      <Flex vertical gap="large" className="business-onboarding-content">
        <Steps
          current={1}
          responsive={false}
          items={[
            { title: "Your role", icon: <CheckCircleOutlined /> },
            { title: "Company details" },
          ]}
        />

        <Row gutter={[32, 24]} align="top">
          <Col xs={24} lg={9}>
            <Flex vertical gap="middle" className="business-onboarding-intro">
              <Text className="company-eyebrow">Company onboarding</Text>
              <Title className="company-heading! m-0!">
                Set up your construction workspace
              </Title>
              <Paragraph type="secondary">
                Tell us about your organization. You can add projects, contractors,
                supervisors, workers, and homeowners after setup.
              </Paragraph>
              <Card variant="borderless" className="business-onboarding-note">
                <Flex vertical gap="small">
                  <Text strong>One account, multiple project roles</Text>
                  <Text type="secondary">
                    Your organization profile does not permanently limit what you can do
                    on other Houzeify projects.
                  </Text>
                </Flex>
              </Card>
            </Flex>
          </Col>

          <Col xs={24} lg={15}>
            <Card>
              <Form<BusinessFormValues>
                layout="vertical"
                requiredMark={false}
                initialValues={{
                  name: organization?.name,
                  kind: organization?.kind,
                  city: organization?.city,
                  phone: organization?.phone,
                  teamSize: organization?.teamSize,
                }}
                onFinish={handleFinish}
              >
                <Form.Item
                  label="Company or business name"
                  name="name"
                  rules={[{ required: true, message: "Enter your business name" }]}
                >
                  <Input prefix={<BankOutlined />} placeholder="BuildRight Construction" />
                </Form.Item>

                <Form.Item
                  label="Business type"
                  name="kind"
                  rules={[{ required: true, message: "Select your business type" }]}
                >
                  <Select
                    options={[
                      { value: "construction-company", label: "Construction company" },
                      { value: "developer", label: "Developer" },
                      { value: "builder", label: "Builder" },
                      { value: "contractor", label: "Main contractor" },
                      { value: "subcontractor", label: "Trade contractor / subcontractor" },
                    ]}
                  />
                </Form.Item>

                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Primary city"
                      name="city"
                      rules={[{ required: true, message: "Enter your primary city" }]}
                    >
                      <Input prefix={<EnvironmentOutlined />} placeholder="Hyderabad" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Contact number"
                      name="phone"
                      rules={[{ required: true, message: "Enter a contact number" }]}
                    >
                      <Input prefix={<PhoneOutlined />} placeholder="+91 98765 43210" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="Current team size"
                  name="teamSize"
                  rules={[{ required: true, message: "Select your team size" }]}
                >
                  <Select
                    prefix={<TeamOutlined />}
                    options={[
                      { value: "1–5", label: "1–5 people" },
                      { value: "6–20", label: "6–20 people" },
                      { value: "21–50", label: "21–50 people" },
                      { value: "51–200", label: "51–200 people" },
                      { value: "201+", label: "201+ people" },
                    ]}
                  />
                </Form.Item>

                <Flex justify="space-between" gap="middle" wrap>
                  <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => onNavigate("role")}
                  >
                    Back
                  </Button>
                  <Space>
                    <Button type="primary" htmlType="submit">
                      Create workspace
                    </Button>
                  </Space>
                </Flex>
              </Form>
            </Card>
          </Col>
        </Row>
      </Flex>
    </Flex>
  )
}

export default function BusinessOnboardingScreen({
  onNavigate,
}: {
  onNavigate: Navigate
}) {
  return (
    <CompanyThemeProvider>
      <BusinessOnboarding onNavigate={onNavigate} />
    </CompanyThemeProvider>
  )
}
