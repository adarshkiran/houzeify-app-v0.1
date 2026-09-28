import { useState } from 'react'
import { Drawer } from 'antd'
import HIcon from './HIcon'

type Navigate = (screen: string, data?: Record<string, string>) => void

type Item = { id: string; label: string; go?: (onNavigate: Navigate) => void }

/** Where each homeowner menu item leads; items without `go` aren't built yet. */
const MAIN: Item[] = [
  { id: 'home', label: 'Home', go: (nav) => nav('dashboard-home') },
  { id: 'advisor', label: 'AI Advisor', go: (nav) => nav('ai-advisor') },
  { id: 'site-update', label: 'Site update', go: (nav) => nav('customer-daily-update', { project_id: 'project-sharma' }) },
  { id: 'estimates', label: 'Estimates', go: (nav) => nav('estimate-dashboard') },
  { id: 'projects', label: 'Projects' },
  { id: 'boq', label: 'BOQ' },
  { id: 'plan', label: 'Plan Analysis' },
]
const TOOLS: Item[] = [
  { id: 'calculator', label: 'Material Calculator' },
  { id: 'reports', label: 'Reports' },
]
const BOTTOM: Item[] = [
  { id: 'help', label: 'Help' },
  { id: 'settings', label: 'Settings' },
]

/**
 * ☰ button for the homeowner's phone top bar. The side menu is hidden below
 * the `md` breakpoint, so this drawer is the only way around on a phone.
 */
export default function HomeownerMobileMenu({ active, onNavigate }: { active: string; onNavigate: Navigate }) {
  const [open, setOpen] = useState(false)

  const row = (item: Item) => {
    const isActive = item.id === active
    return (
      <button
        key={item.id}
        type="button"
        disabled={!item.go}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => {
          setOpen(false)
          if (!isActive) item.go?.(onNavigate)
        }}
        className={`w-full h-10 px-3 flex items-center justify-between rounded-[10px] border-0 text-left text-[14px] transition-colors ${
          isActive
            ? 'bg-[#F3EAFF] text-[#722ED1] font-semibold'
            : item.go
              ? 'bg-transparent text-[#242326] hover:bg-[#F5F2EF] cursor-pointer'
              : 'bg-transparent text-[#9A949D] cursor-default'
        }`}
        style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
      >
        {item.label}
        {!item.go && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-[6px] bg-[#F5F2EF] text-[#9A949D] font-medium">Soon</span>
        )}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="w-9 h-9 -ml-1 flex items-center justify-center rounded-[10px] border border-[#E3DDD7] bg-white text-[#242326] cursor-pointer"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        placement="left"
        width={280}
        title={
          <span className="flex items-center gap-2.5">
            <HIcon size={24} />
            <span className="text-[16px] font-semibold text-[#242326]">Houzeify</span>
          </span>
        }
        styles={{ body: { padding: 12 } }}
      >
        <nav aria-label="Main menu" className="flex flex-col gap-0.5">
          {MAIN.map(row)}
          <div className="my-3 border-t border-[#E3DDD7]" />
          <p className="text-[10px] tracking-[0.08em] uppercase text-[#9A949D] px-3 mb-1" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
            Tools
          </p>
          {TOOLS.map(row)}
          <div className="my-3 border-t border-[#E3DDD7]" />
          {BOTTOM.map(row)}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onNavigate('welcome')
            }}
            className="w-full h-10 px-3 flex items-center rounded-[10px] border-0 bg-transparent text-left text-[14px] text-[#C4320A] hover:bg-[#FFF1F0] cursor-pointer"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            Sign out
          </button>
        </nav>
      </Drawer>
    </>
  )
}
