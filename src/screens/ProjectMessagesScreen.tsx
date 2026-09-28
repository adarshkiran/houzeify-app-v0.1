import { ArrowLeftOutlined } from "@ant-design/icons"
import { Button, Card, Col, Flex, Row, Tag } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import ConversationList from "../components/conversations/ConversationList"
import ThreadPanel from "../components/conversations/ThreadPanel"
import type { EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getViewerThreads } from "../mock/conversationSelectors"
import { useSession } from "../session/SessionProvider"

type Props = { onNavigate: Navigate; projectId: EntityId; threadId?: EntityId; from?: string }

function Messages({ onNavigate, projectId, threadId, from }: Props) {
  const { state } = useConstructionData()
  const { session } = useSession()
  const items = getViewerThreads(state, session, projectId)
  const selected = items.find((item) => item.thread.id === threadId) ?? items[0]
  // Opened from Project Team's Message button: keep the way back while browsing.
  const fromTeam = from === "project-team"
  const openTarget = (subject: string, targetId?: EntityId) => {
    if (subject === "task" && targetId) onNavigate("task-detail", { project_id: projectId, task_id: targetId })
    if (subject === "issue" && targetId) onNavigate("issue-detail", { project_id: projectId, issue_id: targetId })
  }
  const select = (id: EntityId) =>
    onNavigate("project-messages", { project_id: projectId, thread_id: id, ...(fromTeam ? { from } : {}) })

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "messages" }}
      onNavigate={onNavigate}
      description="Conversations about this project's work"
      actions={
        fromTeam && (
          <Button icon={<ArrowLeftOutlined />} onClick={() => onNavigate("project-team", { project_id: projectId })}>
            Project Team
          </Button>
        )
      }
    >
      <Flex vertical gap="large" className="company-content">
        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} lg={9} xl={8}>
            <Card className="chat-card is-list">
              <ConversationList items={items} selectedId={selected?.thread.id} onSelect={select} />
            </Card>
          </Col>
          <Col xs={24} lg={15} xl={16}>
            <Card className="chat-card">
              {selected ? (
                <ThreadPanel
                  key={selected.thread.id}
                  threadId={selected.thread.id}
                  fill
                  header
                  headerExtra={
                    selected.thread.audience === "homeowner"
                      ? <Tag color="purple" className="m-0!">Homeowner can see this</Tag>
                      : <Tag className="m-0!">Internal</Tag>
                  }
                  onOpenTarget={() => openTarget(selected.thread.subject, selected.thread.targetId)}
                  onOpenRecord={openTarget}
                />
              ) : (
                // No conversations yet: the first message starts the project chat.
                <ThreadPanel projectId={projectId} subject="project" fill header emptyText="Start the project conversation." />
              )}
            </Card>
          </Col>
        </Row>
      </Flex>
    </CompanyLayout>
  )
}

export default function ProjectMessagesScreen(props: Props) {
  return (
    <CompanyThemeProvider>
      <Messages {...props} />
    </CompanyThemeProvider>
  )
}
