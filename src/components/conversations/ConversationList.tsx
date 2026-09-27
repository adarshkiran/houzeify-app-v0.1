import { useState } from "react"
import { AudioOutlined, SearchOutlined } from "@ant-design/icons"
import { Empty, Flex, Input, Typography } from "antd"
import type { EntityId } from "../../domain/models"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { threadTitle, type ViewerThread } from "../../mock/conversationSelectors"
import { getProject } from "../../mock/selectors"
import { relativeTime } from "./chatTime"
import { ThreadAvatar, threadSubtitle } from "./threadVisuals"

const { Text } = Typography

/** Searchable conversation rows: avatar, name, who it's for, last message, time, unread count. */
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
  const [query, setQuery] = useState("")
  // Name the project only when the list spans more than one.
  const manyProjects = new Set(items.map(({ thread }) => thread.projectId)).size > 1

  const rows = items.map((item) => {
    const { thread, reader, lastMessage } = item
    const subtitle = [
      manyProjects ? getProject(state, thread.projectId)?.name : undefined,
      threadSubtitle(state, thread, reader.id),
    ]
      .filter(Boolean)
      .join(" · ")
    const preview = lastMessage?.body ?? (lastMessage?.voice ? "Voice message" : "")
    return { ...item, title: threadTitle(state, thread, reader.id), subtitle, preview }
  })
  const needle = query.trim().toLowerCase()
  const shown = needle
    ? rows.filter((row) => [row.title, row.subtitle, row.preview].some((text) => text.toLowerCase().includes(needle)))
    : rows

  return (
    <Flex vertical className="conversation-list">
      <div className="conversation-search">
        <Input
          allowClear
          prefix={<SearchOutlined className="text-(--ant-color-text-tertiary)" />}
          placeholder="Search conversations"
          aria-label="Search conversations"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {!items.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No conversations yet." />
      ) : !shown.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No conversations match your search." />
      ) : (
        <Flex vertical gap={4} role="listbox" aria-label="Conversations" className="conversation-rows">
          {shown.map(({ thread, reader, unread, lastMessage, title, subtitle, preview }) => {
            const active = thread.id === selectedId
            return (
              <button
                key={thread.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`conversation-item${active ? " is-active" : ""}`}
                onClick={() => onSelect(thread.id)}
              >
                <ThreadAvatar state={state} thread={thread} readerId={reader.id} />
                <Flex vertical gap={2} className="min-w-0 flex-1">
                  <Flex align="baseline" justify="space-between" gap="small">
                    <Text strong ellipsis className="text-[15px]!">{title}</Text>
                    {lastMessage && (
                      <Text type="secondary" className="shrink-0 text-[12px]!">{relativeTime(lastMessage.createdAt)}</Text>
                    )}
                  </Flex>
                  <Text type="secondary" ellipsis className="text-[12px]!">{subtitle}</Text>
                  <Flex align="center" justify="space-between" gap="small">
                    <Text ellipsis className={unread ? "font-medium" : "text-(--ant-color-text-secondary)!"}>
                      {lastMessage?.voice && !lastMessage.body && <AudioOutlined />} {preview || "No messages yet"}
                    </Text>
                    {unread > 0 && (
                      <span className="conversation-unread" aria-label={`${unread} unread`}>{unread}</span>
                    )}
                  </Flex>
                </Flex>
              </button>
            )
          })}
        </Flex>
      )}
    </Flex>
  )
}
