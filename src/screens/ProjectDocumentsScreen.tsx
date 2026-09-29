import { FileTextOutlined, UploadOutlined } from "@ant-design/icons"
import { Button, Card, Flex, Form, Input, Modal, Select, Space, Switch, Table, Typography, Upload } from "antd"
import type { TableProps, UploadProps } from "antd"
import { useState } from "react"
import CompanyLayout from "../components/company/CompanyLayout"
import CompanyThemeProvider from "../components/company/CompanyThemeProvider"
import Gated from "../components/Gated"
import { countLabel } from "../components/countLabel"
import type { Document, EntityId } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { Permissions } from "../domain/permissions"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { getMembershipName } from "../mock/selectors"
import { useAccess } from "../session/useCan"
import { useCommand } from "../session/useCommand"
import { useScopedData } from "../session/useScopedData"

const { Text, Title } = Typography

const categoryOptions: Array<{ value: Document["category"]; label: string }> = [
  { value: "approval", label: "Approval" },
  { value: "contract", label: "Contract" },
  { value: "drawing", label: "Drawing" },
  { value: "other", label: "Other" },
]

interface UploadFormValues {
  title: string
  category: Document["category"]
}

function UploadDocumentModal({
  open,
  onClose,
  projectId,
}: {
  open: boolean
  onClose: () => void
  projectId: EntityId
}) {
  const { uploadDocument } = useConstructionData()
  const run = useCommand()
  const [form] = Form.useForm<UploadFormValues>()
  const [file, setFile] = useState<File>()

  const close = () => {
    form.resetFields()
    setFile(undefined)
    onClose()
  }

  const handleFinish = (values: UploadFormValues) => {
    if (!file) return
    const outcome = run(
      () =>
        uploadDocument({
          projectId,
          title: values.title,
          category: values.category,
          url: URL.createObjectURL(file),
        }),
      { success: "Document uploaded" },
    )
    if (outcome.ok) close()
  }

  const beforeUpload: UploadProps["beforeUpload"] = (picked) => {
    setFile(picked)
    if (!form.getFieldValue("title")) form.setFieldsValue({ title: picked.name })
    return false
  }

  return (
    <Modal title="Upload document" open={open} onCancel={close} footer={null} destroyOnHidden>
      <Form<UploadFormValues> form={form} layout="vertical" requiredMark={false} onFinish={handleFinish}>
        <Form.Item label="File" required>
          <Upload maxCount={1} beforeUpload={beforeUpload} onRemove={() => setFile(undefined)}>
            <Button icon={<UploadOutlined />}>Choose file</Button>
          </Upload>
        </Form.Item>
        <Form.Item label="Title" name="title" rules={[{ required: true, message: "Give the document a title." }]}>
          <Input placeholder="e.g. Municipal building approval" />
        </Form.Item>
        <Form.Item label="Category" name="category" initialValue="other" rules={[{ required: true }]}>
          <Select options={categoryOptions} />
        </Form.Item>
        <Flex justify="flex-end" gap="small">
          <Button onClick={close}>Cancel</Button>
          <Button type="primary" htmlType="submit" disabled={!file}>Upload</Button>
        </Flex>
      </Form>
    </Modal>
  )
}

function ProjectDocuments({ onNavigate, projectId }: { onNavigate: Navigate; projectId: EntityId }) {
  const { state, publishDocument } = useConstructionData()
  const scoped = useScopedData()
  const can = useAccess()
  const run = useCommand()
  const [uploadOpen, setUploadOpen] = useState(false)

  const canUpload = can(Permissions.EVIDENCE_CAPTURE, projectId)
  const canPublish = can(Permissions.CUSTOMER_PUBLISH, projectId)

  const documents = scoped.documents
    .filter((doc) => doc.projectId === projectId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  const columns: TableProps<Document>["columns"] = [
    {
      title: "Document",
      key: "title",
      render: (_, doc) => (
        <a href={doc.url} target="_blank" rel="noreferrer">
          <Space><FileTextOutlined />{doc.title}</Space>
        </a>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      render: (value: Document["category"]) => categoryOptions.find((opt) => opt.value === value)?.label ?? value,
    },
    {
      title: "Uploaded by",
      key: "uploadedBy",
      responsive: ["md"],
      render: (_, doc) => <Text>{getMembershipName(state, doc.uploadedByMembershipId) ?? "Unknown"}</Text>,
    },
    {
      title: "Uploaded",
      dataIndex: "createdAt",
      key: "createdAt",
      responsive: ["lg"],
      render: (value: string) => <Text type="secondary">{value.slice(0, 10)}</Text>,
    },
    {
      title: "Shared with homeowner",
      key: "visibility",
      render: (_, doc) => (
        <Gated allowed={canPublish} reason="Publishing needs customer-publish access on this project.">
          <Switch
            checked={doc.customerVisibility === "customer-visible"}
            onChange={(checked) =>
              run(() => publishDocument(doc.id, checked), {
                success: checked ? "Shared with the homeowner" : "Hidden from the homeowner",
              })
            }
          />
        </Gated>
      ),
    },
  ]

  return (
    <CompanyLayout
      nav={{ menu: "project", projectId, active: "documents" }}
      onNavigate={onNavigate}
      description="Approvals, contracts and drawings — share what the homeowner should see"
      actions={
        <Gated allowed={canUpload} reason="You can't upload documents on this project.">
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
            Upload document
          </Button>
        </Gated>
      }
    >
      <Flex vertical gap="large" className="company-content">
        <Card
          title={<Title level={5} className="company-heading! m-0!">Documents</Title>}
          extra={<Text type="secondary">{countLabel(documents.length, "document")}</Text>}
          classNames={{ body: "company-table-card-body" }}
        >
          <Table rowKey="id" columns={columns} dataSource={documents} pagination={{ pageSize: 10, showSizeChanger: false }} />
        </Card>
      </Flex>

      <UploadDocumentModal open={uploadOpen} onClose={() => setUploadOpen(false)} projectId={projectId} />
    </CompanyLayout>
  )
}

export default function ProjectDocumentsScreen({ onNavigate, projectId }: { onNavigate: Navigate; projectId: EntityId }) {
  return (
    <CompanyThemeProvider>
      <ProjectDocuments onNavigate={onNavigate} projectId={projectId} />
    </CompanyThemeProvider>
  )
}
