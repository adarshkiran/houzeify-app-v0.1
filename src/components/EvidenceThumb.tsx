import { useState } from "react"
import {
  AudioOutlined,
  CameraOutlined,
  FileOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons"
import { Flex, Typography } from "antd"
import type { Evidence } from "../domain/models"

const { Text } = Typography

export default function EvidenceThumb({ evidence }: { evidence: Evidence }) {
  const [failed, setFailed] = useState(evidence.url.startsWith("/mock-evidence"))
  const isVideo = evidence.type === "video"
  const Icon = isVideo
    ? PlayCircleOutlined
    : evidence.type === "audio"
      ? AudioOutlined
      : evidence.type === "document"
        ? FileOutlined
        : CameraOutlined

  return (
    <Flex vertical gap={6} className="min-w-0">
      <div
        className="overflow-hidden bg-[#F3EAFF]"
        style={{
          aspectRatio: "4 / 3",
          borderRadius: "var(--ant-border-radius-lg)",
        }}
      >
        {failed || evidence.type === "document" ? (
          <Flex align="center" justify="center" className="h-full text-[#722ED1]">
            <Icon style={{ fontSize: 28 }} />
          </Flex>
        ) : evidence.type === "audio" ? (
          <Flex vertical align="center" justify="center" gap={8} className="h-full px-2 text-[#722ED1]">
            <AudioOutlined style={{ fontSize: 24 }} />
            <audio
              src={evidence.url}
              controls
              preload="metadata"
              className="w-full"
              onError={() => setFailed(true)}
            />
          </Flex>
        ) : isVideo ? (
          <video
            src={evidence.url}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <img
            src={evidence.url}
            alt={evidence.caption || "Site evidence"}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <Text type="secondary" ellipsis>
        {evidence.caption || evidence.type}
      </Text>
    </Flex>
  )
}
