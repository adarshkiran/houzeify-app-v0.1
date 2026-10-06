import { useState } from "react"
import { ArrowLeftOutlined } from "@ant-design/icons"
import { Alert, Button, Card, Form, Input, Typography } from "antd"
import WorkerShell from "../components/worker/WorkerShell"
import type { EntityId, Worker } from "../domain/models"
import type { Navigate } from "../domain/navigation"
import { findOpenOnboardingByPhone } from "../domain/workforceOnboarding"
import { findWorkerByPhone } from "../domain/workerTasks"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { DEMO_WORKER_PHONE } from "../mock/seed"
import { useSession } from "../session/SessionProvider"
import { useCommand } from "../session/useCommand"

const { Text, Title, Paragraph } = Typography

/**
 * Site worker sign-in by phone. Stands in for OTP onboarding. A phone that
 * belongs to an active worker signs in directly. A phone with an open
 * invitation is accepted here: a QR invitation asks for its join code, and any
 * other invitation is accepted for the worker's own phone.
 */
function JoinSite({ onNavigate }: { onNavigate: Navigate }) {
  const { state, acceptOwnWorkerOnboarding, acceptWorkerOnboarding } = useConstructionData()
  const { signIn } = useSession()
  const runCommand = useCommand()
  const [notFound, setNotFound] = useState(false)
  const [pending, setPending] = useState<{ onboardingId: EntityId; phone: string } | null>(null)

  const enterSite = (worker: Worker, phone: string) => {
    if (!worker.userId) {
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

  const handleFinish = ({ phone }: { phone: string }) => {
    const worker = findWorkerByPhone(state, phone)
    if (worker?.userId) {
      enterSite(worker, phone)
      return
    }
    const onboarding = state.organizations
      .map((org) => findOpenOnboardingByPhone(state, org.id, phone))
      .find(Boolean)
    if (!onboarding) {
      setNotFound(true)
      return
    }
    if (onboarding.method === "qr") {
      setPending({ onboardingId: onboarding.id, phone: phone.trim() })
      return
    }
    const outcome = runCommand(() => acceptOwnWorkerOnboarding(onboarding.id, phone))
    if (outcome.ok) enterSite(outcome.value, phone)
  }

  const handleJoin = ({ joinCode }: { joinCode: string }) => {
    if (!pending) return
    const outcome = runCommand(() =>
      acceptWorkerOnboarding(pending.onboardingId, joinCode.trim().toUpperCase()),
    )
    if (outcome.ok) enterSite(outcome.value, pending.phone)
  }

  if (pending) {
    return (
      <>
        <div>
          <Text className="company-eyebrow">Site worker</Text>
          <Title level={3} className="company-heading! m-0!">
            Enter your join code
          </Title>
          <Paragraph type="secondary" className="m-0!">
            Your supervisor shared a code with you when they sent the invitation.
          </Paragraph>
        </div>
        <Card size="small">
          <Form layout="vertical" requiredMark={false} onFinish={handleJoin}>
            <Form.Item
              label="Join code"
              name="joinCode"
              rules={[{ required: true, whitespace: true, message: "Enter the join code" }]}
            >
              <Input size="large" autoCapitalize="characters" autoComplete="off" />
            </Form.Item>
            <Button type="primary" size="large" block htmlType="submit">
              Join site
            </Button>
            <Button type="link" block className="mt-2!" onClick={() => setPending(null)}>
              Use a different phone number
            </Button>
          </Form>
        </Card>
      </>
    )
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
