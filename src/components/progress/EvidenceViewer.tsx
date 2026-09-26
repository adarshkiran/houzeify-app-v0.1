import { useState } from "react"
import {
  CameraOutlined,
  FileOutlined,
  LeftOutlined,
  PlayCircleOutlined,
  RightOutlined,
} from "@ant-design/icons"
import { Button, Descriptions, Flex, Modal, Tag, Typography } from "antd"
import type { Evidence } from "../../domain/models"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { getMembershipName, getProject, getProjectUnits } from "../../mock/selectors"
import { reviewStatusLabel, visibilityLabel } from "./progressLabels"

const { Text } = Typography

export type EvidenceAudience = "company" | "homeowner"

function Media({ item }: { item: Evidence }) {
  const [failed, setFailed] = useState(item.url.startsWith("/mock-evidence"))

  if ((item.type === "photo" || item.type === "video") && failed) {
    const Icon = item.type === "video" ? PlayCircleOutlined : CameraOutlined
    return (
      <Flex vertical align="center" justify="center" gap="small" className="evidence-viewer-media">
        <Icon style={{ fontSize: 40 }} />
        <Text type="secondary">Preview not available</Text>
      </Flex>
    )
  }
  if (item.type === "photo") {
    return (
      <img
        src={item.url}
        alt={item.caption || "Site photo"}
        className="evidence-viewer-media"
        onError={() => setFailed(true)}
      />
    )
  }
  if (item.type === "video") {
    return (
      <video
        src={item.url}
        controls
        playsInline
        className="evidence-viewer-media"
        onError={() => setFailed(true)}
      />
    )
  }
  if (item.type === "audio") {
    return (
      <Flex align="center" justify="center" className="evidence-viewer-media">
        <audio src={item.url} controls className="w-full" />
      </Flex>
    )
  }
  return (
    <Flex vertical align="center" justify="center" gap="small" className="evidence-viewer-media">
      <FileOutlined style={{ fontSize: 40 }} />
      <a href={item.url} target="_blank" rel="noreferrer">Open document</a>
    </Flex>
  )
}

/**
 * Full-size look at one piece of evidence, with who captured it and who can
 * see it. The homeowner audience gets only date, location and task.
 */
export default function EvidenceViewer({
  items,
  index,
  audience,
  onChange,
}: {
  items: Evidence[]
  index: number | null
  audience: EvidenceAudience
  onChange: (index: number | null) => void
}) {
  const { state } = useConstructionData()
  const item = index === null ? undefined : items[index]
  if (!item) return null

  const unit = getProjectUnits(state, item.projectId).find((u) => u.id === item.projectUnitId)
  const task = state.tasks.find((t) => t.id === item.taskId)
  const progress = state.dailyProgress.find((p) => p.id === item.dailyProgressId)
  const worker = state.workers.find((w) => w.id === item.capturedByWorkerId)
  const capturedBy =
    worker?.name ??
    (item.capturedByMembershipId ? getMembershipName(state, item.capturedByMembershipId) : undefined) ??
    "—"
  const where = [getProject(state, item.projectId)?.name, unit?.name].filter(Boolean).join(" · ")
  const when = new Date(item.capturedAt).toLocaleString("en-IN")

  const details =
    audience === "homeowner"
      ? [
          { key: "when", label: "Date", children: when },
          { key: "where", label: "Location", children: where },
          { key: "task", label: "Work", children: task?.title ?? "—" },
        ]
      : [
          { key: "by", label: "Captured by", children: capturedBy },
          { key: "when", label: "Captured at", children: when },
          { key: "where", label: "Project / unit", children: where },
          { key: "task", label: "Task", children: task?.title ?? "—" },
          {
            key: "visibility",
            label: "Homeowner",
            children: (
              <Tag color={visibilityLabel[item.customerVisibility].color} className="m-0!">
                {visibilityLabel[item.customerVisibility].text}
              </Tag>
            ),
          },
          ...(progress
            ? [{
                key: "review",
                label: "Review",
                children: (
                  <Tag color={reviewStatusLabel[progress.reviewStatus].color} className="m-0!">
                    {reviewStatusLabel[progress.reviewStatus].text}
                  </Tag>
                ),
              }]
            : []),
        ]

  const at = index ?? 0
  return (
    <Modal
      open
      width={960}
      footer={null}
      title={item.caption || item.type}
      onCancel={() => onChange(null)}
      destroyOnHidden
    >
      <Flex gap="large" wrap className="evidence-viewer">
        <Flex vertical gap="small" className="evidence-viewer-stage">
          <Media key={item.id} item={item} />
          {items.length > 1 && (
            <Flex align="center" justify="space-between">
              <Button icon={<LeftOutlined />} disabled={at === 0} onClick={() => onChange(at - 1)} aria-label="Previous" />
              <Text type="secondary">{at + 1} of {items.length}</Text>
              <Button icon={<RightOutlined />} disabled={at === items.length - 1} onClick={() => onChange(at + 1)} aria-label="Next" />
            </Flex>
          )}
        </Flex>
        <Descriptions column={1} size="small" items={details} className="evidence-viewer-details" />
      </Flex>
    </Modal>
  )
}
