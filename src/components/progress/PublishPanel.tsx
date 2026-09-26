import { useState } from "react"
import { LockOutlined } from "@ant-design/icons"
import { Button, Card, Checkbox, Col, Flex, Modal, Row, Tag, Typography } from "antd"
import type { DailyProgress } from "../../domain/models"
import { Permissions } from "../../domain/permissions"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { getEvidenceForProgress, getMembershipName, getProject, getWorkTypeName } from "../../mock/selectors"
import { useAccess } from "../../session/useCan"
import { useCommand } from "../../session/useCommand"
import EvidenceThumb from "../EvidenceThumb"
import Gated from "../Gated"

const { Paragraph, Text } = Typography

/** Pick which photos, videos and documents the homeowner sees, preview, then publish. */
export default function PublishPanel({ progress }: { progress: DailyProgress }) {
  const { state, publishDailyProgress } = useConstructionData()
  const run = useCommand()
  const can = useAccess()
  const evidence = getEvidenceForProgress(state, progress)
  const shareable = evidence.filter((item) => item.type !== "audio")
  const voice = evidence.filter((item) => item.type === "audio")
  const [chosen, setChosen] = useState<string[]>(shareable.map((item) => item.id))
  const [previewing, setPreviewing] = useState(false)
  const project = getProject(state, progress.projectId)
  const reviewer = progress.review ? getMembershipName(state, progress.review.reviewedByMembershipId) : undefined

  const publish = () => {
    const outcome = run(() => publishDailyProgress(progress.id, chosen), { success: "Shared with the homeowner" })
    if (outcome.ok) setPreviewing(false)
  }

  return (
    <Card
      title={`${project?.name ?? "Project"} · ${getWorkTypeName(state, progress.workTypeId)}`}
      extra={<Text type="secondary">{progress.date}{reviewer ? ` · approved by ${reviewer}` : ""}</Text>}
    >
      <Flex vertical gap="middle">
        <Paragraph className="m-0!">{progress.todaySummary}</Paragraph>
        {shareable.length ? (
          <Checkbox.Group value={chosen} onChange={(values) => setChosen(values as string[])} className="w-full">
            <Row gutter={[16, 16]} className="w-full">
              {shareable.map((item) => (
                <Col key={item.id} xs={12} sm={8} lg={6}>
                  <Flex vertical gap={6}>
                    <EvidenceThumb evidence={item} />
                    <Checkbox value={item.id}>Share</Checkbox>
                  </Flex>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
        ) : (
          <Text type="secondary">No photos, video or documents to share. The written update can still be published.</Text>
        )}
        {voice.length > 0 && (
          <Tag icon={<LockOutlined />} className="self-start">
            {voice.length} voice note{voice.length === 1 ? "" : "s"} · internal only
          </Tag>
        )}
        <Flex justify="flex-end">
          <Gated allowed={can(Permissions.CUSTOMER_PUBLISH, progress.projectId, progress)}>
            <Button type="primary" onClick={() => setPreviewing(true)}>
              Publish to homeowner
            </Button>
          </Gated>
        </Flex>
      </Flex>

      <Modal
        open={previewing}
        title="The homeowner will see"
        okText="Publish"
        onOk={publish}
        onCancel={() => setPreviewing(false)}
      >
        <Flex vertical gap="middle">
          <Paragraph className="m-0!"><Text strong>Today: </Text>{progress.todaySummary}</Paragraph>
          <Paragraph className="m-0!"><Text strong>Tomorrow: </Text>{progress.tomorrowPlan}</Paragraph>
          <Row gutter={[12, 12]}>
            {shareable.filter((item) => chosen.includes(item.id)).map((item) => (
              <Col key={item.id} span={8}><EvidenceThumb evidence={item} /></Col>
            ))}
          </Row>
          <Text type="secondary">Voice notes and review notes stay internal.</Text>
        </Flex>
      </Modal>
    </Card>
  )
}
