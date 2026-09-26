import { useEffect, useRef, useState } from "react"
import { AudioMutedOutlined, AudioOutlined } from "@ant-design/icons"
import { Button, Flex, Input, Tooltip, Typography, theme } from "antd"
import type { TextAreaProps } from "antd/es/input"

const { Text } = Typography

type SpeechRecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

export default function VoiceTextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  ...rest
}: TextAreaProps) {
  const { token } = theme.useToken()
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => Boolean(getSpeechRecognition()))
  const [status, setStatus] = useState<string>()
  const baseValueRef = useRef(typeof value === "string" ? value : "")

  useEffect(() => {
    if (!listening) {
      baseValueRef.current = typeof value === "string" ? value : ""
    }
  }, [value, listening])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const emitChange = (next: string) => {
    onChange?.({
      target: { value: next },
    } as Parameters<NonNullable<TextAreaProps["onChange"]>>[0])
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const startListening = () => {
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      setStatus("Voice input is not supported in this browser. Try Chrome or Edge.")
      return
    }

    recognitionRef.current?.abort()
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-IN"
    baseValueRef.current = typeof value === "string" ? value : ""
    setStatus("Listening… speak clearly about the site work.")
    setListening(true)

    recognition.onresult = (event) => {
      let finalChunk = ""
      let interimChunk = ""
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) finalChunk += result[0].transcript
        else interimChunk += result[0].transcript
      }

      if (finalChunk) {
        const joined = [baseValueRef.current.trim(), finalChunk.trim()]
          .filter(Boolean)
          .join(" ")
        baseValueRef.current = joined
        emitChange(joined)
        setStatus("Captured. Keep speaking, or tap the mic to stop.")
        return
      }

      if (interimChunk) {
        const preview = [baseValueRef.current.trim(), interimChunk.trim()]
          .filter(Boolean)
          .join(" ")
        emitChange(preview)
      }
    }

    recognition.onerror = (event) => {
      setListening(false)
      if (event.error === "not-allowed") {
        setStatus("Microphone permission was blocked. Allow mic access and try again.")
        return
      }
      if (event.error === "no-speech") {
        setStatus("No speech heard. Tap the mic and try again.")
        return
      }
      setStatus("Could not capture speech. You can still type the update.")
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    try {
      recognition.start()
    } catch {
      setListening(false)
      setStatus("Could not start the microphone. You can still type the update.")
    }
  }

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
            !supported
              ? "Voice input needs Chrome or Edge"
              : listening
                ? "Stop recording"
                : "Record voice to text"
          }
        >
          <Button
            type={listening ? "primary" : "text"}
            danger={listening}
            shape="circle"
            aria-label={listening ? "Stop voice recording" : "Start voice recording"}
            icon={listening ? <AudioMutedOutlined /> : <AudioOutlined />}
            disabled={!supported}
            onClick={() => (listening ? stopListening() : startListening())}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              color: listening ? undefined : token.colorPrimary,
            }}
          />
        </Tooltip>
      </div>
      {status && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {status}
        </Text>
      )}
    </Flex>
  )
}
