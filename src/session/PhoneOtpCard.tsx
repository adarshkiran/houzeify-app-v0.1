import { useState } from "react"
import { Alert, Button, Card, Form, Input, Typography } from "antd"
import { signInWithPhone, verifyOtp } from "../data/session"
import { getSupabaseClient } from "../data/supabaseClient"
import type { Session } from "../domain/session"
import { useSession } from "./SessionProvider"

const { Paragraph, Text, Title } = Typography

/** Phone OTP sign-in state: enter a phone, then the SMS code. */
export function usePhoneOtp() {
  const { signIn } = useSession()
  const [phase, setPhase] = useState<"phone" | "code">("phone")
  const [phone, setPhone] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestCode = async (value: string) => {
    const trimmed = value.trim()
    setBusy(true)
    setError(null)
    try {
      await signInWithPhone(getSupabaseClient(), trimmed)
      setPhone(trimmed)
      setPhase("code")
    } catch {
      setError("We couldn't send a code to that number. Check it and try again.")
    } finally {
      setBusy(false)
    }
  }

  /** Resolves to the signed-in session, or null when the phone has no site or business role. */
  const confirmCode = async (code: string): Promise<Session | null> => {
    setBusy(true)
    setError(null)
    try {
      const next = await verifyOtp(getSupabaseClient(), phone, code.trim())
      if (!next) {
        setError("We couldn't find you on a site team or business. Check with your supervisor.")
        return null
      }
      signIn(next)
      return next
    } catch {
      setError("That code didn't work. Check it and try again.")
      return null
    } finally {
      setBusy(false)
    }
  }

  const backToPhone = () => {
    setPhase("phone")
    setError(null)
  }

  return { phase, phone, busy, error, requestCode, confirmCode, backToPhone }
}

/** Antd sign-in card for the supabase data source. Calls onVerified with the resolved session. */
export default function PhoneOtpCard({
  eyebrow,
  title,
  description,
  onVerified,
}: {
  eyebrow: string
  title: string
  description: string
  onVerified: (session: Session) => void
}) {
  const otp = usePhoneOtp()

  const handlePhone = ({ phone }: { phone: string }) => void otp.requestCode(phone)
  const handleCode = async ({ code }: { code: string }) => {
    const next = await otp.confirmCode(code)
    if (next) onVerified(next)
  }

  return (
    <>
      <div>
        <Text className="company-eyebrow">{eyebrow}</Text>
        <Title level={3} className="company-heading! m-0!">
          {otp.phase === "phone" ? title : "Enter the code we sent"}
        </Title>
        <Paragraph type="secondary" className="m-0!">
          {otp.phase === "phone"
            ? description
            : `We sent a one-time code to ${otp.phone}.`}
        </Paragraph>
      </div>
      <Card size="small">
        {otp.phase === "phone" ? (
          <Form layout="vertical" requiredMark={false} onFinish={handlePhone}>
            <Form.Item
              label="Phone number"
              name="phone"
              rules={[{ required: true, whitespace: true, message: "Enter your phone number" }]}
            >
              <Input size="large" inputMode="tel" autoComplete="tel" />
            </Form.Item>
            {otp.error && <Alert type="warning" showIcon className="mb-4!" message={otp.error} />}
            <Button type="primary" size="large" block htmlType="submit" loading={otp.busy}>
              Send code
            </Button>
          </Form>
        ) : (
          <Form layout="vertical" requiredMark={false} onFinish={handleCode}>
            <Form.Item
              label="One-time code"
              name="code"
              rules={[{ required: true, whitespace: true, message: "Enter the code" }]}
            >
              <Input size="large" inputMode="numeric" autoComplete="one-time-code" />
            </Form.Item>
            {otp.error && <Alert type="warning" showIcon className="mb-4!" message={otp.error} />}
            <Button type="primary" size="large" block htmlType="submit" loading={otp.busy}>
              Verify and continue
            </Button>
            <Button type="link" block className="mt-2!" onClick={otp.backToPhone}>
              Use a different phone number
            </Button>
          </Form>
        )}
      </Card>
    </>
  )
}
