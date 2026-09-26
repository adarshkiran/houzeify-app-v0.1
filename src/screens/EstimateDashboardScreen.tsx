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

// ─── Action/header icons ───────────────────────────────────────────────────────

const IcoEdit = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.5 2.5l2 2L5 12H3v-2L10.5 2.5z"/>
  </svg>
)
const IcoDownload = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.5 2v8M4.5 7l3 3 3-3"/>
    <path d="M2 12h11"/>
  </svg>
)
const IcoMore = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="4" cy="8" r="1.2" fill="currentColor"/>
    <circle cx="8" cy="8" r="1.2" fill="currentColor"/>
    <circle cx="12" cy="8" r="1.2" fill="currentColor"/>
  </svg>
)
const IcoArrow = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="7" x2="12" y2="7"/><path d="M8 3.5l4 3.5-4 3.5"/>
  </svg>
)

// ─── Action card icons ─────────────────────────────────────────────────────────

const IcoBOQLg = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="2" width="16" height="18" rx="2"/>
    <line x1="7" y1="8" x2="15" y2="8"/><line x1="7" y1="12" x2="15" y2="12"/><line x1="7" y1="16" x2="12" y2="16"/>
  </svg>
)
const IcoCalcLg = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="2" width="16" height="18" rx="2"/>
    <rect x="6" y="5" width="10" height="4" rx="0.8"/>
    <circle cx="7.5" cy="13" r="1" fill="currentColor" stroke="none"/>
    <circle cx="11" cy="13" r="1" fill="currentColor" stroke="none"/>
    <circle cx="14.5" cy="13" r="1" fill="currentColor" stroke="none"/>
    <circle cx="7.5" cy="17" r="1" fill="currentColor" stroke="none"/>
    <circle cx="11" cy="17" r="1" fill="currentColor" stroke="none"/>
    <circle cx="14.5" cy="17" r="1" fill="currentColor" stroke="none"/>
  </svg>
)
const IcoPlanLg = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="18" height="18" rx="2.5"/>
    <line x1="2" y1="9" x2="20" y2="9"/>
    <line x1="9" y1="9" x2="9" y2="20"/>
    <line x1="13" y1="12.5" x2="17" y2="12.5"/>
    <line x1="13" y1="15.5" x2="17" y2="15.5"/>
  </svg>
)
const IcoContractors = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="7" r="3"/>
    <path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
    <circle cx="16" cy="8" r="2.5"/>
    <path d="M20 20c0-2.8-1.8-5-4-5.5"/>
  </svg>
)

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
        active ? 'bg-[#F3EAFF] text-[#722ED1]' : 'bg-transparent text-[#68636D] hover:bg-[#F4F0EC] hover:text-[#242326]',
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
    { id: 'help', icon: <IcoHelp />, label: 'Help' },
    { id: 'settings', icon: <IcoSettings />, label: 'Settings' },
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
            <NavItem key={item.id} icon={item.icon} label={item.label} active={item.id === 'estimates'} onClick={() => item.dest && onNavigate(item.dest)} />
          ))}
          <div className="my-3 border-t border-[#E3DDD7]" />
          <p className="hidden lg:block text-[10px] tracking-[0.08em] uppercase text-[#9A949D] px-3 mb-1.5" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>Tools</p>
          {navTools.map(item => (
            <NavItem key={item.id} icon={item.icon} label={item.label} onClick={() => item.dest && onNavigate(item.dest)} />
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

// ─── Ambient BG ───────────────────────────────────────────────────────────────

function AmbientBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
      <div className="absolute rounded-full" style={{ top: -100, right: -180, width: 560, height: 560, backgroundColor: 'rgba(114,46,209,0.045)', filter: 'blur(120px)' }} />
      <div className="absolute rounded-full" style={{ bottom: -160, left: -100, width: 620, height: 620, backgroundColor: 'rgba(243,234,255,0.52)', filter: 'blur(140px)' }} />
      <div className="absolute rounded-full" style={{ top: '40%', left: '42%', transform: 'translate(-50%,-50%)', width: 480, height: 480, backgroundColor: 'rgba(114,46,209,0.026)', filter: 'blur(100px)' }} />
    </div>
  )
}

// ─── Mobile Top Bar ───────────────────────────────────────────────────────────

function MobileTopBar({ onNavigate }: { onNavigate: (s: string) => void }) {
  return (
    <div className="flex md:hidden h-14 items-center justify-between px-4 bg-white border-b border-[#E3DDD7] shrink-0">
      <div className="flex items-center gap-2.5">
        <button onClick={() => onNavigate('dashboard-home')} className="border-0 bg-transparent cursor-pointer p-0"><HIcon size={26} /></button>
        <span className="text-[15px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>Estimate</span>
      </div>
      <div className="flex items-center gap-1">
        <button className="w-8 h-8 flex items-center justify-center text-[#68636D] border-0 bg-transparent cursor-pointer"><IcoDownload /></button>
        <button className="w-8 h-8 flex items-center justify-center text-[#68636D] border-0 bg-transparent cursor-pointer"><IcoMore /></button>
      </div>
    </div>
  )
}

// ─── Cost Breakdown Bar ───────────────────────────────────────────────────────

const breakdownItems = [
  { label: 'Materials',   percent: 56, amount: '₹18.2L', color: '#E14B19' },
  { label: 'Labour',      percent: 26, amount: '₹8.4L',  color: '#E19C12' },
  { label: 'Finishing',   percent: 13, amount: '₹4.1L',  color: '#4AB017' },
  { label: 'Contingency', percent:  5, amount: '₹1.7L',  color: '#7E7E7E' },
]

function CostBreakdownCard() {
  return (
    <div className="bg-white rounded-[16px] border border-[#E3DDD7] p-5 sm:p-6 flex flex-col gap-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.10em] text-[#9A949D] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>Where Your Money Goes</span>
        <span className="text-[11px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>Mid-range estimate</span>
      </div>

      {/* Segmented bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {breakdownItems.map(item => (
          <div
            key={item.label}
            className="transition-all duration-700"
            style={{ flex: item.percent, backgroundColor: item.color }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {breakdownItems.map(item => (
          <div key={item.label} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-[11px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>{item.label}</span>
            </div>
            <div className="flex items-baseline gap-1.5 pl-4">
              <span className="text-[15px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>{item.amount}</span>
              <span className="text-[10px] text-[#9A949D]" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>{item.percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-[14px] border border-[#E3DDD7] overflow-hidden flex" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      {color && <div className="w-1 shrink-0" style={{ backgroundColor: color, opacity: 0.85 }} />}
      <div className="flex-1 px-4 py-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          {color && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
          <span className="text-[9px] tracking-[0.10em] text-[#9A949D] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>{label}</span>
        </div>
        <span className="text-[20px] sm:text-[22px] font-semibold leading-none" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif', color: color ?? '#242326' }}>{value}</span>
        {sub && <span className="text-[11px] text-[#9A949D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>{sub}</span>}
      </div>
    </div>
  )
}

// ─── Hozie Insight Card ───────────────────────────────────────────────────────

function HozieInsightCard({ onNavigate }: { onNavigate?: (s: string) => void }) {
  return (
    <div className="rounded-[16px] px-5 py-4 flex flex-col gap-3" style={{ backgroundColor: '#F3EAFF' }}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center shrink-0">
          <HIcon size={20} />
        </div>
        <span className="text-[10px] tracking-[0.10em] text-[#722ED1] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>Hozie Insight</span>
      </div>
      <p className="text-[13px] text-[#242326] leading-[1.7] m-0" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
        &ldquo;Your estimate has the biggest cost sensitivity in materials and finishing. Choosing construction quality carefully can significantly change the final budget.&rdquo;
      </p>
      <button onClick={() => onNavigate?.('cost-breakdown')} className="self-start text-[13px] text-[#722ED1] font-medium hover:underline cursor-pointer border-0 bg-transparent p-0" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
        Explore cost drivers →
      </button>
    </div>
  )
}

// ─── Next Action Card ─────────────────────────────────────────────────────────

function ActionCard({ icon, title, desc, onClick }: {
  icon: React.ReactNode; title: string; desc: string; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-3 p-4 sm:p-5 rounded-[14px] border border-[#E3DDD7] bg-white text-left cursor-pointer transition-all duration-150 hover:bg-[#F3EAFF] hover:border-[#722ED1] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(114,46,209,0.08)] group outline-none"
    >
      <div className="flex items-center justify-between">
        <span className="w-10 h-10 rounded-[12px] bg-[#F4F0EC] flex items-center justify-center text-[#68636D] group-hover:bg-white group-hover:text-[#722ED1] transition-all">
          {icon}
        </span>
        <span className="text-[#C4BFC8] group-hover:text-[#722ED1] transition-colors"><IcoArrow /></span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>{title}</span>
        <span className="text-[12px] text-[#68636D] leading-[1.5]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>{desc}</span>
      </div>
    </button>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EstimateDashboardScreen({
  onNavigate,
  projectName = '3 BHK G+1 House',
  location = 'Hyderabad',
  area = '2,400 sq ft',
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  projectName?: string
  location?: string
  area?: string
}) {
  const nextActions = [
    { icon: <IcoBOQLg />, title: 'View BOQ', desc: 'See materials and quantities.' },
    { icon: <IcoCalcLg />, title: 'Material Calculator', desc: 'Check material requirements.' },
    { icon: <IcoPlanLg />, title: 'Analyze Plan', desc: 'Upload your floor plan.' },
    { icon: <IcoContractors />, title: 'Find Contractors', desc: 'Get project bids.' },
  ]

  return (
    <div className="flex flex-col" style={{ height: '100%', backgroundColor: '#FBF9F7' }}>
      <AmbientBg />

      <MobileTopBar onNavigate={onNavigate} />

      {/* Body */}
      <div className="flex flex-1 min-h-0 relative z-10">
        <Sidebar onNavigate={onNavigate} />

        {/* Main */}
        <div className="flex flex-col flex-1 min-h-0">

          {/* Desktop Header */}
          <header className="hidden md:flex h-[72px] shrink-0 items-center justify-between px-6 lg:px-8 bg-white border-b border-[#E3DDD7]">
            <div className="flex flex-col gap-0.5">
              <h1 className="text-[22px] font-semibold text-[#242326] m-0" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
                Construction Estimate
              </h1>
              <span className="text-[13px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                {projectName} · {location} · {area}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#E3DDD7] text-[12px] text-[#68636D] hover:bg-[#F4F0EC] transition-all cursor-pointer bg-transparent" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                <IcoEdit /> Edit project
              </button>
              <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#E3DDD7] text-[12px] text-[#68636D] hover:bg-[#F4F0EC] transition-all cursor-pointer bg-transparent" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                <IcoDownload /> <span className="hidden sm:inline">Download PDF</span>
              </button>
              <button className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-[#E3DDD7] text-[#68636D] hover:bg-[#F4F0EC] transition-all cursor-pointer bg-transparent">
                <IcoMore />
              </button>
            </div>
          </header>

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-5">

              {/* Estimate Hero */}
              <div
                className="bg-white rounded-[20px] border border-[#E3DDD7] p-6 sm:p-8 flex flex-col gap-4"
                style={{
                  boxShadow: '0 2px 24px rgba(114,46,209,0.07), 0 1px 4px rgba(0,0,0,0.04)',
                  animation: 'welcomeFadeUp 0.45s ease-out 0.05s both',
                  background: 'linear-gradient(135deg, rgba(243,234,255,0.3) 0%, #ffffff 50%)',
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  {/* Left: numbers */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] tracking-[0.10em] text-[#722ED1] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>AI Estimate</span>
                    </div>
                    <div>
                      <div className="text-[36px] sm:text-[42px] font-semibold text-[#722ED1] leading-none" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
                        ₹29.8L — ₹35.2L
                      </div>
                      <div className="text-[13px] text-[#68636D] mt-1.5" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                        Estimated construction cost
                      </div>
                    </div>
                    <div className="text-[16px] sm:text-[18px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
                      ₹1,240 — ₹1,467 / sq ft
                    </div>
                  </div>

                  {/* Right: confidence */}
                  <div className="flex flex-col items-start sm:items-end gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F3EAFF]" style={{ border: '1px solid rgba(114,46,209,0.18)' }}>
                      <span
                        className="w-2 h-2 rounded-full bg-[#722ED1] shrink-0"
                        style={{ animation: 'hozieStatusPulse 2.5s ease-in-out infinite' }}
                      />
                      <span className="text-[12px] font-medium text-[#722ED1]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                        86% confidence
                      </span>
                    </div>
                    {/* Confidence bar */}
                    <div className="flex flex-col gap-1 w-full sm:w-[160px]">
                      <div className="h-1.5 bg-[#E3DDD7] rounded-full overflow-hidden">
                        <div className="h-full bg-[#722ED1] rounded-full" style={{ width: '86%' }} />
                      </div>
                      <span className="text-[10px] text-[#9A949D] sm:text-right" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>AI CONFIDENCE SCORE</span>
                    </div>
                  </div>
                </div>

                {/* Divider + disclaimer */}
                <div className="border-t border-[#F4F0EC]" />
                <p className="text-[12px] text-[#9A949D] leading-[1.6] m-0" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                  Based on current project details and regional construction assumptions for {location}. Final cost depends on design, materials, and contractor rates.
                </p>
              </div>

              {/* Summary Metrics */}
              <div
                className="grid grid-cols-2 lg:grid-cols-4 gap-3"
                style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.12s both' }}
              >
                <MetricCard label="Built-up Area" value="2,400 sq ft" />
                <MetricCard label="Materials" value="₹18.2L" sub="56% of total" color="#E14B19" />
                <MetricCard label="Labour" value="₹8.4L" sub="26% of total" color="#E19C12" />
                <MetricCard label="Finishing" value="₹4.1L" sub="13% of total" color="#4AB017" />
              </div>

              {/* Cost Breakdown */}
              <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.18s both' }}>
                <CostBreakdownCard />
              </div>

              {/* Hozie Insight */}
              <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.24s both' }}>
                <HozieInsightCard onNavigate={onNavigate} />
              </div>

              {/* Next Actions */}
              <div
                className="flex flex-col gap-3"
                style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.3s both' }}
              >
                <span className="text-[10px] tracking-[0.10em] text-[#9A949D] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>Next Steps</span>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {nextActions.map(a => (
                    <ActionCard key={a.title} icon={a.icon} title={a.title} desc={a.desc} />
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <p
                className="text-[10px] text-[#9A949D] leading-[1.7] m-0"
                style={{ fontFamily: '"Open Sans:Regular", sans-serif', animation: 'welcomeFadeUp 0.4s ease-out 0.36s both' }}
              >
                AI-generated estimate based on the information provided and current assumptions. Actual costs may vary based on design, material selection, labour rates, site conditions and contractor pricing.
              </p>

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
