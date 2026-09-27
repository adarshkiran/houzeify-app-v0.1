import { useEffect, useRef, useState } from "react"
import { AudioOutlined, BorderOutlined } from "@ant-design/icons"
import { App, Button } from "antd"
import { getSpeechRecognition, type SpeechRecognitionLike } from "./speechRecognition"

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
  onTranscript,
  maxSeconds = 120,
  label,
}: {
  onRecorded: (url: string, durationSec: number) => void
  onTranscript?: (text: string) => void
  maxSeconds?: number
  label?: string
}) {
  const { message } = App.useApp()
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const transcriptRef = useRef("")
  const interimRef = useRef("")
  // Set once the current recording has been handed back; the transcript is
  // only delivered after that, so it lands on the new draft.
  const deliveredRef = useRef(false)
  const onRecordedRef = useRef(onRecorded)
  onRecordedRef.current = onRecorded
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)
  useEffect(() => {
    elapsedRef.current = elapsed
  }, [elapsed])

  const releaseMic = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  // Finals when there are any, else the last interim phrase.
  const deliverTranscript = () => {
    if (!deliveredRef.current) return
    onTranscriptRef.current?.((transcriptRef.current || interimRef.current).trim())
  }

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    }
    // Recognition delivers its last final result after stop(), in a later
    // onresult / onend, so stop it now rather than when the recorder ends.
    recognitionRef.current?.stop()
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
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null
        recognitionRef.current.onend = null
      }
      stop()
      releaseMic()
      recognitionRef.current?.abort()
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
      deliveredRef.current = false
      transcriptRef.current = ""
      interimRef.current = ""
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        setRecording(false)
        releaseMic()
        recognitionRef.current?.stop()
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        })
        chunksRef.current = []
        if (blob.size > 0) {
          onRecordedRef.current(URL.createObjectURL(blob), Math.max(1, elapsedRef.current))
          deliveredRef.current = true
          deliverTranscript()
        }
      }
      recorderRef.current = recorder
      recorder.start()

      const Recognition = onTranscriptRef.current ? getSpeechRecognition() : null
      recognitionRef.current = null
      if (Recognition) {
        const recognition = new Recognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = "en-IN"
        recognition.onresult = (event) => {
          if (recognitionRef.current !== recognition) return
          let finalChunk = ""
          let interim = ""
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index]
            if (result.isFinal) finalChunk += result[0].transcript
            else interim += result[0].transcript
          }
          if (finalChunk) {
            transcriptRef.current = [transcriptRef.current.trim(), finalChunk.trim()]
              .filter(Boolean)
              .join(" ")
          }
          interimRef.current = interim.trim()
          // A result that arrives after the recording ended updates the draft.
          deliverTranscript()
        }
        recognition.onend = () => {
          if (recognitionRef.current === recognition) deliverTranscript()
        }
        recognitionRef.current = recognition
        try {
          recognition.start()
        } catch {
          // recognition unavailable: voice-only
        }
      }

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
      {label ?? "Voice note"}
    </Button>
  )
}
