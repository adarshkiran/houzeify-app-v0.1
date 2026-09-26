import { useState, useRef } from 'react'
import HIcon from '../components/HIcon'
import LogoHorizontal from '../components/LogoHorizontal'

// ─── Types ────────────────────────────────────────────────────────────────────
type AiState = 'idle' | 'thinking' | 'response'

// ─── Sidebar Icons ─────────────────────────────────────────────────────────────

const IcoHome = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9L9 3l7 6"/>
    <path d="M4 8v8h3.5v-4h3v4H14V8"/>
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
    <line x1="6" y1="6.5" x2="12" y2="6.5"/>
    <line x1="6" y1="9.5" x2="12" y2="9.5"/>
    <line x1="6" y1="12.5" x2="10" y2="12.5"/>
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
    <line x1="4" y1="15.5" x2="4" y2="9"/>
    <line x1="7.5" y1="15.5" x2="7.5" y2="5"/>
    <line x1="11" y1="15.5" x2="11" y2="8"/>
    <line x1="14.5" y1="15.5" x2="14.5" y2="3"/>
  </svg>
)
const IcoHelp = () => (
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
const IcoBell = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2a6 6 0 016 6v2.5l1.5 3h-15L4 10.5V8a6 6 0 016-6z"/>
    <path d="M8 16a2 2 0 004 0"/>
  </svg>
)
const IcoCircleHelp = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="8"/>
    <path d="M7.5 8a2.5 2.5 0 014.5 1.5c0 2-2.5 2.5-2.5 3.5"/>
    <circle cx="10" cy="15.5" r="0.6" fill="currentColor" stroke="none"/>
  </svg>
)
const IcoSend = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M14 2L2 7.5l5 1.5L9.5 14 14 2z" fill="white"/>
    <path d="M7 9l4-7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
const IcoFolderPlus = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 4.5a1 1 0 011-1h2.5L5.5 4.5H12a1 1 0 011 1V10a1 1 0 01-1 1H2a1 1 0 01-1-1V4.5z"/>
    <line x1="7" y1="6.5" x2="7" y2="9"/>
    <line x1="5.5" y1="7.75" x2="8.5" y2="7.75"/>
  </svg>
)
const IcoBarChart = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="13" x2="13" y2="13"/>
    <line x1="3" y1="13" x2="3" y2="7"/>
    <line x1="7" y1="13" x2="7" y2="4"/>
    <line x1="11" y1="13" x2="11" y2="1"/>
  </svg>
)
const IcoLayout = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="12" height="12" rx="1.5"/>
    <line x1="1" y1="5" x2="13" y2="5"/>
    <line x1="5.5" y1="5" x2="5.5" y2="13"/>
  </svg>
)
const IcoUpload = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 9.5v1.5a1 1 0 001 1h7a1 1 0 001-1V9.5"/>
    <line x1="7" y1="2" x2="7" y2="8.5"/>
    <path d="M4.5 4.5L7 2l2.5 2.5"/>
  </svg>
)

// ─── Sidebar Nav Item ─────────────────────────────────────────────────────────

function NavItem({
  icon, label, active, onClick,
}: {
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
      <span className="shrink-0 w-[18px] h-[18px] flex items-center justify-center">
        {icon}
      </span>
      <span
        className="hidden lg:block text-[13px] leading-none"
        style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
      >
        {label}
      </span>
    </button>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ activeNav, onNav, onNavigate }: { activeNav: string; onNav: (id: string) => void; onNavigate: (s: string) => void }) {
  const navMain = [
    { id: 'home', icon: <IcoHome />, label: 'Home', dest: '' },
    { id: 'advisor', icon: <IcoAdvisor />, label: 'AI Advisor', dest: 'ai-advisor' },
    { id: 'projects', icon: <IcoProjects />, label: 'Projects', dest: '' },
    { id: 'estimates', icon: <IcoEstimates />, label: 'Estimates', dest: '' },
    { id: 'boq', icon: <IcoBOQ />, label: 'BOQ', dest: '' },
    { id: 'plan', icon: <IcoPlan />, label: 'Plan Analysis', dest: '' },
  ]
  const navTools = [
    { id: 'calculator', icon: <IcoCalc />, label: 'Material Calculator', dest: '' },
    { id: 'reports', icon: <IcoReports />, label: 'Reports', dest: '' },
  ]
  const navBottom = [
    { id: 'help', icon: <IcoHelp />, label: 'Help', dest: '' },
    { id: 'settings', icon: <IcoSettings />, label: 'Settings', dest: '' },
  ]

  return (
    <aside
      className="hidden md:flex flex-col shrink-0 bg-white z-10"
      style={{ width: undefined, borderRight: '1px solid #E3DDD7' }}
    >
      {/* This wrapper handles the width responsiveness */}
      <div className="flex flex-col h-full md:w-[72px] lg:w-[240px]">
        {/* Logo */}
        <div className="h-[64px] shrink-0 flex items-center border-b border-[#E3DDD7] md:justify-center lg:justify-start lg:px-5">
          <LogoHorizontal height={22} className="hidden lg:block" />
          <div className="flex lg:hidden">
            <HIcon size={28} />
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto md:p-2 lg:p-3 flex flex-col gap-0.5 scrollbar-hide">
          <div className="flex flex-col gap-0.5">
            {navMain.map(item => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeNav === item.id}
                onClick={() => { item.dest ? onNavigate(item.dest) : onNav(item.id) }}
              />
            ))}
          </div>

          {/* Divider + Tools */}
          <div className="my-3 border-t border-[#E3DDD7]" />
          <p className="hidden lg:block text-[10px] tracking-[0.08em] uppercase text-[#9A949D] px-3 mb-1.5" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
            Tools
          </p>
          <div className="flex flex-col gap-0.5">
            {navTools.map(item => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeNav === item.id}
                onClick={() => onNav(item.id)}
              />
            ))}
          </div>
        </nav>

        {/* Bottom */}
        <div className="shrink-0 border-t border-[#E3DDD7] md:p-2 lg:p-3 flex flex-col gap-0.5">
          {navBottom.map(item => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeNav === item.id}
              onClick={() => onNav(item.id)}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

// ─── Mobile Top Bar ────────────────────────────────────────────────────────────

function MobileTopBar() {
  return (
    <div className="flex md:hidden h-14 items-center justify-between px-4 bg-white border-b border-[#E3DDD7] shrink-0 z-10">
      <div className="flex items-center gap-2.5">
        <HIcon size={26} />
        <span className="text-[16px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
          Home
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button className="w-8 h-8 flex items-center justify-center text-[#68636D] hover:text-[#242326] transition-colors">
          <IcoBell />
        </button>
        <div className="w-8 h-8 rounded-full bg-[#722ED1] flex items-center justify-center text-white text-[11px] font-semibold" style={{ fontFamily: '"Google Sans Flex:Bold", sans-serif' }}>
          AK
        </div>
      </div>
    </div>
  )
}

// ─── Top Header ───────────────────────────────────────────────────────────────

function TopHeader() {
  return (
    <header className="hidden md:flex h-[72px] shrink-0 items-center justify-between px-6 lg:px-8 bg-[#FBF9F7] border-b border-[#E3DDD7]">
      <h1
        className="text-[20px] font-semibold text-[#242326] m-0"
        style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
      >
        Home
      </h1>
      <div className="flex items-center gap-2">
        <button className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[#68636D] hover:bg-[#F4F0EC] hover:text-[#242326] transition-all">
          <IcoBell />
        </button>
        <button className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[#68636D] hover:bg-[#F4F0EC] hover:text-[#242326] transition-all">
          <IcoCircleHelp />
        </button>
        <button className="flex items-center gap-2 ml-1 px-2 py-1 rounded-[10px] hover:bg-[#F4F0EC] transition-all">
          <div className="w-8 h-8 rounded-full bg-[#722ED1] flex items-center justify-center text-white text-[12px] font-semibold shrink-0" style={{ fontFamily: '"Google Sans Flex:Bold", sans-serif' }}>
            AK
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#68636D" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 5l4 4 4-4"/>
          </svg>
        </button>
      </div>
    </header>
  )
}

// ─── Quick Action Chip ────────────────────────────────────────────────────────

function QuickAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 h-[44px] px-3.5 rounded-[12px] border border-[#E3DDD7] bg-[#FBF9F7] text-[#242326] text-[13px] cursor-pointer transition-all duration-150 hover:bg-[#F3EAFF] hover:border-[#722ED1] hover:text-[#722ED1] whitespace-nowrap w-full justify-center sm:justify-start"
      style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
    >
      <span className="text-[#9A949D] group-hover:text-[#722ED1]">{icon}</span>
      {label}
    </button>
  )
}

// ─── Hozie AI Card ────────────────────────────────────────────────────────────

function HozieAICard({
  aiState,
  aiResponse,
  composerValue,
  onComposerChange,
  onComposerSubmit,
  onQuickAction,
  onNavigate,
}: {
  aiState: AiState
  aiResponse: string
  composerValue: string
  onComposerChange: (v: string) => void
  onComposerSubmit: () => void
  onQuickAction: (text: string) => void
  onNavigate: (s: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && composerValue.trim()) onComposerSubmit()
  }

  const quickActions = [
    { label: 'Create a project', icon: <IcoFolderPlus />, text: "", dest: 'create-project' },
    { label: 'Get an estimate', icon: <IcoBarChart />, text: "Help me estimate the cost for my project", dest: '' },
    { label: 'Analyze a plan', icon: <IcoLayout />, text: "I want to analyze my floor plan", dest: '' },
    { label: 'Calculate materials', icon: <IcoCalc />, text: "Calculate the materials needed for my project", dest: '' },
  ]

  return (
    <div
      className="w-full bg-white rounded-[24px] border border-[#E3DDD7] p-5 sm:p-6 flex flex-col gap-5"
      style={{ boxShadow: '0 2px 20px rgba(114,46,209,0.06), 0 1px 4px rgba(0,0,0,0.04)' }}
    >
      {/* Card Header */}
      <div className="flex items-center gap-3">
        {/* H Icon with glow container */}
        <div
          className="relative flex items-center justify-center rounded-[14px] bg-[#F3EAFF] shrink-0"
          style={{
            width: 48, height: 48,
            animation: aiState === 'thinking' ? 'aiIconGlow 1.8s ease-in-out infinite' : undefined,
            boxShadow: aiState !== 'idle' ? '0 0 0 0 rgba(114,46,209,0)' : undefined,
          }}
        >
          <HIcon size={32} />
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[16px] font-semibold text-[#242326] leading-none" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
            HOZIE
          </span>
          <span className="text-[9px] tracking-[0.08em] text-[#722ED1] leading-none" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
            AI CONSTRUCTION ADVISOR
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span
            className="w-[7px] h-[7px] rounded-full bg-[#722ED1] shrink-0"
            style={{ animation: 'hozieStatusPulse 2.2s ease-in-out infinite' }}
          />
          <span className="text-[10px] text-[#722ED1] tracking-[0.06em]" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
            {aiState === 'thinking' ? 'THINKING' : 'READY'}
          </span>
        </div>
      </div>

      {/* Main message area */}
      <div className="flex flex-col gap-2">
        {aiState === 'idle' && (
          <>
            <h2 className="text-[22px] sm:text-[26px] font-medium text-[#242326] leading-tight m-0" style={{ fontFamily: '"Google Sans Flex:Medium", sans-serif' }}>
              What would you like to build today?
            </h2>
            <p className="text-[14px] text-[#68636D] leading-[1.6] m-0" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
              Tell me what you&apos;re planning and I&apos;ll help you estimate the cost, materials and work involved.
            </p>
          </>
        )}
        {aiState === 'thinking' && (
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-2.5">
              <span
                className="text-[10px] tracking-[0.08em] text-[#722ED1]"
                style={{ fontFamily: '"Sometype Mono:SemiBold", monospace', animation: 'hozieStatusPulse 1.4s ease-in-out infinite' }}
              >
                Hozie is thinking...
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {[80, 65, 50].map((w, i) => (
                <div
                  key={i}
                  className="h-3 rounded-full bg-[#F4F0EC]"
                  style={{ width: `${w}%`, animation: `hozieStatusPulse 1.6s ease-in-out ${i * 0.15}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}
        {aiState === 'response' && (
          <div className="flex flex-col gap-3">
            <div
              className="text-[15px] leading-[1.7] text-[#242326] bg-[#F3EAFF] rounded-[16px] px-4 py-3.5"
              style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
            >
              {aiResponse}
            </div>
            <button
              className="text-[13px] text-[#722ED1] self-start hover:underline cursor-pointer border-0 bg-transparent p-0"
              style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
              onClick={() => onQuickAction('')}
            >
              Ask another question →
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions — only shown when idle */}
      {aiState !== 'thinking' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {quickActions.map(action => (
            <QuickAction
              key={action.label}
              label={action.label}
              icon={action.icon}
              onClick={() => {
                if (action.dest) { onNavigate(action.dest); return }
                onComposerChange(action.text)
                setTimeout(() => inputRef.current?.focus(), 50)
              }}
            />
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="flex items-center gap-3 bg-white border border-[#E3DDD7] rounded-[14px] px-4 h-[56px] focus-within:border-[#722ED1] focus-within:shadow-[0_0_0_3px_rgba(114,46,209,0.08)] transition-all">
        <div className="shrink-0 flex items-center justify-center opacity-60">
          <HIcon size={18} />
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="What are you planning to build?"
          className="flex-1 bg-transparent outline-none text-[14px] text-[#242326] placeholder-[#9A949D]"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          value={composerValue}
          onChange={e => onComposerChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={aiState === 'thinking'}
        />
        <button
          onClick={onComposerSubmit}
          disabled={!composerValue.trim() || aiState === 'thinking'}
          className={[
            'w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-150',
            composerValue.trim() && aiState !== 'thinking'
              ? 'bg-[#722ED1] cursor-pointer hover:brightness-90 active:scale-95'
              : 'bg-[#E3DDD7] cursor-not-allowed',
          ].join(' ')}
        >
          <IcoSend />
        </button>
      </div>
    </div>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard() {
  return (
    <div className="bg-white rounded-[16px] border border-[#E3DDD7] p-5 flex flex-col gap-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-[15px] font-semibold text-[#242326] m-0" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
            3 BHK G+1 House
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>Hyderabad</span>
            <span className="text-[#E3DDD7]">·</span>
            <span className="text-[12px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>2,400 sq ft</span>
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-medium text-[#722ED1] bg-[#F3EAFF] px-2.5 py-1 rounded-full" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
          Planning
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#9A949D] tracking-[0.04em]" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
            ESTIMATED COST
          </span>
          <span className="text-[13px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
            ₹29.8L – ₹35.2L
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#9A949D]" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>PROGRESS</span>
          <span className="text-[11px] text-[#722ED1] font-medium" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>18%</span>
        </div>
        <div className="h-1.5 bg-[#F4F0EC] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#722ED1] rounded-full"
            style={{ width: '18%', transition: 'width 0.8s ease-out' }}
          />
        </div>
      </div>

      <button
        className="self-start text-[13px] text-[#722ED1] font-medium hover:underline cursor-pointer border-0 bg-transparent p-0 mt-1"
        style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
      >
        Continue project →
      </button>
    </div>
  )
}

// ─── Empty Projects State ─────────────────────────────────────────────────────

function EmptyProjectsState({ onNavigate }: { onNavigate: (s: string) => void }) {
  return (
    <div className="bg-white rounded-[16px] border border-[#E3DDD7] p-6 flex flex-col items-center text-center gap-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
      <div className="w-12 h-12 rounded-[14px] bg-[#F3EAFF] flex items-center justify-center">
        <IcoProjects />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] tracking-[0.08em] text-[#722ED1]" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
          READY TO BUILD?
        </span>
        <p className="text-[14px] text-[#68636D] leading-[1.6] m-0" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
          Create your first construction project with Hozie.
        </p>
      </div>
      <button
        onClick={() => onNavigate('create-project')}
        className="h-10 px-5 rounded-[10px] bg-[#722ED1] text-white text-[13px] font-medium cursor-pointer hover:brightness-90 transition-all border-0"
        style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
      >
        Create project →
      </button>
    </div>
  )
}

// ─── Project Section ──────────────────────────────────────────────────────────

function ProjectSection({ hasProject, onNavigate }: { hasProject: boolean; onNavigate: (s: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] tracking-[0.10em] text-[#722ED1] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
        Your Projects
      </span>
      {hasProject ? <ProjectCard /> : <EmptyProjectsState onNavigate={onNavigate} />}
    </div>
  )
}

// ─── Right Column Cards ───────────────────────────────────────────────────────

function ProjectSnapshotCard() {
  const rows = [
    { label: 'Project', value: '3 BHK G+1 House' },
    { label: 'Location', value: 'Hyderabad' },
    { label: 'Area', value: '2,400 sq ft' },
    { label: 'Status', value: 'Planning' },
  ]
  return (
    <div className="bg-white rounded-[16px] border border-[#E3DDD7] p-5 flex flex-col gap-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
      <span className="text-[10px] tracking-[0.10em] text-[#9A949D] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
        Project Snapshot
      </span>
      <div className="flex flex-col gap-3">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-[#9A949D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>{row.label}</span>
            <span
              className={[
                'text-[12px] font-medium',
                row.label === 'Status' ? 'text-[#722ED1] bg-[#F3EAFF] px-2 py-0.5 rounded-full' : 'text-[#242326]',
              ].join(' ')}
              style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AIInsightCard() {
  return (
    <div className="bg-white rounded-[16px] border border-[#E3DDD7] p-5 flex flex-col gap-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-[8px] bg-[#F3EAFF] flex items-center justify-center">
          <HIcon size={18} />
        </div>
        <span className="text-[10px] tracking-[0.10em] text-[#722ED1] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
          Hozie Suggests
        </span>
      </div>
      <p className="text-[13px] text-[#242326] leading-[1.65] m-0" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
        &ldquo;Start by confirming your plot size and number of floors. This will help me give you a more accurate cost estimate.&rdquo;
      </p>
      <button className="self-start text-[13px] text-[#722ED1] font-medium hover:underline cursor-pointer border-0 bg-transparent p-0" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
        Continue →
      </button>
    </div>
  )
}

function QuickToolsCard() {
  const tools = [
    { label: 'Material Calculator', icon: <IcoCalc /> },
    { label: 'Estimate', icon: <IcoBarChart /> },
    { label: 'BOQ', icon: <IcoBOQ /> },
    { label: 'Upload Plan', icon: <IcoUpload /> },
  ]
  return (
    <div className="bg-white rounded-[16px] border border-[#E3DDD7] p-5 flex flex-col gap-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
      <span className="text-[10px] tracking-[0.10em] text-[#9A949D] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
        Quick Tools
      </span>
      <div className="grid grid-cols-2 gap-2">
        {tools.map(tool => (
          <button
            key={tool.label}
            className="flex flex-col items-center gap-2 p-3.5 rounded-[12px] border border-[#E3DDD7] bg-[#FBF9F7] hover:bg-[#F3EAFF] hover:border-[#722ED1] hover:text-[#722ED1] text-[#68636D] transition-all cursor-pointer"
          >
            <span className="w-5 h-5 flex items-center justify-center">{tool.icon}</span>
            <span className="text-[11px] leading-tight text-center" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
              {tool.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Ambient Background ───────────────────────────────────────────────────────

function AmbientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
      <div className="absolute rounded-full" style={{ top: 60, right: -160, width: 560, height: 560, backgroundColor: 'rgba(114,46,209,0.045)', filter: 'blur(120px)' }} />
      <div className="absolute rounded-full" style={{ bottom: -180, left: -120, width: 640, height: 640, backgroundColor: 'rgba(243,234,255,0.55)', filter: 'blur(140px)' }} />
      <div className="absolute rounded-full" style={{ top: '45%', left: '35%', transform: 'translate(-50%,-50%)', width: 480, height: 480, backgroundColor: 'rgba(114,46,209,0.03)', filter: 'blur(100px)' }} />
    </div>
  )
}

// ─── Welcome Section ──────────────────────────────────────────────────────────

function WelcomeSection() {
  return (
    <div className="flex flex-col gap-2 mb-6">
      <span
        className="text-[10px] tracking-[0.10em] text-[#722ED1] uppercase"
        style={{ fontFamily: '"Sometype Mono:SemiBold", monospace', animation: 'welcomeFadeUp 0.4s ease-out 0.05s both' }}
      >
        Your Construction Workspace
      </span>
      <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.12s both' }}>
        <h1
          className="text-[28px] sm:text-[36px] font-semibold text-[#242326] leading-[1.1] m-0"
          style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
        >
          Good morning, Adarsh.
        </h1>
        <h1
          className="text-[28px] sm:text-[36px] font-semibold text-[#722ED1] leading-[1.1] m-0"
          style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
        >
          Let&apos;s build something smart.
        </h1>
      </div>
      <p
        className="text-[14px] text-[#68636D] leading-[1.6] m-0"
        style={{ fontFamily: '"Open Sans:Regular", sans-serif', animation: 'welcomeFadeUp 0.45s ease-out 0.2s both' }}
      >
        Hozie is ready to help you plan your construction project.
      </p>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeDashboardScreen({ onNavigate }: { onNavigate: (s: string, data?: Record<string, string>) => void }) {
  const [activeNav, setActiveNav] = useState('home')
  const [aiState, setAiState] = useState<AiState>('idle')
  const [aiResponse, setAiResponse] = useState('')
  const [composerValue, setComposerValue] = useState('')
  const [hasProject] = useState(true)

  const handleComposerSubmit = () => {
    if (!composerValue.trim() || aiState === 'thinking') return
    const query = composerValue
    setComposerValue('')
    setAiState('thinking')

    setTimeout(() => {
      const responses: Record<string, string> = {
        project: 'Based on your profile, I suggest starting with a clear brief: plot dimensions, number of floors, and preferred finish quality. This shapes your entire estimate.',
        estimate: 'For a typical 3 BHK G+1 house in Hyderabad with mid-range finishes, budget between ₹28L–₹38L. I can refine this once we confirm the exact area and specifications.',
        plan: 'Upload your floor plan or share a rough sketch. I\'ll identify rooms, calculate areas, check for standard compliance, and flag anything unusual.',
        material: 'For 2,400 sq ft with standard construction, you\'ll need approximately 1,800 bags of cement, 18 MT of steel, and 4,500 bricks. Want a detailed BOQ breakdown?',
      }
      const key = query.toLowerCase().includes('estimate') ? 'estimate'
        : query.toLowerCase().includes('plan') ? 'plan'
        : query.toLowerCase().includes('material') ? 'material'
        : 'project'
      setAiResponse(responses[key])
      setAiState('response')
    }, 2200)
  }

  const handleQuickAction = (text: string) => {
    setComposerValue(text)
    if (text === '') {
      setAiState('idle')
      setAiResponse('')
    }
  }

  return (
    <div className="flex flex-col relative" style={{ height: '100%', backgroundColor: '#FBF9F7' }}>
      <AmbientBackground />

      {/* Mobile top bar */}
      <MobileTopBar />

      {/* Body: sidebar + main */}
      <div className="flex flex-1 min-h-0 relative z-10">
        <Sidebar activeNav={activeNav} onNav={setActiveNav} onNavigate={onNavigate} />

        {/* Main content column */}
        <div className="flex flex-col flex-1 min-w-0">
          <TopHeader />

          {/* Scrollable content */}
          <main
            className="flex-1 overflow-y-auto"
            style={{ padding: '28px 24px', scrollbarWidth: 'none' }}
          >
            <div style={{ maxWidth: 1120, margin: '0 auto' }}>
              <WelcomeSection />

              {/* Two-column layout */}
              <div
                className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start"
                style={{ animation: 'welcomeFadeUp 0.5s ease-out 0.28s both' }}
              >
                {/* Left column ~65% */}
                <div className="flex flex-col gap-5 w-full min-w-0" style={{ flex: '65 65 0' }}>
                  <HozieAICard
                    aiState={aiState}
                    aiResponse={aiResponse}
                    composerValue={composerValue}
                    onComposerChange={setComposerValue}
                    onComposerSubmit={handleComposerSubmit}
                    onQuickAction={handleQuickAction}
                    onNavigate={onNavigate}
                  />
                  <ProjectSection hasProject={hasProject} onNavigate={onNavigate} />
                </div>

                {/* Right column ~35% */}
                <div
                  className="flex flex-col gap-4 w-full lg:shrink-0"
                  style={{ flex: '35 35 0', minWidth: 0, maxWidth: '100%' }}
                >
                  <ProjectSnapshotCard />
                  <AIInsightCard />
                  <QuickToolsCard />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
