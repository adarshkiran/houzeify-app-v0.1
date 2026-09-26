import { useEffect, useRef, useState } from "react"
import { CameraOutlined, VideoCameraOutlined } from "@ant-design/icons"
import { Alert, Button, Flex, Modal, Space, Typography } from "antd"

const { Text } = Typography

export type CameraCaptureMode = "photo" | "video"

function pickRecorderMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
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

function extensionForMime(mime: string) {
  if (mime.includes("mp4")) return "mp4"
  return "webm"
}

export default function CameraCaptureModal({
  open,
  mode = "photo",
  onClose,
  onCapture,
}: {
  open: boolean
  mode?: CameraCaptureMode
  onClose: () => void
  onCapture: (file: File, previewUrl: string, kind: CameraCaptureMode) => void
}) {
  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [error, setError] = useState<string>()
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [previewKind, setPreviewKind] = useState<CameraCaptureMode>("photo")
  const [starting, setStarting] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)

  const stopCamera = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    }
    recorderRef.current = null
    chunksRef.current = []
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null
    setRecording(false)
  }

  const startCamera = async () => {
    setError(undefined)
    setStarting(true)
    try {
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: mode === "video",
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream
        await liveVideoRef.current.play()
      }
    } catch {
      setError(
        mode === "video"
          ? "Camera or microphone access was blocked. Allow permission, or use Add from gallery for a video file."
          : "Camera access was blocked or unavailable. Allow camera permission, or use Add from gallery instead.",
      )
    } finally {
      setStarting(false)
    }
  }

  useEffect(() => {
    if (!open) {
      stopCamera()
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return undefined
      })
      setError(undefined)
      setElapsedSec(0)
      return
    }
    void startCamera()
    return () => stopCamera()
  }, [open, mode])

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => {
      setElapsedSec((value) => value + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [recording])

  const handleCapturePhoto = () => {
    const video = liveVideoRef.current
    if (!video || !video.videoWidth) return

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext("2d")
    if (!context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        setPreviewKind("photo")
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current)
          return url
        })
        stopCamera()
      },
      "image/jpeg",
      0.92,
    )
  }

  const handleStartRecording = () => {
    const stream = streamRef.current
    if (!stream) return
    if (typeof MediaRecorder === "undefined") {
      setError("Video recording is not supported in this browser. Use Add from gallery instead.")
      return
    }

    const mimeType = pickRecorderMimeType()
    try {
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      chunksRef.current = []
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blobType = recorder.mimeType || mimeType || "video/webm"
        const blob = new Blob(chunksRef.current, { type: blobType })
        chunksRef.current = []
        if (!blob.size) {
          setError("Recording failed. Try again or add a video from gallery.")
          setRecording(false)
          return
        }
        const url = URL.createObjectURL(blob)
        setPreviewKind("video")
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current)
          return url
        })
        stopCamera()
      }
      recorder.start(250)
      setElapsedSec(0)
      setRecording(true)
    } catch {
      setError("Could not start video recording. Try another browser or use Add from gallery.")
    }
  }

  const handleStopRecording = () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") return
    recorder.stop()
    setRecording(false)
  }

  const handleUseCapture = () => {
    if (!previewUrl) return
    void fetch(previewUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-")
        const kind = previewKind
        const file =
          kind === "video"
            ? new File(
                [blob],
                `site-evidence-${stamp}.${extensionForMime(blob.type)}`,
                { type: blob.type || "video/webm" },
              )
            : new File([blob], `site-evidence-${stamp}.jpg`, {
                type: "image/jpeg",
              })
        onCapture(file, previewUrl, kind)
        setPreviewUrl(undefined)
        onClose()
      })
  }

  const handleRetake = () => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return undefined
    })
    setElapsedSec(0)
    void startCamera()
  }

  const title = mode === "video" ? "Record site video" : "Capture site photo"
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0")
  const ss = String(elapsedSec % 60).padStart(2, "0")

  return (
    <Modal
      title={title}
      open={open}
      onCancel={() => {
        if (recording) handleStopRecording()
        onClose()
      }}
      footer={null}
      destroyOnHidden
      width={720}
    >
      <Flex vertical gap="middle">
        {error ? (
          <Alert type="warning" showIcon message={error} />
        ) : (
          <div
            className="relative overflow-hidden bg-[#1C1917]"
            style={{
              aspectRatio: "16 / 10",
              borderRadius: "var(--ant-border-radius-lg)",
            }}
          >
            {previewUrl ? (
              previewKind === "video" ? (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Captured evidence"
                  className="h-full w-full object-contain"
                />
              )
            ) : (
              <video
                ref={liveVideoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            )}
            {recording ? (
              <Flex
                align="center"
                gap={8}
                className="absolute top-3 left-3 rounded-full bg-[#B42318] px-3 py-1 text-white"
              >
                <span className="inline-block size-2 rounded-full bg-white" />
                <Text className="text-white! text-[12px]! m-0!">
                  REC {mm}:{ss}
                </Text>
              </Flex>
            ) : null}
          </div>
        )}

        <Flex justify="space-between" gap="small" wrap>
          <Text type="secondary">
            {previewUrl
              ? mode === "video"
                ? "Use this clip, or record again if needed."
                : "Use this photo, or retake if the shot is unclear."
              : mode === "video"
                ? "Record a short clip of the work on site, then stop and send for review."
                : "Point the camera at the work on site, then capture."}
          </Text>
          <Space wrap>
            <Button
              onClick={() => {
                if (recording) handleStopRecording()
                onClose()
              }}
            >
              Cancel
            </Button>
            {previewUrl ? (
              <>
                <Button onClick={handleRetake}>
                  {previewKind === "video" ? "Record again" : "Retake"}
                </Button>
                <Button
                  type="primary"
                  icon={
                    previewKind === "video" ? (
                      <VideoCameraOutlined />
                    ) : (
                      <CameraOutlined />
                    )
                  }
                  onClick={handleUseCapture}
                >
                  {previewKind === "video" ? "Use video" : "Use photo"}
                </Button>
              </>
            ) : mode === "video" ? (
              recording ? (
                <Button type="primary" danger onClick={handleStopRecording}>
                  Stop recording
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<VideoCameraOutlined />}
                  loading={starting}
                  disabled={Boolean(error)}
                  onClick={handleStartRecording}
                >
                  Start recording
                </Button>
              )
            ) : (
              <Button
                type="primary"
                icon={<CameraOutlined />}
                loading={starting}
                disabled={Boolean(error)}
                onClick={handleCapturePhoto}
              >
                Capture
              </Button>
            )}
          </Space>
        </Flex>
      </Flex>
    </Modal>
  )
}
