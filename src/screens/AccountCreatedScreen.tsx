import HIcon from '../components/HIcon'

// ─── Ambient background ───────────────────────────────────────────────────────

function AmbientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Top-right purple */}
      <div
        className="absolute rounded-full"
        style={{
          top: '-200px', right: '-200px',
          width: 680, height: 680,
          backgroundColor: 'rgba(114,46,209,0.06)',
          filter: 'blur(110px)',
        }}
      />
      {/* Bottom-left lavender */}
      <div
        className="absolute rounded-full"
        style={{
          bottom: '-240px', left: '-200px',
          width: 760, height: 760,
          backgroundColor: 'rgba(243,234,255,0.65)',
          filter: 'blur(130px)',
        }}
      />
      {/* Behind icon — warm lavender halo */}
      <div
        className="absolute rounded-full"
        style={{
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 560, height: 560,
          backgroundColor: 'rgba(243,234,255,0.50)',
          filter: 'blur(80px)',
        }}
      />
      {/* Far right subtle */}
      <div
        className="absolute rounded-full"
        style={{
          top: '15%', right: '-220px',
          width: 500, height: 500,
          backgroundColor: 'rgba(114,46,209,0.04)',
          filter: 'blur(100px)',
        }}
      />
    </div>
  )
}

// ─── Success badge ────────────────────────────────────────────────────────────

function SuccessBadge() {
  return (
    <div
      className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-[2.5px] border-white"
      style={{
        width: 26,
        height: 26,
        backgroundColor: '#16A34A',
        animation: 'successBadgePop 0.38s cubic-bezier(0.34,1.56,0.64,1) 0.60s both',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path
          d="M2.2 5.5L4.4 7.7L8.8 3.3"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

// ─── H icon with glow ─────────────────────────────────────────────────────────

function IconWithGlow({ size }: { size: number }) {
  return (
    <div
      className="relative"
      style={{ animation: 'successIconReveal 0.4s ease-out 0.28s both' }}
    >
      {/* Soft lavender glow */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: '-70%',
          background: 'radial-gradient(circle at center, rgba(243,234,255,1) 0%, transparent 68%)',
          filter: 'blur(12px)',
        }}
      />
      <HIcon size={size} shadow />
      <SuccessBadge />
    </div>
  )
}

// ─── Screen 006 — Account Created ────────────────────────────────────────────

export default function AccountCreatedScreen({
  onNavigate,
}: {
  onNavigate: (screen: string) => void
}) {
  return (
    <div
      className="min-h-full flex flex-col items-center justify-between relative px-5 py-10"
      style={{ backgroundColor: '#FBF9F7' }}
    >
      <AmbientBackground />

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Central success group ── */}
      <div className="relative z-10 flex flex-col items-center gap-5 sm:gap-6 text-center max-w-[440px] w-full">

        {/* H icon with glow + badge */}
        <div className="mb-2">
          <IconWithGlow size={72} />
        </div>

        {/* Eyebrow */}
        <div
          className="text-[11px] tracking-[0.12em] uppercase text-[#722ED1] font-semibold"
          style={{
            fontFamily: '"Sometype Mono:SemiBold", monospace',
            animation: 'welcomeFadeUp 0.4s ease-out 0.42s both',
          }}
        >
          Account Created
        </div>

        {/* Headline */}
        <h1
          className="text-[34px] sm:text-[48px] font-semibold text-[#242326] leading-[1.04] tracking-[-0.025em] m-0"
          style={{
            fontFamily: '"Google Sans Flex:Bold", sans-serif',
            animation: 'welcomeFadeUp 0.4s ease-out 0.50s both',
          }}
        >
          You&apos;re all set.
        </h1>

        {/* Description */}
        <p
          className="text-[15px] sm:text-[16px] text-[#68636D] leading-[1.7] m-0 max-w-[320px]"
          style={{
            fontFamily: '"Open Sans:Regular", sans-serif',
            animation: 'welcomeFadeUp 0.4s ease-out 0.56s both',
          }}
        >
          Your Houzeify workspace is ready.<br />
          Let&apos;s set up your experience.
        </p>

        {/* Success status pill */}
        <div
          className="flex items-center gap-2"
          style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.62s both' }}
        >
          <div
            className="flex items-center justify-center size-[18px] rounded-full shrink-0"
            style={{ backgroundColor: 'rgba(22,163,74,0.12)' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4 7L8 3" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span
            className="text-[13px] font-medium text-[#722ED1]"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            Account created successfully
          </span>
        </div>

        {/* CTA button */}
        <div
          className="flex flex-col items-center gap-3 w-full"
          style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.70s both' }}
        >
          <button
            onClick={() => onNavigate('role')}
            className="h-[52px] bg-[#722ED1] text-white text-[14px] font-semibold rounded-[12px] cursor-pointer transition-all duration-200 hover:brightness-90 active:scale-[0.99] flex items-center justify-center w-full sm:w-[260px]"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            Set up my workspace →
          </button>

          <button
            onClick={() => onNavigate('role')}
            className="text-[13px] text-[#9A949D] bg-transparent border-none cursor-pointer hover:text-[#68636D] transition-colors duration-200"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            Do this later
          </button>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Footer signature ── */}
      <div
        className="relative z-10 flex items-center justify-center gap-2.5"
        style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.80s both' }}
      >
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
