import { useState } from 'react'
import HIcon from '../components/HIcon'
import LogoHorizontal from '../components/LogoHorizontal'

// ─── Sidebar Icons ─────────────────────────────────────────────────────────────

const IcoHome = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9L9 3l7 6"/><path d="M4 8v8h3.5v-4h3v4H14V8"/>
  </svg>
)
const IcoAdvisor = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 1.5L10.6 5.4L14.5 7 10.6 8.6 9 12.5 7.4 8.6 3.5 7l3.9-1.6L9 1.5z"/>
    <path d="M14 12l.9 1.9 1.6.6-1.6.6-.9 1.9-.9-1.9-1.6-.6 1.6-.6.9-1.9z" strokeWidth="1.2"/>
  </svg>
)
const IcoProjects = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 6a1.5 1.5 0 011.5-1.5H7l1.5 2H16a1.5 1.5 0 011.5 1.5V14A1.5 1.5 0 0116 15.5H2A1.5 1.5 0 01.5 14V6z"/>
  </svg>
)
const IcoEstimates = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="2" width="12" height="14" rx="1.5"/>
    <line x1="6" y1="6.5" x2="12" y2="6.5"/><line x1="6" y1="9.5" x2="12" y2="9.5"/><line x1="6" y1="12.5" x2="10" y2="12.5"/>
  </svg>
)
const IcoBOQ = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="3.5" cy="5" r="0.8" fill="currentColor" stroke="none"/>
    <line x1="6.5" y1="5" x2="15" y2="5"/>
    <circle cx="3.5" cy="9" r="0.8" fill="currentColor" stroke="none"/>
    <line x1="6.5" y1="9" x2="15" y2="9"/>
    <circle cx="3.5" cy="13" r="0.8" fill="currentColor" stroke="none"/>
    <line x1="6.5" y1="13" x2="15" y2="13"/>
  </svg>
)
const IcoPlan = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="14" height="14" rx="2"/>
    <line x1="2" y1="7.5" x2="16" y2="7.5"/>
    <line x1="7.5" y1="7.5" x2="7.5" y2="16"/>
  </svg>
)
const IcoCalc = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="2" width="12" height="14" rx="1.5"/>
    <rect x="5.5" y="4.5" width="7" height="2.5" rx="0.5"/>
    <circle cx="6" cy="10" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="9" cy="10" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="10" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="6" cy="13" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="9" cy="13" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="13" r="0.7" fill="currentColor" stroke="none"/>
  </svg>
)
const IcoReports = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="15.5" x2="15" y2="15.5"/>
    <line x1="4" y1="15.5" x2="4" y2="9"/><line x1="7.5" y1="15.5" x2="7.5" y2="5"/>
    <line x1="11" y1="15.5" x2="11" y2="8"/><line x1="14.5" y1="15.5" x2="14.5" y2="3"/>
  </svg>
)
const IcoHelpNav = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="7"/>
    <path d="M6.5 6.5a2.5 2.5 0 015 0c0 2-2.5 2.5-2.5 3.5"/>
    <circle cx="9" cy="14" r="0.6" fill="currentColor" stroke="none"/>
  </svg>
)
const IcoSettings = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="2.5"/>
    <path d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M4.1 4.1l1.06 1.06M12.84 12.84l1.06 1.06M4.1 13.9l1.06-1.06M12.84 5.16l1.06-1.06"/>
  </svg>
)
const IcoLocation = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 1.5C5.51 1.5 3.5 3.51 3.5 6c0 3.5 4.5 8.5 4.5 8.5S12.5 9.5 12.5 6c0-2.49-2.01-4.5-4.5-4.5z"/>
    <circle cx="8" cy="6" r="1.5"/>
  </svg>
)

// ─── Stage card icons ─────────────────────────────────────────────────────────

const IcoLightbulb = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2a6 6 0 016 6c0 2.5-1.5 4.5-3.5 5.5v1a.5.5 0 01-.5.5h-4a.5.5 0 01-.5-.5v-1C5.5 12.5 4 10.5 4 8a6 6 0 016-6z"/>
    <line x1="7.5" y1="17.5" x2="12.5" y2="17.5"/>
  </svg>
)
const IcoBlueprint = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="16" height="16" rx="2"/>
    <line x1="2" y1="8" x2="18" y2="8"/>
    <line x1="8" y1="8" x2="8" y2="18"/>
    <line x1="11" y1="11" x2="15" y2="11"/>
    <line x1="11" y1="14" x2="15" y2="14"/>
  </svg>
)
const IcoCalculatorSm = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="2" width="14" height="16" rx="2"/>
    <rect x="6" y="5" width="8" height="3" rx="0.5"/>
    <circle cx="7" cy="11.5" r="0.8" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="11.5" r="0.8" fill="currentColor" stroke="none"/>
    <circle cx="13" cy="11.5" r="0.8" fill="currentColor" stroke="none"/>
    <circle cx="7" cy="15" r="0.8" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="15" r="0.8" fill="currentColor" stroke="none"/>
    <circle cx="13" cy="15" r="0.8" fill="currentColor" stroke="none"/>
  </svg>
)
const IcoHardHat = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 13h14"/>
    <path d="M5 13V9a5 5 0 0110 0v4"/>
    <line x1="10" y1="4" x2="10" y2="7"/>
    <path d="M2 13a1 1 0 001 1h14a1 1 0 001-1"/>
    <line x1="1.5" y1="16" x2="18.5" y2="16"/>
  </svg>
)

// ─── Property type options ────────────────────────────────────────────────────

const propertyTypes = ['House', 'Villa', 'Farmhouse', 'Apartment', 'Other']

const propertyBadge: Record<string, string> = {
  House: 'HOME',
  Villa: 'VILLA',
  Farmhouse: 'FARM',
  Apartment: 'FLAT',
  Other: 'OTHER',
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function NavItem({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={[
        'w-full flex items-center border-0 cursor-pointer rounded-[12px] transition-all duration-150 outline-none',
        'md:justify-center md:w-[40px] md:h-[40px] md:mx-auto md:p-0',
        'lg:justify-start lg:w-full lg:h-auto lg:mx-0 lg:px-3 lg:py-[9px] lg:gap-3',
        active
          ? 'bg-[#F3EAFF] text-[#722ED1]'
          : 'bg-transparent text-[#68636D] hover:bg-[#F4F0EC] hover:text-[#242326]',
      ].join(' ')}
    >
      <span className="shrink-0 w-[18px] h-[18px] flex items-center justify-center">{icon}</span>
      <span className="hidden lg:block text-[13px] leading-none" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>{label}</span>
    </button>
  )
}

function Sidebar({ onNavigate }: { onNavigate: (s: string) => void }) {
  const navMain = [
    { id: 'home', icon: <IcoHome />, label: 'Home', dest: 'dashboard-home' },
    { id: 'advisor', icon: <IcoAdvisor />, label: 'AI Advisor', dest: 'ai-advisor' },
    { id: 'projects', icon: <IcoProjects />, label: 'Projects', dest: '' },
    { id: 'estimates', icon: <IcoEstimates />, label: 'Estimates', dest: '' },
    { id: 'boq', icon: <IcoBOQ />, label: 'BOQ', dest: '' },
    { id: 'plan', icon: <IcoPlan />, label: 'Plan Analysis', dest: '' },
  ]
  const navTools = [
    { id: 'calc', icon: <IcoCalc />, label: 'Material Calculator', dest: '' },
    { id: 'reports', icon: <IcoReports />, label: 'Reports', dest: '' },
  ]
  const navBottom = [
    { id: 'help', icon: <IcoHelpNav />, label: 'Help', dest: '' },
    { id: 'settings', icon: <IcoSettings />, label: 'Settings', dest: '' },
  ]
  return (
    <aside className="hidden md:flex flex-col shrink-0 bg-white" style={{ borderRight: '1px solid #E3DDD7' }}>
      <div className="flex flex-col h-full md:w-[72px] lg:w-[240px]">
        <div className="h-[64px] shrink-0 flex items-center border-b border-[#E3DDD7] md:justify-center lg:justify-start lg:px-5">
          <LogoHorizontal height={22} className="hidden lg:block" />
          <div className="flex lg:hidden"><HIcon size={28} /></div>
        </div>
        <nav className="flex-1 overflow-y-auto md:p-2 lg:p-3 flex flex-col gap-0.5">
          {navMain.map(item => (
            <NavItem key={item.id} icon={item.icon} label={item.label} active={item.id === 'projects'} onClick={() => item.dest && onNavigate(item.dest)} />
          ))}
          <div className="my-3 border-t border-[#E3DDD7]" />
          <p className="hidden lg:block text-[10px] tracking-[0.08em] uppercase text-[#9A949D] px-3 mb-1.5" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>Tools</p>
          {navTools.map(item => (
            <NavItem key={item.id} icon={item.icon} label={item.label} />
          ))}
        </nav>
        <div className="shrink-0 border-t border-[#E3DDD7] md:p-2 lg:p-3 flex flex-col gap-0.5">
          {navBottom.map(item => (
            <NavItem key={item.id} icon={item.icon} label={item.label} />
          ))}
        </div>
      </div>
    </aside>
  )
}

// ─── Ambient Background ───────────────────────────────────────────────────────

function AmbientBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
      <div className="absolute rounded-full" style={{ top: -80, right: -200, width: 580, height: 580, backgroundColor: 'rgba(114,46,209,0.05)', filter: 'blur(130px)' }} />
      <div className="absolute rounded-full" style={{ bottom: -150, left: -100, width: 500, height: 500, backgroundColor: 'rgba(243,234,255,0.60)', filter: 'blur(120px)' }} />
      <div className="absolute rounded-full" style={{ top: '60%', right: '10%', width: 340, height: 340, backgroundColor: 'rgba(243,234,255,0.45)', filter: 'blur(90px)' }} />
    </div>
  )
}

// ─── Progress Steps ───────────────────────────────────────────────────────────

function ProgressSteps({ current }: { current: number }) {
  const steps = [
    { n: '01', label: 'PROJECT' },
    { n: '02', label: 'DETAILS' },
    { n: '03', label: 'ESTIMATE' },
  ]
  return (
    <div className="flex items-center gap-0 w-full max-w-[420px]">
      {steps.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={step.n} className="flex items-center" style={{ flex: i < steps.length - 1 ? undefined : undefined }}>
            <div className="flex flex-col items-center gap-1.5">
              {/* Dot + number */}
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0"
                  style={{
                    fontFamily: '"Sometype Mono:SemiBold", monospace',
                    backgroundColor: active || done ? '#722ED1' : '#E3DDD7',
                    color: active || done ? 'white' : '#9A949D',
                  }}
                >
                  {done ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : step.n}
                </div>
                <span
                  className="text-[10px] tracking-[0.08em] leading-none"
                  style={{
                    fontFamily: '"Sometype Mono:SemiBold", monospace',
                    color: active ? '#722ED1' : done ? '#722ED1' : '#9A949D',
                  }}
                >
                  {step.label}
                </span>
              </div>
            </div>
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="h-px mx-3 flex-1" style={{ width: 48, backgroundColor: done ? '#722ED1' : '#E3DDD7' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Stage Card ───────────────────────────────────────────────────────────────

interface StageOption {
  id: string
  icon: React.ReactNode
  title: string
  desc: string
}

const stages: StageOption[] = [
  { id: 'planning', icon: <IcoLightbulb />, title: 'Planning', desc: 'Just exploring ideas.' },
  { id: 'have-plan', icon: <IcoBlueprint />, title: 'Have a plan', desc: 'I already have drawings.' },
  { id: 'ready-estimate', icon: <IcoCalculatorSm />, title: 'Ready to estimate', desc: 'I know the basic requirements.' },
  { id: 'ready-build', icon: <IcoHardHat />, title: 'Ready to build', desc: 'Looking for contractors soon.' },
]

function StageCard({ stage, selected, onSelect }: { stage: StageOption; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={[
        'relative flex flex-col gap-2 p-4 rounded-[12px] text-left cursor-pointer transition-all duration-150 border outline-none',
        selected
          ? 'bg-[#F3EAFF] border-[#722ED1] border-2'
          : 'bg-white border-[#E3DDD7] hover:bg-[#F3EAFF] hover:border-[#722ED1]',
      ].join(' ')}
    >
      {/* Selected check */}
      {selected && (
        <div
          className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#722ED1] flex items-center justify-center"
          style={{ animation: 'successBadgePop 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      <span className={selected ? 'text-[#722ED1]' : 'text-[#9A949D]'}>{stage.icon}</span>
      <div className="flex flex-col gap-0.5">
        <span
          className={`text-[13px] font-semibold leading-tight ${selected ? 'text-[#722ED1]' : 'text-[#242326]'}`}
          style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
        >
          {stage.title}
        </span>
        <span
          className="text-[12px] text-[#68636D] leading-[1.5]"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          {stage.desc}
        </span>
      </div>
    </button>
  )
}

// ─── Form Input ───────────────────────────────────────────────────────────────

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[11px] tracking-[0.06em] uppercase text-[#9A949D]"
      style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
    >
      {children}
    </span>
  )
}

// ─── Mobile top bar ───────────────────────────────────────────────────────────

function MobileTopBar({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex md:hidden h-14 items-center justify-between px-4 bg-white border-b border-[#E3DDD7] shrink-0 z-10">
      <div className="flex items-center gap-2.5">
        <HIcon size={26} />
        <span className="text-[15px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
          Create project
        </span>
      </div>
      <button onClick={onCancel} className="text-[13px] text-[#68636D] border-0 bg-transparent cursor-pointer" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
        Cancel
      </button>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CreateProjectScreen({
  onNavigate,
  initialPropertyType = 'House',
  initialLocation = 'Hyderabad, Telangana',
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  initialPropertyType?: string
  initialLocation?: string
}) {
  const [projectName, setProjectName] = useState('')
  const [propertyType, setPropertyType] = useState(initialPropertyType)
  const [location, setLocation] = useState(initialLocation)
  const [stage, setStage] = useState<string | null>(null)
  const [changingType, setChangingType] = useState(false)
  const [editingLocation, setEditingLocation] = useState(false)

  const canContinue = projectName.trim().length > 0 && stage !== null

  const handleContinue = () => {
    if (!canContinue) return
    onNavigate('estimate-loading', {
      project_name: projectName.trim(),
      property_type: propertyType,
      location,
      project_stage: stage!,
      user_role: 'homeowner',
    })
  }

  return (
    <div className="flex flex-col" style={{ height: '100%', backgroundColor: '#FBF9F7' }}>
      <AmbientBg />

      {/* Mobile bar */}
      <MobileTopBar onCancel={() => onNavigate('ai-advisor')} />

      {/* Body */}
      <div className="flex flex-1 min-h-0 relative z-10">
        <Sidebar onNavigate={onNavigate} />

        {/* Main */}
        <div className="flex flex-col flex-1 min-h-0">

          {/* Desktop Header */}
          <header className="hidden md:flex h-[64px] shrink-0 items-center justify-between px-6 lg:px-10 bg-white border-b border-[#E3DDD7]">
            <h1
              className="text-[20px] font-semibold text-[#242326] m-0"
              style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
            >
              Create project
            </h1>
            <button
              onClick={() => onNavigate('ai-advisor')}
              className="text-[13px] text-[#68636D] hover:text-[#242326] transition-colors cursor-pointer border-0 bg-transparent"
              style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
            >
              Cancel
            </button>
          </header>

          {/* Progress bar strip */}
          <div className="hidden md:block h-[2px] bg-[#E3DDD7] w-full shrink-0">
            <div className="h-full bg-[#722ED1] transition-all duration-500" style={{ width: '33%' }} />
          </div>

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="max-w-[900px] mx-auto px-5 sm:px-8 lg:px-10 pt-8 pb-12 flex flex-col gap-8">

              {/* Progress steps — desktop */}
              <div className="hidden md:flex items-center justify-between">
                <ProgressSteps current={0} />
              </div>

              {/* Intro */}
              <div
                className="flex flex-col gap-3"
                style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.05s both' }}
              >
                <span
                  className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]"
                  style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
                >
                  New Construction Project
                </span>
                <h2
                  className="text-[30px] sm:text-[40px] font-semibold text-[#242326] m-0 leading-[1.08]"
                  style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
                >
                  Let&apos;s create your project.
                </h2>
                <p
                  className="text-[14px] sm:text-[15px] text-[#68636D] leading-[1.65] m-0"
                  style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                >
                  Hozie will use these details to build your construction estimate.
                </p>
              </div>

              {/* Form card */}
              <div
                className="bg-white rounded-[20px] border border-[#E3DDD7] p-6 sm:p-8 flex flex-col gap-6"
                style={{ boxShadow: '0 2px 20px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.03)', animation: 'welcomeFadeUp 0.45s ease-out 0.12s both' }}
              >
                {/* Field 1: Project name */}
                <div className="flex flex-col gap-2">
                  <FormLabel>Project name</FormLabel>
                  <input
                    type="text"
                    placeholder="My New Home"
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    className="w-full h-[52px] px-4 rounded-[12px] border border-[#E3DDD7] bg-white text-[15px] text-[#242326] outline-none transition-all placeholder-[#C4BFC8]"
                    style={{
                      fontFamily: '"Open Sans:Regular", sans-serif',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#722ED1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(114,46,209,0.08)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E3DDD7'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  <span className="text-[12px] text-[#9A949D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                    Give your project a name you&apos;ll recognize later.
                  </span>
                </div>

                {/* Divider */}
                <div className="border-t border-[#F4F0EC]" />

                {/* Field 2: Property type */}
                <div className="flex flex-col gap-2">
                  <FormLabel>What are you building?</FormLabel>
                  <div className="flex items-center justify-between px-4 h-[52px] rounded-[12px] border border-[#E3DDD7] bg-[#FBF9F7]">
                    <div className="flex items-center gap-3">
                      <span className="text-[15px] text-[#242326]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                        {propertyType}
                      </span>
                      <span
                        className="text-[9px] tracking-[0.10em] px-2 py-0.5 rounded-full bg-[#F3EAFF] text-[#722ED1]"
                        style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
                      >
                        {propertyBadge[propertyType] ?? 'HOME'}
                      </span>
                    </div>
                    <button
                      onClick={() => setChangingType(v => !v)}
                      className="text-[13px] text-[#722ED1] hover:underline cursor-pointer border-0 bg-transparent"
                      style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                    >
                      {changingType ? 'Done' : 'Change'}
                    </button>
                  </div>
                  {/* Inline type picker */}
                  {changingType && (
                    <div className="flex flex-wrap gap-2 pt-1" style={{ animation: 'welcomeFadeUp 0.2s ease-out both' }}>
                      {propertyTypes.map(pt => (
                        <button
                          key={pt}
                          onClick={() => { setPropertyType(pt); setChangingType(false) }}
                          className={[
                            'h-8 px-3 rounded-full border text-[12px] cursor-pointer transition-all',
                            propertyType === pt
                              ? 'bg-[#722ED1] border-[#722ED1] text-white'
                              : 'bg-white border-[#E3DDD7] text-[#68636D] hover:border-[#722ED1] hover:text-[#722ED1]',
                          ].join(' ')}
                          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                        >
                          {pt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-[#F4F0EC]" />

                {/* Field 3: Location */}
                <div className="flex flex-col gap-2">
                  <FormLabel>Where are you building?</FormLabel>
                  {editingLocation ? (
                    <div
                      className="flex items-center gap-3 px-4 h-[52px] rounded-[12px] border border-[#722ED1] bg-white"
                      style={{ boxShadow: '0 0 0 3px rgba(114,46,209,0.08)' }}
                    >
                      <span className="text-[#9A949D] shrink-0"><IcoLocation /></span>
                      <input
                        autoFocus
                        type="text"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        onBlur={() => setEditingLocation(false)}
                        onKeyDown={e => { if (e.key === 'Enter') setEditingLocation(false) }}
                        className="flex-1 bg-transparent outline-none text-[15px] text-[#242326]"
                        style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-4 h-[52px] rounded-[12px] border border-[#E3DDD7] bg-[#FBF9F7]">
                      <div className="flex items-center gap-3">
                        <span className="text-[#9A949D] shrink-0"><IcoLocation /></span>
                        <span className="text-[15px] text-[#242326]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                          {location}
                        </span>
                      </div>
                      <button
                        onClick={() => setEditingLocation(true)}
                        className="text-[13px] text-[#722ED1] hover:underline cursor-pointer border-0 bg-transparent"
                        style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-[#F4F0EC]" />

                {/* Field 4: Stage */}
                <div className="flex flex-col gap-3">
                  <FormLabel>What stage are you at?</FormLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {stages.map(s => (
                      <StageCard
                        key={s.id}
                        stage={s}
                        selected={stage === s.id}
                        onSelect={() => setStage(s.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Hozie Tip */}
              <div
                className="flex items-start gap-3 px-5 py-4 rounded-[12px]"
                style={{ backgroundColor: '#F3EAFF', animation: 'welcomeFadeUp 0.4s ease-out 0.22s both' }}
              >
                <div className="shrink-0 w-8 h-8 rounded-[10px] bg-white flex items-center justify-center">
                  <HIcon size={20} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] tracking-[0.08em] text-[#722ED1] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
                    Hozie Tip
                  </span>
                  <p className="text-[13px] text-[#242326] leading-[1.6] m-0" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                    You don&apos;t need everything ready. We can start with what you know and fill in the details later.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div
                className="flex flex-col items-start sm:flex-row sm:items-center gap-4"
                style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.3s both' }}
              >
                <button
                  onClick={handleContinue}
                  disabled={!canContinue}
                  className={[
                    'h-[52px] px-6 rounded-[12px] text-[14px] font-semibold transition-all duration-150 border-0 w-full sm:w-auto sm:min-w-[240px]',
                    canContinue
                      ? 'bg-[#722ED1] text-white cursor-pointer hover:brightness-90 active:scale-[0.99]'
                      : 'bg-[#E3DDD7] text-[#9A949D] cursor-not-allowed',
                  ].join(' ')}
                  style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                >
                  Continue to project details →
                </button>

                <button
                  onClick={() => onNavigate('ai-advisor')}
                  className="text-[13px] text-[#68636D] hover:text-[#242326] transition-colors cursor-pointer border-0 bg-transparent"
                  style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                >
                  ← Back to Hozie
                </button>
              </div>

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
