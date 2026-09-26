import Gated from "../components/Gated"
import { Permissions } from "../domain/permissions"
import { useCan } from "../session/useCan"
import { useSession } from "../session/SessionProvider"
import { visibleMemberships } from "../domain/readScope"
import { useCommand } from "../session/useCommand"
import { useState } from "react"
import {
  CheckCircleOutlined,
  MailOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons"
import {
  Avatar,
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
  Table,
  Tag,
  Typography,
} from "antd"
import type { TableProps } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import type {
  EntityId,
  ProjectMembership,
  ProjectRole,
} from "../domain/models"
import type { Navigate } from "../domain/navigation"
import {
  useConstructionData,
  type InviteProjectMemberInput,
} from "../mock/ConstructionDataProvider"
import { getProject, getProjectUnits } from "../mock/selectors"

const { Paragraph, Text, Title } = Typography

interface InviteFormValues {
  name: string
  email?: string
  phone?: string
  role: ProjectRole
  projectUnitIds?: EntityId[]
}

function ProjectTeam({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  const { state, inviteProjectMember } = useConstructionData()
  const run = useCommand()
  const { session } = useSession()
  const canManage = useCan(Permissions.PROJECT_MANAGE, projectId)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm<InviteFormValues>()
  const project = getProject(state, projectId)
  const units = getProjectUnits(state, projectId)
  // A scoped viewer sees project-wide roles and members who overlap their scope.
  const memberships = visibleMemberships(
    session,
    state.memberships,
    state.projectUnits,
    projectId,
  )

  const getPrincipalName = (membership: ProjectMembership) => {
    if (membership.principalType === "organization") {
      return state.organizations.find(
        (organization) => organization.id === membership.principalId,
      )?.name
    }
    return state.people.find((person) => person.id === membership.principalId)?.name
  }

  const columns: TableProps<ProjectMembership>["columns"] = [
    {
      title: "Member",
      key: "member",
      render: (_, membership) => {
        const name = getPrincipalName(membership) ?? "Unknown member"
        return (
          <Flex align="center" gap="small">
            <Avatar>{name.charAt(0)}</Avatar>
            <Text strong>{name}</Text>
          </Flex>
        )
      },
    },
    {
      title: "Project role",
      dataIndex: "role",
      key: "role",
      render: (role: ProjectRole) => <Tag>{role.replace(/-/g, " ")}</Tag>,
    },
    {
      title: "Scope",
      key: "scope",
      responsive: ["md"],
      render: (_, membership) => (
        <Text type="secondary">
          {membership.scope.projectUnitIds.length
            ? `${membership.scope.projectUnitIds.length} locations`
            : "Entire project"}
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: ProjectMembership["status"]) => (
        <Tag color={status === "active" ? "success" : "processing"}>
          {status === "invited"
            ? "Pending invitation"
            : status === "active"
              ? "Active"
              : "Inactive"}
        </Tag>
      ),
    },
  ]

  const handleInvite = (values: InviteFormValues) => {
    const input: InviteProjectMemberInput = {
      projectId,
      name: values.name,
      email: values.email,
      phone: values.phone,
      role: values.role,
      projectUnitIds: values.projectUnitIds,
    }
    const outcome = run(() => inviteProjectMember(input), {
      success: `${values.name} invited`,
    })
    if (!outcome.ok) return
    form.resetFields()
    setModalOpen(false)
  }

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "team" }}
      onNavigate={onNavigate}
    >
      <Flex vertical gap="large" className="company-form-content">
        <Steps
          current={2}
          items={[
            { title: "Project details", icon: <CheckCircleOutlined /> },
            { title: "Structure", icon: <CheckCircleOutlined /> },
            { title: "Team" },
          ]}
        />

        <Row gutter={[32, 24]} align="top">
          <Col xs={24} lg={8}>
            <Flex vertical gap="middle" className="business-onboarding-intro">
              <Text className="company-eyebrow">Project team</Text>
              <Title className="company-heading! m-0!">
                Add people with project-specific roles
              </Title>
              <Paragraph type="secondary">
                Add project managers, contractors, supervisors, consultants, and
                homeowners to {project?.name ?? "this project"}. Roles apply only within
                this project.
              </Paragraph>
            </Flex>
          </Col>

          <Col xs={24} lg={16}>
            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Project members
                </Title>
              }
              extra={
                <Gated
                allowed={canManage}
                reason="Inviting members needs project-wide access."
              >
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setModalOpen(true)}
                  >
                    Invite member
                  </Button>
                </Gated>
              }
              classNames={{ body: "company-table-card-body" }}
            >
              {memberships.length ? (
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={memberships}
                  pagination={false}
                  scroll={{ x: 640 }}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No members yet">
                  <Gated
                allowed={canManage}
                reason="Inviting members needs project-wide access."
              >
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setModalOpen(true)}
                    >
                      Add first member
                    </Button>
                  </Gated>
                </Empty>
              )}
            </Card>

            <Flex justify="flex-end" className="company-form-actions">
              <Button
                type="primary"
                onClick={() =>
                  onNavigate("project-overview", { project_id: projectId })
                }
              >
                Finish project setup
              </Button>
            </Flex>
          </Col>
        </Row>
      </Flex>

      <Modal
        title="Invite project member"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form<InviteFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ role: "supervisor" }}
          onFinish={handleInvite}
        >
          <Form.Item
            label="Full name"
            name="name"
            rules={[{ required: true, message: "Enter the member's name" }]}
          >
            <Input prefix={<TeamOutlined />} placeholder="Suresh Kumar" />
          </Form.Item>
          <Form.Item label="Email" name="email">
            <Input prefix={<MailOutlined />} placeholder="name@company.com" />
          </Form.Item>
          <Form.Item label="Mobile number" name="phone">
            <Input placeholder="+91 98765 43210" />
          </Form.Item>
          <Form.Item
            label="Project role"
            name="role"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "project-manager", label: "Project manager" },
                { value: "contractor", label: "Main contractor" },
                { value: "subcontractor", label: "Subcontractor" },
                { value: "supervisor", label: "Site supervisor" },
                { value: "consultant", label: "Architect / consultant" },
                { value: "homeowner", label: "Homeowner / buyer" },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Location scope"
            name="projectUnitIds"
            extra="Leave empty for entire project access."
          >
            <Select
              mode="multiple"
              allowClear
              placeholder="Entire project"
              options={units.map((unit) => ({
                value: unit.id,
                label: `${unit.name} · ${unit.kind}`,
              }))}
            />
          </Form.Item>
          <Flex justify="flex-end">
            <Space>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Send invitation</Button>
            </Space>
          </Flex>
        </Form>
      </Modal>
    </CompanyLayout>
  )
}

export default function ProjectTeamScreen({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  return (
    <CompanyThemeProvider>
      <ProjectTeam onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
