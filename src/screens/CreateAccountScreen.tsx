import { useState } from 'react'
import PublicBackButton from '../components/PublicBackButton'
import HIcon from '../components/HIcon'

// ─── Ambient background (same language as OTP screen) ─────────────────────────

function AmbientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        className="absolute rounded-full"
        style={{
          top: '-160px', right: '-160px',
          width: 600, height: 600,
          backgroundColor: 'rgba(114,46,209,0.065)',
          filter: 'blur(100px)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          bottom: '-200px', left: '-160px',
          width: 680, height: 680,
          backgroundColor: 'rgba(243,234,255,0.60)',
          filter: 'blur(120px)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500, height: 500,
          backgroundColor: 'rgba(114,46,209,0.030)',
          filter: 'blur(90px)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: '20%', right: '-180px',
          width: 460, height: 460,
          backgroundColor: 'rgba(243,234,255,0.50)',
          filter: 'blur(100px)',
        }}
      />
    </div>
  )
}

// ─── Verified phone badge ─────────────────────────────────────────────────────

function VerifiedPhone({ phone }: { phone: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-[#F3EAFF] border border-[#722ED1]/15 rounded-[10px] px-3.5 py-2.5">
      <div
        className="size-[18px] rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'rgba(114,46,209,0.12)' }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5L4 7L8 3" stroke="#722ED1" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span
        className="text-[14px] font-semibold text-[#242326]"
        style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
      >
        +91 {phone}
      </span>
      <span
        className="text-[9px] tracking-[0.12em] text-[#722ED1] uppercase ml-auto"
        style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
      >
        Verified
      </span>
    </div>
  )
}

// ─── Input field ──────────────────────────────────────────────────────────────

interface InputFieldProps {
  label: string
  optional?: boolean
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder: string
  type?: string
  error?: string
  showError?: boolean
  helper?: string
  disabled?: boolean
}

function InputField({
  label, optional, value, onChange, onBlur,
  placeholder, type = 'text', error, showError, helper, disabled,
}: InputFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label
          className="text-[13px] font-semibold text-[#242326]"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          {label}
        </label>
        {optional && (
          <span
            className="text-[11px] text-[#9A949D]"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            Optional
          </span>
        )}
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={[
          'h-[52px] px-4 text-[15px] text-[#242326] placeholder:text-[#C0BAB5] bg-white border rounded-[12px] outline-none transition-all duration-200 w-full',
          disabled ? 'opacity-60 cursor-not-allowed' : '',
          showError
            ? 'border-[#DC2626] ring-2 ring-[#DC2626]/10'
            : 'border-[#E3DDD7] focus:border-[#722ED1] focus:ring-2 focus:ring-[#722ED1]/10',
        ].join(' ')}
        style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
      />
      {showError && error && (
        <div
          className="flex items-center gap-1.5 text-[#DC2626] text-[12px]"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="#DC2626" strokeWidth="1.2"/>
            <line x1="7" y1="4.5" x2="7" y2="7.5" stroke="#DC2626" strokeWidth="1.3" strokeLinecap="round"/>
            <circle cx="7" cy="9.5" r="0.7" fill="#DC2626"/>
          </svg>
          {error}
        </div>
      )}
      {helper && !showError && (
        <p
          className="text-[11px] text-[#9A949D] m-0 leading-[1.5]"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          {helper}
        </p>
      )}
    </div>
  )
}

// ─── Screen 005 — Create Account ──────────────────────────────────────────────

type Stage = 'idle' | 'creating' | 'success'

export default function CreateAccountScreen({
  phone = '98765 43210',
  onNavigate,
}: {
  phone?: string
  onNavigate: (screen: string) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')

  const nameError = name.trim().length === 0 ? 'Full name is required.' : ''
  const emailError =
    email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? 'Please enter a valid email address.'
      : ''

  const handleCreate = async () => {
    setNameTouched(true)
    setEmailTouched(true)
    if (nameError || emailError) return
    setStage('creating')
    await new Promise(r => setTimeout(r, 1600))
    setStage('success')
    await new Promise(r => setTimeout(r, 900))
    onNavigate('account-created')
  }

  const isDisabled = stage === 'creating' || stage === 'success'

  const buttonLabel = () => {
    if (stage === 'creating') return null
    if (stage === 'success') return 'Account created ✓'
    return 'Create my account →'
  }

  return (
    <div
      className="min-h-full flex flex-col items-center justify-center relative px-5 py-10"
      style={{ backgroundColor: '#FBF9F7' }}
    >
      <AmbientBackground />

      {/* ── Card ── */}
      <div
        className="relative z-10 w-full bg-white border border-[#E3DDD7] rounded-[24px]"
        style={{
          maxWidth: 480,
          padding: 'clamp(24px, 5vw, 48px)',
          boxShadow: '0 8px 40px rgba(36,35,38,0.07)',
          animation: 'welcomeFadeUp 0.45s ease-out both',
        }}
      >
        <div className="mb-2">
          <PublicBackButton onClick={() => onNavigate('login')} />
        </div>

        {/* H icon */}
        <div className="flex justify-center mb-5">
          <HIcon size={48} />
        </div>

        {/* Eyebrow */}
        <div
          className="text-center text-[11px] tracking-[0.12em] text-[#722ED1] font-semibold uppercase mb-3"
          style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
        >
          Create Your Account
        </div>

        {/* Headline */}
        <h1
          className="text-center text-[28px] sm:text-[38px] font-semibold text-[#242326] leading-[1.06] tracking-[-0.02em] m-0 mb-2"
          style={{ fontFamily: '"Google Sans Flex:Bold", sans-serif' }}
        >
          Let&apos;s get started.
        </h1>

        {/* Description */}
        <p
          className="text-center text-[14px] sm:text-[15px] text-[#68636D] leading-[1.65] m-0 mb-5"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          Create your Houzeify workspace in a few seconds.
        </p>

        {/* Verified phone */}
        <div className="mb-6">
          <VerifiedPhone phone={phone} />
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4 mb-5">
          <InputField
            label="Full name"
            value={name}
            onChange={v => { setName(v); if (nameTouched && v.trim()) setNameTouched(false) }}
            onBlur={() => setNameTouched(true)}
            placeholder="Enter your name"
            error={nameError}
            showError={nameTouched && !!nameError}
            disabled={isDisabled}
          />
          <InputField
            label="Email address"
            optional
            type="email"
            value={email}
            onChange={v => { setEmail(v); if (emailTouched) setEmailTouched(false) }}
            onBlur={() => setEmailTouched(true)}
            placeholder="you@example.com"
            error={emailError}
            showError={emailTouched && !!emailError}
            helper="We'll use this for project reports and important updates."
            disabled={isDisabled}
          />
        </div>

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={isDisabled}
          className={[
            'w-full h-[52px] rounded-[12px] text-white text-[14px] font-semibold',
            'flex items-center justify-center gap-2 transition-all duration-200 mb-4',
            isDisabled ? 'cursor-default' : 'cursor-pointer hover:brightness-90 active:scale-[0.99]',
          ].join(' ')}
          style={{
            backgroundColor: stage === 'success' ? '#16A34A' : '#722ED1',
            fontFamily: '"Open Sans:Regular", sans-serif',
          }}
        >
          {stage === 'creating' ? (
            <>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="2" strokeOpacity="0.3"/>
                <path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Creating workspace...
            </>
          ) : (
            buttonLabel()
          )}
        </button>

        {/* Terms */}
        <p
          className="text-center text-[11px] text-[#9A949D] leading-[1.65] m-0"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          By continuing, you agree to our{' '}
          <a href="#" className="text-[#722ED1] hover:underline" onClick={e => e.preventDefault()}>
            Terms of Service
          </a>
          {' '}and{' '}
          <a href="#" className="text-[#722ED1] hover:underline" onClick={e => e.preventDefault()}>
            Privacy Policy
          </a>
          .
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
