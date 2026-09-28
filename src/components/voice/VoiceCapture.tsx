import { useState } from "react"
import { AudioMutedOutlined, AudioOutlined } from "@ant-design/icons"
import { Alert, Button, Flex, Input, Modal, Typography } from "antd"
import { useDictation } from "../useDictation"

const { Text } = Typography

/**
 * Speak (or type) an instruction, check the words, then make a draft. Nothing
 * is saved here — the caller opens the normal form pre-filled from the draft.
 */
export default function VoiceCapture({
  open,
  title,
  placeholder,
  onCancel,
  onDraft,
}: {
  open: boolean
  title: string
  placeholder: string
  onCancel: () => void
  onDraft: (transcript: string) => void
}) {
  const [text, setText] = useState("")
  const dictation = useDictation(text, setText)
  const close = () => {
    setText("")
    onCancel()
  }
  return (
    <Modal open={open} title={title} onCancel={close} footer={null} destroyOnHidden>
      <Flex vertical gap="middle">
        {!dictation.supported && (
          <Alert type="info" showIcon message="Voice isn't available in this browser — type the instruction instead." />
        )}
        <Input.TextArea
          autoFocus
          autoSize={{ minRows: 3, maxRows: 8 }}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          aria-label="Instruction"
        />
        <Text type="secondary" className="text-[12px]!">
          {dictation.status ?? (text.trim() ? "Check the words, then make a draft." : "Say or type what needs doing.")}
        </Text>
        <Flex justify="space-between" gap="small">
          <Button
            icon={dictation.listening ? <AudioMutedOutlined /> : <AudioOutlined />}
            danger={dictation.listening}
            disabled={!dictation.supported}
            onClick={dictation.toggle}
          >
            {dictation.listening ? "Stop" : "Speak"}
          </Button>
          <Flex gap="small">
            <Button onClick={close}>Cancel</Button>
            <Button
              type="primary"
              disabled={!text.trim() || dictation.listening}
              onClick={() => {
                onDraft(text.trim())
                setText("")
              }}
            >
              Make draft
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </Modal>
  )
}
