import { useState } from "react"
import { ArrowLeftOutlined } from "@ant-design/icons"
import { Alert, Button, Card, Form, Input, Typography } from "antd"
import WorkerShell from "../components/worker/WorkerShell"
import type { Navigate } from "../domain/navigation"
import { findWorkerByPhone } from "../domain/workerTasks"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { DEMO_WORKER_PHONE } from "../mock/seed"
import { useSession } from "../session/SessionProvider"

const { Text, Title, Paragraph } = Typography

/**
 * Site worker sign-in by phone. Stands in for OTP onboarding: the phone must
 * belong to a worker a company has already added (and linked to a person).
 */
function JoinSite({ onNavigate }: { onNavigate: Navigate }) {
  const { state } = useConstructionData()
  const { signIn } = useSession()
  const [notFound, setNotFound] = useState(false)

  const handleFinish = ({ phone }: { phone: string }) => {
    const worker = findWorkerByPhone(state, phone)
    if (!worker?.userId) {
      setNotFound(true)
      return
    }
    signIn({
      accountType: "worker",
      personId: worker.userId,
      organizationId: worker.organizationId,
      phone: phone.trim(),
    })
    onNavigate("worker-today")
  }

  return (
    <>
      <div>
        <Text className="company-eyebrow">Site worker</Text>
        <Title level={3} className="company-heading! m-0!">
          Join your site team
        </Title>
        <Paragraph type="secondary" className="m-0!">
          Use the phone number your supervisor added to the workforce list.
        </Paragraph>
      </div>
      <Card size="small">
        <Form
          layout="vertical"
          requiredMark={false}
          initialValues={{ phone: DEMO_WORKER_PHONE }}
          onFinish={handleFinish}
          onValuesChange={() => setNotFound(false)}
        >
          <Form.Item
            label="Phone number"
            name="phone"
            extra="Demo: Ravi Naik's number is filled in."
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Enter your phone number",
              },
            ]}
          >
            <Input size="large" inputMode="tel" autoComplete="tel" />
          </Form.Item>
          {notFound && (
            <Alert
              type="warning"
              showIcon
              className="mb-4!"
              message="We couldn't find you on a site team"
              description="Ask your supervisor to add this number in Workforce, then try again."
            />
          )}
          <Button type="primary" size="large" block htmlType="submit">
            Continue
          </Button>
        </Form>
      </Card>
    </>
  )
}

export default function WorkerOnboardingScreen({
  onNavigate,
}: {
  onNavigate: Navigate
}) {
  return (
    <WorkerShell
      headerAction={
        <Button icon={<ArrowLeftOutlined />} onClick={() => onNavigate("role")}>
          Back
        </Button>
      }
    >
      <JoinSite onNavigate={onNavigate} />
    </WorkerShell>
  )
}
