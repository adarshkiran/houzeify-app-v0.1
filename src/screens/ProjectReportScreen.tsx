import { useMemo } from "react"
import { Alert, Avatar, Card, Col, Empty, Flex, List, Row, Statistic, Table, Tag, Typography } from "antd"
import type { TableProps } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import HIcon from "../components/HIcon"
import { attendanceDate } from "../domain/attendance"
import type { EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import {
  analyzeProject,
  type DelaySignal,
  type ReportStatus,
  type SignalKind,
  type StageAnalysis,
} from "../domain/projectAnalysis"
import { useConstructionData } from "../mock/ConstructionDataProvider"

const { Paragraph, Text, Title } = Typography

const STATUS_PRESENTATION: Record<ReportStatus, { label: string; type: "success" | "warning" | "error" | "info" }> = {
  "on-track": { label: "On track", type: "success" },
  "at-risk": { label: "At risk", type: "warning" },
  behind: { label: "Behind schedule", type: "error" },
  "not-enough-data": { label: "Not enough data", type: "info" },
}

const SIGNAL_LABELS: Record<SignalKind, string> = {
  "overdue-task": "Overdue",
  "blocked-task": "Blocked",
  "late-start": "Late start",
  "stale-updates": "Stale updates",
  "behind-schedule": "Behind schedule",
  "aging-issue": "Open issue",
}

function ProjectReport({ onNavigate, projectId }: { onNavigate: Navigate; projectId: EntityId }) {
  const { state } = useConstructionData()

  const report = useMemo(() => {
    const now = new Date()
    return analyzeProject(state, projectId, attendanceDate(now), now.toISOString())
  }, [state, projectId])

  const openSignal = (signal: DelaySignal) => {
    if (signal.taskId) onNavigate("task-detail", { project_id: projectId, task_id: signal.taskId })
    else if (signal.issueId) onNavigate("issue-detail", { project_id: projectId, issue_id: signal.issueId })
  }

  const stageColumns: TableProps<StageAnalysis>["columns"] = [
    { title: "Stage", dataIndex: "name", key: "name", render: (name: string) => <Text strong>{name}</Text> },
    { title: "Progress", dataIndex: "percent", key: "percent", render: (percent: number) => `${percent}%` },
    { title: "Tasks", dataIndex: "taskCount", key: "tasks" },
    {
      title: "Due by today",
      key: "due",
      render: (_, stage) => (stage.dueByToday ? `${stage.doneOfDue} of ${stage.dueByToday} done` : "—"),
    },
  ]

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "report" }}
      onNavigate={onNavigate}
      description="Delay signals, planned vs actual and issues"
    >
      <Flex vertical gap="large" className="company-content">
        {!report ? (
          <Card>
            <Empty description="We couldn't find that project." />
          </Card>
        ) : (
          <>
            <Alert
              type={STATUS_PRESENTATION[report.status].type}
              showIcon
              message={
                <Flex align="center" gap="small" wrap>
                  <Text strong>{STATUS_PRESENTATION[report.status].label}</Text>
                  <Tag>AI draft, not reviewed</Tag>
                  <Text type="secondary">
                    As of {report.asOf} · confidence {report.confidence}
                  </Text>
                </Flex>
              }
              description={report.summary[0]}
            />

            <Row gutter={[16, 16]}>
              <Col xs={12} lg={6}>
                <Card size="small">
                  <Statistic title="Overall progress" value={report.progress.overall} suffix="%" />
                </Card>
              </Col>
              <Col xs={12} lg={6}>
                <Card size="small">
                  <Statistic
                    title="Planned vs actual"
                    value={report.plannedVsActual.expectedPercent ?? "—"}
                    suffix={report.plannedVsActual.expectedPercent !== undefined ? `% expected` : undefined}
                  />
                  <Text type="secondary">
                    {report.plannedVsActual.dueByToday
                      ? `${report.plannedVsActual.doneOfDue} of ${report.plannedVsActual.dueByToday} due tasks done`
                      : "No tasks due yet"}
                  </Text>
                </Card>
              </Col>
              <Col xs={12} lg={6}>
                <Card size="small">
                  <Statistic title="Open issues" value={report.issues.open} />
                </Card>
              </Col>
              <Col xs={12} lg={6}>
                <Card size="small">
                  <Statistic
                    title="Days since last update"
                    value={report.progress.daysSinceLastUpdate ?? "—"}
                  />
                </Card>
              </Col>
            </Row>

            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Delay signals
                </Title>
              }
            >
              <List
                dataSource={report.signals}
                locale={{ emptyText: "No delay signals right now." }}
                renderItem={(signal) => (
                  <List.Item
                    onClick={signal.taskId || signal.issueId ? () => openSignal(signal) : undefined}
                    className={signal.taskId || signal.issueId ? "cursor-pointer" : undefined}
                  >
                    <Flex gap="small" align="center" wrap>
                      <Tag color={signal.severity === "high" ? "error" : "warning"}>
                        {SIGNAL_LABELS[signal.kind]}
                      </Tag>
                      <Text>{signal.message}</Text>
                    </Flex>
                  </List.Item>
                )}
              />
            </Card>

            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Stages
                </Title>
              }
              classNames={{ body: "company-table-card-body" }}
            >
              <Table
                rowKey="stageId"
                columns={stageColumns}
                dataSource={report.progress.stages}
                pagination={false}
                locale={{ emptyText: "No stages have tasks or a baseline yet." }}
              />
            </Card>

            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Issues
                </Title>
              }
            >
              <Flex gap="small" wrap>
                {(["critical", "high", "medium", "low"] as const).map((severity) => (
                  <Tag key={severity}>
                    {severity}: {report.issues.bySeverity[severity]}
                  </Tag>
                ))}
              </Flex>
              {report.issues.oldestSerious ? (
                <Paragraph className="mt-3! mb-0!">
                  Oldest serious open issue: {report.issues.oldestSerious.title} (
                  {report.issues.oldestSerious.ageDays} days).
                </Paragraph>
              ) : null}
            </Card>

            <Card className="company-hozie-card" variant="borderless">
              <Flex vertical gap="middle">
                <Flex align="center" gap="small">
                  <Avatar className="company-hozie-icon" shape="square">
                    <HIcon size={18} />
                  </Avatar>
                  <Text className="company-eyebrow">Hozie Summary</Text>
                </Flex>
                {report.summary.map((line) => (
                  <Paragraph key={line} className="m-0!">
                    {line}
                  </Paragraph>
                ))}
                {report.assumptions.length ? (
                  <Flex vertical gap={4}>
                    <Text type="secondary">Assumptions</Text>
                    {report.assumptions.map((assumption) => (
                      <Text key={assumption} type="secondary">
                        {assumption}
                      </Text>
                    ))}
                  </Flex>
                ) : null}
              </Flex>
            </Card>
          </>
        )}
      </Flex>
    </CompanyLayout>
  )
}

export default function ProjectReportScreen({
  onNavigate,
  projectId,
}: {
  onNavigate: Navigate
  projectId: EntityId
}) {
  return (
    <CompanyThemeProvider>
      <ProjectReport onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
