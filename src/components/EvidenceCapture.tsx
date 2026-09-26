import { useRef, useState, type ReactNode } from "react"
import {
  CameraOutlined,
  DeleteOutlined,
  PictureOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons"
import { Button, Flex, Tag, Typography, Upload } from "antd"
import CameraCaptureModal, {
  type CameraCaptureMode,
} from "./CameraCaptureModal"
import type { EvidenceType } from "../domain/models"

const { Text } = Typography

/** Evidence captured in the browser, not yet submitted. */
export interface DraftEvidence {
  type: EvidenceType
  url: string
  caption: string
}

function isTouchDevice() {
  return (
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0)
  )
}

const timeLabel = () => new Date().toLocaleTimeString("en-IN")

/**
 * Photo / video / gallery capture with thumbnails. On touch devices the
 * native camera opens; on desktop the in-browser camera modal does. Extra
 * capture buttons (e.g. a voice note recorder) go in `extraActions`.
 */
export default function EvidenceCapture({
  value,
  onChange,
  extraActions,
}: {
  value: DraftEvidence[]
  onChange: (next: DraftEvidence[]) => void
  extraActions?: ReactNode
}) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraMode, setCameraMode] = useState<CameraCaptureMode>("photo")
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  // Handlers may fire back to back (camera modal, file inputs); always append
  // to the latest list rather than the one from the last render.
  const latest = useRef(value)
  latest.current = value
  const append = (item: DraftEvidence) => {
    latest.current = [...latest.current, item]
    onChange(latest.current)
  }

  const addEvidenceFile = (file: File) => {
    const type: EvidenceType = file.type.startsWith("video/")
      ? "video"
      : "photo"
    append({
      type,
      url: URL.createObjectURL(file),
      caption: type === "video" ? `Video ${timeLabel()}` : file.name,
    })
  }

  const openCapture = (mode: CameraCaptureMode) => {
    setCameraMode(mode)
    if (isTouchDevice()) {
      if (mode === "video") videoInputRef.current?.click()
      else cameraInputRef.current?.click()
      return
    }
    setCameraOpen(true)
  }

  const removeEvidence = (url: string) => {
    onChange(latest.current.filter((item) => item.url !== url))
    URL.revokeObjectURL(url)
  }

  const fileInput = (accept: string, ref: typeof cameraInputRef) => (
    <input
      ref={ref}
      type="file"
      accept={accept}
      capture="environment"
      aria-hidden
      tabIndex={-1}
      style={{ display: "none" }}
      onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) addEvidenceFile(file)
        event.target.value = ""
      }}
    />
  )

  return (
    <>
      {fileInput("image/*", cameraInputRef)}
      {fileInput("video/*", videoInputRef)}

      <Flex vertical gap="middle">
        <Flex gap="small" wrap>
          <Button
            type="primary"
            icon={<CameraOutlined />}
            onClick={() => openCapture("photo")}
          >
            Photo
          </Button>
          <Button
            icon={<VideoCameraOutlined />}
            onClick={() => openCapture("video")}
          >
            Record video
          </Button>
          <Upload
            accept="image/*,video/*"
            showUploadList={false}
            beforeUpload={(file) => {
              addEvidenceFile(file)
              return false
            }}
          >
            <Button icon={<PictureOutlined />}>Gallery</Button>
          </Upload>
          {extraActions}
        </Flex>

        {value.length ? (
          <Flex gap="small" wrap>
            {value.map((item) => (
              <div key={item.url} className="relative shrink-0">
                {item.type === "audio" ? (
                  <Flex
                    vertical
                    justify="center"
                    gap={4}
                    className="h-24 w-56 px-2 bg-[#F3EAFF]"
                    style={{ borderRadius: "var(--ant-border-radius-lg)" }}
                  >
                    <audio src={item.url} controls className="w-full" />
                  </Flex>
                ) : item.type === "video" ? (
                  <video
                    src={item.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-24 w-36 object-cover bg-[#1C1917]"
                    style={{ borderRadius: "var(--ant-border-radius-lg)" }}
                  />
                ) : (
                  <img
                    src={item.url}
                    alt={item.caption}
                    className="h-24 w-36 object-cover"
                    style={{ borderRadius: "var(--ant-border-radius-lg)" }}
                  />
                )}
                <Tag className="absolute! left-1 bottom-1 m-0!">
                  {item.type === "audio" ? "voice" : item.type}
                </Tag>
                <Button
                  size="small"
                  danger
                  type="primary"
                  icon={<DeleteOutlined />}
                  aria-label={`Remove ${item.caption}`}
                  className="absolute! top-1 right-1"
                  onClick={() => removeEvidence(item.url)}
                />
              </div>
            ))}
          </Flex>
        ) : (
          <Text type="secondary" className="m-0! text-[13px]!">
            No files yet — use Photo, Record video, or Gallery above.
          </Text>
        )}
      </Flex>

      <CameraCaptureModal
        open={cameraOpen}
        mode={cameraMode}
        onClose={() => setCameraOpen(false)}
        onCapture={(_file, previewUrl, kind) => {
          append({
            type: kind,
            url: previewUrl,
            caption: `${kind === "video" ? "Video" : "Photo"} ${timeLabel()}`,
          })
        }}
      />
    </>
  )
}
