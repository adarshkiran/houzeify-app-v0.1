import { Alert, Descriptions, Flex, Tag, Timeline, Typography } from "antd"
import type { DailyProgress } from "../../domain/models"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import {
  getEvidenceForProgress,
  getMembershipName,
  getProject,
  getVersionChain,
  getWorkTypeName,
} from "../../mock/selectors"
import EvidenceGrid from "./EvidenceGrid"
import { reviewStatusLabel } from "./progressLabels"

const { Paragraph, Text } = Typography

/** One update: what was done, the evidence, and every earlier version with its review. */
export default function ProgressDetail({ progress }: { progress: DailyProgress }) {
  const { state } = useConstructionData()
  const project = getProject(state, progress.projectId)
  const evidence = getEvidenceForProgress(state, progress)
  const chain = getVersionChain(state, progress)
  const earlier = chain.filter((item) => item.id !== progress.id)
  const who = (membershipId?: string) =>
    (membershipId && getMembershipName(state, membershipId)) || "—"

  return (
    <Flex vertical gap="large">
      <Flex align="center" gap="small" wrap>
        <Tag color={reviewStatusLabel[progress.reviewStatus].color} className="m-0!">
          {reviewStatusLabel[progress.reviewStatus].text}
        </Tag>
        {progress.version > 1 && <Tag className="m-0!">Version {progress.version}</Tag>}
        {progress.publicationStatus === "published" && (
          <Tag color="success" className="m-0!">Published</Tag>
        )}
      </Flex>

      <Descriptions
        column={{ xs: 1, sm: 2 }}
        items={[
          { key: "work", label: "Work", children: getWorkTypeName(state, progress.workTypeId) },
          { key: "by", label: "Submitted by", children: who(progress.submittedByMembershipId) },
          { key: "date", label: "Date", children: progress.date },
          { key: "workers", label: "Workers", children: progress.workersPresent },
          ...(progress.completedQuantity
            ? [{
                key: "quantity",
                label: "Done today",
                children: `${progress.completedQuantity.value} ${progress.completedQuantity.unit}${
                  progress.plannedQuantity ? ` of ${progress.plannedQuantity.value} ${progress.plannedQuantity.unit} planned` : ""
                }`,
              }]
            : []),
          ...(typeof progress.progressAfter === "number"
            ? [{ key: "estimate", label: "Submitter's estimate", children: `${progress.progressAfter}%` }]
            : []),
          { key: "official", label: "Project progress (calculated)", children: `${project?.progress ?? 0}%` },
        ]}
      />

      <Flex vertical gap="small">
        <Text strong>Yesterday</Text>
        <Paragraph className="m-0!">{progress.yesterdaySummary || "No previous-day note was included."}</Paragraph>
        <Text strong>Today</Text>
        <Paragraph className="m-0!">{progress.todaySummary}</Paragraph>
        <Text strong>Tomorrow</Text>
        <Paragraph className="m-0!">{progress.tomorrowPlan}</Paragraph>
        {progress.blockerSummary && <Alert type="warning" showIcon message={progress.blockerSummary} />}
      </Flex>

      {progress.review?.note && (
        <Alert
          type={progress.review.decision === "approve" ? "success" : "warning"}
          showIcon
          message={`Review note from ${who(progress.review.reviewedByMembershipId)}`}
          description={progress.review.note}
        />
      )}

      <Flex vertical gap="small">
        <Text strong>Evidence</Text>
        <EvidenceGrid items={evidence} />
      </Flex>

      {earlier.length > 0 && (
        <Flex vertical gap="small">
          <Text strong>Earlier versions</Text>
          <Timeline
            items={earlier.map((item) => ({
              key: item.id,
              content: (
                <Flex vertical gap={2}>
                  <Text>
                    Version {item.version} · {item.date} · {reviewStatusLabel[item.reviewStatus].text}
                  </Text>
                  {item.review?.note && (
                    <Text type="secondary">
                      {who(item.review.reviewedByMembershipId)}: "{item.review.note}"
                    </Text>
                  )}
                </Flex>
              ),
            }))}
          />
        </Flex>
      )}
    </Flex>
  )
}
