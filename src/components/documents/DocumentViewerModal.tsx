import { FileOutlined } from "@ant-design/icons"
import { Descriptions, Flex, Modal, Typography } from "antd"
import type { Document } from "../../domain/models"

const { Text } = Typography

export const categoryLabel: Record<Document["category"], string> = {
  approval: "Approval",
  contract: "Contract",
  drawing: "Drawing",
  other: "Other",
}

/** Read-only look at one shared document: what it is and a link to open it. */
export default function DocumentViewerModal({
  document,
  onClose,
}: {
  document: Document | undefined
  onClose: () => void
}) {
  if (!document) return null
  return (
    <Modal open width={480} footer={null} title={document.title} onCancel={onClose} destroyOnHidden>
      <Flex vertical gap="middle">
        <Flex align="center" justify="center" gap="small" className="evidence-viewer-media" style={{ minHeight: 160 }}>
          <FileOutlined style={{ fontSize: 40 }} />
          <a href={document.url} target="_blank" rel="noreferrer">Open document</a>
        </Flex>
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: "category", label: "Category", children: categoryLabel[document.category] },
            { key: "date", label: "Date", children: document.createdAt.slice(0, 10) },
          ]}
        />
      </Flex>
    </Modal>
  )
}
