import type { ReactNode } from "react"
import { Flex, Tag, Tooltip, Typography } from "antd"
import type { FieldState } from "../../domain/voice/types"

const { Text } = Typography

/** 🎤 Heard / ✨ Guessed / ⚠ Needs you — how a voice draft filled a field. */
export default function VoiceFieldMark({ field }: { field?: FieldState }) {
  if (!field) return null
  if (field.state === "heard") return <Tag variant="outlined" color="blue" className="m-0! text-[11px]!">🎤 Heard</Tag>
  if (field.state === "guessed")
    return (
      <Tooltip title={field.reason}>
        <Tag variant="outlined" color="gold" className="m-0! text-[11px]!">✨ Guessed</Tag>
      </Tooltip>
    )
  const tip =
    field.state === "choose"
      ? `Choose: ${field.options.map((o) => o.label).join(" or ")}`
      : field.note ?? "Not heard — please fill this in"
  return (
    <Tooltip title={tip}>
      <Tag variant="outlined" color="red" className="m-0! text-[11px]!">⚠ Needs you</Tag>
    </Tooltip>
  )
}

/** A form label with its voice marker. */
export function voiceLabel(label: ReactNode, field?: FieldState): ReactNode {
  return (
    <Flex align="center" gap={6}>
      {label}
      <VoiceFieldMark field={field} />
    </Flex>
  )
}

/** "You said: …" above a pre-filled form (`label` names someone else, e.g. "Ravi said"). */
export function VoiceDraftBanner({ transcript, label = "You said" }: { transcript: string; label?: string }) {
  return (
    <div className="voice-draft-banner">
      <Text type="secondary" className="text-[12px]!">{label}</Text>
      <Text italic>"{transcript}"</Text>
    </div>
  )
}
