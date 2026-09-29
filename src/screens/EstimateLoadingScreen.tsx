import { useState, useEffect } from 'react'
import HIcon from '../components/HIcon'
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { getEstimate } from '../mock/selectors'

// ─── Processing state machine ──────────────────────────────────────────────────

interface ProcessingPhase {
  stateLabel: string
  statusSub: string
  progress: number
  doneCount: number   // how many steps are ✓
}

const phases: ProcessingPhase[] = [
  { stateLabel: 'PREPARING PROJECT DATA',               statusSub: 'Initialising estimate generation',                        progress: 14,  doneCount: 0 },
  { stateLabel: 'CALCULATING CONSTRUCTION QUANTITIES',  statusSub: 'Analysing structural parameters and floor layout',        progress: 38,  doneCount: 1 },
  { stateLabel: 'ESTIMATING MATERIALS + LABOUR',        statusSub: 'Analysing your project details',                          progress: 72,  doneCount: 2 },
  { stateLabel: 'PREPARING YOUR ESTIMATE',              statusSub: 'Compiling cost breakdown and contingency values',         progress: 92,  doneCount: 3 },
  { stateLabel: 'ESTIMATE READY',                       statusSub: 'Your construction estimate has been generated',           progress: 100, doneCount: 5 },
]

const STEP_LABELS = [
  'Understanding project requirements',
  'Calculating construction quantities',
  'Estimating materials and labour',
  'Preparing cost breakdown',
  'Preparing your estimate',
]

// Cumulative delay in ms to move to each phase (0-indexed)
const PHASE_TIMINGS = [1800, 3800, 6400, 8600]   // transitions: 0→1, 1→2, 2→3, 3→4

// ─── Step Icon ────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: 'done' | 'active' | 'pending' }) {
  if (status === 'done') {
    return (
      <div className="w-5 h-5 rounded-full bg-[#722ED1] flex items-center justify-center shrink-0">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5.2l2.2 2.2 3.8-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    )
  }
  if (status === 'active') {
    return (
      <div
        className="w-5 h-5 rounded-full bg-[#722ED1] flex items-center justify-center shrink-0"
        style={{ animation: 'estimatePulse 1.4s ease-in-out infinite' }}
      >
        <div className="w-2 h-2 rounded-full bg-white" />
      </div>
    )
  }
  return (
    <div className="w-5 h-5 rounded-full border-2 border-[#E3DDD7] shrink-0" />
  )
}

// ─── Processing Icon ──────────────────────────────────────────────────────────

function ProcessingIcon({ complete }: { complete: boolean }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 192, height: 192 }}>
      {/* Rings — 3 expanding outward, staggered */}
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            inset: 0,
            border: `1.5px solid rgba(114,46,209,${0.22 - i * 0.05})`,
            animation: complete
              ? undefined
              : `estimateRingExpand 3s ease-out ${i * 1}s infinite`,
            opacity: complete ? 0 : undefined,
            transition: 'opacity 0.6s ease',
          }}
        />
      ))}

      {/* Soft lavender glow disc */}
      <div
        className="absolute rounded-full bg-[#F3EAFF]"
        style={{ width: 120, height: 120, filter: 'blur(16px)', opacity: 0.85 }}
      />

      {/* Icon tile */}
      <div
        className="relative flex items-center justify-center rounded-[24px] bg-[#F3EAFF] z-10"
        style={{
          width: 88,
          height: 88,
          boxShadow: complete
            ? '0 0 0 4px #722ED1, 0 0 40px rgba(114,46,209,0.28)'
            : '0 0 32px rgba(114,46,209,0.18)',
          animation: complete ? undefined : 'estimatePulse 2.8s ease-in-out infinite',
          transition: 'box-shadow 0.6s ease',
        }}
      >
        <HIcon size={52} />
      </div>

      {/* Complete checkmark overlay */}
      {complete && (
        <div
          className="absolute bottom-8 right-8 w-7 h-7 rounded-full bg-[#722ED1] flex items-center justify-center z-20"
          style={{ animation: 'estimateButtonPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2.5 6.5l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </div>
  )
}

// ─── Ambient Background ───────────────────────────────────────────────────────

function AmbientBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute rounded-full" style={{ top: -120, right: -180, width: 600, height: 600, backgroundColor: 'rgba(114,46,209,0.048)', filter: 'blur(130px)' }} />
      <div className="absolute rounded-full" style={{ bottom: -160, left: -120, width: 680, height: 680, backgroundColor: 'rgba(243,234,255,0.55)', filter: 'blur(140px)' }} />
      <div className="absolute rounded-full" style={{ top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, height: 520, backgroundColor: 'rgba(114,46,209,0.028)', filter: 'blur(110px)' }} />
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full max-w-[420px] mx-auto flex flex-col gap-2">
      <div className="h-1.5 w-full bg-[#E3DDD7] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#722ED1] rounded-full"
          style={{ width: `${value}%`, transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EstimateLoadingScreen({
  onNavigate,
  estimateId,
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  estimateId?: string
}) {
  const { state } = useConstructionData()
  const estimate = estimateId ? getEstimate(state, estimateId) : undefined
  const [phaseIdx, setPhaseIdx] = useState(0)

  useEffect(() => {
    const timers = PHASE_TIMINGS.map((delay, i) =>
      setTimeout(() => setPhaseIdx(i + 1), delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  const phase = phases[phaseIdx]
  const complete = phaseIdx === phases.length - 1

  return (
    <div
      className="min-h-full flex flex-col items-center justify-between"
      style={{ backgroundColor: '#FBF9F7' }}
    >
      <AmbientBg />

      {/* Spacer */}
      <div />

      {/* Main centered column */}
      <div
        className="relative z-10 flex flex-col items-center gap-8 px-5 sm:px-8 w-full py-12"
        style={{ maxWidth: 600 }}
      >

        {/* Processing icon */}
        <div style={{ animation: 'estimateReveal 0.5s ease-out 0.1s both' }}>
          <ProcessingIcon complete={complete} />
        </div>

        {/* Eyebrow */}
        <div
          className="flex flex-col items-center gap-1"
          style={{ animation: 'estimateReveal 0.5s ease-out 0.18s both' }}
        >
          <span
            className="text-[10px] tracking-[0.10em] text-[#722ED1]"
            style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}
          >
            HOZIE · AI CONSTRUCTION ADVISOR
          </span>
        </div>

        {/* Headline + description */}
        <div
          className="flex flex-col items-center gap-3 text-center"
          style={{ animation: 'estimateReveal 0.5s ease-out 0.26s both' }}
        >
          <h1
            className="text-[32px] sm:text-[44px] font-semibold text-[#242326] m-0 leading-[1.08]"
            style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
          >
            {complete ? 'Estimate ready.' : 'Building your estimate.'}
          </h1>
          <p
            className="text-[14px] sm:text-[15px] text-[#68636D] leading-[1.65] m-0"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif', maxWidth: 480 }}
          >
            {complete
              ? 'Hozie has finished analysing your project. Your initial construction estimate is ready to view.'
              : 'Hozie is analysing your project and preparing an initial construction estimate.'}
          </p>
        </div>

        {/* Project context card */}
        <div
          className="w-full bg-white rounded-[16px] border border-[#E3DDD7] px-5 py-4 flex items-center justify-between gap-4"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)', animation: 'estimateReveal 0.5s ease-out 0.32s both' }}
        >
          <div className="flex flex-col gap-1">
            <span
              className="text-[13px] font-semibold text-[#242326]"
              style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
            >
              {estimate?.projectName ?? 'Your project'}
            </span>
            <span
              className="text-[11px] text-[#68636D]"
              style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
            >
              {estimate ? `${estimate.location} · ${estimate.builtUpAreaSqft.toLocaleString('en-IN')} sq ft` : ''}
            </span>
          </div>
          <span
            className={[
              'shrink-0 text-[10px] tracking-[0.06em] px-2.5 py-1 rounded-full',
              complete ? 'text-[#722ED1] bg-[#F3EAFF]' : 'text-[#9A949D] bg-[#F4F0EC]',
            ].join(' ')}
            style={{ fontFamily: '"Sometype Mono:SemiBold", monospace', transition: 'all 0.5s ease' }}
          >
            {complete ? 'ESTIMATE READY' : 'GENERATING ESTIMATE'}
          </span>
        </div>

        {/* Processing steps */}
        <div
          className="w-full flex flex-col gap-3"
          style={{ animation: 'estimateReveal 0.5s ease-out 0.38s both' }}
        >
          {STEP_LABELS.map((label, i) => {
            const status: 'done' | 'active' | 'pending' =
              i < phase.doneCount ? 'done'
              : i === phase.doneCount && !complete ? 'active'
              : 'pending'
            return (
              <div key={label} className="flex items-center gap-3">
                <StepIcon status={status} />
                <span
                  className="text-[13px] leading-none"
                  style={{
                    fontFamily: '"Open Sans:Regular", sans-serif',
                    color: status === 'pending' ? '#9A949D' : '#242326',
                    transition: 'color 0.4s ease',
                  }}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Current status */}
        <div
          className="flex flex-col items-center gap-1.5 text-center"
          style={{ animation: 'estimateReveal 0.4s ease-out 0.44s both' }}
        >
          <span
            className="text-[10px] tracking-[0.10em] text-[#722ED1]"
            style={{
              fontFamily: '"Sometype Mono:SemiBold", monospace',
              animation: complete ? undefined : 'hozieStatusPulse 2s ease-in-out infinite',
              transition: 'opacity 0.4s',
            }}
          >
            {phase.stateLabel}
          </span>
          <span
            className="text-[12px] text-[#9A949D]"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            {phase.statusSub}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="w-full"
          style={{ animation: 'estimateReveal 0.4s ease-out 0.5s both' }}
        >
          <ProgressBar value={phase.progress} />
        </div>

        {/* View estimate button — appears only on complete, and only if the estimate really exists */}
        {complete && estimate && (
          <button
            onClick={() => onNavigate('estimate-dashboard', { estimate_id: estimate.id })}
            className="h-[52px] px-8 rounded-[12px] bg-[#722ED1] text-white text-[15px] font-semibold cursor-pointer hover:brightness-90 active:scale-[0.98] transition-all border-0"
            style={{
              fontFamily: '"Google Sans Flex:SemiBold", sans-serif',
              animation: 'estimateButtonPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both',
              minWidth: 220,
            }}
          >
            View estimate →
          </button>
        )}
        {complete && !estimate && (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-[13px] text-[#68636D]" style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}>
              We couldn&apos;t find that estimate.
            </span>
            <button
              onClick={() => onNavigate('create-project')}
              className="h-[44px] px-6 rounded-[12px] bg-[#722ED1] text-white text-[14px] font-semibold cursor-pointer hover:brightness-90 transition-all border-0"
              style={{ fontFamily: '"Google Sans Flex:SemiBold", sans-serif' }}
            >
              Start over
            </button>
          </div>
        )}

        {/* Hozie message card */}
        <div
          className="w-full flex items-start gap-3 bg-white border border-[#E3DDD7] rounded-[12px] px-4 py-3.5"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)', animation: 'estimateReveal 0.4s ease-out 0.55s both' }}
        >
          <div className="shrink-0 w-7 h-7 rounded-[8px] bg-[#F3EAFF] flex items-center justify-center">
            <HIcon size={18} />
          </div>
          <p
            className="text-[13px] text-[#242326] leading-[1.6] m-0"
            style={{ fontFamily: '"Open Sans:Regular", sans-serif' }}
          >
            Your estimate will include materials, labour, finishing and contingency — covering all major cost categories.
          </p>
        </div>

      </div>

      {/* Footer */}
      <footer
        className="relative z-10 flex justify-center items-center gap-2.5 pb-6"
        style={{ animation: 'estimateReveal 0.4s ease-out 0.6s both' }}
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
              <span className="text-[9px] text-[#C4BFC8]" style={{ fontFamily: '"Sometype Mono:SemiBold", monospace' }}>/</span>
            )}
          </span>
        ))}
      </footer>
    </div>
  )
}
