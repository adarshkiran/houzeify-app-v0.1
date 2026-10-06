import { useMemo, useState } from "react"
import { countLabel } from "../components/countLabel"
import {
  ClockCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  QrcodeOutlined,
  SearchOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons"
import {
  Alert,
  Avatar,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
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
import { attendanceDate, dayState, validateTimes, type DayState } from "../domain/attendance"
import type {
  AssignmentEndReason,
  AttendanceStatus,
  EntityId,
  ISODate,
  Worker,
  WorkerOnboarding,
  WorkerProjectAssignment,
} from "../domain/models"
import type { Navigate } from "../domain/navigation"
import {
  getActiveAssignmentsForWorker,
  getOrganizationWorkers,
  workerMatchesProject,
} from "../domain/workforce"
import { openOnboardingFor } from "../domain/workforceOnboarding"
import Gated from "../components/Gated"
import { Permissions } from "../domain/permissions"
import { useAccess } from "../session/useCan"
import { useCommand } from "../session/useCommand"
import {
  useConstructionData,
  type AddWorkerInput,
} from "../mock/ConstructionDataProvider"
import { useOrganizationId } from "../session/SessionProvider"
import {
  getOrganizationProjects,
  getProjectUnits,
  getTradeName,
} from "../mock/selectors"

const { Paragraph, Text, Title } = Typography

interface AddWorkerFormValues {
  name: string
  phone?: string
  tradeIds: EntityId[]
  languages: string[]
  projectId?: EntityId
  projectUnitIds?: EntityId[]
  role: WorkerProjectAssignment["role"]
}

const ONBOARDING_METHOD_LABELS: Record<Worker["onboardingMethod"], string> = {
  manual: "Manual",
  otp: "OTP",
  qr: "QR join",
  "supervisor-assisted": "Supervisor-assisted",
}

const END_REASON_OPTIONS: { value: AssignmentEndReason; label: string }[] = [
  { value: "reassigned", label: "Reassigned to another project" },
  { value: "left-project", label: "Left the project" },
  { value: "removed", label: "Removed from the project" },
]

interface JoinCodeState {
  workerName: string
  code: string
}

interface EndAssignmentState {
  assignment: WorkerProjectAssignment
  workerName: string
  projectName: string
}

interface AssignFormValues {
  workerId: EntityId
  projectId: EntityId
  projectUnitIds?: EntityId[]
  tradeIds: EntityId[]
  role: WorkerProjectAssignment["role"]
}

interface AttendanceFormValues {
  projectId: EntityId
  date: ISODate
  status: AttendanceStatus
  checkInTime?: string
  checkOutTime?: string
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

/** HH:mm in Asia/Kolkata for a saved instant, the inverse of instantOn. */
function kolkataTime(instant?: string): string | undefined {
  if (!instant) return undefined
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant))
}

function Workforce({ onNavigate }: { onNavigate: Navigate }) {
  const {
    state,
    addWorker,
    assignWorkerToProject,
    createWorkerOnboarding,
    cancelWorkerOnboarding,
    acceptWorkerOnboarding,
    endWorkerProjectAssignment,
    recordAttendance,
    getOwnAttendance,
  } = useConstructionData()
  const run = useCommand()
  const can = useAccess()
  const organizationId = useOrganizationId()
  const [search, setSearch] = useState("")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [tradeFilter, setTradeFilter] = useState<string>("all")
  const [assignmentFilter, setAssignmentFilter] = useState<
    "all" | "assigned" | "unassigned"
  >("all")
  const [addOpen, setAddOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [joinCode, setJoinCode] = useState<JoinCodeState | null>(null)
  const [endAssignment, setEndAssignment] = useState<EndAssignmentState | null>(
    null,
  )
  const [endReason, setEndReason] = useState<AssignmentEndReason>("reassigned")
  const [attendanceWorker, setAttendanceWorker] = useState<Worker | null>(null)
  const [attendanceError, setAttendanceError] = useState<string | null>(null)
  const [addForm] = Form.useForm<AddWorkerFormValues>()
  const [assignForm] = Form.useForm<AssignFormValues>()
  const [attendanceForm] = Form.useForm<AttendanceFormValues>()
  const addProjectId = Form.useWatch("projectId", addForm)
  const assignProjectId = Form.useWatch("projectId", assignForm)

  const projects = getOrganizationProjects(state, organizationId)
  // Only projects where the person may manage workforce can be chosen in dialogs.
  const WF = Permissions.WORKFORCE_MANAGE
  /** Units of a project the person may assign workers to (their scope). */
  const workforceUnits = (projectId?: EntityId) =>
    projectId
      ? getProjectUnits(state, projectId).filter((unit) =>
          can(WF, projectId, { projectUnitId: unit.id }),
        )
      : []
  /** "Entire project" is a whole-project change: unscoped members only. */
  const canAssignWholeProject = (projectId?: EntityId) =>
    !!projectId && can(WF, projectId)
  /** Trades the person may assign, within their scope. */
  const tradesFor = (projectId?: EntityId) =>
    !projectId
      ? state.trades
      : state.trades.filter((trade) =>
          canAssignWholeProject(projectId)
            ? can(WF, projectId, { tradeId: trade.id })
            : workforceUnits(projectId).some((unit) =>
                can(WF, projectId, { projectUnitId: unit.id, tradeId: trade.id }),
              ),
        )
  const manageableProjects = projects.filter(
    (project) =>
      canAssignWholeProject(project.id) || workforceUnits(project.id).length > 0,
  )
  const workers = getOrganizationWorkers(state, organizationId)

  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      const haystack = `${worker.name} ${worker.phone ?? ""}`.toLowerCase()
      if (search && !haystack.includes(search.toLowerCase())) return false
      if (
        tradeFilter !== "all" &&
        !worker.tradeIds.includes(tradeFilter)
      ) {
        return false
      }
      const assigned = getActiveAssignmentsForWorker(state, worker.id).length > 0
      if (assignmentFilter === "assigned" && !assigned) return false
      if (assignmentFilter === "unassigned" && assigned) return false
      if (
        projectFilter !== "all" &&
        !workerMatchesProject(state, worker.id, projectFilter)
      ) {
        return false
      }
      return true
    })
  }, [workers, search, tradeFilter, assignmentFilter, projectFilter, state])

  const openAdd = () => {
    addForm.setFieldsValue({
      languages: ["en"],
      role: "worker",
      tradeIds: undefined,
      projectId: undefined,
      projectUnitIds: undefined,
      name: undefined,
      phone: undefined,
    })
    setAddOpen(true)
  }

  const openAssign = (worker?: Worker) => {
    assignForm.setFieldsValue({
      workerId: worker?.id,
      tradeIds: worker?.tradeIds,
      role: "worker",
      projectId: undefined,
      projectUnitIds: undefined,
    })
    setAssignOpen(true)
  }

  const handleAdd = (values: AddWorkerFormValues) => {
    const input: AddWorkerInput = {
      organizationId,
      name: values.name,
      phone: values.phone,
      tradeIds: values.tradeIds,
      languages: values.languages,
      onboardingMethod: "manual",
      projectId: values.projectId,
      projectUnitIds: values.projectUnitIds,
      role: values.role,
    }
    const outcome = run(() => addWorker(input), {
      success: `${values.name} added`,
    })
    if (!outcome.ok) return
    setAddOpen(false)
    addForm.resetFields()
  }

  const handleSendQrJoin = (worker: Worker) => {
    const outcome = run(
      () => createWorkerOnboarding({ workerId: worker.id, method: "qr" }),
      { success: `QR join created for ${worker.name}` },
    )
    if (!outcome.ok) return
    setJoinCode({
      workerName: worker.name,
      code: outcome.value.joinCode ?? "",
    })
  }

  /** Supervisor activates a non-qr invite (R10); qr joins are accepted by the worker with the code. */
  const handleMarkJoined = (onboarding: WorkerOnboarding) => {
    run(() => acceptWorkerOnboarding(onboarding.id), {
      success: "Marked as joined",
    })
  }

  const handleCancelInvite = (onboarding: WorkerOnboarding) => {
    run(() => cancelWorkerOnboarding(onboarding.id), {
      success: "Invite cancelled",
    })
  }

  const openEndAssignment = (
    assignment: WorkerProjectAssignment,
    workerName: string,
  ) => {
    setEndReason("reassigned")
    setEndAssignment({
      assignment,
      workerName,
      projectName:
        state.projects.find((item) => item.id === assignment.projectId)?.name ??
        "Project",
    })
  }

  const handleEndAssignment = () => {
    if (!endAssignment) return
    const outcome = run(
      () => endWorkerProjectAssignment(endAssignment.assignment.id, endReason),
      { success: "Assignment ended" },
    )
    if (!outcome.ok) return
    setEndAssignment(null)
  }

  const handleAssign = (values: AssignFormValues) => {
    const outcome = run(
      () =>
        assignWorkerToProject({
          workerId: values.workerId,
          projectId: values.projectId,
          projectUnitIds: values.projectUnitIds,
          tradeIds: values.tradeIds,
          role: values.role,
        }),
      { success: "Worker assigned" },
    )
    if (!outcome.ok) return
    setAssignOpen(false)
    assignForm.resetFields()
  }

  const today = attendanceDate(new Date())

  /** The worker's active assignments on projects this person may record attendance for. */
  const attendanceProjectsFor = (worker: Worker) =>
    getActiveAssignmentsForWorker(state, worker.id)
      .map((assignment) => state.projects.find((item) => item.id === assignment.projectId))
      .filter((project): project is NonNullable<typeof project> =>
        !!project && canAssignWholeProject(project.id),
      )

  const openAttendance = (worker: Worker) => {
    const projects = attendanceProjectsFor(worker)
    const projectId = projects.length === 1 ? projects[0].id : undefined
    const saved =
      projectId && worker.phone ? getOwnAttendance(projectId, worker.phone, today) : undefined
    setAttendanceError(null)
    attendanceForm.setFieldsValue({
      projectId,
      date: today,
      status: saved?.status ?? "present",
      checkInTime: kolkataTime(saved?.checkInAt),
      checkOutTime: kolkataTime(saved?.checkOutAt),
    })
    setAttendanceWorker(worker)
  }

  const handleAttendance = (values: AttendanceFormValues) => {
    if (!attendanceWorker) return
    const checkInAt = instantOn(values.date, values.checkInTime)
    const checkOutAt = instantOn(values.date, values.checkOutTime)
    // A repeat submit may leave a time blank to keep the saved one, so validate against the saved record too.
    const saved = attendanceWorker.phone
      ? getOwnAttendance(values.projectId, attendanceWorker.phone, values.date)
      : undefined
    const refusal = validateTimes(
      checkInAt ?? saved?.checkInAt,
      checkOutAt ?? saved?.checkOutAt,
    )
    if (refusal) {
      setAttendanceError(refusal.message)
      return
    }
    setAttendanceError(null)
    const outcome = run(
      () =>
        recordAttendance({
          projectId: values.projectId,
          workerId: attendanceWorker.id,
          date: values.date,
          status: values.status,
          checkInAt,
          checkOutAt,
        }),
      { success: `Attendance recorded for ${attendanceWorker.name}` },
    )
    if (!outcome.ok) return
    setAttendanceWorker(null)
    attendanceForm.resetFields()
  }

  /** Today's day state for each of the worker's active project assignments. */
  const todayStates = (worker: Worker) => {
    if (!worker.phone) return []
    return getActiveAssignmentsForWorker(state, worker.id).flatMap((assignment) => {
      const project = state.projects.find((item) => item.id === assignment.projectId)
      if (!project) return []
      const record = getOwnAttendance(project.id, worker.phone!, today)
      return [
        {
          id: assignment.id,
          projectName: project.name,
          state: dayState(record, project.requireCheckout),
        },
      ]
    })
  }

  const columns: TableProps<Worker>["columns"] = [
    {
      title: "Worker",
      key: "worker",
      render: (_, worker) => (
        <Flex align="center" gap="small" className="min-w-0">
          <Avatar>{worker.name.charAt(0)}</Avatar>
          <Flex vertical gap={2} className="min-w-0">
            <Text strong className="company-heading">
              {worker.name}
            </Text>
            <Text type="secondary">{worker.phone ?? "No phone"}</Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: "Trades",
      key: "trades",
      responsive: ["md"],
      render: (_, worker) => (
        <Space size={[4, 4]} wrap>
          {worker.tradeIds.map((tradeId) => (
            <Tag key={tradeId}>{getTradeName(state, tradeId)}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Projects",
      key: "projects",
      render: (_, worker) => {
        const assignments = getActiveAssignmentsForWorker(state, worker.id)
        if (!assignments.length) {
          return <Text type="secondary">Unassigned</Text>
        }
        return (
          <Space size={[4, 4]} wrap>
            {assignments.map((assignment) => {
              const project = state.projects.find(
                (item) => item.id === assignment.projectId,
              )
              return (
                <Tag key={assignment.id} color="processing">
                  {project?.name ?? "Project"} · {assignment.role}{" "}
                  <Button
                    type="link"
                    size="small"
                    className="company-inline-link"
                    icon={<UserDeleteOutlined />}
                    aria-label={`End assignment to ${project?.name ?? "project"}`}
                    onClick={() => openEndAssignment(assignment, worker.name)}
                  >
                    End assignment
                  </Button>
                </Tag>
              )
            })}
          </Space>
        )
      },
    },
    {
      title: "Languages",
      dataIndex: "languages",
      key: "languages",
      width: 140,
      responsive: ["lg"],
      render: (languages: string[]) => languages.join(", "),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: Worker["status"]) => (
        <Tag
          color={
            status === "invited"
              ? "gold"
              : status === "active"
                ? "success"
                : "default"
          }
        >
          {status}
        </Tag>
      ),
    },
    {
      title: "Onboarding",
      key: "onboarding",
      width: 180,
      responsive: ["lg"],
      render: (_, worker) => {
        const open = openOnboardingFor(state, worker.id)
        return (
          <Space size={[4, 4]} wrap>
            <Text>{ONBOARDING_METHOD_LABELS[worker.onboardingMethod]}</Text>
            {open ? <Tag>{open.status}</Tag> : null}
          </Space>
        )
      },
    },
    {
      title: `Today (${today})`,
      key: "today",
      width: 200,
      responsive: ["lg"],
      render: (_, worker) => {
        const states = todayStates(worker)
        if (!states.length) return <Text type="secondary">—</Text>
        return (
          <Space size={[4, 4]} wrap>
            {states.map((item) => (
              <Tag key={item.id} color={DAY_STATE_COLORS[item.state]}>
                {item.projectName}: {DAY_STATE_LABELS[item.state]}
              </Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: "",
      key: "actions",
      width: 260,
      render: (_, worker) => {
        const open = openOnboardingFor(state, worker.id)
        return (
          <Space size={[4, 4]} wrap>
            <Button
              type="link"
              size="small"
              className="company-inline-link"
              onClick={() => openAssign(worker)}
            >
              Assign
            </Button>
            {attendanceProjectsFor(worker).length > 0 ? (
              <Button
                type="link"
                size="small"
                className="company-inline-link"
                icon={<ClockCircleOutlined />}
                onClick={() => openAttendance(worker)}
              >
                Record attendance
              </Button>
            ) : null}
            {worker.status === "invited" && !open ? (
              <Button
                type="link"
                size="small"
                className="company-inline-link"
                icon={<QrcodeOutlined />}
                onClick={() => handleSendQrJoin(worker)}
              >
                Send QR join
              </Button>
            ) : null}
            {open?.status === "invited" && open.method !== "qr" ? (
              <Button
                type="link"
                size="small"
                className="company-inline-link"
                onClick={() => handleMarkJoined(open)}
              >
                Mark as joined
              </Button>
            ) : null}
            {open?.status === "invited" ? (
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleCancelInvite(open)}
              >
                Cancel invite
              </Button>
            ) : null}
          </Space>
        )
      },
    },
  ]

  const addUnits = workforceUnits(addProjectId)
  const assignUnits = workforceUnits(assignProjectId)

  return (
    <CompanyLayout
      nav={{ menu: "company", active: "workforce" }}
      onNavigate={onNavigate}
      header={
        <Flex align="center" justify="space-between" className="h-full gap-3">
          <Flex vertical justify="center">
            <Title level={5} className="company-heading! m-0!">
              Site Workforce
            </Title>
            <Text type="secondary">
              Add workers and assign them to projects by trade
            </Text>
          </Flex>
          <Space>
            <Gated
              allowed={manageableProjects.length > 0}
              reason="You don't manage workforce on any project."
            >
              <Button onClick={() => openAssign()}>Assign existing</Button>
            </Gated>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              Add worker
            </Button>
          </Space>
        </Flex>
      }
    >
      <Flex vertical gap="middle" className="company-content">
        <Card size="small">
          <Flex gap="small" wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search workers"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="company-project-search"
            />
            <Select
              value={projectFilter}
              onChange={setProjectFilter}
              className="company-project-filter"
              options={[
                { value: "all", label: "All projects" },
                ...projects.map((project) => ({
                  value: project.id,
                  label: project.name,
                })),
              ]}
            />
            <Select
              value={tradeFilter}
              onChange={setTradeFilter}
              className="company-project-filter"
              options={[
                { value: "all", label: "All trades" },
                ...state.trades.map((trade) => ({
                  value: trade.id,
                  label: trade.name,
                })),
              ]}
            />
            <Select
              value={assignmentFilter}
              onChange={setAssignmentFilter}
              className="company-project-filter"
              options={[
                { value: "all", label: "All assignments" },
                { value: "assigned", label: "Assigned" },
                { value: "unassigned", label: "Unassigned" },
              ]}
            />
          </Flex>
        </Card>

        <Card
          size="small"
          title={
            <Title level={5} className="company-heading! m-0!">
              Workers
            </Title>
          }
          extra={
            <Text type="secondary">{countLabel(filteredWorkers.length, "worker")}</Text>
          }
          classNames={{ body: "company-table-card-body-inset" }}
        >
          <Table
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={filteredWorkers}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 1100 }}
          />
        </Card>
      </Flex>

      <Modal
        title="Add worker"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Paragraph type="secondary" className="mt-0! mb-3!">
          Create a site worker and optionally assign them to a project.
        </Paragraph>
        <Form<AddWorkerFormValues>
          form={addForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{ languages: ["en"], role: "worker" }}
          onFinish={handleAdd}
        >
          <Form.Item
            label="Full name"
            name="name"
            rules={[{ required: true, message: "Enter the worker's name" }]}
          >
            <Input placeholder="Ramesh Kumar" />
          </Form.Item>
          <Form.Item label="Mobile number" name="phone">
            <Input placeholder="+91 98765 43210" />
          </Form.Item>
          <Form.Item
            label="Trades"
            name="tradeIds"
            rules={[{ required: true, message: "Select at least one trade" }]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="e.g. Reinforcement"
              options={tradesFor(addProjectId).map((trade) => ({
                value: trade.id,
                label: trade.name,
              }))}
            />
          </Form.Item>
          <Form.Item label="Languages" name="languages">
            <Select
              mode="tags"
              options={[
                { value: "en", label: "English" },
                { value: "hi", label: "Hindi" },
                { value: "te", label: "Telugu" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Assign to project" name="projectId">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Optional"
              options={manageableProjects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
              onChange={() => addForm.setFieldValue("projectUnitIds", undefined)}
            />
          </Form.Item>
          {addProjectId ? (
            <>
              <Form.Item
                label="Location scope"
                name="projectUnitIds"
                rules={[
                  {
                    required: !canAssignWholeProject(addProjectId),
                    message: "Choose at least one location",
                  },
                ]}
              >
                <Select
                  mode="multiple"
                  allowClear
                  placeholder={
                    canAssignWholeProject(addProjectId) ? "Entire project" : "Choose locations"
                  }
                  options={addUnits.map((unit) => ({
                    value: unit.id,
                    label: `${unit.name} · ${unit.kind}`,
                  }))}
                />
              </Form.Item>
              <Form.Item label="Site role" name="role" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: "worker", label: "Worker" },
                    { value: "lead", label: "Lead" },
                    { value: "supervisor-assist", label: "Supervisor assist" },
                  ]}
                />
              </Form.Item>
            </>
          ) : null}
          <Flex justify="flex-end">
            <Space>
              <Button onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Add worker
              </Button>
            </Space>
          </Flex>
        </Form>
      </Modal>

      <Modal
        title="Assign worker to project"
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form<AssignFormValues>
          form={assignForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{ role: "worker" }}
          onFinish={handleAssign}
        >
          <Form.Item
            label="Worker"
            name="workerId"
            rules={[{ required: true, message: "Choose a worker" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select worker"
              options={workers.map((worker) => ({
                value: worker.id,
                label: worker.name,
              }))}
              onChange={(workerId) => {
                const worker = workers.find((item) => item.id === workerId)
                if (worker) {
                  assignForm.setFieldValue("tradeIds", worker.tradeIds)
                }
              }}
            />
          </Form.Item>
          <Form.Item
            label="Project"
            name="projectId"
            rules={[{ required: true, message: "Choose a project" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select project"
              options={manageableProjects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
              onChange={() =>
                assignForm.setFieldValue("projectUnitIds", undefined)
              }
            />
          </Form.Item>
          <Form.Item
            label="Trades on this project"
            name="tradeIds"
            rules={[{ required: true, message: "Select at least one trade" }]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              options={tradesFor(assignProjectId).map((trade) => ({
                value: trade.id,
                label: trade.name,
              }))}
            />
          </Form.Item>
          {assignProjectId ? (
            <Form.Item
              label="Location scope"
              name="projectUnitIds"
              rules={[
                {
                  required: !canAssignWholeProject(assignProjectId),
                  message: "Choose at least one location",
                },
              ]}
            >
              <Select
                mode="multiple"
                allowClear
                placeholder={
                  canAssignWholeProject(assignProjectId) ? "Entire project" : "Choose locations"
                }
                options={assignUnits.map((unit) => ({
                  value: unit.id,
                  label: `${unit.name} · ${unit.kind}`,
                }))}
              />
            </Form.Item>
          ) : null}
          <Form.Item label="Site role" name="role" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "worker", label: "Worker" },
                { value: "lead", label: "Lead" },
                { value: "supervisor-assist", label: "Supervisor assist" },
              ]}
            />
          </Form.Item>
          <Flex justify="flex-end">
            <Space>
              <Button onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Assign worker
              </Button>
            </Space>
          </Flex>
        </Form>
      </Modal>

      <Modal
        title={`Record attendance${attendanceWorker ? ` · ${attendanceWorker.name}` : ""}`}
        open={attendanceWorker !== null}
        onCancel={() => setAttendanceWorker(null)}
        footer={null}
        destroyOnHidden
      >
        <Paragraph type="secondary" className="mt-0! mb-3!">
          Record or correct one day for this worker on a project they are assigned to.
        </Paragraph>
        {attendanceError ? (
          <Alert type="error" showIcon message={attendanceError} className="mb-3" />
        ) : null}
        <Form<AttendanceFormValues>
          form={attendanceForm}
          layout="vertical"
          requiredMark={false}
          onFinish={handleAttendance}
        >
          <Form.Item
            label="Project"
            name="projectId"
            rules={[{ required: true, message: "Choose a project" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select project"
              options={
                attendanceWorker
                  ? attendanceProjectsFor(attendanceWorker).map((project) => ({
                      value: project.id,
                      label: project.name,
                    }))
                  : []
              }
            />
          </Form.Item>
          <Form.Item
            label="Date"
            name="date"
            rules={[{ required: true, message: "Choose a date" }]}
          >
            <Input type="date" />
          </Form.Item>
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
              <Button onClick={() => setAttendanceWorker(null)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Save attendance
              </Button>
            </Space>
          </Flex>
        </Form>
      </Modal>

      <Modal
        title="QR join code"
        open={joinCode !== null}
        onCancel={() => setJoinCode(null)}
        footer={
          <Button type="primary" onClick={() => setJoinCode(null)}>
            Done
          </Button>
        }
        destroyOnHidden
      >
        <Paragraph type="secondary" className="mt-0! mb-3!">
          Read this code out to {joinCode?.workerName ?? "the worker"}. They
          enter it in the worker app to accept the invite.
        </Paragraph>
        <Flex justify="center" className="py-4">
          <Title level={2} copyable className="m-0! tracking-widest">
            {joinCode?.code}
          </Title>
        </Flex>
      </Modal>

      <Modal
        title="End assignment"
        open={endAssignment !== null}
        onCancel={() => setEndAssignment(null)}
        footer={null}
        destroyOnHidden
      >
        <Paragraph type="secondary" className="mt-0! mb-3!">
          {endAssignment?.workerName} stops working on{" "}
          {endAssignment?.projectName}. Their record is kept and their worker
          status stays as it is.
        </Paragraph>
        <Form layout="vertical" requiredMark={false}>
          <Form.Item label="Reason">
            <Select
              value={endReason}
              onChange={setEndReason}
              options={END_REASON_OPTIONS}
            />
          </Form.Item>
          <Flex justify="flex-end">
            <Space>
              <Button onClick={() => setEndAssignment(null)}>Cancel</Button>
              <Button type="primary" danger onClick={handleEndAssignment}>
                End assignment
              </Button>
            </Space>
          </Flex>
        </Form>
      </Modal>
    </CompanyLayout>
  )
}

export default function WorkforceScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <CompanyThemeProvider>
      <Workforce onNavigate={onNavigate} />
    </CompanyThemeProvider>
  )
}
