import {
  DownloadOutlined,
  EditOutlined,
  FileOutlined,
  MoreOutlined,
  ToolOutlined,
  ProjectOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Col, Empty, Flex, Row, Statistic, Typography } from 'antd'
import AmbientBg from '../components/homeowner/AmbientBg'
import EstimateTotalSummary, { formatRupees } from '../components/homeowner/EstimateTotalSummary'
import HIcon from '../components/HIcon'
import HomeownerLayout from '../components/homeowner/HomeownerLayout'
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { getEstimate, getLatestEstimate } from '../mock/selectors'
import { useCommand } from '../session/useCommand'
import { useSession } from '../session/SessionProvider'

const { Text, Title } = Typography

interface BreakdownItem { label: string; percent: number; amount: string; color: string }

/** Segmented multi-colour bar — no direct AntD primitive for this shape, kept bespoke. */
function CostBreakdownCard({ items }: { items: BreakdownItem[] }) {
  return (
    <Card
      title={<Title level={5} className="m-0!">Where Your Money Goes</Title>}
      extra={<Text type="secondary">Mid-range estimate</Text>}
    >
      <Flex vertical gap={16}>
        <div className="flex h-3 rounded-full overflow-hidden gap-px">
          {items.map((item) => (
            <div key={item.label} style={{ flex: item.percent, backgroundColor: item.color }} />
          ))}
        </div>
        <Row gutter={[12, 12]}>
          {items.map((item) => (
            <Col key={item.label} xs={12} sm={6}>
              <Flex vertical gap={4}>
                <Flex align="center" gap={6}>
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                  <Text type="secondary" className="text-[11px]!">{item.label}</Text>
                </Flex>
                <Flex align="baseline" gap={6}>
                  <Text strong className="text-[15px]!">{item.amount}</Text>
                  <Text type="secondary" className="text-[10px]!">{item.percent}%</Text>
                </Flex>
              </Flex>
            </Col>
          ))}
        </Row>
      </Flex>
    </Card>
  )
}

function HozieInsightCard({ onNavigate, estimateId }: { onNavigate: (s: string, data?: Record<string, string>) => void; estimateId: string }) {
  return (
    <Card className="bg-[#F3EAFF]! border-0!">
      <Flex vertical gap={12}>
        <Flex align="center" gap={10}>
          <div className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center shrink-0">
            <HIcon size={20} />
          </div>
          <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">Hozie Insight</Text>
        </Flex>
        <Text>
          &ldquo;Your estimate has the biggest cost sensitivity in materials and finishing. Choosing construction
          quality carefully can significantly change the final budget.&rdquo;
        </Text>
        <Button type="link" className="self-start p-0!" onClick={() => onNavigate('cost-breakdown', { estimate_id: estimateId })}>
          Explore cost drivers →
        </Button>
      </Flex>
    </Card>
  )
}

export default function EstimateDashboardScreen({
  onNavigate,
  estimateId,
}: {
  onNavigate: (s: string, data?: Record<string, string>) => void
  estimateId?: string
}) {
  const { state, confirmEstimate } = useConstructionData()
  const { session } = useSession()
  const run = useCommand()
  const estimate = estimateId
    ? getEstimate(state, estimateId)
    : session?.personId
      ? getLatestEstimate(state, session.personId)
      : undefined

  if (!estimate) {
    const message = estimateId ? "We couldn't find that estimate." : "You haven't created an estimate yet."
    return (
      <HomeownerLayout active="estimates" onNavigate={onNavigate}>
        <Flex align="center" justify="center" className="min-h-full">
          <Empty description={message}>
            <Button type="primary" onClick={() => onNavigate('create-project')}>Start an estimate</Button>
          </Empty>
        </Flex>
      </HomeownerLayout>
    )
  }

  const areaLabel = `${estimate.builtUpAreaSqft.toLocaleString('en-IN')} sq ft`
  const midpoint = (estimate.totalLow + estimate.totalHigh) / 2
  const pct = (amount: number) => Math.round((amount / midpoint) * 100)
  const nextActions = [
    {
      icon: <FileOutlined />,
      title: 'View BOQ',
      desc: 'See materials and quantities.',
      onClick: () => onNavigate('boq', { estimate_id: estimate.id }),
    },
    { icon: <ToolOutlined />, title: 'Material Calculator', desc: 'Check material requirements.' },
    { icon: <ProjectOutlined />, title: 'Analyze Plan', desc: 'Upload your floor plan.' },
    { icon: <TeamOutlined />, title: 'Find Contractors', desc: 'Get project bids.' },
  ]

  const handleConfirm = () => {
    run(() => confirmEstimate(estimate.id), { success: 'Estimate confirmed.' })
  }

  return (
    <HomeownerLayout active="estimates" onNavigate={onNavigate}>
      <div className="relative min-h-full" style={{ backgroundColor: '#FBF9F7' }}>
        <AmbientBg variant="estimate-dashboard" />
        <Flex vertical gap={20} className="relative z-10 max-w-[1080px] mx-auto! px-4! sm:px-6! lg:px-8! py-6! sm:py-8!">
          <Flex align="center" justify="space-between" wrap gap={12} style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.05s both' }}>
            <Flex vertical gap={2}>
              <Title level={3} className="m-0!">Construction Estimate</Title>
              <Text type="secondary">{estimate.projectName} · {estimate.location} · {areaLabel}</Text>
            </Flex>
            <Flex gap={8}>
              <Button icon={<EditOutlined />}>Edit project</Button>
              <Button icon={<DownloadOutlined />}>Download PDF</Button>
              <Button icon={<MoreOutlined />} />
            </Flex>
          </Flex>

          <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.08s both' }}>
            {estimate.reviewStatus === 'draft' ? (
              <Alert
                type="info"
                showIcon
                message="This is Hozie's AI-generated draft estimate."
                description="Review the numbers below, then confirm the estimate once you're happy with it."
                action={<Button size="small" type="primary" onClick={handleConfirm}>Confirm estimate</Button>}
              />
            ) : (
              <Alert
                type="success"
                showIcon
                message={`Confirmed by you on ${new Date(estimate.approvedAt!).toLocaleDateString('en-IN')}.`}
                action={<Button size="small" type="primary" onClick={() => onNavigate('marketplace-post', { estimate_id: estimate.id })}>Post to marketplace</Button>}
              />
            )}
          </div>

          <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.12s both' }}>
            <EstimateTotalSummary estimate={estimate} />
          </div>

          <Row gutter={[12, 12]} style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.18s both' }}>
            <Col xs={12} lg={6}><Card><Statistic title="Built-up Area" value={areaLabel} /></Card></Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Materials" value={formatRupees(estimate.breakdown.materials)} valueStyle={{ color: '#E14B19' }} />
                <Text type="secondary" className="text-[11px]!">{pct(estimate.breakdown.materials)}% of total</Text>
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Labour" value={formatRupees(estimate.breakdown.labour)} valueStyle={{ color: '#E19C12' }} />
                <Text type="secondary" className="text-[11px]!">{pct(estimate.breakdown.labour)}% of total</Text>
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="Finishing" value={formatRupees(estimate.breakdown.finishing)} valueStyle={{ color: '#4AB017' }} />
                <Text type="secondary" className="text-[11px]!">{pct(estimate.breakdown.finishing)}% of total</Text>
              </Card>
            </Col>
          </Row>

          <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.24s both' }}>
            <CostBreakdownCard
              items={[
                { label: 'Materials', percent: pct(estimate.breakdown.materials), amount: formatRupees(estimate.breakdown.materials), color: '#E14B19' },
                { label: 'Labour', percent: pct(estimate.breakdown.labour), amount: formatRupees(estimate.breakdown.labour), color: '#E19C12' },
                { label: 'Finishing', percent: pct(estimate.breakdown.finishing), amount: formatRupees(estimate.breakdown.finishing), color: '#4AB017' },
                { label: 'Contingency', percent: pct(estimate.breakdown.contingency), amount: formatRupees(estimate.breakdown.contingency), color: '#7E7E7E' },
              ]}
            />
          </div>

          <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.3s both' }}>
            <HozieInsightCard onNavigate={onNavigate} estimateId={estimate.id} />
          </div>

          <Flex vertical gap={12} style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.36s both' }}>
            <Text className="text-[10px] tracking-[0.10em] uppercase text-[#9A949D]!">Next Steps</Text>
            <Row gutter={[12, 12]}>
              {nextActions.map((a) => (
                <Col key={a.title} xs={12} lg={6}>
                  <Card hoverable onClick={a.onClick}>
                    <Flex vertical gap={8}>
                      <span className="text-[#722ED1] text-[20px]">{a.icon}</span>
                      <Text strong>{a.title}</Text>
                      <Text type="secondary" className="text-[12px]!">{a.desc}</Text>
                    </Flex>
                  </Card>
                </Col>
              ))}
            </Row>
          </Flex>
        </Flex>
      </div>
    </HomeownerLayout>
  )
}
