import { useState } from "react"
import { Col, Row, Typography } from "antd"
import type { Evidence } from "../../domain/models"
import EvidenceThumb from "../EvidenceThumb"
import EvidenceViewer, { type EvidenceAudience } from "./EvidenceViewer"

const { Text } = Typography

/** Thumbnails that open the evidence viewer. */
export default function EvidenceGrid({
  items,
  audience = "company",
  empty = "No evidence was attached.",
}: {
  items: Evidence[]
  audience?: EvidenceAudience
  empty?: string
}) {
  const [open, setOpen] = useState<number | null>(null)
  if (!items.length) return <Text type="secondary">{empty}</Text>
  return (
    <>
      <Row gutter={[16, 16]}>
        {items.map((item, index) => (
          <Col key={item.id} xs={12} sm={8}>
            <button
              type="button"
              className="evidence-grid-item"
              onClick={() => setOpen(index)}
              aria-label={`Open ${item.caption || item.type}`}
            >
              <EvidenceThumb evidence={item} />
            </button>
          </Col>
        ))}
      </Row>
      <EvidenceViewer items={items} index={open} audience={audience} onChange={setOpen} />
    </>
  )
}
