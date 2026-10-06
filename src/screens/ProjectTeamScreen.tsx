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
  ClockCircleOutlined,
  MailOutlined,
  MessageOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons"
import {
  Alert,
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
  Switch,
  Table,
  Tag,
  Typography,
} from "antd"
import type { TableProps } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import { attendanceDate, dayState, validateTimes, type DayState } from "../domain/attendance"
import type {
  AttendanceStatus,
  EntityId,
  ISODate,
  ProjectMembership,
  ProjectRole,
  Worker,
  WorkerAttendance,
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

interface AttendanceFormValues {
  status: AttendanceStatus
  checkInTime?: string
  checkOutTime?: string
}

interface AttendanceRow {
  worker: Worker
  record?: WorkerAttendance
  state: DayState
}

const ATTENDANCE_STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "half-day", label: "Half day" },
  { value: "absent", label: "Absent" },
]

const DAY_STATE_LABELS: Record<DayState, string> = {
  "not-recorded": "Not recorded",
  absent: "Absent",
  complete: "Complete",
  incomplete: "Check-out missing",
}

const DAY_STATE_COLORS: Record<DayState, string | undefined> = {
  "not-recorded": "default",
  absent: "default",
  complete: "success",
  incomplete: "warning",
}

/** Asia/Kolkata has no DST, so a fixed offset turns the form's date and time into an instant. */
const KOLKATA_OFFSET = "+05:30"
function instantOn(date: ISODate, time?: string): string | undefined {
  return time ? `${date}T${time}:00${KOLKATA_OFFSET}` : undefined
}

/** HH:mm in Asia/Kolkata for a stored instant, to prefill the correction form. */
function kolkataTime(instant?: string): string | undefined {
  if (!instant) return undefined
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant))
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
  const {
    state,
    inviteProjectMember,
    openDirectThread,
    recordAttendance,
    listAttendance,
    setAttendancePolicy,
  } = useConstructionData()
  const run = useCommand()
  const { session } = useSession()
  const canManage = useCan(Permissions.PROJECT_MANAGE, projectId)
  const canRead = useCan(Permissions.PROJECT_READ, projectId)
  // Worker sessions are refused by listAttendance even with PROJECT_READ (spec §5).
  const canReadAttendance = session?.accountType === "business" && canRead
  const canCorrectAttendance = useCan(Permissions.WORKFORCE_MANAGE, projectId)
  const [day, setDay] = useState<ISODate>(() => attendanceDate(new Date()))
  const [correction, setCorrection] = useState<AttendanceRow | null>(null)
  const [correctionError, setCorrectionError] = useState<string | null>(null)
  const [attendanceForm] = Form.useForm<AttendanceFormValues>()
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
    if (outcome.ok) onNavigate("project-messages", { project_id: projectId, thread_id: outcome.value.id, from: "project-team" })
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
            <Avatar className="shrink-0">{name.charAt(0)}</Avatar>
            <Flex vertical align="flex-start" gap={2}>
              <Text strong>{name}</Text>
              {/* On a phone the role column is hidden; show the role here instead. */}
              <Tag className="m-0! sm:hidden!">{membership.role.replace(/-/g, " ")}</Tag>
            </Flex>
          </Flex>
        )
      },
    },
    {
      title: "Project role",
      dataIndex: "role",
      key: "role",
      responsive: ["sm"],
      render: (role: ProjectRole) => <Tag>{role.replace(/-/g, " ")}</Tag>,
    },
    {
      title: "Scope",
      key: "scope",
      responsive: ["md"],
      render: (_, membership) => (
        <Text type="secondary">
          {membership.scope.projectUnitIds.length
            ? `${membership.scope.projectUnitIds.length} ${membership.scope.projectUnitIds.length === 1 ? "location" : "locations"}`
            : "Entire project"}
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      responsive: ["sm"],
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
      render: (_: unknown, member: ProjectMembership) =>
        canDm(member) ? (
          <Button size="small" icon={<MessageOutlined />} onClick={() => message(member)}>
            Message
          </Button>
        ) : null,
    },
  ]

  const project = state.projects.find((item) => item.id === projectId)
  const requireCheckout = project?.requireCheckout ?? false
  const dayRecords = canReadAttendance ? listAttendance(projectId, day) : []
  const attendanceRows: AttendanceRow[] = canReadAttendance
    ? state.workers
        .filter((worker) =>
          state.workerProjectAssignments.some(
            (assignment) =>
              assignment.workerId === worker.id &&
              assignment.projectId === projectId &&
              assignment.status === "active",
          ),
        )
        .map((worker) => {
          const record = dayRecords.find((item) => item.workerId === worker.id)
          return { worker, record, state: dayState(record, requireCheckout) }
        })
    : []

  const openCorrection = (row: AttendanceRow) => {
    setCorrectionError(null)
    attendanceForm.setFieldsValue({
      status: row.record?.status ?? "present",
      checkInTime: kolkataTime(row.record?.checkInAt),
      checkOutTime: kolkataTime(row.record?.checkOutAt),
    })
    setCorrection(row)
  }

  const handleCorrection = (values: AttendanceFormValues) => {
    if (!correction) return
    const checkInAt = instantOn(day, values.checkInTime)
    const checkOutAt = instantOn(day, values.checkOutTime)
    const refusal = validateTimes(
      checkInAt ?? correction.record?.checkInAt,
      checkOutAt ?? correction.record?.checkOutAt,
    )
    if (refusal) {
      setCorrectionError(refusal.message)
      return
    }
    setCorrectionError(null)
    const outcome = run(
      () =>
        recordAttendance({
          projectId,
          workerId: correction.worker.id,
          date: day,
          status: values.status,
          checkInAt,
          checkOutAt,
        }),
      { success: `Attendance saved for ${correction.worker.name}` },
    )
    if (!outcome.ok) return
    setCorrection(null)
    attendanceForm.resetFields()
  }

  const handleRequireCheckout = (checked: boolean) => {
    run(() => setAttendancePolicy(projectId, checked), {
      success: checked ? "Check-out is now required" : "Check-out is no longer required",
    })
  }

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

        {canReadAttendance && (
          <Card
            title={
              <Title level={5} className="company-heading! m-0!">
                Attendance
              </Title>
            }
            extra={
              <Input
                type="date"
                value={day}
                onChange={(event) => setDay(event.target.value)}
                aria-label="Attendance day"
                className="w-auto"
              />
            }
            className="company-section-card"
            classNames={{ body: attendanceRows.length ? "company-table-card-body" : undefined }}
          >
            {canManage && (
              <Flex align="center" gap="small" className="mb-3">
                <Switch
                  checked={requireCheckout}
                  onChange={handleRequireCheckout}
                  aria-label="Require check-out"
                />
                <Text>Require check-out for a complete day</Text>
              </Flex>
            )}
            {attendanceRows.length ? (
              <Table<AttendanceRow>
                rowKey={(row) => row.worker.id}
                pagination={false}
                dataSource={attendanceRows}
                columns={[
                  {
                    title: "Worker",
                    key: "worker",
                    render: (_, row) => <Text strong>{row.worker.name}</Text>,
                  },
                  {
                    title: "Check-in",
                    key: "checkIn",
                    responsive: ["sm"],
                    render: (_, row) => kolkataTime(row.record?.checkInAt) ?? "—",
                  },
                  {
                    title: "Check-out",
                    key: "checkOut",
                    responsive: ["sm"],
                    render: (_, row) => kolkataTime(row.record?.checkOutAt) ?? "—",
                  },
                  {
                    title: "Day",
                    key: "dayState",
                    render: (_, row) => (
                      <Tag color={DAY_STATE_COLORS[row.state]}>
                        {DAY_STATE_LABELS[row.state]}
                      </Tag>
                    ),
                  },
                  {
                    title: "",
                    key: "correct",
                    render: (_, row) =>
                      canCorrectAttendance ? (
                        <Button
                          size="small"
                          icon={<ClockCircleOutlined />}
                          onClick={() => openCorrection(row)}
                        >
                          Record
                        </Button>
                      ) : null,
                  },
                ]}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No workers assigned to this project"
              />
            )}
          </Card>
        )}

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
        title={`Record attendance${correction ? ` · ${correction.worker.name}` : ""}`}
        open={correction !== null}
        onCancel={() => setCorrection(null)}
        footer={null}
        destroyOnHidden
      >
        <Text type="secondary" className="mb-3 block">
          Record or correct this worker's day, {day}.
        </Text>
        {correctionError ? (
          <Alert type="error" showIcon message={correctionError} className="mb-3" />
        ) : null}
        <Form<AttendanceFormValues>
          form={attendanceForm}
          layout="vertical"
          requiredMark={false}
          onFinish={handleCorrection}
        >
          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: "Choose a status" }]}
          >
            <Select options={ATTENDANCE_STATUS_OPTIONS} />
          </Form.Item>
          <Flex gap="middle">
            <Form.Item label="Check-in (optional)" name="checkInTime" className="flex-1">
              <Input type="time" />
            </Form.Item>
            <Form.Item label="Check-out (optional)" name="checkOutTime" className="flex-1">
              <Input type="time" />
            </Form.Item>
          </Flex>
          <Flex justify="flex-end">
            <Space>
              <Button onClick={() => setCorrection(null)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Save attendance
              </Button>
            </Space>
          </Flex>
        </Form>
      </Modal>

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
