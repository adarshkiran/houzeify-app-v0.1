import { useEffect, useRef, useState } from "react"
import { AudioOutlined, BorderOutlined } from "@ant-design/icons"
import { App, Button } from "antd"

function pickAudioMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ]
  for (const type of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type
    }
  }
  return ""
}

const formatElapsed = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

/**
 * Records a voice note from the microphone. Hands back a local object URL;
 * there is no upload/transcription service yet, so the note stays a browser
 * recording attached to the update.
 */
export default function VoiceNoteRecorder({
  onRecorded,
  maxSeconds = 120,
}: {
  onRecorded: (url: string) => void
  maxSeconds?: number
}) {
  const { message } = App.useApp()
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const onRecordedRef = useRef(onRecorded)
  onRecordedRef.current = onRecorded
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const releaseMic = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    }
  }

  // Tick while recording; stop at the limit.
  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])
  useEffect(() => {
    if (recording && elapsed >= maxSeconds) stop()
  }, [recording, elapsed, maxSeconds])

  // Leaving the screen mid-recording must release the microphone.
  useEffect(
    () => () => {
      if (recorderRef.current) recorderRef.current.onstop = null
      stop()
      releaseMic()
    },
    [],
  )

  const start = async () => {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      message.warning(
        "Voice notes need a browser with microphone recording (Chrome, Edge or Safari).",
      )
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickAudioMimeType()
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      )
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        setRecording(false)
        releaseMic()
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        })
        chunksRef.current = []
        if (blob.size > 0) onRecordedRef.current(URL.createObjectURL(blob))
      }
      recorderRef.current = recorder
      recorder.start()
      setElapsed(0)
      setRecording(true)
    } catch {
      releaseMic()
      message.warning(
        "Microphone access was blocked. Allow the mic and try again.",
      )
    }
  }

  return recording ? (
    <Button danger type="primary" icon={<BorderOutlined />} onClick={stop}>
      Stop · {formatElapsed(elapsed)}
    </Button>
  ) : (
    <Button icon={<AudioOutlined />} onClick={start}>
      Voice note
    </Button>
  )
}
