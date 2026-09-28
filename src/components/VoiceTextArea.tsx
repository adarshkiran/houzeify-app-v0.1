import { AudioMutedOutlined, AudioOutlined } from "@ant-design/icons"
import { Button, Flex, Input, Tooltip, Typography, theme } from "antd"
import type { TextAreaProps } from "antd/es/input"
import { useDictation } from "./useDictation"

const { Text } = Typography

export default function VoiceTextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  ...rest
}: TextAreaProps) {
  const { token } = theme.useToken()
  const text = typeof value === "string" ? value : ""
  const dictation = useDictation(text, (next) =>
    onChange?.({
      target: { value: next },
    } as Parameters<NonNullable<TextAreaProps["onChange"]>>[0]),
  )

  return (
    <Flex vertical gap={6}>
      <div className="relative">
        <Input.TextArea
          {...rest}
          value={value}
          onChange={onChange}
          rows={rows}
          placeholder={placeholder}
          style={{ paddingInlineEnd: 44, ...(rest.style ?? {}) }}
        />
        <Tooltip
          title={
            !dictation.supported
              ? "Voice input needs Chrome or Edge"
              : dictation.listening
                ? "Stop recording"
                : "Record voice to text"
          }
        >
          <Button
            type={dictation.listening ? "primary" : "text"}
            danger={dictation.listening}
            shape="circle"
            aria-label={dictation.listening ? "Stop voice recording" : "Start voice recording"}
            icon={dictation.listening ? <AudioMutedOutlined /> : <AudioOutlined />}
            disabled={!dictation.supported}
            onClick={dictation.toggle}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              color: dictation.listening ? undefined : token.colorPrimary,
            }}
          />
        </Tooltip>
      </div>
      {dictation.status && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dictation.status}
        </Text>
      )}
    </Flex>
  )
}
