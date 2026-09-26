import { useState } from 'react'
import LogoHorizontal from '../components/LogoHorizontal'

// ─── Ambient background ───────────────────────────────────────────────────────

function AmbientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute rounded-full" style={{ top: '-160px', right: '-160px', width: 620, height: 620, backgroundColor: 'rgba(114,46,209,0.055)', filter: 'blur(110px)' }} />
      <div className="absolute rounded-full" style={{ bottom: '-200px', left: '-160px', width: 700, height: 700, backgroundColor: 'rgba(243,234,255,0.60)', filter: 'blur(130px)' }} />
      <div className="absolute rounded-full" style={{ top: '45%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, height: 480, backgroundColor: 'rgba(243,234,255,0.28)', filter: 'blur(90px)' }} />
    </div>
  )
}

// ─── Project type icons ───────────────────────────────────────────────────────

const HouseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 13L14 4L25 13"/>
    <path d="M6 11.5V23H22V11.5"/>
    <rect x="11" y="16" width="6" height="7"/>
  </svg>
)

const VillaIcon = () => (
  <svg width="24" height="24" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 15L8 8L14 3L20 8L26 15"/>
    <path d="M5 13V23H23V13"/>
    <line x1="9" y1="13" x2="9" y2="17"/>
    <line x1="19" y1="13" x2="19" y2="17"/>
    <rect x="10" y="17" width="8" height="6"/>
  </svg>
)

const FarmhouseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 15L14 5L27 15"/>
    <path d="M3 14V23H25V14"/>
    <line x1="14" y1="14" x2="14" y2="23"/>
    <rect x="15" y="16" width="5" height="4"/>
    <rect x="7" y="16" width="5" height="7"/>
  </svg>
)

const ApartmentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="4" width="18" height="20"/>
    <line x1="14" y1="4" x2="14" y2="24"/>
    <rect x="7" y="7" width="4" height="3"/>
    <rect x="17" y="7" width="4" height="3"/>
    <rect x="7" y="13" width="4" height="3"/>
    <rect x="17" y="13" width="4" height="3"/>
    <rect x="7" y="19" width="4" height="5"/>
    <rect x="17" y="19" width="4" height="5"/>
  </svg>
)

const OtherIcon = () => (
  <svg width="24" height="24" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="14" cy="14" r="10"/>
    <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none"/>
    <circle cx="14" cy="14" r="1" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="14" r="1" fill="currentColor" stroke="none"/>
  </svg>
)

const LocationPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 14S2 9.6 2 6a6 6 0 1 1 12 0c0 3.6-6 8-6 8Z"/>
    <circle cx="8" cy="6" r="2"/>
  </svg>
)

// ─── Project types ────────────────────────────────────────────────────────────

interface ProjectType {
  id: string
  title: string
  description: string
  icon: React.ReactNode
}

const projectTypes: ProjectType[] = [
  { id: 'house',      title: 'House',      description: 'Build a house',      icon: <HouseIcon /> },
  { id: 'villa',      title: 'Villa',      description: 'Build a villa',      icon: <VillaIcon /> },
  { id: 'farmhouse',  title: 'Farmhouse',  description: 'Build a farmhouse',  icon: <FarmhouseIcon /> },
  { id: 'apartment',  title: 'Apartment',  description: 'Build an apartment', icon: <ApartmentIcon /> },
  { id: 'other',      title: 'Other',      description: 'Something else',     icon: <OtherIcon /> },
]

// ─── Project card ─────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: ProjectType
  selected: boolean
  onSelect: (id: string) => void
}

function ProjectCard({ project, selected, onSelect }: ProjectCardProps) {
  return (
    <button
      onClick={() => onSelect(project.id)}
      className={[
        'relative w-full text-left flex flex-col gap-2 rounded-[16px] transition-all duration-200',
        'outline-none cursor-pointer p-5',
        'min-h-[88px] sm:min-h-[112px]',
        selected
          ? 'bg-[#F3EAFF] border-2 border-[#722ED1]'
          : 'bg-white border border-[#E3DDD7] hover:bg-[#F3EAFF] hover:border-[#722ED1] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(114,46,209,0.08)]',
      ].join(' ')}
    >
      {/* Icon */}
      <div className={selected ? 'text-[#722ED1]' : 'text-[#9A949D]'}>
        {project.icon}
      </div>

      {/* Title */}
      <div
        className={`text-[14px] font-semibold leading-tight ${selected ? 'text-[#722ED1]' : 'text-[#242326]'}`}
        style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
      >
        {project.title}
      </div>

      {/* Description */}
      <div
        className="text-[12px] text-[#9A949D] leading-tight"
        style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
      >
        {project.description}
      </div>

      {/* Selection check */}
      {selected && (
        <div
          className="absolute top-3 right-3 size-[20px] rounded-full bg-[#722ED1] flex items-center justify-center"
          style={{ animation: 'successBadgePop 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.5 7.5L8.5 2.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </button>
  )
}

// ─── Project grid (3 + 2 centered) ───────────────────────────────────────────

interface ProjectGridProps {
  selected: string | null
  onSelect: (id: string) => void
}

function ProjectGrid({ selected, onSelect }: ProjectGridProps) {
  return (
    <>
      {/* Mobile / tablet */}
      <div className="lg:hidden grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
        {projectTypes.map(p => (
          <ProjectCard key={p.id} project={p} selected={selected === p.id} onSelect={onSelect} />
        ))}
      </div>

      {/* Desktop: 3 + 2 centered via 6-col grid */}
      <div className="hidden lg:grid grid-cols-6 gap-4 w-full">
        {projectTypes.slice(0, 3).map(p => (
          <div key={p.id} className="col-span-2">
            <ProjectCard project={p} selected={selected === p.id} onSelect={onSelect} />
          </div>
        ))}
        <div className="col-span-1" aria-hidden="true" />
        {projectTypes.slice(3).map(p => (
          <div key={p.id} className="col-span-2">
            <ProjectCard project={p} selected={selected === p.id} onSelect={onSelect} />
          </div>
        ))}
        <div className="col-span-1" aria-hidden="true" />
      </div>
    </>
  )
}

// ─── Screen 008 — Homeowner Onboarding ───────────────────────────────────────

export default function HomeownerOnboardingScreen({
  onNavigate,
}: {
  onNavigate: (screen: string, data?: Record<string, string>) => void
}) {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [location, setLocation] = useState('')
  const [locationFocused, setLocationFocused] = useState(false)

  const canContinue = !!selectedType && location.trim().length > 1

  const handleContinue = () => {
    if (!canContinue || !selectedType) return
    onNavigate('dashboard-home', {
      property_type: selectedType,
      location: location.trim(),
      user_role: 'homeowner',
    })
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
          <div className="flex items-center gap-2.5">
            <span
              className="text-[10px] tracking-[0.08em] text-[#9A949D]"
              style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
            >
              Step 2 of 2
            </span>
            <div className="flex gap-1">
              <div className="w-5 h-[3px] rounded-full bg-[#722ED1]" />
              <div className="w-5 h-[3px] rounded-full bg-[#722ED1]" />
            </div>
          </div>
        </div>
        {/* Full progress bar */}
        <div className="h-[2px] bg-[#E3DDD7] w-full">
          <div className="h-full bg-[#722ED1] transition-all duration-500 w-full" />
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col items-center px-5 sm:px-8 lg:px-12 py-8 lg:py-10 relative z-10 max-w-[1200px] mx-auto w-full">

        {/* Intro */}
        <div
          className="flex flex-col items-center text-center gap-3 mb-7 lg:mb-8"
          style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.15s both' }}
        >
          <div
            className="text-[11px] tracking-[0.12em] uppercase text-[#722ED1] font-semibold"
            style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
          >
            Let&apos;s Build Your Plan
          </div>

          <h1
            className="text-[28px] sm:text-[36px] lg:text-[44px] font-semibold text-[#242326] leading-[1.06] tracking-[-0.02em] m-0"
            style={{ fontFamily: '"Google Sans Flex:Bold", sans-serif' }}
          >
            What are you planning to build?
          </h1>

          <p
            className="text-[14px] sm:text-[15px] lg:text-[16px] text-[#68636D] leading-[1.7] m-0 max-w-[520px]"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            Tell Hozie what you&apos;re building.
            We&apos;ll use this to personalize your construction workspace.
          </p>
        </div>

        {/* Project type grid */}
        <div
          className="w-full mb-6"
          style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.25s both' }}
        >
          <ProjectGrid selected={selectedType} onSelect={setSelectedType} />
        </div>

        {/* Location input */}
        <div
          className="w-full mb-6 max-w-none lg:max-w-[560px]"
          style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.32s both' }}
        >
          <label
            className="block text-[13px] font-semibold text-[#242326] mb-1.5"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            Where are you building?
          </label>
          <div
            className={[
              'flex items-center border rounded-[12px] bg-white transition-all duration-200 h-[52px] overflow-hidden',
              locationFocused
                ? 'border-[#722ED1] ring-2 ring-[#722ED1]/10'
                : 'border-[#E3DDD7]',
            ].join(' ')}
          >
            <div className="flex items-center pl-3.5 pr-2 shrink-0 text-[#9A949D]">
              <LocationPinIcon />
            </div>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              onFocus={() => setLocationFocused(true)}
              onBlur={() => setLocationFocused(false)}
              placeholder="Hyderabad, Telangana"
              className="flex-1 h-full pr-4 text-[15px] text-[#242326] placeholder:text-[#C0BAB5] bg-transparent outline-none border-none"
              style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
            />
            {location.trim().length > 0 && (
              <button
                onClick={() => setLocation('')}
                className="flex items-center justify-center pr-3.5 shrink-0 text-[#C0BAB5] hover:text-[#9A949D] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M3 3L11 11M11 3L3 11"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex flex-col items-center gap-3"
          style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.38s both' }}
        >
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className={[
              'h-[52px] text-[14px] font-semibold rounded-[12px] transition-all duration-200 w-full sm:w-[180px]',
              'flex items-center justify-center',
              canContinue
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
            You can change these details later.
          </p>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="shrink-0 flex justify-center items-center gap-2.5 pb-5 relative z-10">
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
