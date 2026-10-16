import { useState } from "react"
import { RobotOutlined } from "@ant-design/icons"
import { App, Button, Flex, Segmented, Tag, Typography } from "antd"
import type { EntityId } from "../../domain/models"
import { narrativeErrorMessage } from "../../domain/narrative/messages"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import type { Narrative, NarrativeFacts, NarrativeKind } from "../../../supabase/functions/_shared/narrative/types"
import type { NarrativeDraft } from "./useNarrativeDraft"

const { Paragraph, Text } = Typography

/**
 * The summary block of a report or weekly card. Shows the standard (rules)
 * text, or the AI draft when one exists and is chosen, and offers the
 * "Rewrite with AI" action. The draft is never saved here: the parent keeps
 * it with the report only through the existing approve step.
 */
export default function NarrativePanel({
  projectId,
  kind,
  facts,
  fallbackLines,
  allowed,
  draft,
}: {
  projectId: EntityId
  kind: NarrativeKind
  facts: NarrativeFacts | undefined
  fallbackLines: string[]
  /** The organization's plan includes AI summaries. */
  allowed: boolean
  draft: NarrativeDraft
}) {
  const { narrateReport } = useConstructionData()
  const { message } = App.useApp()
  const [working, setWorking] = useState(false)

  const rewrite = async () => {
    if (!facts || working) return
    setWorking(true)
    try {
      const result = await narrateReport({ projectId, kind, facts })
      if ("narrative" in result) draft.set(result.narrative)
      else message.warning(narrativeErrorMessage(result.error))
    } finally {
      setWorking(false)
    }
  }

  return (
    <Flex vertical gap={8}>
      <div aria-live="polite">
      {draft.narrative && draft.useAi ? (
        <AiText narrative={draft.narrative} />
      ) : (
        <Flex vertical gap={4}>
          {fallbackLines.map((line, index) => (
            <Text key={`${index}-${line}`} className={line.startsWith("•") ? "pl-2" : undefined}>
              {line}
            </Text>
          ))}
        </Flex>
      )}
      </div>

      <Flex gap="small" align="center" wrap>
        {draft.narrative ? (
          <Segmented
            size="small"
            aria-label="Summary version"
            value={draft.useAi ? "ai" : "standard"}
            onChange={(value) => draft.setUseAi(value === "ai")}
            options={[
              { label: "AI summary", value: "ai" },
              { label: "Standard summary", value: "standard" },
            ]}
          />
        ) : null}
        {allowed ? (
          facts ? (
            <Button size="small" icon={<RobotOutlined />} loading={working} onClick={() => void rewrite()}>
              {draft.narrative ? "Rewrite again" : "Rewrite with AI"}
            </Button>
          ) : null
        ) : (
          <Text type="secondary" className="text-[12px]!">
            AI summaries aren't included in your plan.
          </Text>
        )}
      </Flex>
    </Flex>
  )
}

/** The AI text with its provenance. Used live (unreviewed) and in saved snapshots (approved). */
export function AiText({ narrative, approved = false }: { narrative: Narrative; approved?: boolean }) {
  return (
    <Flex vertical gap={6}>
      <Flex gap="small" wrap>
        <Tag color={approved ? "green" : "purple"}>{approved ? "AI-written · approved" : "AI-written · not yet reviewed"}</Tag>
        <Tag>{narrative.engine}</Tag>
      </Flex>
      {narrative.text.split("\n\n").map((paragraph, index) => (
        <Paragraph key={`${index}-${paragraph}`} className="m-0!">
          {paragraph}
        </Paragraph>
      ))}
    </Flex>
  )
}
