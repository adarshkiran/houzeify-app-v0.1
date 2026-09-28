import { ArrowRightOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons"
import { clickableRow, stopRowClick } from "../components/company/clickableRow"
import { countLabel } from "../components/countLabel"
import { Button, Card, Flex, Input, Select, Table, Tag, Typography } from "antd"
import type { TableProps } from "antd"
import { useMemo, useState } from "react"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import Gated from "../components/Gated"
import { issueSeverityColor, issueStatusColor, issueStatusLabel } from "../components/issueLabels"
import ReportIssueModal from "../components/ReportIssueModal"
import type { EntityId, Issue } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { ISSUE_REPORT_PERMISSIONS } from "../domain/permissions"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getMembershipName } from "../mock/selectors"
import { useAccess, useActableUnits } from "../session/useCan"
import { useScopedData } from "../session/useScopedData"

const { Text, Title } = Typography

type StatusFilter = Issue["status"] | "active" | "all"

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "active", label: "Open and in progress" },
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in-progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
]

const severityRank: Record<Issue["severity"], number> = { critical: 0, high: 1, medium: 2, low: 3 }

function Issues({ onNavigate, projectId }: { onNavigate: Navigate; projectId: EntityId }) {
  const { state } = useConstructionData()
  const scoped = useScopedData() // only issues in the viewer's scope
  const can = useAccess()
  const reportableUnits = useActableUnits(ISSUE_REPORT_PERMISSIONS, projectId)
  const canReport = reportableUnits.length > 0 || can(ISSUE_REPORT_PERMISSIONS, projectId)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<StatusFilter>("active")
  const [severity, setSeverity] = useState<Issue["severity"] | "all">("all")
  const [unitId, setUnitId] = useState<EntityId | "all">("all")
  const [reportOpen, setReportOpen] = useState(false)

  const units = scoped.projectUnits.filter((unit) => unit.projectId === projectId)
  const issues = useMemo(
    () =>
      scoped.issues
        .filter((issue) => issue.projectId === projectId)
        .filter((issue) => {
          const matchesStatus =
            status === "all" ||
            (status === "active"
              ? issue.status === "open" || issue.status === "in-progress"
              : issue.status === status)
          return (
            matchesStatus &&
            (severity === "all" || issue.severity === severity) &&
            (unitId === "all" || issue.projectUnitId === unitId) &&
            `${issue.title} ${issue.description}`.toLowerCase().includes(search.toLowerCase())
          )
        })
        .sort(
          (a, b) =>
            severityRank[a.severity] - severityRank[b.severity] ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [scoped.issues, projectId, status, severity, unitId, search],
  )

  const columns: TableProps<Issue>["columns"] = [
    {
      title: "Issue",
      key: "issue",
      render: (_, issue) => (
        <Flex vertical gap={2}>
          <Text strong>{issue.title}</Text>
          {/* Two lines at most; wraps on a phone instead of forcing the table wider. */}
          <Text type="secondary" className="line-clamp-2" style={{ maxWidth: 360 }}>
            {issue.description || "No details"}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Severity",
      dataIndex: "severity",
      key: "severity",
      responsive: ["sm"],
      render: (value: Issue["severity"]) => <Tag color={issueSeverityColor(value)}>{value}</Tag>,
    },
    {
      title: "Location",
      key: "location",
      responsive: ["md"],
      render: (_, issue) => (
        <Text>{units.find((unit) => unit.id === issue.projectUnitId)?.name ?? "Whole project"}</Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (value: Issue["status"]) => <Tag color={issueStatusColor(value)}>{issueStatusLabel[value]}</Tag>,
    },
    {
      title: "Assigned to",
      key: "assignee",
      responsive: ["lg"],
      render: (_, issue) => (
        <Text type={issue.assignedMembershipId ? undefined : "secondary"}>
          {getMembershipName(state, issue.assignedMembershipId) ?? "Unassigned"}
        </Text>
      ),
    },
    {
      title: "Raised",
      dataIndex: "createdAt",
      key: "createdAt",
      responsive: ["lg"],
      render: (value: string) => <Text type="secondary">{value.slice(0, 10)}</Text>,
    },
    {
      key: "action",
      width: 48,
      // The whole row opens the issue; the arrow is just the hint.
      render: () => <ArrowRightOutlined aria-hidden className="clickable-row-arrow" />,
    },
  ]

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "issues" }}
      onNavigate={onNavigate}
      description="Site problems, owners and how they were closed"
      actions={
        <Gated allowed={canReport} reason="You can't report issues on this project.">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setReportOpen(true)}>
            Report issue
          </Button>
        </Gated>
      }
    >
      <Flex vertical gap="large" className="company-content">

        <Card>
          <Flex gap="middle" wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search issues"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="company-project-search"
            />
            <Select value={status} onChange={setStatus} options={statusOptions} className="company-project-filter" />
            <Select
              value={severity}
              onChange={setSeverity}
              className="company-project-filter"
              options={[
                { value: "all", label: "All severities" },
                { value: "critical", label: "Critical" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
            />
            <Select
              value={unitId}
              onChange={setUnitId}
              className="company-project-filter"
              options={[
                { value: "all", label: "All locations" },
                ...units.map((unit) => ({ value: unit.id, label: unit.name })),
              ]}
            />
          </Flex>
        </Card>

        <Card
          title={<Title level={5} className="company-heading! m-0!">Issue register</Title>}
          extra={<Text type="secondary">{countLabel(issues.length, "issue")}</Text>}
          classNames={{ body: "company-table-card-body" }}
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={issues}
            onRow={(issue) =>
              clickableRow(
                () => onNavigate("issue-detail", { project_id: projectId, issue_id: issue.id }),
                `Open ${issue.title}`,
              )
            }
            pagination={{ pageSize: 10, showSizeChanger: false }}
          />
        </Card>
      </Flex>

      <ReportIssueModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        projectId={projectId}
        onReported={(issue) =>
          onNavigate("issue-detail", { project_id: projectId, issue_id: issue.id })
        }
      />
    </CompanyLayout>
  )
}

export default function IssuesScreen({ onNavigate, projectId }: { onNavigate: Navigate; projectId: EntityId }) {
  return (
    <CompanyThemeProvider>
      <Issues onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}

