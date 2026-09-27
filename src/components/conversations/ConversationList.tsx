import { AudioOutlined } from "@ant-design/icons"
import { Badge, Empty, Flex, Typography } from "antd"
import type { EntityId, ThreadSubject } from "../../domain/models"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { threadTitle, type ViewerThread } from "../../mock/conversationSelectors"
import { getProject } from "../../mock/selectors"

const { Text } = Typography

const SUBJECT_LABEL: Record<ThreadSubject, string> = {
  project: "Everyone on the project",
  homeowner: "Homeowner and project team",
  task: "Task",
  issue: "Issue",
  unit: "Location",
  direct: "Direct message",
}

/** Selectable conversation rows with unread badges (list + detail layout). */
export default function ConversationList({
  items,
  selectedId,
  onSelect,
}: {
  items: ViewerThread[]
  selectedId?: EntityId
  onSelect: (threadId: EntityId) => void
}) {
  const { state } = useConstructionData()
  if (!items.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No conversations yet." />
  // Name the project only when the list spans more than one.
  const manyProjects = new Set(items.map(({ thread }) => thread.projectId)).size > 1
  return (
    <Flex vertical gap={4} role="listbox" aria-label="Conversations">
      {items.map(({ thread, reader, unread, lastMessage }) => {
        const active = thread.id === selectedId
        const preview = lastMessage?.body ?? (lastMessage?.voice ? "Voice message" : "")
        return (
          <button
            key={thread.id}
            type="button"
            role="option"
            aria-selected={active}
            className={`progress-queue-item${active ? " is-active" : ""}`}
            onClick={() => onSelect(thread.id)}
          >
            <Flex align="center" justify="space-between" gap="small">
              <Text strong ellipsis>{threadTitle(state, thread, reader.id)}</Text>
              <Badge count={unread} size="small" />
            </Flex>
            <Text type="secondary" className="text-[12px]!">
              {[manyProjects ? getProject(state, thread.projectId)?.name : undefined, SUBJECT_LABEL[thread.subject]]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {preview && (
              <Text type="secondary" ellipsis>
                {lastMessage?.voice && !lastMessage.body && <AudioOutlined />} {preview}
              </Text>
            )}
          </button>
        )
      })}
    </Flex>
  )
}
