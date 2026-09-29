import { useState, useEffect } from 'react'
import { Button, Flex, Progress, Result, Steps, Typography } from 'antd'
import AmbientBg from '../components/homeowner/AmbientBg'
import HIcon from '../components/HIcon'
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { getEstimate } from '../mock/selectors'

const { Text, Title } = Typography

interface ProcessingPhase {
  stateLabel: string
  statusSub: string
  progress: number
  doneCount: number
}

const phases: ProcessingPhase[] = [
  { stateLabel: 'PREPARING PROJECT DATA', statusSub: 'Initialising estimate generation', progress: 14, doneCount: 0 },
  { stateLabel: 'CALCULATING CONSTRUCTION QUANTITIES', statusSub: 'Analysing structural parameters and floor layout', progress: 38, doneCount: 1 },
  { stateLabel: 'ESTIMATING MATERIALS + LABOUR', statusSub: 'Analysing your project details', progress: 72, doneCount: 2 },
  { stateLabel: 'PREPARING YOUR ESTIMATE', statusSub: 'Compiling cost breakdown and contingency values', progress: 92, doneCount: 3 },
  { stateLabel: 'ESTIMATE READY', statusSub: 'Your construction estimate has been generated', progress: 100, doneCount: 5 },
]

const STEP_LABELS = [
  'Understanding project requirements',
  'Calculating construction quantities',
  'Estimating materials and labour',
  'Preparing cost breakdown',
  'Preparing your estimate',
]

const PHASE_TIMINGS = [1800, 3800, 6400, 8600]

/** Pulsing Hozie tile with expanding rings — kept custom, not an AntD component. */
function ProcessingIcon({ complete }: { complete: boolean }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 192, height: 192 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            inset: 0,
            border: `1.5px solid rgba(114,46,209,${0.22 - i * 0.05})`,
            animation: complete ? undefined : `estimateRingExpand 3s ease-out ${i * 1}s infinite`,
            opacity: complete ? 0 : undefined,
            transition: 'opacity 0.6s ease',
          }}
        />
      ))}
      <div className="absolute rounded-full bg-[#F3EAFF]" style={{ width: 120, height: 120, filter: 'blur(16px)', opacity: 0.85 }} />
      <div
        className="relative flex items-center justify-center rounded-[24px] bg-[#F3EAFF] z-10"
        style={{
          width: 88,
          height: 88,
          boxShadow: complete ? '0 0 0 4px #722ED1, 0 0 40px rgba(114,46,209,0.28)' : '0 0 32px rgba(114,46,209,0.18)',
          animation: complete ? undefined : 'estimatePulse 2.8s ease-in-out infinite',
          transition: 'box-shadow 0.6s ease',
        }}
      >
        <HIcon size={52} />
      </div>
      {complete && (
        <div
          className="absolute bottom-8 right-8 w-7 h-7 rounded-full bg-[#722ED1] flex items-center justify-center z-20"
          style={{ animation: 'estimateButtonPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2.5 6.5l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  )
}

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
    const timers = PHASE_TIMINGS.map((delay, i) => setTimeout(() => setPhaseIdx(i + 1), delay))
    return () => timers.forEach(clearTimeout)
  }, [])

  const phase = phases[phaseIdx]
  const complete = phaseIdx === phases.length - 1

  if (complete && !estimate) {
    return (
      <div className="relative min-h-full flex items-center justify-center" style={{ backgroundColor: '#FBF9F7' }}>
        <AmbientBg variant="estimate-loading" />
        <div className="relative z-10">
          <Result
            status="error"
            title="We couldn't find that estimate."
            extra={<Button type="primary" onClick={() => onNavigate('create-project')}>Start over</Button>}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-full flex flex-col items-center justify-center" style={{ backgroundColor: '#FBF9F7' }}>
      <AmbientBg variant="estimate-loading" />
      <Flex vertical align="center" gap={32} className="relative z-10 px-5 sm:px-8 w-full py-12" style={{ maxWidth: 600 }}>
        <div style={{ animation: 'estimateReveal 0.5s ease-out 0.1s both' }}>
          <ProcessingIcon complete={complete} />
        </div>

        <Text className="text-[10px] tracking-[0.10em] text-[#722ED1]!" style={{ animation: 'estimateReveal 0.5s ease-out 0.18s both' }}>
          HOZIE · AI CONSTRUCTION ADVISOR
        </Text>

        <Flex vertical align="center" gap={12} className="text-center" style={{ animation: 'estimateReveal 0.5s ease-out 0.26s both' }}>
          <Title level={1} className="m-0!">{complete ? 'Estimate ready.' : 'Building your estimate.'}</Title>
          <Text type="secondary" style={{ maxWidth: 480 }}>
            {complete
              ? 'Hozie has finished analysing your project. Your initial construction estimate is ready to view.'
              : 'Hozie is analysing your project and preparing an initial construction estimate.'}
          </Text>
        </Flex>

        {estimate && (
          <Flex
            align="center"
            justify="space-between"
            gap={16}
            className="w-full bg-white rounded-[16px] border border-[#E3DDD7] px-5 py-4"
            style={{ animation: 'estimateReveal 0.5s ease-out 0.32s both' }}
          >
            <Flex vertical gap={2}>
              <Text strong>{estimate.projectName}</Text>
              <Text type="secondary" className="text-[11px]!">
                {estimate.location} · {estimate.builtUpAreaSqft.toLocaleString('en-IN')} sq ft
              </Text>
            </Flex>
            <Text className={complete ? 'text-[#722ED1]!' : 'text-[#9A949D]!'} style={{ fontSize: 10 }}>
              {complete ? 'ESTIMATE READY' : 'GENERATING ESTIMATE'}
            </Text>
          </Flex>
        )}

        <div className="w-full" style={{ animation: 'estimateReveal 0.5s ease-out 0.38s both' }}>
          <Steps
            direction="vertical"
            size="small"
            className="w-full"
            current={phase.doneCount}
            status={complete ? 'finish' : 'process'}
            items={STEP_LABELS.map((label, i) => ({
              title: label,
              status: i < phase.doneCount ? 'finish' : i === phase.doneCount && !complete ? 'process' : 'wait',
            }))}
          />
        </div>

        <Flex vertical align="center" gap={4} className="text-center" style={{ animation: 'estimateReveal 0.4s ease-out 0.44s both' }}>
          <Text
            className="text-[10px] tracking-[0.10em] text-[#722ED1]!"
            style={{ animation: complete ? undefined : 'hozieStatusPulse 2s ease-in-out infinite' }}
          >
            {phase.stateLabel}
          </Text>
          <Text type="secondary" className="text-[12px]!">{phase.statusSub}</Text>
        </Flex>

        <div className="w-full" style={{ animation: 'estimateReveal 0.4s ease-out 0.5s both' }}>
          <Progress percent={phase.progress} showInfo={false} strokeColor="#722ED1" className="w-full" />
        </div>

        {complete && estimate && (
          <Button
            type="primary"
            size="large"
            onClick={() => onNavigate('estimate-dashboard', { estimate_id: estimate.id })}
            style={{ animation: 'estimateButtonPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both' }}
          >
            View estimate →
          </Button>
        )}

        <Flex
          align="flex-start"
          gap={12}
          className="w-full bg-white border border-[#E3DDD7] rounded-[12px] px-4 py-3.5"
          style={{ animation: 'estimateReveal 0.4s ease-out 0.55s both' }}
        >
          <div className="shrink-0 w-7 h-7 rounded-[8px] bg-[#F3EAFF] flex items-center justify-center">
            <HIcon size={18} />
          </div>
          <Text className="text-[13px]!">
            Your estimate will include materials, labour, finishing and contingency — covering all major cost categories.
          </Text>
        </Flex>
      </Flex>
    </div>
  )
}
