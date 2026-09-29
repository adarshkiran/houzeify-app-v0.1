import {
  FileOutlined,
  TeamOutlined,
  BgColorsOutlined,
  SafetyOutlined,
} from '@ant-design/icons'
import { Button, Card, Col, Empty, Flex, Progress, Row, Typography } from 'antd'
import AmbientBg from '../components/homeowner/AmbientBg'
import EstimateTotalSummary, { formatRupees } from '../components/homeowner/EstimateTotalSummary'
import HIcon from '../components/HIcon'
import HomeownerLayout from '../components/homeowner/HomeownerLayout'
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { getEstimate } from '../mock/selectors'

const { Text, Title } = Typography

interface Category {
  id: string
  label: string
  amount: string
  pct: number
  icon: React.ReactNode
  detail: string
  color: string
}

function CategoryCard({ cat }: { cat: Category }) {
  return (
    <Card>
      <Flex vertical gap={8}>
        <Flex align="center" justify="space-between" gap={12}>
          <Flex align="center" gap={10}>
            <div className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.color}1A`, color: cat.color }}>
              {cat.icon}
            </div>
            <Text strong>{cat.label}</Text>
          </Flex>
          <Flex align="center" gap={12}>
            <Text strong className="text-[18px]!">{cat.amount}</Text>
            <Text style={{ color: cat.color }}>{cat.pct}%</Text>
          </Flex>
        </Flex>
        <Progress percent={cat.pct} showInfo={false} strokeColor={cat.color} />
        <Text type="secondary" className="text-[12px]!">{cat.detail}</Text>
      </Flex>
    </Card>
  )
}

function EstimateSummaryPanel({ categories, averageLabel }: { categories: Category[]; averageLabel: string }) {
  return (
    <Card title={<Text className="text-[10px] tracking-[0.10em] uppercase text-[#9A949D]!">Summary</Text>}>
      <Flex vertical gap={10}>
        {categories.map((cat) => (
          <Flex key={cat.id} align="center" justify="space-between" gap={8}>
            <Flex align="center" gap={8}>
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: cat.color }} />
              <Text type="secondary" className="text-[13px]!">{cat.label}</Text>
            </Flex>
            <Flex align="center" gap={8}>
              <Text strong className="text-[13px]!">{cat.amount}</Text>
              <Text style={{ color: cat.color, fontSize: 10 }}>{cat.pct}%</Text>
            </Flex>
          </Flex>
        ))}
        <Flex justify="space-between" className="pt-2! border-t border-[#E3DDD7]">
          <Text strong>Total (avg)</Text>
          <Text strong className="text-[#722ED1]!">{averageLabel}</Text>
        </Flex>
      </Flex>
    </Card>
  )
}

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
      <HomeownerLayout active="estimates" onNavigate={onNavigate}>
        <Flex align="center" justify="center" className="min-h-full">
          <Empty description="We couldn't find that estimate.">
            <Button type="primary" onClick={() => onNavigate('estimate-dashboard')}>Back to estimate</Button>
          </Empty>
        </Flex>
      </HomeownerLayout>
    )
  }

  const midpoint = (estimate.totalLow + estimate.totalHigh) / 2
  const averageLabel = formatRupees(midpoint)
  const categories: Category[] = [
    { id: 'materials', label: 'Materials', amount: formatRupees(estimate.breakdown.materials), pct: 56, icon: <FileOutlined />, detail: 'Cement, steel, bricks, aggregates and other raw materials.', color: '#E14B19' },
    { id: 'labour', label: 'Labour', amount: formatRupees(estimate.breakdown.labour), pct: 26, icon: <TeamOutlined />, detail: 'Civil, plumbing, electrical and finishing labour charges.', color: '#E19C12' },
    { id: 'finishing', label: 'Finishing', amount: formatRupees(estimate.breakdown.finishing), pct: 13, icon: <BgColorsOutlined />, detail: 'Flooring, painting, doors, windows and interior finishes.', color: '#4AB017' },
    { id: 'contingency', label: 'Contingency', amount: formatRupees(estimate.breakdown.contingency), pct: 5, icon: <SafetyOutlined />, detail: 'Buffer for unforeseen costs and estimation variance.', color: '#7E7E7E' },
  ]

  return (
    <HomeownerLayout active="estimates" onNavigate={onNavigate}>
      <div className="relative min-h-full" style={{ backgroundColor: '#FBF9F7' }}>
        <AmbientBg variant="cost-breakdown" />
        <Flex vertical gap={24} className="relative z-10 max-w-[1080px] mx-auto! px-4! sm:px-6! lg:px-8! py-6! sm:py-8!">
          <Flex vertical gap={4} style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.05s both' }}>
            <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]! block">Estimate Breakdown</Text>
            <Title level={2} className="m-0!">Where your money goes.</Title>
            <Text type="secondary">Hozie has grouped your estimated construction cost into the major areas of work.</Text>
            <Text type="secondary">{estimate.projectName} · {estimate.location} · {estimate.builtUpAreaSqft.toLocaleString('en-IN')} sq ft</Text>
          </Flex>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={14}>
              <Flex vertical gap={16}>
                <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.1s both' }}>
                  <EstimateTotalSummary estimate={estimate} />
                </div>
                {categories.map((cat, i) => (
                  <div key={cat.id} style={{ animation: `welcomeFadeUp 0.4s ease-out ${0.15 + i * 0.06}s both` }}>
                    <CategoryCard cat={cat} />
                  </div>
                ))}
              </Flex>
            </Col>
            <Col xs={24} lg={10}>
              <Flex vertical gap={16}>
                <Card className="bg-[#F3EAFF]! border-0!" style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.18s both' }}>
                  <Flex vertical gap={12}>
                    <Flex align="center" gap={10}>
                      <div className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center shrink-0">
                        <HIcon size={20} />
                      </div>
                      <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">Hozie Insight</Text>
                    </Flex>
                    <Text>
                      &ldquo;Materials are currently the largest cost driver. Changes in steel, cement and finishing
                      specifications can significantly affect your final estimate.&rdquo;
                    </Text>
                  </Flex>
                </Card>
                <div style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.24s both' }}>
                  <EstimateSummaryPanel categories={categories} averageLabel={averageLabel} />
                </div>
                <Button
                  type="primary"
                  block
                  onClick={() => onNavigate('estimate-dashboard', { estimate_id: estimate.id })}
                  style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.3s both' }}
                >
                  ← Back to Estimate
                </Button>
                <Text type="secondary" className="text-[10px]!" style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.36s both' }}>
                  AI-generated estimate based on the information provided. Actual costs may vary based on design,
                  specifications, site conditions and contractor pricing.
                </Text>
              </Flex>
            </Col>
          </Row>
        </Flex>
      </div>
    </HomeownerLayout>
  )
}
