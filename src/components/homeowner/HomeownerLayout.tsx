import type { ReactNode } from "react"
import { Flex, Layout, Menu, Tag, type MenuProps } from "antd"
import HIcon from "../HIcon"
import LogoHorizontal from "../LogoHorizontal"
import HomeownerMobileMenu from "../HomeownerMobileMenu"
import CompanyThemeProvider from "../company/CompanyThemeProvider"
import {
  HOMEOWNER_BOTTOM_NAV,
  HOMEOWNER_NAV,
  HOMEOWNER_TOOLS_NAV,
  type HomeownerNavKey,
} from "./homeownerNav"

const { Content, Header, Sider } = Layout

function SoonLabel({ label }: { label: string }) {
  return (
    <Flex align="center" justify="space-between" gap="small">
      <span>{label}</span>
      <Tag className="m-0!">Soon</Tag>
    </Flex>
  )
}

function toMenuItem(item: { key: string; label: string; icon: ReactNode; to?: string }): NonNullable<MenuProps["items"]>[number] {
  if (!item.to) {
    return { key: item.key, icon: item.icon, label: <SoonLabel label={item.label} />, disabled: true }
  }
  return { key: item.key, icon: item.icon, label: item.label }
}

/**
 * Frame for the homeowner's estimate-flow screens: the shared side navigation
 * (a drawer on phones, via HomeownerMobileMenu), a 64px header and a scrolling
 * content area. Screens pass only their body; they never build their own sidebar.
 */
function Layout_({
  active,
  onNavigate,
  children,
}: {
  active: HomeownerNavKey
  onNavigate: (screen: string, data?: Record<string, string>) => void
  children: ReactNode
}) {
  const targets = Object.fromEntries(
    [...HOMEOWNER_NAV, ...HOMEOWNER_TOOLS_NAV, ...HOMEOWNER_BOTTOM_NAV].map((item) => [
      item.key,
      { to: item.to, params: item.params },
    ]),
  )

  const go = (key: string) => {
    const target = targets[key]
    if (target?.to) onNavigate(target.to, target.params)
  }

  const mainMenu = (
    <Menu
      mode="inline"
      selectedKeys={[active]}
      items={HOMEOWNER_NAV.map(toMenuItem)}
      inlineIndent={18}
      className="flex-1 border-0! overflow-y-auto"
      onClick={({ key }) => go(key)}
    />
  )
  const toolsMenu = (
    <Menu
      mode="inline"
      selectable={false}
      inlineIndent={18}
      items={[
        { type: "group", key: "tools-group", label: "Tools", children: HOMEOWNER_TOOLS_NAV.map(toMenuItem) },
      ]}
    />
  )
  const bottomMenu = (
    <Menu mode="inline" selectable={false} inlineIndent={18} items={HOMEOWNER_BOTTOM_NAV.map(toMenuItem)} />
  )

  return (
    <Layout className="h-full">
      <Sider width={240} theme="light" trigger={null} className="hidden md:block border-r border-[#F0F0F0]">
        <Flex vertical className="h-full">
          <Flex align="center" gap="small" className="h-16 px-5! border-b border-[#F0F0F0]">
            <LogoHorizontal height={24} />
          </Flex>
          {mainMenu}
          {toolsMenu}
          {bottomMenu}
        </Flex>
      </Sider>

      <Layout className="min-w-0">
        <Header className="bg-white! flex items-center px-4 md:px-6 h-16!" style={{ borderBottom: "1px solid #F0F0F0" }}>
          <Flex align="center" gap="middle" className="h-full w-full md:hidden!">
            <HomeownerMobileMenu active={active} onNavigate={onNavigate} />
            <Flex align="center" gap="small" className="flex-1">
              <HIcon size={24} />
              <span className="text-[15px] font-semibold text-[#242326]">Houzeify</span>
            </Flex>
          </Flex>
        </Header>
        <Content className="overflow-y-auto">{children}</Content>
      </Layout>
    </Layout>
  )
}

export default function HomeownerLayout(props: {
  active: HomeownerNavKey
  onNavigate: (screen: string, data?: Record<string, string>) => void
  children: ReactNode
}) {
  return (
    <CompanyThemeProvider>
      <Layout_ {...props} />
    </CompanyThemeProvider>
  )
}
