import { useState } from 'react'
import { CheckCircleFilled } from '@ant-design/icons'
import { Button, Card, Flex, Form, Input, InputNumber, Steps, Typography } from 'antd'
import type { ConstructionLevel } from '../domain/models'
import AmbientBg from '../components/homeowner/AmbientBg'
import HIcon from '../components/HIcon'
import HomeownerLayout from '../components/homeowner/HomeownerLayout'
import { useConstructionData } from '../mock/ConstructionDataProvider'
import { useCommand } from '../session/useCommand'

const { Text, Title } = Typography

const propertyTypes = ['House', 'Villa', 'Farmhouse', 'Apartment', 'Other']

interface StageOption {
  id: string
  title: string
  desc: string
}
const stages: StageOption[] = [
  { id: 'planning', title: 'Planning', desc: 'Just exploring ideas.' },
  { id: 'have-plan', title: 'Have a plan', desc: 'I already have drawings.' },
  { id: 'ready-estimate', title: 'Ready to estimate', desc: 'I know the basic requirements.' },
  { id: 'ready-build', title: 'Ready to build', desc: 'Looking for contractors soon.' },
]

interface LevelOption {
  id: ConstructionLevel
  title: string
  desc: string
}
const levels: LevelOption[] = [
  { id: 'basic', title: 'Basic', desc: 'Functional finishes, standard materials.' },
  { id: 'standard', title: 'Standard', desc: 'Good quality finishes, popular choice.' },
  { id: 'premium', title: 'Premium', desc: 'High-end finishes, premium materials.' },
]

/** One selectable card in a small labelled group (property type / stage / construction level). */
function PickCard({ title, desc, selected, onSelect }: { title: string; desc?: string; selected: boolean; onSelect: () => void }) {
  return (
    <Card
      hoverable
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={selected ? 'border-[#722ED1]! bg-[#F3EAFF]!' : ''}
      styles={{ body: { padding: 16, position: 'relative' } }}
    >
      {selected && <CheckCircleFilled className="absolute top-3 right-3 text-[#722ED1]" style={{ animation: 'successBadgePop 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }} />}
      <Flex vertical gap={2}>
        <Text strong className={selected ? 'text-[#722ED1]!' : undefined}>{title}</Text>
        {desc && <Text type="secondary" className="text-[12px]!">{desc}</Text>}
      </Flex>
    </Card>
  )
}

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
  const [builtUpArea, setBuiltUpArea] = useState<number | null>(null)
  const [floors, setFloors] = useState<number | null>(1)
  const [constructionLevel, setConstructionLevel] = useState<ConstructionLevel>('standard')

  const { generateEstimate } = useConstructionData()
  const run = useCommand()

  const canContinue =
    projectName.trim().length > 0 &&
    stage !== null &&
    Number.isInteger(builtUpArea) &&
    (builtUpArea ?? 0) > 0 &&
    Number.isInteger(floors) &&
    (floors ?? 0) > 0

  const handleContinue = () => {
    if (!canContinue) return
    const outcome = run(() =>
      generateEstimate({
        projectName: projectName.trim(),
        propertyType,
        location,
        builtUpAreaSqft: builtUpArea!,
        floors: floors!,
        constructionLevel,
      }),
    )
    if (!outcome.ok) return
    onNavigate('estimate-loading', { estimate_id: outcome.value.id })
  }

  return (
    <HomeownerLayout active="estimates" onNavigate={onNavigate}>
      <div className="relative min-h-full" style={{ backgroundColor: '#FBF9F7' }}>
        <AmbientBg variant="create-project" />
        <Flex vertical gap="large" className="relative z-10 max-w-[900px] mx-auto px-5 sm:px-8 lg:px-10 pt-8 pb-12">
          <Flex vertical gap={16} style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.05s both' }}>
            <Steps
              size="small"
              current={0}
              items={[{ title: 'Project' }, { title: 'Details' }, { title: 'Estimate' }]}
            />
            <Flex vertical gap={4}>
              <Text className="text-[10px] tracking-[0.10em] uppercase text-[#722ED1]!">New Construction Project</Text>
              <Title level={2} className="m-0!">Let&apos;s create your project.</Title>
              <Text type="secondary">Hozie will use these details to build your construction estimate.</Text>
            </Flex>
          </Flex>

          <Card style={{ animation: 'welcomeFadeUp 0.45s ease-out 0.12s both' }}>
            <Form layout="vertical" requiredMark={false}>
              <Form.Item label="Project name" htmlFor="project-name">
                <Input
                  id="project-name"
                  size="large"
                  placeholder="My New Home"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </Form.Item>

              <Form.Item label="What are you building?">
                <Flex gap={8} wrap style={{ animation: 'welcomeFadeUp 0.2s ease-out both' }}>
                  {propertyTypes.map((pt) => (
                    <Button
                      key={pt}
                      type={propertyType === pt ? 'primary' : 'default'}
                      shape="round"
                      onClick={() => setPropertyType(pt)}
                    >
                      {pt}
                    </Button>
                  ))}
                </Flex>
              </Form.Item>

              <Form.Item label="Where are you building?" htmlFor="location">
                <Input id="location" size="large" value={location} onChange={(e) => setLocation(e.target.value)} />
              </Form.Item>

              <Form.Item label="What stage are you at?">
                <Flex gap={12} wrap>
                  {stages.map((s) => (
                    <div key={s.id} style={{ flex: '1 1 240px', minWidth: 220 }}>
                      <PickCard title={s.title} desc={s.desc} selected={stage === s.id} onSelect={() => setStage(s.id)} />
                    </div>
                  ))}
                </Flex>
              </Form.Item>

              <Flex gap={16}>
                <Form.Item label="Built-up area (sq.ft)" className="flex-1" htmlFor="built-up-area">
                  <InputNumber
                    id="built-up-area"
                    size="large"
                    min={1}
                    style={{ width: '100%' }}
                    placeholder="e.g. 2000"
                    value={builtUpArea}
                    onChange={(v) => setBuiltUpArea(v)}
                  />
                </Form.Item>
                <Form.Item label="Floors" className="flex-1" htmlFor="floors">
                  <InputNumber id="floors" size="large" min={1} style={{ width: '100%' }} value={floors} onChange={(v) => setFloors(v)} />
                </Form.Item>
              </Flex>

              <Form.Item label="Construction level">
                <Flex gap={12} wrap>
                  {levels.map((l) => (
                    <div key={l.id} style={{ flex: '1 1 200px', minWidth: 180 }}>
                      <PickCard
                        title={l.title}
                        desc={l.desc}
                        selected={constructionLevel === l.id}
                        onSelect={() => setConstructionLevel(l.id)}
                      />
                    </div>
                  ))}
                </Flex>
              </Form.Item>
            </Form>
          </Card>

          <Card className="bg-[#F3EAFF]! border-0!" style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.22s both' }}>
            <Flex gap={12} align="flex-start">
              <div className="shrink-0 w-8 h-8 rounded-[10px] bg-white flex items-center justify-center">
                <HIcon size={20} />
              </div>
              <Flex vertical gap={2}>
                <Text className="text-[10px] tracking-[0.08em] uppercase text-[#722ED1]!">Hozie Tip</Text>
                <Text>You don&apos;t need everything ready. We can start with what you know and fill in the details later.</Text>
              </Flex>
            </Flex>
          </Card>

          <Flex gap={16} align="center" wrap style={{ animation: 'welcomeFadeUp 0.4s ease-out 0.3s both' }}>
            <Button type="primary" size="large" disabled={!canContinue} onClick={handleContinue}>
              Continue to project details →
            </Button>
            <Button type="link" onClick={() => onNavigate('ai-advisor')}>← Back to Hozie</Button>
          </Flex>
        </Flex>
      </div>
    </HomeownerLayout>
  )
}
