import { useMemo, useState } from "react"
import {
  Alert,
  Avatar,
  Card,
  Flex,
  Input,
  Table,
  Tag,
  Typography,
} from "antd"
import type { TableProps } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import HIcon from "../components/HIcon"
import { attendanceDate, dayState, type DayState } from "../domain/attendance"
import { ConflictError } from "../domain/errors"
import type {
  AttendanceStatus,
  EntityId,
  ISODate,
  WorkerAttendance,
} from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { PermissionError } from "../domain/session"
import { useConstructionData } from "../mock/ConstructionDataProvider"

const { Paragraph, Text, Title } = Typography

const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  "half-day": "Half day",
  absent: "Absent",
}

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

/** HH:mm in Asia/Kolkata for a saved instant. */
function kolkataTime(instant?: string): string {
  if (!instant) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant))
}

interface AttendanceRow {
  key: EntityId
  name: string
  ended: boolean
  record?: WorkerAttendance
  dayState: DayState
}

function AttendanceHistory({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  const { state, listAttendance } = useConstructionData()
  const [date, setDate] = useState<ISODate>(() => attendanceDate(new Date()))

  const project = state.projects.find((item) => item.id === projectId)
  const requireCheckout = project?.requireCheckout ?? false

  // The read is refused for worker sessions and for people without PROJECT_READ; show that instead of throwing.
  const { records, refusal } = useMemo(() => {
    try {
      return { records: listAttendance(projectId, date), refusal: null as string | null }
    } catch (error) {
      if (error instanceof PermissionError) {
        return { records: [] as WorkerAttendance[], refusal: "You don't have permission to view attendance for this project." }
      }
      if (!(error instanceof ConflictError)) throw error
      return { records: [] as WorkerAttendance[], refusal: error.message }
    }
  }, [listAttendance, projectId, date])

  // One row per worker assigned to the project (invited workers have no day yet). Ended assignments stay listed.
  const rows = useMemo<AttendanceRow[]>(
    () =>
      state.workerProjectAssignments
        .filter((assignment) => assignment.projectId === projectId && assignment.status !== "invited")
        .flatMap((assignment) => {
          const worker = state.workers.find((item) => item.id === assignment.workerId)
          if (!worker) return []
          const record = records.find((item) => item.workerId === worker.id)
          return [
            {
              key: assignment.id,
              name: worker.name,
              ended: Boolean(assignment.endedAt),
              record,
              dayState: dayState(record, requireCheckout),
            },
          ]
        }),
    [state.workerProjectAssignments, state.workers, projectId, records, requireCheckout],
  )

  const columns: TableProps<AttendanceRow>["columns"] = [
    {
      title: "Worker",
      key: "worker",
      render: (_, row) => (
        <Flex align="center" gap={8} wrap>
          <Text strong>{row.name}</Text>
          {row.ended ? <Tag>Ended</Tag> : null}
        </Flex>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_, row) => (
        <Text>{row.record?.status ? ATTENDANCE_STATUS_LABELS[row.record.status] : "—"}</Text>
      ),
    },
    {
      title: "Check-in",
      key: "checkIn",
      render: (_, row) => <Text>{kolkataTime(row.record?.checkInAt)}</Text>,
    },
    {
      title: "Check-out",
      key: "checkOut",
      render: (_, row) => <Text>{kolkataTime(row.record?.checkOutAt)}</Text>,
    },
    {
      title: "Day",
      key: "day",
      render: (_, row) => (
        <Tag color={DAY_STATE_COLORS[row.dayState]}>{DAY_STATE_LABELS[row.dayState]}</Tag>
      ),
    },
  ]

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "attendance" }}
      onNavigate={onNavigate}
      description="Who was on site, and when"
    >
      <Flex vertical gap="large" className="company-content">
        <Card>
          <Flex align="center" gap="middle" wrap>
            <Text>Day</Text>
            <Input
              type="date"
              value={date}
              onChange={(event) => {
                if (event.target.value) setDate(event.target.value)
              }}
              className="company-project-filter"
              aria-label="Attendance date"
            />
          </Flex>
        </Card>

        {refusal ? <Alert type="warning" showIcon message={refusal} /> : null}

        <Card
          title={
            <Title level={5} className="company-heading! m-0!">
              Attendance register
            </Title>
          }
          extra={<Text type="secondary">{date}</Text>}
          classNames={{ body: "company-table-card-body" }}
        >
          <Table
            rowKey="key"
            columns={columns}
            dataSource={rows}
            pagination={false}
            locale={{
              emptyText: refusal
                ? "Attendance isn't available for this project."
                : "No workers are assigned to this project yet.",
            }}
          />
        </Card>

        <Card className="company-hozie-card" variant="borderless">
          <Flex vertical gap="middle">
            <Flex align="center" gap="small">
              <Avatar className="company-hozie-icon" shape="square">
                <HIcon size={18} />
              </Avatar>
              <Text className="company-eyebrow">Hozie Summary</Text>
            </Flex>
            <Paragraph className="m-0!">
              This register lists {rows.length} {rows.length === 1 ? "worker" : "workers"} assigned to
              the project for {date}. A day marked Check-out missing needs a check-out before it is
              complete.
            </Paragraph>
          </Flex>
        </Card>
      </Flex>
    </CompanyLayout>
  )
}

export default function AttendanceHistoryScreen({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  return (
    <CompanyThemeProvider>
      <AttendanceHistory onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
