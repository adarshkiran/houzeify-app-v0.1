import { useState, useRef, useEffect } from 'react'
import HIcon from '../components/HIcon'
import HomeownerLayout from '../components/homeowner/HomeownerLayout'

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatState = 'suggestions' | 'conversation' | 'thinking' | 'estimate'

interface Message {
  id: string
  role: 'hozie' | 'user'
  content: React.ReactNode
  actions?: { label: string; icon: React.ReactNode }[]
}

// ─── Sidebar Icons ────────────────────────────────────────────────────────────

const IcoBarChart = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="1.5" y1="14.5" x2="14.5" y2="14.5"/>
    <line x1="3" y1="14.5" x2="3" y2="8"/><line x1="7" y1="14.5" x2="7" y2="4"/><line x1="11" y1="14.5" x2="11" y2="7"/><line x1="13.5" y1="14.5" x2="13.5" y2="1.5"/>
  </svg>
)
const IcoList = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="3" cy="5" r="0.8" fill="currentColor" stroke="none"/>
    <line x1="6" y1="5" x2="14" y2="5"/>
    <circle cx="3" cy="9" r="0.8" fill="currentColor" stroke="none"/>
    <line x1="6" y1="9" x2="14" y2="9"/>
    <circle cx="3" cy="13" r="0.8" fill="currentColor" stroke="none"/>
    <line x1="6" y1="13" x2="14" y2="13"/>
  </svg>
)
const IcoCalcSm = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/>
    <rect x="4.5" y="3.5" width="7" height="2.5" rx="0.5"/>
    <circle cx="5.5" cy="9" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="8" cy="9" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="10.5" cy="9" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="5.5" cy="12" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="8" cy="12" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="10.5" cy="12" r="0.7" fill="currentColor" stroke="none"/>
  </svg>
)
const IcoPlanSm = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <rect x="2" y="2" width="12" height="12" rx="1.5"/>
    <line x1="2" y1="6.5" x2="14" y2="6.5"/>
    <line x1="6.5" y1="6.5" x2="6.5" y2="14"/>
  </svg>
)
const IcoAttachment = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 9.5l-6.5 6.5A5 5 0 011.5 9L9 1.5a3.5 3.5 0 015 5L7 13.5a2 2 0 01-2.8-2.8L11 4"/>
  </svg>
)
const IcoMic = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6.5" y="2" width="5" height="8" rx="2.5"/>
    <path d="M3 9a6 6 0 0012 0"/><line x1="9" y1="15" x2="9" y2="17.5"/><line x1="6" y1="17.5" x2="12" y2="17.5"/>
  </svg>
)
const IcoSend = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M14 2L2 7.5l5 1.5L9.5 14 14 2z" fill="white"/>
    <path d="M7 9l4-7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
const IcoPlus = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
  </svg>
)
const IcoMore = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="4.5" cy="9" r="1.2" fill="currentColor"/>
    <circle cx="9" cy="9" r="1.2" fill="currentColor"/>
    <circle cx="13.5" cy="9" r="1.2" fill="currentColor"/>
  </svg>
)
const IcoArrow = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="7" x2="12" y2="7"/><path d="M8 3l4 4-4 4"/>
  </svg>
)
const IcoCheck = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#722ED1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 6l3 3 5-5"/>
  </svg>
)

// ─── Ambient BG ───────────────────────────────────────────────────────────────

function AmbientBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
      <div className="absolute rounded-full" style={{ top: -100, right: -200, width: 600, height: 600, backgroundColor: 'rgba(114,46,209,0.04)', filter: 'blur(120px)' }} />
      <div className="absolute rounded-full" style={{ bottom: -200, left: -100, width: 700, height: 700, backgroundColor: 'rgba(243,234,255,0.50)', filter: 'blur(140px)' }} />
      <div className="absolute rounded-full" style={{ top: '50%', left: '45%', transform: 'translate(-50%,-50%)', width: 500, height: 500, backgroundColor: 'rgba(114,46,209,0.025)', filter: 'blur(110px)' }} />
    </div>
  )
}

// ─── AI Advisor Header ────────────────────────────────────────────────────────

function AIAdvisorHeader({ onNew }: { onNew: () => void }) {
  return (
    <header className="shrink-0 flex items-center justify-between px-5 lg:px-8 bg-white border-b border-[#E3DDD7]" style={{ height: 64 }}>
      {/* Left: identity */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[12px] bg-[#F3EAFF] flex items-center justify-center shrink-0" style={{ boxShadow: '0 0 0 1px rgba(114,46,209,0.10)' }}>
          <HIcon size={26} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-[#242326] leading-none" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>HOZIE</span>
          <span className="text-[9px] tracking-[0.08em] text-[#722ED1] leading-none" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>AI CONSTRUCTION ADVISOR</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-[#F3EAFF]">
          <span className="w-[6px] h-[6px] rounded-full bg-[#722ED1]" style={{ animation: 'hozieStatusPulse 2.2s ease-in-out infinite' }} />
          <span className="text-[9px] text-[#722ED1] tracking-[0.06em]" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>READY</span>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onNew}
          className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#E3DDD7] text-[12px] text-[#68636D] hover:bg-[#F4F0EC] hover:text-[#242326] transition-all cursor-pointer bg-transparent"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
        >
          <IcoPlus />
          New conversation
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#68636D] hover:bg-[#F4F0EC] transition-all cursor-pointer border-0 bg-transparent">
          <IcoMore />
        </button>
      </div>
    </header>
  )
}

// ─── Suggestion Card ──────────────────────────────────────────────────────────

function SuggestionCard({ icon, label, desc, onClick }: {
  icon: React.ReactNode; label: string; desc: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2.5 p-4 rounded-[14px] border border-[#E3DDD7] bg-white text-left cursor-pointer transition-all duration-150 hover:bg-[#F3EAFF] hover:border-[#722ED1] group outline-none"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      <span className="w-9 h-9 rounded-[10px] bg-[#F3EAFF] flex items-center justify-center text-[#722ED1] group-hover:bg-white transition-colors shrink-0">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>{label}</span>
        <span className="text-[11px] text-[#9A949D] leading-[1.5]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>{desc}</span>
      </div>
    </button>
  )
}

// ─── Hozie Message ────────────────────────────────────────────────────────────

function HozieMessage({ children, actions, isFirst }: {
  children: React.ReactNode;
  actions?: { label: string; icon?: React.ReactNode }[];
  isFirst?: boolean
}) {
  return (
    <div className="flex gap-3 items-start" style={{ animation: 'welcomeFadeUp 0.35s ease-out both' }}>
      <div className="w-8 h-8 rounded-[10px] bg-[#F3EAFF] flex items-center justify-center shrink-0 mt-0.5">
        <HIcon size={20} />
      </div>
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        <div className="flex flex-col gap-1.5">
          {isFirst && (
            <span className="text-[11px] font-medium text-[#722ED1]" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>Hozie</span>
          )}
          <div
            className="text-[15px] text-[#242326] leading-[1.7]"
            style={{ fontFamily: '"Google Sans Flex:Medium", sans-serif' }}
          >
            {children}
          </div>
        </div>
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {actions.map(a => (
              <button
                key={a.label}
                className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#E3DDD7] text-[12px] text-[#68636D] hover:bg-[#F3EAFF] hover:border-[#722ED1] hover:text-[#722ED1] transition-all cursor-pointer bg-white"
                style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
              >
                {a.icon && <span className="w-3.5 h-3.5 flex items-center justify-center">{a.icon}</span>}
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── User Message ─────────────────────────────────────────────────────────────

function UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end" style={{ animation: 'welcomeFadeUp 0.3s ease-out both' }}>
      <div
        className="max-w-[75%] px-4 py-3 rounded-[16px] rounded-br-[4px] text-[14px] text-[#242326] leading-[1.65]"
        style={{ backgroundColor: '#F3EAFF', fontFamily: '"Open Sans:Regular", sans-serif' }}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Thinking Dots ────────────────────────────────────────────────────────────

function ThinkingBubble() {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-[10px] bg-[#F3EAFF] flex items-center justify-center shrink-0 mt-0.5" style={{ animation: 'aiIconGlow 1.8s ease-in-out infinite' }}>
        <HIcon size={20} />
      </div>
      <div className="flex items-center gap-2 py-2.5 px-4 rounded-[14px] bg-white border border-[#E3DDD7]">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-[#722ED1] block"
            style={{ animation: `hozieStatusPulse 1.2s ease-in-out ${i * 0.18}s infinite` }}
          />
        ))}
        <span className="text-[10px] text-[#722ED1] ml-1" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>Hozie is thinking...</span>
      </div>
    </div>
  )
}

// ─── Estimate Card (inside message) ──────────────────────────────────────────

function EstimateCard() {
  return (
    <div className="rounded-[16px] border border-[#E3DDD7] bg-white overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(114,46,209,0.07)' }}>
      <div className="px-5 pt-4 pb-3 bg-[#F3EAFF] flex items-center gap-2 border-b border-[#E3DDD7]">
        <span className="text-[10px] tracking-[0.10em] text-[#722ED1] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>Estimate Range</span>
      </div>
      <div className="px-5 py-4 flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <span className="text-[28px] font-semibold text-[#242326] leading-none" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
            ₹29.8L – ₹35.2L
          </span>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] text-[#9A949D]" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>AI CONFIDENCE</span>
            <span className="text-[18px] font-semibold text-[#722ED1]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>86%</span>
          </div>
        </div>
        <div className="h-1.5 bg-[#F4F0EC] rounded-full overflow-hidden">
          <div className="h-full bg-[#722ED1] rounded-full" style={{ width: '86%' }} />
        </div>
        <p className="text-[12px] text-[#68636D] leading-[1.55] m-0" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
          Based on 2,400 sq ft G+1 construction in Hyderabad with mid-range finishes. Excludes land cost and interior work.
        </p>
        <button className="h-10 px-4 rounded-[10px] bg-[#722ED1] text-white text-[13px] font-medium cursor-pointer hover:brightness-90 transition-all border-0 self-start" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
          Create detailed estimate →
        </button>
      </div>
    </div>
  )
}

// ─── Chat Composer ────────────────────────────────────────────────────────────

function ChatComposer({ value, onChange, onSubmit, disabled }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean
}) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && value.trim()) { e.preventDefault(); onSubmit() }
  }
  return (
    <div className="shrink-0 flex flex-col gap-2 px-4 pb-4 pt-3 bg-gradient-to-t from-[#FBF9F7] via-[#FBF9F7] to-transparent">
      <div
        className="flex items-center gap-3 bg-white border border-[#E3DDD7] rounded-[16px] px-4 h-[64px] focus-within:border-[#722ED1] focus-within:shadow-[0_0_0_3px_rgba(114,46,209,0.08)] transition-all"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        <div className="shrink-0 flex items-center justify-center opacity-50">
          <HIcon size={22} />
        </div>
        <input
          type="text"
          placeholder="Ask Hozie anything about your construction..."
          className="flex-1 bg-transparent outline-none text-[14px] text-[#242326] placeholder-[#9A949D]"
          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
        />
        <div className="flex items-center gap-1.5">
          <button className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#9A949D] hover:text-[#68636D] hover:bg-[#F4F0EC] transition-all cursor-pointer border-0 bg-transparent">
            <IcoAttachment />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#9A949D] hover:text-[#68636D] hover:bg-[#F4F0EC] transition-all cursor-pointer border-0 bg-transparent">
            <IcoMic />
          </button>
          <button
            onClick={onSubmit}
            disabled={!value.trim() || disabled}
            className={[
              'w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-150 border-0',
              value.trim() && !disabled
                ? 'bg-[#722ED1] cursor-pointer hover:brightness-90 active:scale-95'
                : 'bg-[#E3DDD7] cursor-not-allowed',
            ].join(' ')}
          >
            <IcoSend />
          </button>
        </div>
      </div>
      <p className="text-center text-[9px] text-[#9A949D]" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
        Hozie can make mistakes. Review important estimates before making decisions.
      </p>
    </div>
  )
}

// ─── Right Context Panel ──────────────────────────────────────────────────────

const ctxTools = [
  { label: 'Create Estimate', icon: <IcoBarChart /> },
  { label: 'Material Calculator', icon: <IcoCalcSm /> },
  { label: 'BOQ Generator', icon: <IcoList /> },
  { label: 'Plan Analysis', icon: <IcoPlanSm /> },
]

function RightContextPanel() {
  return (
    <aside
      className="hidden xl:flex flex-col shrink-0 overflow-y-auto gap-4 p-4 border-l border-[#E3DDD7] bg-white"
      style={{ width: 296, scrollbarWidth: 'none' }}
    >
      {/* Project context */}
      <div className="flex flex-col gap-3">
        <span className="text-[10px] tracking-[0.10em] text-[#722ED1] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>
          Project Context
        </span>
        <div className="rounded-[14px] border border-[#E3DDD7] bg-[#FBF9F7] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E3DDD7]">
            <span className="text-[10px] tracking-[0.06em] text-[#9A949D] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>Current Project</span>
          </div>
          <div className="px-4 py-3.5 flex flex-col gap-2.5">
            <div>
              <p className="text-[14px] font-semibold text-[#242326] m-0" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>3 BHK G+1 House</p>
            </div>
            {[['Location', 'Hyderabad'], ['Area', '2,400 sq ft'], ['Status', 'Planning']].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#9A949D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>{k}</span>
                <span
                  className={k === 'Status' ? 'text-[11px] text-[#722ED1] bg-[#F3EAFF] px-2 py-0.5 rounded-full font-medium' : 'text-[11px] text-[#242326]'}
                  style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hozie knows */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] tracking-[0.10em] text-[#9A949D] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>Hozie Knows</span>
        <div className="flex flex-col gap-2">
          {['Project type', 'Location', 'User role'].map(item => (
            <div key={item} className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-[#F3EAFF] flex items-center justify-center shrink-0">
                <IcoCheck />
              </div>
              <span className="text-[12px] text-[#242326]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#E3DDD7]" />

      {/* Next best action */}
      <div className="flex flex-col gap-3">
        <span className="text-[10px] tracking-[0.10em] text-[#9A949D] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>Next Best Action</span>
        <div className="rounded-[12px] border border-[#E3DDD7] bg-white p-3.5 flex flex-col gap-2.5">
          <p className="text-[13px] text-[#242326] m-0" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>Confirm your plot size to get a more accurate estimate.</p>
          <button className="h-8 px-3 rounded-[8px] bg-[#722ED1] text-white text-[12px] font-medium cursor-pointer hover:brightness-90 border-0 self-start" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
            Continue →
          </button>
        </div>
      </div>

      <div className="border-t border-[#E3DDD7]" />

      {/* Hozie tools */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] tracking-[0.10em] text-[#9A949D] uppercase" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>Hozie Tools</span>
        <div className="flex flex-col gap-0.5">
          {ctxTools.map(tool => (
            <button
              key={tool.label}
              className="flex items-center gap-3 h-10 px-3 rounded-[10px] border-0 bg-transparent text-[#68636D] hover:bg-[#F4F0EC] hover:text-[#242326] cursor-pointer transition-all text-left"
            >
              <span className="shrink-0 w-4 h-4 flex items-center justify-center text-[#9A949D]">{tool.icon}</span>
              <span className="flex-1 text-[13px]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>{tool.label}</span>
              <span className="text-[#C4BFC8]"><IcoArrow /></span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}

// ─── Mobile top bar ───────────────────────────────────────────────────────────

function MobileTopBar({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex md:hidden h-12 items-center justify-between px-4 bg-white border-b border-[#E3DDD7] shrink-0 z-10">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-[9px] bg-[#F3EAFF] flex items-center justify-center">
          <HIcon size={18} />
        </div>
        <span className="text-[14px] font-semibold text-[#242326]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>Hozie</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onNew} className="w-8 h-8 flex items-center justify-center text-[#68636D] border-0 bg-transparent cursor-pointer"><IcoPlus /></button>
        <button className="w-8 h-8 flex items-center justify-center text-[#68636D] border-0 bg-transparent cursor-pointer"><IcoMore /></button>
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const suggestions = [
  { icon: <IcoBarChart />, label: 'Estimate construction cost', desc: 'Get a budget range for your project', intent: 'How much will it cost to build my house?' },
  { icon: <IcoList />, label: 'Build a BOQ', desc: 'Generate a bill of quantities', intent: 'Build a detailed BOQ for my project' },
  { icon: <IcoCalcSm />, label: 'Calculate materials', desc: 'Find out exactly what you need', intent: 'Calculate the materials needed for my construction' },
  { icon: <IcoPlanSm />, label: 'Analyze a floor plan', desc: 'Upload and review your layout', intent: 'I want to analyze my floor plan' },
]

function buildInitialMessages(): Message[] {
  return [
    {
      id: 'm0',
      role: 'hozie',
      content: (
        <div className="flex flex-col gap-2">
          <p className="m-0">Hi Adarsh 👋</p>
          <p className="m-0">I can help you plan your construction from the first idea to a detailed estimate.</p>
          <p className="m-0">For example, you can ask:</p>
          <p className="m-0 text-[#722ED1] font-medium" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>
            &ldquo;How much will it cost to build a 3 BHK house in Hyderabad?&rdquo;
          </p>
        </div>
      ),
      isFirst: true,
    } as Message & { isFirst?: boolean },
    {
      id: 'm1',
      role: 'user',
      content: 'I want to build a 3 BHK G+1 house in Hyderabad.',
    },
    {
      id: 'm2',
      role: 'hozie',
      content: (
        <div className="flex flex-col gap-2.5">
          <p className="m-0">Great. I can help you build an initial estimate.</p>
          <p className="m-0">To make it accurate, I need a few details:</p>
          <ol className="m-0 pl-4 flex flex-col gap-1 list-decimal">
            {['Plot size', 'Approximate built-up area', 'Number of floors', 'Construction quality', 'Location'].map((item, i) => (
              <li key={i} className="text-[15px] text-[#242326]">{item}</li>
            ))}
          </ol>
          <p className="m-0 text-[#722ED1]" style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}>Let&apos;s start with your plot size.</p>
        </div>
      ),
      actions: [
        { label: 'Enter plot size', icon: undefined },
        { label: 'Upload floor plan', icon: undefined },
        { label: 'Start estimate', icon: undefined },
      ],
    },
  ] as Message[]
}

export default function AIAdvisorScreen({ onNavigate }: { onNavigate: (s: string, data?: Record<string, string>) => void }) {
  const [chatState, setChatState] = useState<ChatState>('conversation')
  const [messages, setMessages] = useState<Message[]>(buildInitialMessages)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatState])

  const handleNew = () => {
    setMessages([])
    setChatState('suggestions')
    setInput('')
  }

  const handleSuggestion = (intent: string) => {
    setInput(intent)
    setChatState('conversation')
  }

  const handleSubmit = () => {
    if (!input.trim() || chatState === 'thinking') return
    const userMsg: Message = { id: `m${Date.now()}`, role: 'user', content: input }
    const isEstimateQuery = input.toLowerCase().includes('estimat') || input.toLowerCase().includes('cost') || input.toLowerCase().includes('budget')
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setChatState('thinking')

    setTimeout(() => {
      const reply: Message = {
        id: `m${Date.now() + 1}`,
        role: 'hozie',
        content: isEstimateQuery ? (
          <div className="flex flex-col gap-4">
            <p className="m-0">Based on the details you&apos;ve shared, here&apos;s an initial estimate for your 3 BHK G+1 house in Hyderabad:</p>
            <EstimateCard />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="m-0">Understood. To give you the most accurate guidance, could you confirm a few details about your project?</p>
            <p className="m-0">Let&apos;s start with your plot size — how many square yards or square feet is your plot?</p>
          </div>
        ),
        actions: isEstimateQuery
          ? [{ label: 'Refine estimate', icon: undefined }, { label: 'Create BOQ', icon: undefined }]
          : [{ label: 'Enter plot size', icon: undefined }, { label: 'Skip for now', icon: undefined }],
      }
      setMessages(prev => [...prev, reply])
      setChatState('conversation')
    }, 2400)
  }

  const isSuggestions = chatState === 'suggestions' && messages.length === 0

  return (
    <HomeownerLayout active="advisor" onNavigate={onNavigate}>
      <div className="flex flex-col relative" style={{ height: '100%', backgroundColor: '#FBF9F7' }}>
        <AmbientBg />

        {/* Mobile top bar */}
        <MobileTopBar onNew={handleNew} />

        {/* Main content */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="hidden md:flex flex-col">
            <AIAdvisorHeader onNew={handleNew} />
          </div>

          {/* Chat area + right panel */}
          <div className="flex flex-1 min-h-0">
            {/* Chat column */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              {/* Messages scroll area */}
              <div
                className="flex-1 overflow-y-auto"
                style={{ scrollbarWidth: 'none' }}
              >
                <div className="max-w-[820px] mx-auto px-4 pt-8 pb-4 flex flex-col gap-6">
                  {/* Greeting */}
                  <div className="flex flex-col gap-2" style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.05s both' }}>
                    <h2
                      className="text-[24px] sm:text-[28px] font-semibold text-[#242326] m-0"
                      style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
                    >
                      Good morning, Adarsh.
                    </h2>
                    <p
                      className="text-[14px] sm:text-[15px] text-[#68636D] leading-[1.65] m-0"
                      style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                    >
                      I&apos;m Hozie, your AI construction advisor. Tell me what you&apos;re planning to build and I&apos;ll help you work through it.
                    </p>
                  </div>

                  {/* Suggestion cards — shown when no conversation */}
                  {isSuggestions && (
                    <div
                      className="grid grid-cols-2 gap-3"
                      style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.15s both' }}
                    >
                      {suggestions.map(s => (
                        <SuggestionCard
                          key={s.label}
                          icon={s.icon}
                          label={s.label}
                          desc={s.desc}
                          onClick={() => handleSuggestion(s.intent)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Conversation suggestion cards — shown above messages */}
                  {!isSuggestions && messages.length === buildInitialMessages().length && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.1s both' }}>
                      {suggestions.map(s => (
                        <button
                          key={s.label}
                          onClick={() => handleSuggestion(s.intent)}
                          className="flex items-center gap-2 h-[40px] px-3 rounded-[10px] border border-[#E3DDD7] bg-white text-[12px] text-[#68636D] hover:bg-[#F3EAFF] hover:border-[#722ED1] hover:text-[#722ED1] cursor-pointer transition-all text-left"
                          style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
                        >
                          <span className="shrink-0 text-[#9A949D]">{s.icon}</span>
                          <span className="leading-tight">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Messages */}
                  {messages.map(msg => (
                    msg.role === 'hozie' ? (
                      <HozieMessage
                        key={msg.id}
                        actions={(msg as Message & { actions?: { label: string; icon?: React.ReactNode }[] }).actions}
                        isFirst={(msg as Message & { isFirst?: boolean }).isFirst}
                      >
                        {msg.content}
                      </HozieMessage>
                    ) : (
                      <UserMessage key={msg.id}>{msg.content}</UserMessage>
                    )
                  ))}

                  {/* Thinking indicator */}
                  {chatState === 'thinking' && <ThinkingBubble />}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Composer */}
              <ChatComposer
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                disabled={chatState === 'thinking'}
              />
            </div>

            {/* Right context panel */}
            <RightContextPanel />
          </div>
        </div>
      </div>
    </HomeownerLayout>
  )
}
