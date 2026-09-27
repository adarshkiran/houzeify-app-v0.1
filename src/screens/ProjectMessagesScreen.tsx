import { Card, Col, Flex, Row, Tag, Typography } from "antd"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import ConversationList from "../components/conversations/ConversationList"
import ThreadPanel from "../components/conversations/ThreadPanel"
import type { EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getViewerThreads, threadTitle } from "../mock/conversationSelectors"
import { useSession } from "../session/SessionProvider"

const { Title } = Typography

function Messages({ onNavigate, projectId, threadId }: { onNavigate: Navigate; projectId: EntityId; threadId?: EntityId }) {
  const { state } = useConstructionData()
  const { session } = useSession()
  const items = getViewerThreads(state, session, projectId)
  const selected = items.find((item) => item.thread.id === threadId) ?? items[0]
  const select = (id: EntityId) => onNavigate("project-messages", { project_id: projectId, thread_id: id })

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "messages" }}
      onNavigate={onNavigate}
      description="Conversations about this project's work"
    >
      <Flex vertical gap="large" className="company-content">
        <Row gutter={[16, 16]} align="top">
          <Col xs={24} lg={8}>
            <Card
              title={<Title level={5} className="company-heading! m-0!">Conversations</Title>}
              classNames={{ body: "progress-queue-body" }}
            >
              <ConversationList items={items} selectedId={selected?.thread.id} onSelect={select} />
            </Card>
          </Col>
          <Col xs={24} lg={16}>
            {selected ? (
              <Card
                title={
                  <Title level={5} className="company-heading! m-0!">
                    {threadTitle(state, selected.thread, selected.reader.id)}
                  </Title>
                }
                extra={
                  selected.thread.audience === "homeowner"
                    ? <Tag color="purple">Homeowner can see this</Tag>
                    : <Tag>Internal</Tag>
                }
              >
                <ThreadPanel key={selected.thread.id} threadId={selected.thread.id} />
              </Card>
            ) : (
              // No conversations yet: the first message starts the project chat.
              <Card title={<Title level={5} className="company-heading! m-0!">Project chat</Title>}>
                <ThreadPanel projectId={projectId} subject="project" emptyText="Start the project conversation." />
              </Card>
            )}
          </Col>
        </Row>
      </Flex>
    </CompanyLayout>
  )
}

export default function ProjectMessagesScreen(props: { onNavigate: Navigate; projectId: EntityId; threadId?: EntityId }) {
  return (
    <CompanyThemeProvider>
      <Messages {...props} />
    </CompanyThemeProvider>
  )
}
