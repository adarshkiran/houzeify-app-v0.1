import { useEffect } from "react"
import { Button, Flex, Form, Input, InputNumber, Modal, Segmented } from "antd"
import type { CallLog, EntityId } from "../../domain/models"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { useCommand } from "../../session/useCommand"

interface CallFormValues {
  type: "voice" | "video"
  /** `<input type="date">` value, e.g. "2026-09-29". */
  callDate: string
  /** `<input type="time">` value, e.g. "14:30". */
  callTime: string
  durationMinutes: number
  note?: string
}

/** Today as "YYYY-MM-DD" and now as "HH:mm", for the form's defaults. */
function nowParts() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  }
}

/**
 * Logs that a call happened on a direct thread — no dialling, no number, no
 * audio. Opens pre-set to whichever of 📞/🎥 was tapped.
 */
export default function LogCallModal({
  open,
  onClose,
  threadId,
  initialType,
  onLogged,
}: {
  open: boolean
  onClose: () => void
  threadId: EntityId
  initialType: "voice" | "video"
  onLogged?: (call: CallLog) => void
}) {
  const { logCall } = useConstructionData()
  const run = useCommand()
  const [form] = Form.useForm<CallFormValues>()

  useEffect(() => {
    if (!open) return
    // The Form store instance persists across opens (ThreadPanel keeps this
    // component mounted and only toggles `open`), so re-seed every field
    // explicitly here rather than relying on `initialValues`, which only
    // applies on the form's true first mount.
    const { date: seedDate, time: seedTime } = nowParts()
    form.setFieldsValue({
      type: initialType,
      callDate: seedDate,
      callTime: seedTime,
      durationMinutes: undefined,
      note: undefined,
    })
  }, [open, initialType, form])

  const handleFinish = (values: CallFormValues) => {
    // Build the ISO timestamp from the two plain inputs (local time).
    const startedAt = new Date(`${values.callDate}T${values.callTime}:00`).toISOString()
    const outcome = run(
      () =>
        logCall({
          threadId,
          type: values.type,
          startedAt,
          durationMinutes: values.durationMinutes,
          note: values.note,
        }),
      { success: "Call logged" },
    )
    if (!outcome.ok) return
    onClose()
    onLogged?.(outcome.value)
  }

  const { date } = nowParts()

  return (
    <Modal title="Log a call" open={open} onCancel={onClose} footer={null} destroyOnHidden>
      <Form<CallFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={handleFinish}
      >
        <Form.Item label="Type" name="type" rules={[{ required: true }]}>
          <Segmented
            options={[
              { label: "Voice", value: "voice" },
              { label: "Video", value: "video" },
            ]}
          />
        </Form.Item>
        <Flex gap={16}>
          <Form.Item label="Date" name="callDate" rules={[{ required: true, message: "Say when the call happened" }]} className="flex-1">
            <Input type="date" max={date} />
          </Form.Item>
          <Form.Item label="Time" name="callTime" rules={[{ required: true, message: "Say when the call happened" }]} className="flex-1">
            <Input type="time" />
          </Form.Item>
        </Flex>
        <Form.Item
          label="Duration (minutes)"
          name="durationMinutes"
          rules={[{ required: true, message: "Enter how long the call lasted." }]}
        >
          <InputNumber min={0} precision={0} className="w-full!" />
        </Form.Item>
        <Form.Item label="Note (optional)" name="note">
          <Input.TextArea rows={2} placeholder="e.g. Discussed Friday's pour timing" />
        </Form.Item>
        <Flex justify="flex-end" gap="small">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit">Log call</Button>
        </Flex>
      </Form>
    </Modal>
  )
}
