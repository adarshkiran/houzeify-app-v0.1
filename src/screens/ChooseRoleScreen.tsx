import { useState } from 'react'
import LogoHorizontal from '../components/LogoHorizontal'
import PublicBackButton from '../components/PublicBackButton'

// ─── Ambient background ───────────────────────────────────────────────────────

function AmbientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute rounded-full" style={{ top: '-180px', right: '-180px', width: 640, height: 640, backgroundColor: 'rgba(114,46,209,0.055)', filter: 'blur(110px)' }} />
      <div className="absolute rounded-full" style={{ bottom: '-220px', left: '-180px', width: 720, height: 720, backgroundColor: 'rgba(243,234,255,0.60)', filter: 'blur(130px)' }} />
      <div className="absolute rounded-full" style={{ top: '40%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, height: 500, backgroundColor: 'rgba(243,234,255,0.30)', filter: 'blur(90px)' }} />
      <div className="absolute rounded-full" style={{ top: '10%', right: '-200px', width: 480, height: 480, backgroundColor: 'rgba(114,46,209,0.035)', filter: 'blur(100px)' }} />
    </div>
  )
}

// ─── Role icons ───────────────────────────────────────────────────────────────

const HomeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 14L14 5L25 14"/>
    <path d="M6 12V23H22V12"/>
    <rect x="11" y="16" width="6" height="7"/>
  </svg>
)

const WrenchIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 4C22 4 24.5 4.5 25 7C25.5 9.5 23.5 11.5 21 12L16 17L11 12L16 7C16 7 18 4 22 4Z"/>
    <line x1="11" y1="12" x2="4" y2="25"/>
    <circle cx="5.5" cy="23.5" r="2"/>
  </svg>
)

const CompassIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="14" cy="9" r="3.5"/>
    <path d="M14 12.5L9 26M14 12.5L19 26"/>
    <line x1="10.5" y1="22" x2="17.5" y2="22"/>
    <line x1="14" y1="2" x2="14" y2="5.5"/>
  </svg>
)

const BrushIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 3L25 10L12 22.5C10.5 24 8 24.5 6.5 23C5 21.5 5.5 19 7 17.5L18 3Z"/>
    <circle cx="6.5" cy="22.5" r="2.5"/>
    <line x1="15" y1="6" x2="22" y2="13"/>
  </svg>
)

const BoxIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4L24 9.5V18.5L14 24L4 18.5V9.5L14 4Z"/>
    <line x1="14" y1="4" x2="14" y2="24"/>
    <line x1="4" y1="9.5" x2="24" y2="9.5"/>
    <line x1="4" y1="14" x2="14" y2="18.5"/>
    <line x1="24" y1="14" x2="14" y2="18.5"/>
  </svg>
)

const HardHatIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 19C5 13.5 8.5 9 14 9C19.5 9 23 13.5 23 19"/>
    <path d="M11.5 9.5V6H16.5V9.5"/>
    <path d="M3 19H25V22H3Z"/>
    <line x1="14" y1="6" x2="14" y2="19"/>
  </svg>
)

// ─── Role data ────────────────────────────────────────────────────────────────

interface Role {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  destination: string
}

const roles: Role[] = [
  { id: 'homeowner', title: 'Homeowner', description: 'Planning or building your own home.', icon: <HomeIcon />, destination: 'onboarding-homeowner' },
  { id: 'contractor', title: 'Contractor / Builder', description: 'Build and manage construction projects.', icon: <WrenchIcon />, destination: 'onboarding-business' },
  { id: 'architect', title: 'Architect / Engineer', description: 'Design, plan and advise on projects.', icon: <CompassIcon />, destination: 'onboarding-professional' },
  { id: 'interior', title: 'Interior Designer', description: 'Create and manage interior projects.', icon: <BrushIcon />, destination: 'onboarding-professional' },
  { id: 'supplier', title: 'Material Supplier', description: 'Supply construction materials and products.', icon: <BoxIcon />, destination: 'onboarding-supplier' },
  { id: 'worker', title: 'Site Worker', description: 'See your tasks and send daily updates from site.', icon: <HardHatIcon />, destination: 'onboarding-worker' },
]

// ─── Role card ────────────────────────────────────────────────────────────────

interface RoleCardProps {
  role: Role
  selected: boolean
  onSelect: (id: string) => void
}

function RoleCard({ role, selected, onSelect }: RoleCardProps) {
  return (
    <button
      onClick={() => onSelect(role.id)}
      className={[
        'relative w-full text-left flex flex-col gap-2.5 sm:gap-3 rounded-[18px] transition-all duration-200 outline-none cursor-pointer',
        'p-5 sm:p-6 min-h-[110px] sm:min-h-[150px]',
        selected
          ? 'bg-[#F3EAFF] border-2 border-[#722ED1]'
          : 'bg-white border border-[#E3DDD7] hover:bg-[#F3EAFF] hover:border-[#722ED1] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(114,46,209,0.08)]',
      ].join(' ')}
      style={{ animation: 'welcomeFadeUp 0.4s ease-out both' }}
    >
      {/* Icon */}
      <div className={selected ? 'text-[#722ED1]' : 'text-[#9A949D]'}>
        {role.icon}
      </div>

      {/* Title */}
      <div
        className={`text-[14px] sm:text-[15px] font-semibold leading-tight ${selected ? 'text-[#722ED1]' : 'text-[#242326]'}`}
        style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
      >
        {role.title}
      </div>

      {/* Description */}
      <div
        className="text-[12px] sm:text-[13px] text-[#68636D] leading-[1.5]"
        style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
      >
        {role.description}
      </div>

      {/* Selection check badge */}
      {selected && (
        <div
          className="absolute top-3.5 right-3.5 size-[22px] rounded-full bg-[#722ED1] flex items-center justify-center"
          style={{ animation: 'successBadgePop 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 5.5L4.5 8L9 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </button>
  )
}

// ─── Role grid (3 + 3 on desktop) ─────────────────────────────────────────────

interface RoleGridProps {
  selected: string | null
  onSelect: (id: string) => void
}

function RoleGrid({ selected, onSelect }: RoleGridProps) {
  return (
    <>
      {/* Mobile / tablet: responsive flow */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
        {roles.map(role => (
          <RoleCard key={role.id} role={role} selected={selected === role.id} onSelect={onSelect} />
        ))}
      </div>

      {/* Desktop: two rows of 3 */}
      <div className="hidden lg:grid grid-cols-3 gap-4 w-full">
        {roles.map(role => (
          <RoleCard key={role.id} role={role} selected={selected === role.id} onSelect={onSelect} />
        ))}
      </div>
    </>
  )
}

// ─── Screen 007 — Choose Your Role ───────────────────────────────────────────

export default function ChooseRoleScreen({
  onNavigate,
}: {
  onNavigate: (screen: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)

  const handleContinue = () => {
    if (!selected) return
    const role = roles.find(r => r.id === selected)
    if (role) onNavigate(role.destination)
  }

  return (
    <div
      className="min-h-full flex flex-col relative"
      style={{ backgroundColor: '#FBF9F7' }}
    >
      <AmbientBackground />

      {/* ── Header ── */}
      <header
        className="shrink-0 relative z-10"
        style={{ animation: 'welcomeFadeDown 0.4s ease-out 0.05s both' }}
      >
        <div className="flex items-center justify-between h-14 lg:h-[64px] px-5 sm:px-8 lg:px-12">
          <LogoHorizontal height={28} />
          <div className="flex items-center gap-3">
          <PublicBackButton onClick={() => onNavigate('login')} />
          <div
            className="flex items-center gap-2"
            style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
          >
            <span className="max-sm:hidden text-[10px] tracking-[0.08em] text-[#9A949D]">Step 1 of 2</span>
            <div className="flex gap-1">
              <div className="w-5 h-[3px] rounded-full bg-[#722ED1]" />
              <div className="w-5 h-[3px] rounded-full bg-[#E3DDD7]" />
            </div>
          </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-[2px] bg-[#E3DDD7] w-full">
          <div
            className="h-full bg-[#722ED1] transition-all duration-500"
            style={{ width: '50%' }}
          />
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col items-center px-5 sm:px-8 lg:px-12 py-8 lg:py-10 relative z-10 max-w-[1200px] mx-auto w-full">

        {/* Intro */}
        <div
          className="flex flex-col items-center text-center gap-3 mb-8 lg:mb-10"
          style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.15s both' }}
        >
          <div
            className="text-[11px] tracking-[0.10em] uppercase text-[#722ED1] font-semibold"
            style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
          >
            Let&apos;s Personalize Your Experience
          </div>

          <h1
            className="text-[28px] sm:text-[36px] lg:text-[44px] font-semibold text-[#242326] leading-[1.06] tracking-[-0.02em] m-0"
            style={{ fontFamily: '"Google Sans Flex:Bold", sans-serif' }}
          >
            How will you use Houzeify?
          </h1>

          <p
            className="text-[14px] sm:text-[15px] lg:text-[16px] text-[#68636D] leading-[1.7] m-0 max-w-[520px]"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            Choose the option that best describes you.
            We&apos;ll tailor your Houzeify workspace around it.
          </p>
        </div>

        {/* Role grid */}
        <div
          className="w-full mb-8 lg:mb-10"
          style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.25s both' }}
        >
          <RoleGrid selected={selected} onSelect={setSelected} />
        </div>

        {/* Actions */}
        <div
          className="flex flex-col items-center gap-3"
          style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.35s both' }}
        >
          <button
            onClick={handleContinue}
            disabled={!selected}
            className={[
              'h-[52px] text-[14px] font-semibold rounded-[12px] transition-all duration-200 w-full sm:w-[180px]',
              'flex items-center justify-center',
              selected
                ? 'bg-[#722ED1] text-white cursor-pointer hover:brightness-90 active:scale-[0.99]'
                : 'bg-[#E3DDD7] text-[#9A949D] cursor-not-allowed',
            ].join(' ')}
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            Continue →
          </button>

          <p
            className="text-[11px] text-[#9A949D] text-center m-0"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            You can change your role later from your profile.
          </p>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        className="shrink-0 flex justify-center items-center gap-2.5 pb-5 relative z-10"
        style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.45s both' }}
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
              <span className="text-[9px] text-[#722ED1]" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>/</span>
            )}
          </span>
        ))}
      </footer>
    </div>
  )
}
