import {
  CheckSquareOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  TeamOutlined,
  WarningOutlined,
} from "@ant-design/icons"
import { Avatar, theme } from "antd"
import type { ReactNode } from "react"
import type { ConstructionDataState, EntityId, Thread, ThreadSubject } from "../../domain/models"
import { roleLabel } from "../../mock/conversationSelectors"
import { getMembershipName } from "../../mock/selectors"

/** The other person in a direct thread. */
export function directPartner(state: ConstructionDataState, thread: Thread, readerId: EntityId) {
  const otherId = thread.participantMembershipIds?.find((id) => id !== readerId)
  return state.memberships.find((m) => m.id === otherId)
}

const SUBJECT_SUBTITLE: Record<Exclude<ThreadSubject, "direct">, string> = {
  project: "Everyone on the project",
  homeowner: "Homeowner and project team",
  task: "Task conversation",
  issue: "Issue conversation",
  unit: "Location conversation",
}

/** Grey line under a conversation's name: the person's role, or who the chat is for. */
export function threadSubtitle(state: ConstructionDataState, thread: Thread, readerId: EntityId): string {
  if (thread.subject !== "direct") return SUBJECT_SUBTITLE[thread.subject]
  const partner = directPartner(state, thread, readerId)
  return partner ? roleLabel(partner.role) : "Direct message"
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("")

/** Initials for a person, a soft coloured icon for a group conversation. */
export function ThreadAvatar({
  state,
  thread,
  readerId,
  size = 40,
}: {
  state: ConstructionDataState
  thread: Thread
  readerId: EntityId
  size?: number
}) {
  const { token } = theme.useToken()
  const tones: Record<ThreadSubject, { bg: string; fg: string; icon?: ReactNode }> = {
    project: { bg: token.colorPrimaryBg, fg: token.colorPrimary, icon: <TeamOutlined /> },
    homeowner: { bg: token.colorSuccessBg, fg: token.colorSuccess, icon: <HomeOutlined /> },
    task: { bg: token.colorInfoBg, fg: token.colorInfo, icon: <CheckSquareOutlined /> },
    issue: { bg: token.colorWarningBg, fg: token.colorWarning, icon: <WarningOutlined /> },
    unit: { bg: token.colorInfoBg, fg: token.colorInfo, icon: <EnvironmentOutlined /> },
    direct: { bg: token.colorPrimaryBg, fg: token.colorPrimary },
  }
  const tone = tones[thread.subject]
  const partner = thread.subject === "direct" ? directPartner(state, thread, readerId) : undefined
  const name = partner ? getMembershipName(state, partner.id) : undefined
  return (
    <Avatar
      size={size}
      icon={tone.icon}
      aria-hidden
      className="shrink-0"
      style={{ background: tone.bg, color: tone.fg, fontWeight: 600, fontSize: tone.icon ? size * 0.45 : size * 0.38 }}
    >
      {name ? initials(name) : undefined}
    </Avatar>
  )
}
