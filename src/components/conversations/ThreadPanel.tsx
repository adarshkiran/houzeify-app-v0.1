import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import {
  ArrowUpOutlined,
  AudioMutedOutlined,
  AudioOutlined,
  EyeInvisibleOutlined,
  ExportOutlined,
  MoreOutlined,
  PhoneOutlined,
  SearchOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons"
import { Button, Dropdown, Empty, Flex, Input, Tag, Tooltip, Typography, type MenuProps } from "antd"
import { findThread, readerMembership, unreadCount } from "../../domain/conversations"
import type { EntityId, Message, MessageSource, Thread, ThreadSubject } from "../../domain/models"
import { ISSUE_REPORT_PERMISSIONS, Permissions } from "../../domain/permissions"
import { voiceExtractor } from "../../domain/voice/extract"
import type { IssueDraftValues, TaskDraftValues, VoiceDraft } from "../../domain/voice/types"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { getThreadMessages, roleLabel, threadTitle } from "../../mock/conversationSelectors"
import { messageLinks, type MessageLink } from "../../mock/messageLinks"
import { getMembershipName } from "../../mock/selectors"
import { useSession } from "../../session/SessionProvider"
import { useAccess } from "../../session/useCan"
import { useCommand } from "../../session/useCommand"
import { useScopedData } from "../../session/useScopedData"
import ReportIssueModal from "../ReportIssueModal"
import CreateTaskModal from "../tasks/CreateTaskModal"
import { useDictation } from "../useDictation"
import { useVoiceContext } from "../voice/useVoiceContext"
import { clockTime, dayLabel, sameDay } from "./chatTime"
import { ThreadAvatar, threadSubtitle } from "./threadVisuals"

const { Text } = Typography

type PanelTarget =
  | { threadId: EntityId }
  | { projectId: EntityId; subject: Exclude<ThreadSubject, "direct">; targetId?: EntityId }

type PanelProps = PanelTarget & {
  emptyText?: string
  /** Shorter message area, for Discussion cards. */
  compact?: boolean
  /** Fill the parent's height (full chat page): messages scroll, composer stays at the bottom. */
  fill?: boolean
  /** Show the chat header: avatar, name, search, calls (coming later) and the ⋮ menu. */
  header?: boolean
  /** Shown at the right of the header, e.g. the audience tag. */
  headerExtra?: ReactNode
  /** Opens the task or issue a conversation is about (⋮ menu). */
  onOpenTarget?: () => void
  /** Opens a task or issue made from a message (the chips under it). Chips are plain text without it. */
  onOpenRecord?: (kind: "task" | "issue", id: EntityId) => void
  /** Which chip kinds `onOpenRecord` opens (default: both). Other chips stay plain text. */
  openableKinds?: ReadonlyArray<"task" | "issue">
}

const FROM_TASK_THREAD = "From this task's conversation"

/** What a message says: its text, or a voice note's transcript. */
const messageText = (message: Message) => (message.body ?? message.voice?.transcript ?? "").trim()

const MAX_LENGTH = 2000
const CALLS_SOON = "Calls are coming in the calls update"

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Wraps each match of `query` in a highlight. */
function highlight(text: string, query: string): ReactNode {
  if (!query) return text
  return text
    .split(new RegExp(`(${escapeRegExp(query)})`, "gi"))
    .map((part, index) => (index % 2 ? <mark key={index} className="thread-highlight">{part}</mark> : part))
}

/**
 * One conversation: messages oldest → newest and a composer. For a context
 * (task, issue, …) that has no thread yet, it shows an empty state and the
 * first message creates the thread. Opening it marks the thread read.
 */
export default function ThreadPanel(props: PanelProps) {
  const { state, postMessage, markThreadRead, markThreadUnread } = useConstructionData()
  const { session } = useSession()
  const run = useCommand()
  const [body, setBody] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const dictation = useDictation(body, setBody)
  const scoped = useScopedData()
  const can = useAccess()
  const [taskDraft, setTaskDraft] = useState<VoiceDraft<TaskDraftValues>>()
  const [issueDraft, setIssueDraft] = useState<VoiceDraft<IssueDraftValues>>()
  const [source, setSource] = useState<MessageSource>()
  // Who said the message a draft was made from; unset when it was the reader.
  const [draftAuthor, setDraftAuthor] = useState<string>()
  const scrollRef = useRef<HTMLDivElement>(null)

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
  // The task this conversation is about, if any (pre-fills location, work and the issue's task).
  const threadTask =
    probe?.subject === "task" ? state.tasks.find((t) => t.id === probe.targetId) : undefined
  // Called unconditionally (hooks rule); an empty project only happens when there is no thread to act on.
  const voiceContext = useVoiceContext(probe?.projectId ?? "", threadTask?.id)
  const messages = useMemo(() => (thread ? getThreadMessages(state, thread.id) : []), [state, thread])
  const needle = searchOpen ? query.trim() : ""
  const matches = needle
    ? messages.filter((m) =>
        [m.body, m.voice?.transcript].some((text) => text?.toLowerCase().includes(needle.toLowerCase())),
      )
    : []

  // Mark read when the conversation opens (not on every change, so "Mark as unread" sticks).
  useEffect(() => {
    if (thread && me && unreadCount(state, thread, me.id) > 0) run(() => markThreadRead(thread.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, me?.id])

  // Keep the newest message in view; while searching, jump to the first match.
  useEffect(() => {
    const box = scrollRef.current
    if (!box) return
    if (needle) box.querySelector(".thread-highlight")?.scrollIntoView({ block: "center" })
    else box.scrollTop = box.scrollHeight
  }, [messages.length, needle])

  if (!probe || !me) return <Text type="secondary">You can't see this conversation.</Text>

  const send = () => {
    if (!body.trim()) return
    const target: PanelTarget = thread
      ? { threadId: thread.id }
      : { projectId: probe.projectId, subject: probe.subject as Exclude<ThreadSubject, "direct">, targetId: probe.targetId }
    const outcome = run(() => postMessage({ ...target, body }))
    if (outcome.ok) {
      setBody("")
      dictation.clearStatus()
    }
  }

  const group = probe.subject !== "direct"
  // Homeowners don't see internal tasks and issues anywhere else, so no chips for them either.
  const links =
    thread && me.role !== "homeowner"
      ? messageLinks(thread.id, scoped.tasks, scoped.issues)
      : new Map<EntityId, MessageLink[]>()
  // Project-wide checks, as in the brief and controller ruling: a worker who may only report on
  // their own task keeps using Report issue there, and sees no per-message actions here.
  const canTask = !!thread && can([Permissions.TASK_MANAGE], probe.projectId)
  const canIssue = !!thread && can(ISSUE_REPORT_PERMISSIONS, probe.projectId)

  // Turn a message into a draft; nothing is created until the form is submitted.
  const turnInto = (kind: "task" | "issue", message: Message) => {
    if (!thread) return
    const text = messageText(message)
    setSource({ threadId: thread.id, messageId: message.id })
    setDraftAuthor(
      message.authorMembershipId === me.id
        ? undefined
        : getMembershipName(state, message.authorMembershipId) ?? "Someone",
    )
    if (kind === "issue") {
      setIssueDraft(voiceExtractor.issue(text, voiceContext))
      return
    }
    const draft = voiceExtractor.task(text, voiceContext)
    if (threadTask) {
      const values = { ...draft.values }
      const fields = { ...draft.fields }
      const guessed = { state: "guessed" as const, reason: FROM_TASK_THREAD }
      if (!values.projectUnitId) {
        values.projectUnitId = threadTask.projectUnitId
        fields.projectUnitId = guessed
      }
      if (!values.workTypeId) {
        values.workTypeId = threadTask.workTypeId
        fields.workTypeId = guessed
      }
      setTaskDraft({ ...draft, values, fields })
    } else setTaskDraft(draft)
  }
  const messageActions: MenuProps["items"] = [
    ...(canTask ? [{ key: "task", label: "Turn into task" }] : []),
    ...(canIssue ? [{ key: "issue", label: "Turn into issue" }] : []),
  ]
  const menuItems: MenuProps["items"] = [
    {
      key: "unread",
      icon: <EyeInvisibleOutlined />,
      label: "Mark as unread",
      disabled: !messages.some((m) => m.authorMembershipId !== me.id),
    },
    ...(props.onOpenTarget && (probe.subject === "task" || probe.subject === "issue")
      ? [{ key: "open", icon: <ExportOutlined />, label: probe.subject === "task" ? "Open task" : "Open issue" }]
      : []),
  ]
  const onMenu: MenuProps["onClick"] = ({ key }) => {
    if (key === "unread" && thread) run(() => markThreadUnread(thread.id), { success: "Marked as unread" })
    if (key === "open") props.onOpenTarget?.()
  }

  return (
    <Flex
      vertical
      className={["thread-panel", props.compact && "is-compact", props.fill && "is-fill", props.header && "has-header"]
        .filter(Boolean)
        .join(" ")}
    >
      {props.header && (
        <Flex align="center" justify="space-between" gap="middle" className="thread-header">
          <Flex align="center" gap={12} className="min-w-0">
            <ThreadAvatar state={state} thread={probe} readerId={me.id} size={44} />
            <Flex vertical className="min-w-0">
              <Text strong ellipsis className="text-[16px]!">{threadTitle(state, probe, me.id)}</Text>
              <Text type="secondary" ellipsis className="text-[13px]!">{threadSubtitle(state, probe, me.id)}</Text>
            </Flex>
          </Flex>
          <Flex align="center" gap={4} className="shrink-0">
            {props.headerExtra && <span className="thread-header-extra">{props.headerExtra}</span>}
            <Tooltip title="Search in this conversation">
              <Button
                type={searchOpen ? "primary" : "text"}
                ghost={searchOpen}
                shape="circle"
                icon={<SearchOutlined />}
                aria-label="Search in this conversation"
                aria-pressed={searchOpen}
                onClick={() => {
                  setSearchOpen(!searchOpen)
                  setQuery("")
                }}
              />
            </Tooltip>
            {!group && (
              <>
                <Tooltip title={CALLS_SOON}>
                  <span>
                    <Button type="text" shape="circle" icon={<PhoneOutlined />} aria-label="Voice call (coming soon)" disabled />
                  </span>
                </Tooltip>
                <Tooltip title={CALLS_SOON}>
                  <span>
                    <Button type="text" shape="circle" icon={<VideoCameraOutlined />} aria-label="Video call (coming soon)" disabled />
                  </span>
                </Tooltip>
              </>
            )}
            <Dropdown menu={{ items: menuItems, onClick: onMenu }} trigger={["click"]} placement="bottomRight">
              <Button type="text" shape="circle" icon={<MoreOutlined />} aria-label="More actions" />
            </Dropdown>
          </Flex>
        </Flex>
      )}

      {searchOpen && (
        <Flex vertical gap={4} className="thread-search">
          <Input
            autoFocus
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search in this conversation"
            aria-label="Search in this conversation"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setSearchOpen(false)}
          />
          {needle && (
            <Text type="secondary" className="text-[12px]!" aria-live="polite">
              {matches.length ? `${matches.length} ${matches.length === 1 ? "message matches" : "messages match"}` : "No messages match"}
            </Text>
          )}
        </Flex>
      )}

      <div ref={scrollRef} className="thread-messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={props.emptyText ?? "No messages yet. Start the conversation."} />
        ) : (
          messages.map((message, index) => {
            const author = state.memberships.find((m) => m.id === message.authorMembershipId)
            const mine = message.authorMembershipId === me.id
            const previous = messages[index - 1]
            const newDay = !previous || !sameDay(previous.createdAt, message.createdAt)
            const dimmed = needle && !matches.includes(message)
            return (
              <Fragment key={message.id}>
                {newDay && (
                  <div className="thread-day" role="separator">
                    <span>{dayLabel(message.createdAt)}</span>
                  </div>
                )}
                <Flex vertical className={`thread-row${mine ? " is-mine" : ""}${dimmed ? " is-dimmed" : ""}`}>
                  {!mine && group && (
                    <Text type="secondary" className="thread-author">
                      <Text strong className="text-[12px]!">{getMembershipName(state, message.authorMembershipId) ?? "Someone"}</Text>
                      {author && ` · ${roleLabel(author.role)}`}
                    </Text>
                  )}
                  <div className="thread-bubble">
                    {message.voice && (
                      <Flex vertical gap={4}>
                        <audio src={message.voice.url} controls preload="none" className="thread-audio" />
                        {message.voice.transcript && (
                          <Text italic className="thread-transcript">“{highlight(message.voice.transcript, needle)}”</Text>
                        )}
                      </Flex>
                    )}
                    {message.body && <span className="thread-body">{highlight(message.body, needle)}</span>}
                  </div>
                  {links.get(message.id)?.map((link) => {
                    const openable = !props.openableKinds || props.openableKinds.includes(link.kind)
                    const open =
                      props.onOpenRecord && openable ? () => props.onOpenRecord!(link.kind, link.id) : undefined
                    return (
                      <Tag
                        key={`${link.kind}-${link.id}`}
                        color={link.kind === "task" ? "blue" : "orange"}
                        className={`thread-link-chip${open ? " is-link" : ""}`}
                        {...(open && {
                          role: "button",
                          tabIndex: 0,
                          onClick: open,
                          onKeyDown: (event: KeyboardEvent) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              open()
                            }
                          },
                        })}
                      >
                        → {link.kind === "task" ? "Task" : "Issue"}: {link.title}
                      </Tag>
                    )
                  })}
                  <Flex align="center" gap={2}>
                    <Text type="secondary" className="thread-time">{clockTime(message.createdAt)}</Text>
                    {messageActions.length > 0 && messageText(message) && (
                      <Dropdown
                        menu={{ items: messageActions, onClick: ({ key }) => turnInto(key as "task" | "issue", message) }}
                        trigger={["click"]}
                        placement={mine ? "bottomRight" : "bottomLeft"}
                      >
                        <Button
                          type="text"
                          size="small"
                          icon={<MoreOutlined />}
                          aria-label="Message actions"
                          className="thread-message-action"
                        />
                      </Dropdown>
                    )}
                  </Flex>
                </Flex>
              </Fragment>
            )
          })
        )}
      </div>

      <div className="thread-composer">
        <Input.TextArea
          variant="borderless"
          autoSize={{ minRows: 1, maxRows: 6 }}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends on a keyboard; Shift+Enter adds a line. Phones keep Enter as a new line.
            const keyboard = window.matchMedia?.("(pointer: fine)").matches
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && keyboard) {
              event.preventDefault()
              send()
            }
          }}
          placeholder="Write a message"
          aria-label="Message"
          maxLength={MAX_LENGTH}
        />
        <Flex align="center" justify="space-between" gap="small">
          <Text type="secondary" className="text-[12px]!">
            {dictation.status ?? `${body.length} / ${MAX_LENGTH}`}
          </Text>
          <Flex align="center" gap={8} className="shrink-0">
            <Tooltip
              title={
                !dictation.supported
                  ? "Voice input needs Chrome or Edge"
                  : dictation.listening
                    ? "Stop"
                    : "Speak your message"
              }
            >
              <Button
                type={dictation.listening ? "primary" : "text"}
                danger={dictation.listening}
                shape="circle"
                icon={dictation.listening ? <AudioMutedOutlined /> : <AudioOutlined />}
                aria-label={dictation.listening ? "Stop voice input" : "Speak your message"}
                disabled={!dictation.supported}
                onClick={dictation.toggle}
                className={dictation.listening ? undefined : "text-(--ant-color-primary)!"}
              />
            </Tooltip>
            <Button
              type="primary"
              shape="circle"
              icon={<ArrowUpOutlined />}
              aria-label="Send"
              disabled={!body.trim()}
              onClick={send}
            />
          </Flex>
        </Flex>
      </div>

      {canTask && (
        <CreateTaskModal
          open={!!taskDraft}
          onClose={() => setTaskDraft(undefined)}
          projectId={probe.projectId}
          draft={taskDraft}
          draftLabel={draftAuthor ? `${draftAuthor} said` : undefined}
          source={source}
        />
      )}
      {canIssue && (
        <ReportIssueModal
          open={!!issueDraft}
          onClose={() => setIssueDraft(undefined)}
          projectId={probe.projectId}
          taskId={threadTask?.id}
          draft={issueDraft}
          draftLabel={draftAuthor ? `${draftAuthor} said` : undefined}
          source={source}
        />
      )}
    </Flex>
  )
}
