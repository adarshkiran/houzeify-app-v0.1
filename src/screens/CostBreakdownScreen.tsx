import HIcon from '../components/HIcon'
import LogoHorizontal from '../components/LogoHorizontal'
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { getEstimate } from '../mock/selectors'

// ─── Sidebar & shell icons ─────────────────────────────────────────────────────

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
const IcoDownload = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 2v7M4.5 6.5l2.5 2.5 2.5-2.5"/><path d="M2 11h10"/>
  </svg>
)
const IcoEdit = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2l3 3L5 12H2v-3L9 2z"/>
  </svg>
)
const IcoChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3L5 7l4 4"/>
  </svg>
)

// ─── Category icons ────────────────────────────────────────────────────────────

const IcoMaterials = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 1.5L14 5v6L8 14.5 2 11V5L8 1.5z"/>
    <line x1="8" y1="1.5" x2="8" y2="14.5"/>
    <line x1="2" y1="5" x2="14" y2="5"/>
    <line x1="2" y1="11" x2="14" y2="11"/>
  </svg>
)
const IcoLabour = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 14c0-3 2-4.5 4-4.5s4 1.5 4 4.5"/>
    <circle cx="6" cy="5.5" r="2.5"/>
    <path d="M11 9.5c1.5.5 3 1.8 3 4.5"/>
    <circle cx="11.5" cy="5" r="2" strokeWidth="1.3"/>
  </svg>
)
const IcoFinishing = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.5 2l3 3-8 8H2.5v-3l8-8z"/>
    <line x1="8" y1="4.5" x2="11.5" y2="8"/>
  </svg>
)
const IcoContingency = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2L2 5v4c0 3.3 2.7 5 6 5s6-1.7 6-5V5L8 2z"/>
    <line x1="8" y1="7" x2="8" y2="9.5"/>
    <circle cx="8" cy="11" r="0.7" fill="currentColor" stroke="none"/>
  </svg>
)

// ─── Data ─────────────────────────────────────────────────────────────────────

interface Category {
  id: string
  label: string
  amount: string
  pct: number
  icon: React.ReactNode
  detail: string
  color: string
  bg: string
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
    { id: 'home',      icon: <IcoHome />,      label: 'Dashboard',          dest: 'dashboard-home' },
    { id: 'advisor',   icon: <IcoAdvisor />,   label: 'AI Advisor',    dest: 'ai-advisor' },
    { id: 'projects',  icon: <IcoProjects />,  label: 'Projects',      dest: '' },
    { id: 'estimates', icon: <IcoEstimates />, label: 'Estimates',     dest: 'estimate-dashboard' },
    { id: 'boq',       icon: <IcoBOQ />,       label: 'BOQ',           dest: '' },
    { id: 'plan',      icon: <IcoPlan />,       label: 'Plan Analysis', dest: '' },
  ]
  const navTools = [
    { id: 'calc',    icon: <IcoCalc />,    label: 'Material Calculator', dest: '' },
    { id: 'reports', icon: <IcoReports />, label: 'Reports',             dest: '' },
  ]
  const navBottom = [
    { id: 'help',     icon: <IcoHelp />,     label: 'Help' },
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
            <NavItem key={item.id} icon={item.icon} label={item.label} />
          ))}
        </nav>
        <div className="shrink-0 border-t border-[#E3DDD7] md:p-2 lg:p-3 flex flex-col gap-0.5">
          {navBottom.map(item => <NavItem key={item.id} icon={item.icon} label={item.label} />)}
        </div>
      </div>
    </aside>
  )
}

// ─── Ambient BG ───────────────────────────────────────────────────────────────

function AmbientBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
      <div className="absolute rounded-full" style={{ top: -100, right: -180, width: 560, height: 560, backgroundColor: 'rgba(114,46,209,0.042)', filter: 'blur(130px)' }} />
      <div className="absolute rounded-full" style={{ bottom: -160, left: -100, width: 640, height: 640, backgroundColor: 'rgba(243,234,255,0.50)', filter: 'blur(140px)' }} />
      <div className="absolute rounded-full" style={{ top: '55%', right: '15%', width: 380, height: 380, backgroundColor: 'rgba(243,234,255,0.38)', filter: 'blur(90px)' }} />
    </div>
  )
}

// ─── Total Card ───────────────────────────────────────────────────────────────

function TotalCard({ categories, totalLabel, averageLabel }: { categories: Category[]; totalLabel: string; averageLabel: string }) {
  return (
    <div
      className="bg-white rounded-[20px] border border-[#E3DDD7] p-6 sm:p-7 flex flex-col gap-4"
      style={{
        boxShadow: '0 2px 24px rgba(114,46,209,0.07), 0 1px 4px rgba(0,0,0,0.04)',
        background: 'linear-gradient(135deg, rgba(243,234,255,0.28) 0%, #ffffff 55%)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[0.10em] text-[#722ED1] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
            Total Estimated Cost
          </span>
          <div className="text-[34px] sm:text-[40px] font-semibold leading-none" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif', color: 'rgb(40, 40, 40)' }}>
            {totalLabel}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[13px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
              Estimated average:
            </span>
            <span className="text-[15px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
              {averageLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Compact stacked bar */}
      <div className="flex flex-col gap-2">
        <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
          {categories.map(c => (
            <div key={c.id} style={{ flex: c.pct, backgroundColor: c.color }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: c.color }} />
              <span className="text-[11px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: Category }) {
  return (
    <div
      className="bg-white rounded-[14px] border border-[#E3DDD7] overflow-hidden"
      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)', animation: 'welcomeFadeUp 0.4s ease-out both' }}
    >
      {/* Left accent bar */}
      <div className="flex">
        <div className="w-1 shrink-0" style={{ backgroundColor: cat.color, opacity: 0.85 }} />
        <div className="flex-1 p-4 sm:p-5 flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ backgroundColor: cat.bg, color: cat.color }}>
                {cat.icon}
              </div>
              <span
                className="text-[14px] font-semibold text-[#242326]"
                style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
              >
                {cat.label}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className="text-[18px] sm:text-[20px] font-semibold text-[#242326]"
                style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
              >
                {cat.amount}
              </span>
              <span
                className="text-[13px] font-medium w-[36px] text-right"
                style={{ fontFamily: '"Sometype Mono:SemiBold", monospace', color: cat.color }}
              >
                {cat.pct}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: cat.bg }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${cat.pct}%`, backgroundColor: cat.color, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </div>

          {/* Detail text */}
          <span
            className="text-[12px] text-[#9A949D] leading-[1.5]"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            {cat.detail}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Right panel components ───────────────────────────────────────────────────

function HozieInsightPanel() {
  return (
    <div className="rounded-[16px] px-5 py-4 flex flex-col gap-3" style={{ backgroundColor: '#F3EAFF' }}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center shrink-0">
          <HIcon size={20} />
        </div>
        <span className="text-[10px] tracking-[0.10em] text-[#722ED1] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
          Hozie Insight
        </span>
      </div>
      <p className="text-[13px] text-[#242326] leading-[1.7] m-0" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
        &ldquo;Materials are currently the largest cost driver. Changes in steel, cement and finishing specifications can significantly affect your final estimate.&rdquo;
      </p>
    </div>
  )
}

function EstimateSummaryPanel({ categories, averageLabel }: { categories: Category[]; averageLabel: string }) {
  return (
    <div className="bg-white rounded-[16px] border border-[#E3DDD7] p-5 flex flex-col gap-3" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      <span className="text-[10px] tracking-[0.10em] text-[#9A949D] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
        Summary
      </span>
      <div className="flex flex-col gap-2.5">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-[13px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>{cat.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>{cat.amount}</span>
              <span className="text-[10px] w-[28px] text-right" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace', color: cat.color }}>{cat.pct}%</span>
            </div>
          </div>
        ))}
        <div className="border-t border-[#E3DDD7] pt-2.5 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>Total (avg)</span>
          <span className="text-[14px] font-semibold text-[#722ED1]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>{averageLabel}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CostBreakdownScreen({
  onNavigate,
  estimateId,
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  estimateId?: string
}) {
  const { state } = useConstructionData()
  const estimate = estimateId ? getEstimate(state, estimateId) : undefined

  if (!estimate) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center px-6" style={{ height: '100%', backgroundColor: '#FBF9F7' }}>
        <span className="text-[18px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
          We couldn&apos;t find that estimate.
        </span>
        <button
          onClick={() => onNavigate('estimate-dashboard')}
          className="h-[48px] px-6 rounded-[12px] bg-[#722ED1] text-white text-[14px] font-semibold cursor-pointer hover:brightness-90 transition-all border-0"
          style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
        >
          Back to estimate
        </button>
      </div>
    )
  }

  const areaLabel = `${estimate.builtUpAreaSqft.toLocaleString('en-IN')} sq ft`
  const formatRupees = (value: number) => `₹${(value / 100000).toFixed(1)}L`
  const midpoint = (estimate.totalLow + estimate.totalHigh) / 2
  const totalLabel = `${formatRupees(estimate.totalLow)} — ${formatRupees(estimate.totalHigh)}`
  const averageLabel = formatRupees(midpoint)
  const categories: Category[] = [
    { id: 'materials', label: 'Materials', amount: formatRupees(estimate.breakdown.materials), pct: 56, icon: <IcoMaterials />, detail: 'Cement, steel, bricks, aggregates and other raw materials.', color: '#E14B19', bg: '#FFF2E8' },
    { id: 'labour', label: 'Labour', amount: formatRupees(estimate.breakdown.labour), pct: 26, icon: <IcoLabour />, detail: 'Civil, plumbing, electrical and finishing labour charges.', color: '#E19C12', bg: '#FFFBE6' },
    { id: 'finishing', label: 'Finishing', amount: formatRupees(estimate.breakdown.finishing), pct: 13, icon: <IcoFinishing />, detail: 'Flooring, painting, doors, windows and interior finishes.', color: '#4AB017', bg: '#F6FFED' },
    { id: 'contingency', label: 'Contingency', amount: formatRupees(estimate.breakdown.contingency), pct: 5, icon: <IcoContingency />, detail: 'Buffer for unforeseen costs and estimation variance.', color: '#7E7E7E', bg: '#F5F5F5' },
  ]

  return (
    <div className="flex flex-col" style={{ height: '100%', backgroundColor: '#FBF9F7' }}>
      <AmbientBg />

      {/* Mobile top bar */}
      <div className="flex md:hidden h-14 items-center justify-between px-4 bg-white border-b border-[#E3DDD7] shrink-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => onNavigate('estimate-dashboard')} className="flex items-center gap-1 text-[#68636D] border-0 bg-transparent cursor-pointer text-[13px]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
            <IcoChevronLeft /> Estimate
          </button>
        </div>
        <span className="text-[15px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>Cost Breakdown</span>
        <button className="w-8 h-8 flex items-center justify-center text-[#68636D] border-0 bg-transparent cursor-pointer"><IcoDownload /></button>
      </div>

      <div className="flex flex-1 min-h-0 relative z-10">
        <Sidebar onNavigate={onNavigate} />

        <div className="flex flex-col flex-1 min-h-0">
          {/* Desktop header */}
          <header className="hidden md:flex h-[72px] shrink-0 items-center justify-between px-6 lg:px-8 bg-white border-b border-[#E3DDD7]">
            <div className="flex flex-col gap-0.5">
              <h1 className="text-[20px] font-semibold text-[#242326] m-0" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
                Cost Breakdown
              </h1>
              <span className="text-[13px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                {estimate.projectName} · {estimate.location} · {areaLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#E3DDD7] text-[12px] text-[#68636D] hover:bg-[#F4F0EC] cursor-pointer bg-transparent transition-all" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                <IcoEdit /> Edit estimate
              </button>
              <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#E3DDD7] text-[12px] text-[#68636D] hover:bg-[#F4F0EC] cursor-pointer bg-transparent transition-all" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                <IcoDownload /> <span className="hidden sm:inline">Download PDF</span>
              </button>
              <button
                onClick={() => onNavigate('estimate-dashboard')}
                className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#E3DDD7] text-[12px] text-[#68636D] hover:bg-[#F4F0EC] cursor-pointer bg-transparent transition-all"
                style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
              >
                <IcoChevronLeft /> Back to Estimate
              </button>
            </div>
          </header>

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6">

              {/* Intro */}
              <div style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.05s both' }}>
                <span className="text-[10px] tracking-[0.10em] text-[#722ED1] uppercase block mb-3" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
                  Estimate Breakdown
                </span>
                <h2 className="text-[32px] sm:text-[40px] font-semibold text-[#242326] m-0 leading-[1.08]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
                  Where your money goes.
                </h2>
                <p className="text-[14px] sm:text-[15px] text-[#68636D] leading-[1.65] m-0 mt-2" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
                  Hozie has grouped your estimated construction cost into the major areas of work.
                </p>
              </div>

              {/* Two-column layout */}
              <div className="flex flex-col lg:flex-row gap-6 items-start">

                {/* Left — Total + categories */}
                <div className="flex flex-col gap-4 w-full min-w-0" style={{ flex: '60 60 0' }}>
                  <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.1s both' }}>
                    <TotalCard categories={categories} totalLabel={totalLabel} averageLabel={averageLabel} />
                  </div>
                  <div className="flex flex-col gap-3">
                    {categories.map((cat, i) => (
                      <div key={cat.id} style={{ animation: `welcomeFadeUp 0.4s ease-out ${0.15 + i * 0.06}s both` }}>
                        <CategoryCard cat={cat} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right — Insight + Summary + Actions */}
                <div
                  className="flex flex-col gap-4 w-full lg:shrink-0 lg:sticky lg:top-6"
                  style={{ flex: '40 40 0', minWidth: 0 }}
                >
                  <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.18s both' }}>
                    <HozieInsightPanel />
                  </div>
                  <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.24s both' }}>
                    <EstimateSummaryPanel categories={categories} averageLabel={averageLabel} />
                  </div>

                  {/* Next actions */}
                  <div
                    className="flex flex-col gap-2.5"
                    style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.3s both' }}
                  >
                    <button
                      onClick={() => onNavigate('material-estimate')}
                      className="w-full h-[46px] rounded-[12px] bg-[#722ED1] text-white text-[13px] font-semibold cursor-pointer hover:brightness-90 transition-all border-0"
                      style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                    >
                      View Material Estimate →
                    </button>
                    <button
                      className="w-full h-[46px] rounded-[12px] bg-white border border-[#E3DDD7] text-[#242326] text-[13px] font-medium cursor-pointer hover:bg-[#F4F0EC] transition-all"
                      style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                    >
                      View BOQ →
                    </button>
                  </div>

                  {/* Disclaimer */}
                  <p
                    className="text-[10px] text-[#9A949D] leading-[1.7] m-0"
                    style={{ fontFamily: '"Open Sans:Regular", sans-serif', animation: 'welcomeFadeUp 0.4s ease-out 0.36s both' }}
                  >
                    AI-generated estimate based on the information provided. Actual costs may vary based on design, specifications, site conditions and contractor pricing.
                  </p>
                </div>

              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
