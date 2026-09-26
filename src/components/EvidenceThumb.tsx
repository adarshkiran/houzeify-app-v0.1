import { useState } from "react"
import { CameraOutlined, PlayCircleOutlined } from "@ant-design/icons"
import { Flex, Typography } from "antd"
import type { Evidence } from "../domain/models"

const { Text } = Typography

export default function EvidenceThumb({ evidence }: { evidence: Evidence }) {
  const [failed, setFailed] = useState(evidence.url.startsWith("/mock-evidence"))
  const Icon = evidence.type === "video" ? PlayCircleOutlined : CameraOutlined

  return (
    <Flex vertical gap={6} className="min-w-0">
      <div
        className="overflow-hidden bg-[#F3EAFF]"
        style={{
          aspectRatio: "4 / 3",
          borderRadius: "var(--ant-border-radius-lg)",
        }}
      >
        {failed ? (
          <Flex align="center" justify="center" className="h-full text-[#722ED1]">
            <Icon style={{ fontSize: 28 }} />
          </Flex>
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
