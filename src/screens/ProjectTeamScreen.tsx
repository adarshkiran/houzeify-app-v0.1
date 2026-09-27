import Gated from "../components/Gated"
import { Permissions } from "../domain/permissions"
import { canMessageDirectly } from "../domain/conversations"
import { useCan } from "../session/useCan"
import { useSession } from "../session/SessionProvider"
import { visibleMemberships } from "../domain/readScope"
import { useCommand } from "../session/useCommand"
import { useState } from "react"
import {
  CheckCircleOutlined,
  MailOutlined,
  MessageOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons"
import {
  Avatar,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
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
import { getProjectUnits } from "../mock/selectors"

const { Text, Title } = Typography

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
  setup,
}: {
  onNavigate: Navigate
  projectId: EntityId
  /** Reached from project setup: show the steps and the finish button. */
  setup: boolean
}) {
  const { state, inviteProjectMember, openDirectThread } = useConstructionData()
  const run = useCommand()
  const { session } = useSession()
  const canManage = useCan(Permissions.PROJECT_MANAGE, projectId)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm<InviteFormValues>()
  const units = getProjectUnits(state, projectId)
  // A scoped viewer sees project-wide roles and members who overlap their scope.
  const memberships = visibleMemberships(
    session,
    state.memberships,
    state.projectUnits,
    projectId,
  )
  const myMemberships = state.memberships.filter(
    (m) =>
      m.projectId === projectId &&
      m.status === "active" &&
      m.principalType === "person" &&
      m.principalId === session?.personId,
  )
  const canDm = (other: ProjectMembership) =>
    other.status === "active" &&
    other.principalType === "person" &&
    myMemberships.some((m) => m.id !== other.id && canMessageDirectly(m.role, other.role))
  const message = (other: ProjectMembership) => {
    const outcome = run(() => openDirectThread(projectId, other.id))
    if (outcome.ok) onNavigate("project-messages", { project_id: projectId, thread_id: outcome.value.id })
  }

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
    {
      key: "message",
      title: "",
      width: 110,
      render: (_: unknown, member: ProjectMembership) =>
        canDm(member) ? (
          <Button size="small" icon={<MessageOutlined />} onClick={() => message(member)}>
            Message
          </Button>
        ) : null,
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
      description="Roles here apply only within this project"
      actions={
        <Gated allowed={canManage} reason="Inviting members needs project-wide access.">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Invite member
          </Button>
        </Gated>
      }
    >
      <Flex vertical gap="large" className="company-content">
        {setup && (
          <Card>
            <Steps
              current={2}
              items={[
                { title: "Project details", icon: <CheckCircleOutlined /> },
                { title: "Structure", icon: <CheckCircleOutlined /> },
                { title: "Team" },
              ]}
            />
          </Card>
        )}

        <Card
          title={
            <Title level={5} className="company-heading! m-0!">
              Project members
            </Title>
          }
          extra={<Text type="secondary">{memberships.length} {memberships.length === 1 ? "member" : "members"}</Text>}
          className="company-section-card"
          classNames={{ body: memberships.length ? "company-table-card-body" : undefined }}
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
              <Gated allowed={canManage} reason="Inviting members needs project-wide access.">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
                  Add first member
                </Button>
              </Gated>
            </Empty>
          )}
        </Card>

        {setup && (
          <Flex justify="flex-end">
            <Button
              type="primary"
              onClick={() => onNavigate("project-overview", { project_id: projectId })}
            >
              Finish project setup
            </Button>
          </Flex>
        )}
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
  setup = false,
}: {
  onNavigate: Navigate
  projectId: EntityId
  setup?: boolean
}) {
  return (
    <CompanyThemeProvider>
      <ProjectTeam onNavigate={onNavigate} projectId={projectId} setup={setup} />
    </CompanyThemeProvider>
  )
}
