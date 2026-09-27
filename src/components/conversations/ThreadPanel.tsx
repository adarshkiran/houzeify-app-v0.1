import { useEffect, useMemo, useState } from "react"
import { SendOutlined } from "@ant-design/icons"
import { Button, Empty, Flex, Typography } from "antd"
import { findThread, readerMembership, unreadCount } from "../../domain/conversations"
import type { EntityId, Thread, ThreadSubject } from "../../domain/models"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { getThreadMessages, roleLabel } from "../../mock/conversationSelectors"
import { getMembershipName } from "../../mock/selectors"
import { useSession } from "../../session/SessionProvider"
import { useCommand } from "../../session/useCommand"
import VoiceTextArea from "../VoiceTextArea"

const { Text } = Typography

type PanelTarget =
  | { threadId: EntityId }
  | { projectId: EntityId; subject: Exclude<ThreadSubject, "direct">; targetId?: EntityId }

const MAX_LENGTH = 2000

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

/**
 * One conversation: messages oldest → newest and a composer. For a context
 * (task, issue, …) that has no thread yet, it shows an empty state and the
 * first message creates the thread. Opening it marks the thread read.
 */
export default function ThreadPanel(props: PanelTarget & { emptyText?: string; compact?: boolean }) {
  const { state, postMessage, markThreadRead } = useConstructionData()
  const { session } = useSession()
  const run = useCommand()
  const [body, setBody] = useState("")

  const thread: Thread | undefined =
    "threadId" in props
      ? state.threads.find((t) => t.id === props.threadId)
      : findThread(state, props.projectId, props.subject, props.targetId)
  const probe: Thread | undefined =
    thread ??
    ("threadId" in props
      ? undefined
      : {
          id: "draft",
          projectId: props.projectId,
          subject: props.subject,
          targetId: props.targetId,
          audience: props.subject === "homeowner" ? "homeowner" : "internal",
          createdAt: "",
        })
  const me = probe ? readerMembership(state, session, probe) : undefined
  const messages = useMemo(() => (thread ? getThreadMessages(state, thread.id) : []), [state, thread])
  const unread = thread && me ? unreadCount(state, thread, me.id) : 0

  useEffect(() => {
    if (thread && me && unread > 0) run(() => markThreadRead(thread.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, me?.id, unread])

  if (!probe || !me) return <Text type="secondary">You can't see this conversation.</Text>

  const send = () => {
    const target: PanelTarget = thread
      ? { threadId: thread.id }
      : { projectId: probe.projectId, subject: probe.subject as Exclude<ThreadSubject, "direct">, targetId: probe.targetId }
    const outcome = run(() => postMessage({ ...target, body }))
    if (outcome.ok) setBody("")
  }

  return (
    <Flex vertical gap="middle" className={`thread-panel${props.compact ? " is-compact" : ""}`}>
      <Flex vertical gap="small" className="thread-messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={props.emptyText ?? "No messages yet. Start the conversation."} />
        ) : (
          messages.map((message) => {
            const author = state.memberships.find((m) => m.id === message.authorMembershipId)
            const mine = message.authorMembershipId === me.id
            return (
              <Flex key={message.id} vertical className={`thread-message${mine ? " is-mine" : ""}`}>
                <Flex gap={6} align="baseline" wrap>
                  <Text strong className="text-[13px]!">{mine ? "You" : getMembershipName(state, message.authorMembershipId) ?? "Someone"}</Text>
                  {author && !mine && <Text type="secondary" className="text-[12px]!">{roleLabel(author.role)}</Text>}
                  <Text type="secondary" className="text-[12px]!">{timeLabel(message.createdAt)}</Text>
                </Flex>
                {message.voice && (
                  <Flex vertical gap={4}>
                    <audio src={message.voice.url} controls preload="none" className="thread-audio" />
                    {message.voice.transcript && <Text type="secondary" italic>“{message.voice.transcript}”</Text>}
                  </Flex>
                )}
                {message.body && <Text className="thread-body">{message.body}</Text>}
              </Flex>
            )
          })
        )}
      </Flex>

      <Flex vertical gap="small" className="thread-composer">
        <VoiceTextArea
          rows={2}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a message"
          aria-label="Message"
          maxLength={MAX_LENGTH}
        />
        <Flex justify="space-between" align="center" gap="small">
          <Text type="secondary" className="text-[12px]!">
            {body.length} / {MAX_LENGTH}
          </Text>
          <Button type="primary" icon={<SendOutlined />} disabled={!body.trim()} onClick={send}>
            Send
          </Button>
        </Flex>
      </Flex>
    </Flex>
  )
}
