import { useState, useEffect, useRef } from 'react'
import HIcon from '../components/HIcon'

// ─── Soft ambient background ──────────────────────────────────────────────────

function AmbientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Top-right purple glow */}
      <div
        className="absolute rounded-full"
        style={{
          top: '-180px', right: '-180px',
          width: 640, height: 640,
          backgroundColor: 'rgba(114,46,209,0.065)',
          filter: 'blur(100px)',
        }}
      />
      {/* Bottom-left lavender glow */}
      <div
        className="absolute rounded-full"
        style={{
          bottom: '-220px', left: '-180px',
          width: 720, height: 720,
          backgroundColor: 'rgba(243,234,255,0.60)',
          filter: 'blur(120px)',
        }}
      />
      {/* Behind card — very subtle center */}
      <div
        className="absolute rounded-full"
        style={{
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 520, height: 520,
          backgroundColor: 'rgba(114,46,209,0.032)',
          filter: 'blur(90px)',
        }}
      />
      {/* Far right accent */}
      <div
        className="absolute rounded-full"
        style={{
          top: '25%', right: '-200px',
          width: 480, height: 480,
          backgroundColor: 'rgba(243,234,255,0.50)',
          filter: 'blur(100px)',
        }}
      />
    </div>
  )
}

// ─── OTP box grid ─────────────────────────────────────────────────────────────

type OtpStage = 'idle' | 'verifying' | 'success' | 'error'

interface OtpInputProps {
  otp: string[]
  onChange: (otp: string[]) => void
  stage: OtpStage
  disabled: boolean
}

function OtpInput({ otp, onChange, stage, disabled }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null))

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  const update = (index: number, digit: string) => {
    const next = [...otp]
    next[index] = digit
    onChange(next)
    if (digit && index < 5) refs.current[index + 1]?.focus()
  }

  const handleChange = (index: number, value: string) => {
    const d = value.replace(/\D/g, '').slice(-1)
    update(index, d)
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const next = [...otp]; next[index] = ''; onChange(next)
      } else if (index > 0) {
        const next = [...otp]; next[index - 1] = ''; onChange(next)
        refs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      refs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const next = [...otp]
    text.split('').forEach((c, i) => { next[i] = c })
    onChange(next)
    refs.current[Math.min(text.length, 5)]?.focus()
  }

  const boxStyle = (index: number): string => {
    const filled = !!otp[index]
    if (stage === 'error') return 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]'
    if (stage === 'success') return 'border-[#16A34A] bg-[#F0FDF4] text-[#16A34A]'
    if (filled) return 'border-[#722ED1] bg-[#F3EAFF] text-[#242326]'
    return 'border-[#E3DDD7] bg-white text-[#242326] focus:border-[#722ED1] focus:ring-2 focus:ring-[#722ED1]/10'
  }

  return (
    <div className="flex gap-2">
      {otp.map((digit, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          disabled={disabled}
          className={[
            'flex-1 min-w-0 text-center text-[22px] sm:text-[24px] font-semibold rounded-[12px] border outline-none',
            'transition-all duration-150 h-[52px] sm:h-[60px] caret-[#722ED1]',
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-text',
            boxStyle(i),
          ].join(' ')}
          style={{ fontFamily: '"Google Sans Flex:Bold", sans-serif' }}
        />
      ))}
    </div>
  )
}

// ─── Resend timer ─────────────────────────────────────────────────────────────

function ResendTimer({ seconds, onResend }: { seconds: number; onResend: () => void }) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const mm = Math.floor(seconds / 60)
  const ss = seconds % 60
  return (
    <div
      className="text-center text-[11px] text-[#9A949D]"
      style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
    >
      {seconds > 0 ? (
        <>
          Didn&apos;t receive the code?{' '}
          <span className="text-[#C0BAB5]">Resend in {pad(mm)}:{pad(ss)}</span>
        </>
      ) : (
        <>
          Didn&apos;t receive the code?{' '}
          <button
            onClick={onResend}
            className="text-[#722ED1] font-semibold cursor-pointer bg-transparent border-none p-0 hover:underline"
          >
            Resend code
          </button>
        </>
      )}
    </div>
  )
}

// ─── Screen 004 — OTP Verification ───────────────────────────────────────────

export default function OtpScreen({
  phone = '98765 43210',
  onNavigate,
}: {
  phone?: string
  onNavigate: (screen: string) => void
}) {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const [stage, setStage] = useState<OtpStage>('idle')
  const [timer, setTimer] = useState(28)
  const [errorMsg, setErrorMsg] = useState('')

  const isComplete = otp.every(d => d !== '')

  // Countdown
  useEffect(() => {
    if (timer <= 0) return
    const id = setInterval(() => setTimer(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [timer])

  const handleOtpChange = (next: string[]) => {
    setOtp(next)
    if (stage === 'error') { setStage('idle'); setErrorMsg('') }
  }

  const handleResend = () => {
    setTimer(28)
    setOtp(Array(6).fill(''))
    setStage('idle')
    setErrorMsg('')
  }

  const handleVerify = async () => {
    if (!isComplete || stage === 'verifying' || stage === 'success') return
    setStage('verifying')
    setErrorMsg('')

    await new Promise(r => setTimeout(r, 1500))

    if (otp.join('') === '000000') {
      setStage('error')
      setErrorMsg("The code doesn't match. Check it and try again.")
      return
    }

    setStage('success')
    await new Promise(r => setTimeout(r, 900))
    onNavigate('create-account')
  }

  const buttonLabel = () => {
    if (stage === 'verifying') return null
    if (stage === 'success') return 'Verified ✓'
    return 'Verify & Continue →'
  }

  const buttonBg = stage === 'success' ? '#16A34A' : '#722ED1'

  return (
    <div
      className="min-h-full flex flex-col items-center justify-center relative px-5 py-10"
      style={{ backgroundColor: '#FBF9F7' }}
    >
      <AmbientBackground />

      {/* ── Authentication card ── */}
      <div
        className="relative z-10 w-full bg-white border border-[#E3DDD7] rounded-[24px]"
        style={{
          maxWidth: 460,
          padding: 'clamp(24px, 5vw, 48px)',
          boxShadow: '0 8px 40px rgba(36,35,38,0.07)',
          animation: 'welcomeFadeUp 0.45s ease-out both',
        }}
      >
        {/* H icon */}
        <div className="flex justify-center mb-5">
          <HIcon size={48} />
        </div>

        {/* Eyebrow */}
        <div
          className="text-center text-[11px] tracking-[0.12em] text-[#722ED1] font-semibold uppercase mb-3"
          style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
        >
          Verify Your Number
        </div>

        {/* Headline */}
        <h1
          className="text-center text-[28px] sm:text-[36px] font-semibold text-[#242326] leading-[1.06] tracking-[-0.02em] m-0 mb-3"
          style={{ fontFamily: '"Google Sans Flex:Bold", sans-serif' }}
        >
          Enter your verification code
        </h1>

        {/* Description + phone */}
        <div className="flex flex-col items-center gap-1 mb-7">
          <p
            className="text-[14px] sm:text-[15px] text-[#68636D] leading-[1.65] m-0 text-center"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            We sent a 6-digit code to
          </p>
          <div className="flex items-center gap-2">
            <span
              className="text-[14px] sm:text-[15px] font-semibold text-[#242326]"
              style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
            >
              +91 {phone}
            </span>
            <button
              onClick={() => onNavigate('login')}
              className="text-[13px] text-[#722ED1] font-medium cursor-pointer bg-transparent border-none p-0 hover:underline transition-opacity hover:opacity-80"
              style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
            >
              Change
            </button>
          </div>
        </div>

        {/* OTP boxes */}
        <div className="mb-4">
          <OtpInput
            otp={otp}
            onChange={handleOtpChange}
            stage={stage}
            disabled={stage === 'verifying' || stage === 'success'}
          />
        </div>

        {/* Error message */}
        {errorMsg && (
          <div
            className="flex items-center justify-center gap-1.5 text-[#DC2626] text-[12px] mb-3"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="#DC2626" strokeWidth="1.2"/>
              <line x1="7" y1="4.5" x2="7" y2="7.5" stroke="#DC2626" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="7" cy="9.5" r="0.7" fill="#DC2626"/>
            </svg>
            {errorMsg}
          </div>
        )}

        {/* Resend timer */}
        <div className="mb-6">
          <ResendTimer seconds={timer} onResend={handleResend} />
        </div>

        {/* Verify button */}
        <button
          onClick={handleVerify}
          disabled={!isComplete || stage === 'verifying' || stage === 'success'}
          className={[
            'w-full h-[52px] rounded-[12px] text-white text-[14px] font-semibold',
            'flex items-center justify-center gap-2 transition-all duration-200 mb-4',
            !isComplete && stage !== 'verifying' && stage !== 'success'
              ? 'opacity-50 cursor-not-allowed'
              : stage === 'verifying' || stage === 'success'
              ? 'cursor-default'
              : 'cursor-pointer hover:brightness-90 active:scale-[0.99]',
          ].join(' ')}
          style={{ backgroundColor: buttonBg, fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          {stage === 'verifying' ? (
            <>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="2" strokeOpacity="0.3"/>
                <path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Verifying...
            </>
          ) : (
            buttonLabel()
          )}
        </button>

        {/* Security microcopy */}
        <p
          className="text-center text-[11px] text-[#9A949D] leading-[1.6] m-0"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          Your number is used to securely access your Houzeify workspace.
        </p>
      </div>

      {/* Footer signature */}
      <div className="relative z-10 flex items-center justify-center gap-2.5 mt-8">
        {(['PLAN', 'ESTIMATE', 'BOQ', 'BUILD'] as const).map((item, i, arr) => (
          <span key={item} className="flex items-center gap-2.5">
            <span
              className="text-[9px] tracking-[0.08em] uppercase text-[#9A949D]"
              style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
            >
              {item}
            </span>
            {i < arr.length - 1 && (
              <span
                className="text-[9px] text-[#722ED1]"
                style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
              >
                /
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
