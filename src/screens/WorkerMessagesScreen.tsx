import { ArrowLeftOutlined } from "@ant-design/icons"
import { Button, Card, Flex, Typography } from "antd"
import ConversationList from "../components/conversations/ConversationList"
import ThreadPanel from "../components/conversations/ThreadPanel"
import WorkerShell from "../components/worker/WorkerShell"
import type { EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getViewerThreads, threadTitle } from "../mock/conversationSelectors"
import { useSession } from "../session/SessionProvider"

const { Text, Title } = Typography

export default function WorkerMessagesScreen({ onNavigate, threadId }: { onNavigate: Navigate; threadId?: EntityId }) {
  const { state } = useConstructionData()
  const { session } = useSession()
  const items = getViewerThreads(state, session)
  const open = items.find((item) => item.thread.id === threadId)

  return (
    <WorkerShell
      headerAction={
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => (open ? onNavigate("worker-messages") : onNavigate("worker-today"))}
        >
          {open ? "Messages" : "Today"}
        </Button>
      }
    >
      {open ? (
        <Flex vertical gap="small">
          <Title level={4} className="company-heading! m-0!">{threadTitle(state, open.thread, open.reader.id)}</Title>
          <Card size="small">
            <ThreadPanel key={open.thread.id} threadId={open.thread.id} />
          </Card>
        </Flex>
      ) : (
        <Flex vertical gap="small">
          <Title level={4} className="company-heading! m-0!">Messages</Title>
          <Text type="secondary">Your supervisor, your tasks and the project team.</Text>
          <Card size="small" classNames={{ body: "progress-queue-body" }}>
            <ConversationList items={items} onSelect={(id) => onNavigate("worker-messages", { thread_id: id })} />
          </Card>
        </Flex>
      )}
    </WorkerShell>
  )
}
