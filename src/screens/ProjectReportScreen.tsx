import { useMemo, useState } from "react"
import { Alert, Avatar, Button, Card, Col, Empty, Flex, List, Row, Statistic, Table, Tag, Typography } from "antd"
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
  type ProjectReport as ProjectReportData,
  type ReportStatus,
  type SignalKind,
  type StageAnalysis,
} from "../domain/projectAnalysis"
import NarrativePanel, { AiText } from "../components/narrative/NarrativePanel"
import { useNarrativeDraft } from "../components/narrative/useNarrativeDraft"
import { hasEntitlement } from "../domain/entitlements"
import { buildNarrativeFacts } from "../mock/narrativeFacts"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { useCommand } from "../session/useCommand"

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

/** The Asia/Kolkata calendar date of an instant, matching the report's own `asOf`. */
const approvalDate = (instant: string) => attendanceDate(new Date(instant))

function ProjectReport({ onNavigate, projectId }: { onNavigate: Navigate; projectId: EntityId }) {
  const { state, approveProjectReport } = useConstructionData()
  const run = useCommand()
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)

  const live = useMemo(() => {
    const now = new Date()
    return analyzeProject(state, projectId, attendanceDate(now), now.toISOString())
  }, [state, projectId])

  const facts = useMemo(() => (live ? buildNarrativeFacts(live) : undefined), [live])
  const draft = useNarrativeDraft(facts)
  const organizationId = state.projects.find((project) => project.id === projectId)?.organizationId
  const aiAllowed = !!organizationId && hasEntitlement(state, organizationId, "ai.narrative")

  const saved = useMemo(
    () =>
      state.projectReports
        .filter((item) => item.projectId === projectId)
        .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt)),
    [state.projectReports, projectId],
  )
  const snapshot = saved.find((item) => item.id === viewingId)
  const report: ProjectReportData | undefined = snapshot?.report ?? live
  const personName = (personId: string) =>
    state.people.find((person) => person.id === personId)?.name ?? "a project manager"

  const approve = async () => {
    if (!live || approving) return
    setApproving(true)
    const outcome = await run(
      () => approveProjectReport(draft.chosen ? { ...live, narrative: draft.chosen } : live),
      { success: "Report approved and saved." },
    )
    setApproving(false)
    if (outcome.ok) {
      draft.clear()
      setViewingId(outcome.value.id)
    }
  }

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
                  {snapshot ? (
                    <Tag color="success">
                      Approved by {personName(snapshot.approvedBy)} on {approvalDate(snapshot.approvedAt)}
                    </Tag>
                  ) : (
                    <Tag>AI draft, not reviewed</Tag>
                  )}
                  <Text type="secondary">
                    As of {report.asOf} · confidence {report.confidence}
                  </Text>
                </Flex>
              }
              description={report.summary[0]}
              action={
                snapshot ? (
                  <Button size="small" onClick={() => setViewingId(null)}>
                    Back to live report
                  </Button>
                ) : (
                  <Button type="primary" size="small" loading={approving} onClick={() => void approve()}>
                    Approve and save
                  </Button>
                )
              }
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

            <Card
              title={
                <Title level={5} className="company-heading! m-0!">
                  Saved reports
                </Title>
              }
            >
              <List
                dataSource={saved}
                locale={{ emptyText: "No approved reports yet. Approve the live report to keep a snapshot." }}
                renderItem={(item) => (
                  <List.Item
                    className="cursor-pointer"
                    onClick={() => setViewingId(item.id)}
                    extra={item.id === viewingId ? <Tag color="processing">Viewing</Tag> : undefined}
                  >
                    <Flex gap="small" align="center" wrap>
                      <Tag color={STATUS_PRESENTATION[item.status].type === "success" ? "success" : STATUS_PRESENTATION[item.status].type === "warning" ? "warning" : STATUS_PRESENTATION[item.status].type === "error" ? "error" : "default"}>
                        {STATUS_PRESENTATION[item.status].label}
                      </Tag>
                      <Text>
                        As of {item.asOf} · approved by {personName(item.approvedBy)} on {approvalDate(item.approvedAt)}
                      </Text>
                    </Flex>
                  </List.Item>
                )}
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
                {snapshot ? (
                  snapshot.report.narrative ? (
                    <AiText narrative={snapshot.report.narrative} approved />
                  ) : (
                    report.summary.map((line) => (
                      <Paragraph key={line} className="m-0!">
                        {line}
                      </Paragraph>
                    ))
                  )
                ) : (
                  <NarrativePanel
                    projectId={projectId}
                    kind="report"
                    facts={facts}
                    fallbackLines={report.summary}
                    allowed={aiAllowed}
                    draft={draft}
                  />
                )}
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
