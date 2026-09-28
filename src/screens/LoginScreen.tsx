import { useState } from 'react'
import PublicBackButton from '../components/PublicBackButton'
import LogoHorizontal from '../components/LogoHorizontal'
import HIcon from '../components/HIcon'

// ─── Google icon ─────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2a10.3 10.3 0 00-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 009 18z" fill="#34A853"/>
      <path d="M3.97 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.29-1.71V5.06H.96A9 9 0 000 9c0 1.45.35 2.82.96 4.04l3.01-2.33z" fill="#FBBC05"/>
      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.47.89 11.43 0 9 0A9 9 0 00.96 5.06l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

// ─── Circular AI confidence ───────────────────────────────────────────────────

function CircularConfidence({ value }: { value: number }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - value / 100)
  return (
    <div className="relative w-[52px] h-[52px]">
      <svg width="52" height="52" viewBox="0 0 52 52" className="absolute inset-0">
        <circle cx="26" cy="26" r={r} fill="none" stroke="#F4F0EC" strokeWidth="4" />
        <circle
          cx="26" cy="26" r={r} fill="none" stroke="#722ED1" strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 26 26)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[12px] font-semibold text-[#722ED1] leading-none"
          style={{ fontFamily: '"Google Sans Flex:Bold", sans-serif' }}
        >
          {value}%
        </span>
      </div>
    </div>
  )
}

// ─── Cost breakdown row ───────────────────────────────────────────────────────

function CostRow({ label, amount, pct }: { label: string; amount: string; pct: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-[84px] shrink-0 text-[8px] tracking-[0.10em] text-[#9A949D]"
        style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
      >
        {label}
      </div>
      <div className="flex-1 h-[2.5px] bg-[#F4F0EC] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#722ED1] rounded-full"
          style={{ width: `${pct}%`, opacity: 0.5 + pct * 0.008 }}
        />
      </div>
      <div
        className="w-[46px] text-right text-[11px] font-semibold text-[#242326]"
        style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
      >
        {amount}
      </div>
    </div>
  )
}

// ─── Floor plan inside product card ──────────────────────────────────────────

function FloorPlanBG() {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 440 210" fill="none" preserveAspectRatio="xMidYMid meet">
      <g stroke="#722ED1" opacity="0.10">
        <rect x="20" y="14" width="400" height="182" strokeWidth="1.5" />
        <line x1="196" y1="14" x2="196" y2="196" strokeWidth="1.5" />
        <line x1="20" y1="108" x2="196" y2="108" strokeWidth="1" />
        <line x1="196" y1="116" x2="420" y2="116" strokeWidth="1" />
        <line x1="308" y1="14" x2="308" y2="116" strokeWidth="1" />
        <path d="M 20 82 A 28 28 0 0 1 48 54" strokeWidth="0.8" fill="none" />
        <path d="M 196 146 A 22 22 0 0 0 174 168" strokeWidth="0.8" fill="none" />
        <line x1="20" y1="4" x2="420" y2="4" strokeWidth="0.5" />
        <line x1="20" y1="0" x2="20" y2="8" strokeWidth="0.5" />
        <line x1="420" y1="0" x2="420" y2="8" strokeWidth="0.5" />
        <line x1="430" y1="14" x2="430" y2="196" strokeWidth="0.5" />
        <line x1="424" y1="14" x2="436" y2="14" strokeWidth="0.5" />
        <line x1="424" y1="196" x2="436" y2="196" strokeWidth="0.5" />
        <circle cx="20" cy="14" r="1.5" fill="#722ED1" />
        <circle cx="196" cy="14" r="1.5" fill="#722ED1" />
        <circle cx="308" cy="14" r="1.5" fill="#722ED1" />
        <circle cx="420" cy="14" r="1.5" fill="#722ED1" />
        <circle cx="20" cy="108" r="1.5" fill="#722ED1" />
        <circle cx="196" cy="108" r="1.5" fill="#722ED1" />
      </g>
      <text x="108" y="63" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#722ED1" opacity="0.14">LIVING</text>
      <text x="108" y="154" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#722ED1" opacity="0.14">KITCHEN</text>
      <text x="252" y="63" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#722ED1" opacity="0.14">MASTER</text>
      <text x="364" y="63" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#722ED1" opacity="0.14">BEDROOM</text>
      <text x="308" y="158" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#722ED1" opacity="0.14">BATH</text>
      <text x="220" y="3" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#722ED1" opacity="0.14">5600</text>
      <text x="439" y="110" textAnchor="start" fontSize="7" fontFamily="monospace" fill="#722ED1" opacity="0.14" transform="rotate(90 439 110)">3800</text>
    </svg>
  )
}

// ─── Right panel blueprint background ────────────────────────────────────────

function RightBlueprintBG() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 680 900" fill="none" preserveAspectRatio="xMidYMid slice">
        <g stroke="#722ED1" opacity="0.038">
          <rect x="55" y="90" width="255" height="175" strokeWidth="1.5" />
          <rect x="55" y="265" width="255" height="155" strokeWidth="1.5" />
          <rect x="310" y="90" width="200" height="155" strokeWidth="1.5" />
          <rect x="310" y="245" width="200" height="175" strokeWidth="1.5" />
          <rect x="55" y="420" width="455" height="120" strokeWidth="1" />
          <line x1="55" y1="165" x2="310" y2="165" strokeWidth="0.8" />
          <line x1="310" y1="155" x2="510" y2="155" strokeWidth="0.8" />
          <line x1="183" y1="265" x2="183" y2="420" strokeWidth="0.8" />
          <line x1="55" y1="52" x2="510" y2="52" strokeWidth="0.5" />
          <line x1="55" y1="46" x2="55" y2="58" strokeWidth="0.5" />
          <line x1="510" y1="46" x2="510" y2="58" strokeWidth="0.5" />
          <line x1="28" y1="90" x2="28" y2="420" strokeWidth="0.5" />
          <line x1="22" y1="90" x2="34" y2="90" strokeWidth="0.5" />
          <line x1="22" y1="420" x2="34" y2="420" strokeWidth="0.5" />
          {[100, 180, 260, 340, 420].map(y =>
            [75, 183, 310, 410, 510].map(x => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="#722ED1" opacity="0.5" />
            ))
          )}
          <path d="M 55 140 A 32 32 0 0 1 87 108" strokeWidth="0.75" fill="none" />
          <path d="M 310 340 A 24 24 0 0 0 286 364" strokeWidth="0.75" fill="none" />
        </g>
        <text x="283" y="49" textAnchor="middle" fontSize="10" fontFamily="monospace" fill="#722ED1" opacity="0.08">3800</text>
        <text x="26" y="263" textAnchor="middle" fontSize="10" fontFamily="monospace" fill="#722ED1" opacity="0.08" transform="rotate(-90 26 263)">5600</text>
        <text x="183" y="178" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#722ED1" opacity="0.10">LIVING</text>
        <text x="183" y="340" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#722ED1" opacity="0.10">KITCHEN</text>
        <text x="410" y="178" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#722ED1" opacity="0.10">MASTER</text>
        <text x="410" y="336" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#722ED1" opacity="0.10">BATH</text>
        <text x="55" y="88" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#722ED1" opacity="0.08">A1</text>
        <text x="310" y="88" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#722ED1" opacity="0.08">B1</text>
        <text x="510" y="88" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#722ED1" opacity="0.08">C1</text>
      </svg>
    </div>
  )
}

// ─── Metadata labels (right panel) ───────────────────────────────────────────

function MetadataLabels() {
  const items = [
    { key: 'PROJECT ID', val: 'HZF-1024', highlight: false },
    { key: 'AREA', val: '2,400 SQ FT', highlight: false },
    { key: 'TYPE', val: 'G+1', highlight: false },
    { key: 'STATUS', val: '● READY', highlight: true },
  ]
  return (
    <div className="absolute right-5 xl:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-20">
      {items.map(({ key, val, highlight }) => (
        <div key={key} className="flex flex-col gap-0.5">
          <div
            className="text-[7.5px] tracking-[0.14em] text-[#C0BAB5] uppercase"
            style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
          >
            {key}
          </div>
          <div
            className={`text-[9px] tracking-[0.08em] ${highlight ? 'text-[#722ED1]' : 'text-[#9A949D]'}`}
            style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
          >
            {val}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Product card ─────────────────────────────────────────────────────────────

function ProductCard() {
  const costs = [
    { label: 'MATERIALS', amount: '₹18.2L', pct: 56 },
    { label: 'LABOUR', amount: '₹8.4L', pct: 26 },
    { label: 'FINISHING', amount: '₹4.1L', pct: 13 },
    { label: 'CONTINGENCY', amount: '₹1.7L', pct: 5 },
  ]
  return (
    <div
      className="bg-white border border-[#E8E2DD] rounded-[24px] overflow-hidden"
      style={{
        width: 'clamp(320px, 50vw, 520px)',
        boxShadow: '0 8px 40px rgba(36,35,38,0.10)',
        animation: 'loginCardFloat 3.5s ease-in-out 0.8s infinite alternate',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F4F0EC]">
        <div className="flex items-center gap-2.5">
          <HIcon size={32} />
          <div>
            <div
              className="text-[14px] font-semibold text-[#242326] tracking-[-0.01em]"
              style={{ fontFamily: '"Google Sans Flex:Bold", sans-serif' }}
            >
              HOZIE
            </div>
            <div
              className="text-[8px] tracking-[0.1em] uppercase text-[#722ED1] mt-0.5"
              style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
            >
              AI Construction Advisor
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="size-[7px] rounded-full bg-[#722ED1]"
            style={{ animation: 'hozieStatusPulse 2.2s ease-in-out infinite' }}
          />
          <span
            className="text-[9px] tracking-[0.08em] text-[#722ED1]"
            style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
          >
            READY
          </span>
        </div>
      </div>

      {/* Project + Estimate */}
      <div className="relative px-5 pt-4 pb-4 border-b border-[#F4F0EC] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <FloorPlanBG />
        </div>
        <div className="relative z-10 flex items-start gap-4">
          <div className="flex-1 flex flex-col gap-3">
            <div>
              <div
                className="text-[8px] tracking-[0.14em] text-[#9A949D] mb-1 uppercase"
                style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
              >
                Your Project
              </div>
              <div
                className="text-[13px] font-semibold text-[#242326]"
                style={{ fontFamily: '"Google Sans Flex:Bold", sans-serif' }}
              >
                3 BHK G+1 HOME
              </div>
              <div
                className="text-[9.5px] text-[#68636D] mt-0.5 tracking-[0.05em]"
                style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
              >
                HYDERABAD  ·  2,400 SQ FT
              </div>
            </div>
            <div>
              <div
                className="text-[8px] tracking-[0.12em] text-[#9A949D] mb-1 uppercase"
                style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
              >
                Estimated Construction Cost
              </div>
              <div
                className="text-[22px] font-semibold text-[#722ED1] tracking-[-0.02em] leading-tight"
                style={{ fontFamily: '"Google Sans Flex:Bold", sans-serif' }}
              >
                ₹29.8L – ₹35.2L
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div
              className="text-[8px] tracking-[0.10em] text-[#9A949D] mb-1 text-center uppercase"
              style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
            >
              AI Confidence
            </div>
            <CircularConfidence value={86} />
          </div>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="px-5 py-3.5 flex flex-col gap-2.5">
        {costs.map(c => <CostRow key={c.label} {...c} />)}
      </div>

      {/* HOZIE AI message */}
      <div className="mx-4 mb-4 bg-[#F3EAFF] rounded-[12px] px-3.5 py-2.5 flex items-center gap-2.5">
        <HIcon size={22} />
        <div>
          <div
            className="text-[8px] tracking-[0.08em] text-[#722ED1] font-semibold"
            style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
          >
            HOZIE
          </div>
          <div
            className="text-[12px] text-[#242326]"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            Your initial estimate is ready.
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginForm({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState(false)

  const isValid = phone.length === 10 && /^[6-9]/.test(phone)
  const showError = touched && phone.length > 0 && !isValid

  const handleContinue = async () => {
    setTouched(true)
    if (!isValid) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 1200))
    setLoading(false)
    onNavigate('otp')
  }

  return (
    <div className="w-full max-w-[400px] flex flex-col gap-6">
      {/* Eyebrow + headline + description */}
      <div className="flex flex-col gap-2.5">
        <div
          className="text-[11px] tracking-[0.12em] uppercase text-[#722ED1] font-semibold"
          style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
        >
          Hello how are you!
        </div>
        <h1
          className="text-[36px] sm:text-[40px] font-semibold text-[#242326] leading-[1.05] tracking-[-0.02em] m-0"
          style={{ fontFamily: '"Google Sans Flex:Bold", sans-serif' }}
        >
          Welcome back.
        </h1>
        <p
          className="text-[15px] text-[#68636D] leading-[1.65] m-0 max-w-[340px]"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          Continue planning your build with Hozie.
        </p>
      </div>

      {/* Form fields */}
      <div className="flex flex-col gap-3.5">
        <label
          className="text-[13px] font-semibold text-[#242326]"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          Mobile number
        </label>

        {/* Phone input row */}
        <div
          className={[
            'flex items-stretch border rounded-[12px] overflow-hidden bg-white transition-all duration-200 h-[52px]',
            showError
              ? 'border-[#DC2626] ring-2 ring-[#DC2626]/10'
              : 'border-[#E3DDD7] focus-within:border-[#722ED1] focus-within:ring-2 focus-within:ring-[#722ED1]/10',
          ].join(' ')}
        >
          {/* Country selector */}
          <div className="flex items-center justify-center gap-1.5 px-3 border-r border-[#E3DDD7] shrink-0 select-none cursor-default">
            <span className="text-[16px] leading-none">🇮🇳</span>
            <span
              className="text-[13px] font-medium text-[#242326]"
              style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
            >
              +91
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 4L5 7L8 4" stroke="#9A949D" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Number input */}
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 10)
              setPhone(v)
            }}
            onBlur={() => setTouched(true)}
            placeholder="98765 43210"
            className="flex-1 px-3 text-[15px] text-[#242326] placeholder:text-[#C0BAB5] bg-transparent outline-none border-none"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          />

          {/* Valid checkmark */}
          {phone.length === 10 && isValid && (
            <div className="flex items-center pr-3 shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="#16A34A" strokeWidth="1.2"/>
                <path d="M5 8L7 10L11 6" stroke="#16A34A" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
        </div>

        {/* Error message */}
        {showError && (
          <div
            className="flex items-center gap-1.5 text-[#DC2626] text-[12px]"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="#DC2626" strokeWidth="1.2"/>
              <line x1="7" y1="4.5" x2="7" y2="7.5" stroke="#DC2626" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="7" cy="9.5" r="0.7" fill="#DC2626"/>
            </svg>
            Please enter a valid 10-digit mobile number.
          </div>
        )}

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={loading}
          className={[
            'h-[52px] w-full rounded-[12px] text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-all duration-200',
            loading ? 'cursor-wait' : 'cursor-pointer hover:brightness-90 active:scale-[0.99]',
            !isValid && !loading ? 'opacity-60' : '',
          ].join(' ')}
          style={{ backgroundColor: '#722ED1', fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          {loading ? (
            <>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="2" strokeOpacity="0.3"/>
                <path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Sending code...
            </>
          ) : (
            'Continue →'
          )}
        </button>

        {/* Helper text */}
        <p
          className="text-[12px] text-[#9A949D] text-center m-0 leading-[1.6]"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          We&apos;ll send a one-time verification code to your mobile number.
        </p>
      </div>

      {/* OR divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#E3DDD7]" />
        <span
          className="text-[10px] text-[#9A949D]"
          style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
        >
          OR
        </span>
        <div className="flex-1 h-px bg-[#E3DDD7]" />
      </div>

      {/* Google button */}
      <button
        className="h-[48px] w-full flex items-center justify-center gap-2.5 bg-white border border-[#E3DDD7] rounded-[12px] text-[14px] font-medium text-[#242326] cursor-pointer transition-all duration-200 hover:border-[#722ED1] hover:bg-[#F3EAFF]"
        style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
      >
        <GoogleIcon />
        Continue with Google
      </button>

      {/* Create account */}
      <p
        className="text-center text-[13px] text-[#68636D] m-0"
        style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
      >
        Don&apos;t have a Houzeify account?{' '}
        <button
          className="text-[#722ED1] font-semibold cursor-pointer bg-transparent border-none p-0 hover:underline"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          Create account →
        </button>
      </p>

      {/* Terms */}
      <p
        className="text-center text-[11px] text-[#9A949D] m-0 leading-[1.65]"
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
  )
}

// ─── Screen 003 — Login ───────────────────────────────────────────────────────

export default function LoginScreen({ onNavigate }: { onNavigate: (screen: string) => void }) {
  return (
    <div
      className="min-h-full flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: '#FBF9F7',
        backgroundImage: [
          'radial-gradient(ellipse 70% 55% at 0% 0%,    rgba(114,46,209,0.08) 0%, transparent 70%)',
          'radial-gradient(ellipse 55% 50% at 100% 100%, rgba(114,46,209,0.07) 0%, transparent 70%)',
          'radial-gradient(ellipse 60% 45% at 100% 0%,  rgba(180,130,255,0.04) 0%, transparent 65%)',
          'radial-gradient(ellipse 50% 55% at 0% 100%,  rgba(180,130,255,0.03) 0%, transparent 65%)',
          'radial-gradient(ellipse 45% 50% at 50% 50%,  rgba(243,234,255,0.35) 0%, transparent 65%)',
        ].join(', '),
      }}
    >
      {/* ── Header ── */}
      <header
        className="h-14 lg:h-[64px] flex items-center justify-between px-5 sm:px-8 lg:px-12 shrink-0 relative z-10 border-b border-[#E3DDD7]/50"
        style={{ animation: 'welcomeFadeDown 0.4s ease-out 0.1s both' }}
      >
        <LogoHorizontal height={28} />
        <PublicBackButton onClick={() => onNavigate('welcome')} />
      </header>

      {/* ── Two-column body ── */}
      <div className="flex-1 flex relative">

        {/* Left panel — login form */}
        <div
          className="flex-[5] flex items-center justify-center px-6 sm:px-10 lg:px-12 py-8 relative z-10"
          style={{ animation: 'welcomeFadeUp 0.5s ease-out 0.15s both' }}
        >
          <LoginForm onNavigate={onNavigate} />
        </div>

        {/* Vertical divider */}
        <div className="hidden lg:block w-px bg-[#E3DDD7]/80 self-stretch" />

        {/* Right panel — product visual */}
        <div
          className="hidden lg:flex flex-[7] relative items-center justify-center overflow-hidden"
          style={{ animation: 'welcomeFadeUp 0.5s ease-out 0.25s both' }}
        >
          <RightBlueprintBG />

          {/* Centered product card */}
          <div className="relative z-10 px-8 xl:px-12 py-8 w-full flex items-center justify-center">
            <ProductCard />
          </div>

          {/* Metadata labels — right side */}
          <MetadataLabels />

          {/* Footer inside right panel */}
          <div className="absolute bottom-5 left-0 right-0 flex justify-center items-center gap-2.5 z-10">
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
      </div>
    </div>
  )
}
