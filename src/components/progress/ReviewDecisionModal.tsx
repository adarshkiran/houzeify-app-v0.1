import { useEffect, useState } from "react"
import { Input, Modal, Typography } from "antd"
import type { ReviewDecision } from "../../domain/models"

const { Text } = Typography

const COPY: Record<ReviewDecision, { title: string; ok: string; hint: string; required: boolean }> = {
  approve: { title: "Approve update", ok: "Approve", hint: "Optional note for the submitter.", required: false },
  "request-changes": { title: "Request changes", ok: "Send back", hint: "Tell the submitter what to fix. They will see this note.", required: true },
  reject: { title: "Reject update", ok: "Reject", hint: "Say why this update doesn't belong in the record. It stays private.", required: true },
}

export default function ReviewDecisionModal({
  decision,
  onCancel,
  onConfirm,
}: {
  decision: ReviewDecision | null
  onCancel: () => void
  onConfirm: (note?: string) => void
}) {
  const [note, setNote] = useState("")
  useEffect(() => setNote(""), [decision])
  if (!decision) return null
  const copy = COPY[decision]
  const blocked = copy.required && !note.trim()
  return (
    <Modal
      open
      title={copy.title}
      okText={copy.ok}
      okButtonProps={{ disabled: blocked, danger: decision === "reject" }}
      onCancel={onCancel}
      onOk={() => onConfirm(note.trim() || undefined)}
    >
      <Text type="secondary">{copy.hint}</Text>
      <Input.TextArea
        rows={4}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className="mt-2!"
        aria-label="Review note"
      />
    </Modal>
  )
}
