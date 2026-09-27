import { ArrowLeftOutlined, CameraOutlined } from "@ant-design/icons"
import { Alert, Button, Card, Col, Empty, Flex, Input, Modal, Row, Select, Space, Tag, Timeline, Typography, Upload } from "antd"
import { useState } from "react"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import ThreadPanel from "../components/conversations/ThreadPanel"
import EvidenceThumb from "../components/EvidenceThumb"
import Gated from "../components/Gated"
import { issueActionLabel, issueSeverityColor, issueStatusColor, issueStatusLabel } from "../components/issueLabels"
import { getAllowedIssueTransitions } from "../domain/issueTransitions"
import type { EntityId, Issue } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { ISSUE_REPORT_PERMISSIONS, Permissions } from "../domain/permissions"
import { visibleMemberships } from "../domain/readScope"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getMembershipName } from "../mock/selectors"
import { useSession } from "../session/SessionProvider"
import { useAccess } from "../session/useCan"
import { useCommand } from "../session/useCommand"
import { useScopedData } from "../session/useScopedData"

const { Paragraph, Text, Title } = Typography

function IssueDetail({
  onNavigate,
  projectId,
  issueId,
}: {
  onNavigate: Navigate
  projectId: EntityId
  issueId: EntityId
}) {
  const { state, assignIssue, transitionIssue, addIssueEvidence } = useConstructionData()
  const scoped = useScopedData()
  const { session } = useSession()
  const run = useCommand()
  const can = useAccess()
  const [resolveOpen, setResolveOpen] = useState(false)
  const [note, setNote] = useState("")

  // An issue outside the viewer's scope reads as not found.
  const issue = scoped.issues.find((item) => item.id === issueId && item.projectId === projectId)

  if (!issue) {
    return (
      <Flex align="center" justify="center" className="project-overview-empty">
        <Alert
          type="error"
          showIcon
          message="Issue not found"
          description="This issue isn't available in this project."
          action={<Button onClick={() => onNavigate("issues", { project_id: projectId })}>Back to issues</Button>}
        />
      </Flex>
    )
  }

  const canManage = can(Permissions.ISSUE_MANAGE, projectId, issue)
  const canReport = can(ISSUE_REPORT_PERMISSIONS, projectId, issue) && issue.status !== "closed"
  const unit = state.projectUnits.find((item) => item.id === issue.projectUnitId)
  const task = issue.taskId ? scoped.tasks.find((item) => item.id === issue.taskId) : undefined
  const evidence = issue.evidenceIds
    .map((id) => scoped.evidence.find((item) => item.id === id) ?? state.evidence.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  // Who this person may hand the issue to: active members they can see.
  const assignees = visibleMemberships(session, state.memberships, state.projectUnits, projectId).filter(
    (member) => member.status === "active",
  )

  const move = (next: Issue["status"]) => {
    if (next === "resolved") {
      setNote("")
      setResolveOpen(true)
      return
    }
    run(() => transitionIssue(issue.id, next), { success: `Issue ${issueStatusLabel[next].toLowerCase()}` })
  }

  const confirmResolve = () => {
    const outcome = run(() => transitionIssue(issue.id, "resolved", note), { success: "Issue resolved" })
    if (outcome.ok) setResolveOpen(false)
  }

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "issues" }}
      onNavigate={onNavigate}
      actions={
        <Button icon={<ArrowLeftOutlined />} onClick={() => onNavigate("issues", { project_id: projectId })}>
          Issue register
        </Button>
      }
    >
      <Flex vertical gap="large" className="company-content">
        <Flex align="flex-start" justify="space-between" gap="middle" wrap>
          <Flex vertical gap="small">
            <Title level={2} className="company-heading! m-0!">{issue.title}</Title>
            <Space>
              <Tag color={issueStatusColor(issue.status)}>{issueStatusLabel[issue.status]}</Tag>
              <Tag color={issueSeverityColor(issue.severity)}>{issue.severity} severity</Tag>
            </Space>
          </Flex>
          <Space wrap>
            {getAllowedIssueTransitions(issue.status).map((next) => (
              <Gated key={next} allowed={canManage} reason="Managing issues needs issue-management access here.">
                <Button
                  type={next === "resolved" || next === "in-progress" ? "primary" : "default"}
                  onClick={() => move(next)}
                >
                  {issueActionLabel(issue.status, next)}
                </Button>
              </Gated>
            ))}
          </Space>
        </Flex>

        <Row gutter={[24, 24]} align="top">
          <Col xs={24} xl={16}>
            <Flex vertical gap="large">
              <Card title={<Title level={5} className="company-heading! m-0!">What happened</Title>}>
                <Paragraph className="m-0!">{issue.description || "No details were added."}</Paragraph>
              </Card>

              <Card
                title={<Title level={5} className="company-heading! m-0!">Evidence</Title>}
                extra={
                  canReport ? (
                    <Upload
                      multiple
                      showUploadList={false}
                      accept="image/*,video/*"
                      beforeUpload={(file) => {
                        run(
                          () =>
                            addIssueEvidence(issue.id, [
                              {
                                type: file.type.startsWith("video/") ? "video" : "photo",
                                url: URL.createObjectURL(file),
                                caption: file.name,
                              },
                            ]),
                          { success: "Evidence added" },
                        )
                        return false
                      }}
                    >
                      <Button icon={<CameraOutlined />}>Add evidence</Button>
                    </Upload>
                  ) : null
                }
              >
                {evidence.length ? (
                  <Row gutter={[12, 12]}>
                    {evidence.map((item) => (
                      <Col key={item.id} xs={12} md={8}>
                        <EvidenceThumb evidence={item} />
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No evidence attached" />
                )}
              </Card>

              <Card title={<Title level={5} className="company-heading! m-0!">Discussion</Title>}>
                <ThreadPanel
                  key={issue.id}
                  compact
                  projectId={projectId}
                  subject="issue"
                  targetId={issue.id}
                  emptyText="No messages about this issue yet."
                />
              </Card>

              {issue.resolutionNote ? (
                <Card title={<Title level={5} className="company-heading! m-0!">Resolution</Title>}>
                  <Paragraph className="m-0!">{issue.resolutionNote}</Paragraph>
                </Card>
              ) : null}
            </Flex>
          </Col>

          <Col xs={24} xl={8}>
            <Flex vertical gap="large">
              <Card title={<Title level={5} className="company-heading! m-0!">Details</Title>}>
                <Flex vertical gap="small">
                  <Flex justify="space-between"><Text type="secondary">Location</Text><Text>{unit?.name ?? "Whole project"}</Text></Flex>
                  <Flex justify="space-between" align="center">
                    <Text type="secondary">Task</Text>
                    {issue.taskId ? (
                      task ? (
                        <Button
                          type="link"
                          className="p-0!"
                          onClick={() => onNavigate("task-detail", { project_id: projectId, task_id: task.id })}
                        >
                          {task.title}
                        </Button>
                      ) : (
                        <Text type="secondary">Linked task</Text>
                      )
                    ) : (
                      <Text type="secondary">Not linked</Text>
                    )}
                  </Flex>
                  <Flex justify="space-between"><Text type="secondary">Raised by</Text><Text>{getMembershipName(state, issue.createdByMembershipId) ?? "Unknown"}</Text></Flex>
                  <Flex justify="space-between"><Text type="secondary">Raised</Text><Text>{issue.createdAt.slice(0, 10)}</Text></Flex>
                </Flex>
              </Card>

              <Card title={<Title level={5} className="company-heading! m-0!">Assigned to</Title>}>
                <Gated allowed={canManage && issue.status !== "closed"} reason="Only issue managers can assign an open issue.">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Unassigned"
                    style={{ width: "100%" }}
                    value={issue.assignedMembershipId}
                    onChange={(membershipId) => run(() => assignIssue(issue.id, membershipId), { success: "Assignment updated" })}
                    options={assignees.map((member) => ({
                      value: member.id,
                      label: `${getMembershipName(state, member.id) ?? "Member"} · ${member.role}`,
                    }))}
                  />
                </Gated>
              </Card>

              <Card title={<Title level={5} className="company-heading! m-0!">History</Title>}>
                <Timeline
                  items={[
                    { content: `Raised ${issue.createdAt.slice(0, 10)}` },
                    ...(issue.resolvedAt ? [{ color: "green", content: `Resolved ${issue.resolvedAt.slice(0, 10)}` }] : []),
                    ...(issue.closedAt ? [{ color: "gray", content: `Closed ${issue.closedAt.slice(0, 10)}` }] : []),
                  ]}
                />
              </Card>
            </Flex>
          </Col>
        </Row>
      </Flex>

      <Modal
        title="Resolve issue"
        open={resolveOpen}
        onCancel={() => setResolveOpen(false)}
        onOk={confirmResolve}
        okText="Resolve"
        destroyOnHidden
      >
        <Paragraph type="secondary">What was done to fix it? This is kept on the issue.</Paragraph>
        <Input.TextArea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Lintel replaced and re-inspected" />
      </Modal>
    </CompanyLayout>
  )
}

export default function IssueDetailScreen(props: { onNavigate: Navigate; projectId: EntityId; issueId: EntityId }) {
  return (
    <CompanyThemeProvider>
      <IssueDetail {...props} />
    </CompanyThemeProvider>
  )
}
