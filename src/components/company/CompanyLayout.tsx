import { useState, type ReactNode } from "react"
import { MenuOutlined, SettingOutlined } from "@ant-design/icons"
import { Badge, Button, Drawer, Flex, Layout, Menu, Tag, Typography, type MenuProps } from "antd"
import HIcon from "../HIcon"
import LogoHorizontal from "../LogoHorizontal"
import { resolveRoute, type Navigate } from "../../domain/navigation"
import { useConstructionData } from "../../mock/ConstructionDataProvider"
import { getOrganizationProjects, getProject } from "../../mock/selectors"
import { useSession } from "../../session/SessionProvider"
import { useScopedData } from "../../session/useScopedData"
import {
  BACK_TO_COMPANY,
  COMPANY_NAV,
  projectNav,
  type CompanyNavKey,
  type NavItem,
  type NavTarget,
  type ProjectNavKey,
} from "./companyNav"

const { Content, Header, Sider } = Layout
const { Text, Title } = Typography

/** Which menu to show and which item is current. */
export type CompanyNavState =
  | { menu: "company"; active: CompanyNavKey }
  | { menu: "project"; projectId: string; active: ProjectNavKey }

function SoonLabel({ label }: { label: string }) {
  return (
    <Flex align="center" justify="space-between" gap="small">
      <span>{label}</span>
      <Tag className="m-0! company-nav-soon">Soon</Tag>
    </Flex>
  )
}

function CountLabel({ label, count }: { label: string; count: number }) {
  return (
    <Flex align="center" justify="space-between" gap="small">
      <span>{label}</span>
      <Badge count={count} size="small" />
    </Flex>
  )
}

/**
 * Frame for every company screen: the shared side navigation (a drawer on
 * phones), a 64px header and a scrolling content area. Screens pass their
 * header content and body; they never build their own sidebar.
 */
export default function CompanyLayout({
  nav,
  onNavigate,
  header,
  actions,
  className,
  children,
}: {
  nav: CompanyNavState
  onNavigate: Navigate
  /**
   * Custom header content (after the phone menu button). Omit it for the
   * standard header: where you are (project and section) plus `actions`.
   */
  header?: ReactNode
  /** Right-aligned buttons in the standard header (e.g. a back link). */
  actions?: ReactNode
  className?: string
  children: ReactNode
}) {
  const { session } = useSession()
  const { state } = useConstructionData()
  const scoped = useScopedData()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const knownProjectIds = new Set(state.projects.map((project) => project.id))
  /** Only offer destinations the person is allowed to open (same rule as routing). */
  const canOpen = (to: NavTarget) =>
    resolveRoute(
      { screen: to.screen, params: to.params ?? {} },
      { session, memberships: state.memberships, knownProjectIds },
    ).ok

  const toMenuItem = <K extends string>(
    item: NavItem<K>,
    count?: number,
  ): NonNullable<MenuProps["items"]>[number] | null => {
    if (!item.to) {
      return { key: item.key, icon: item.icon, label: <SoonLabel label={item.label} />, disabled: true }
    }
    if (!canOpen(item.to)) return null
    return {
      key: item.key,
      icon: item.icon,
      label: count ? <CountLabel label={item.label} count={count} /> : item.label,
    }
  }

  let items: MenuProps["items"]
  let targets: Record<string, NavTarget | undefined>
  let heading: { title: string; subtitle: string }
  if (nav.menu === "company") {
    heading = {
      title: COMPANY_NAV.find((item) => item.key === nav.active)?.label ?? "Home",
      subtitle: "Company workspace",
    }
    const projectCount = session?.organizationId
      ? getOrganizationProjects(scoped, session.organizationId).length
      : 0
    items = COMPANY_NAV.map((item) =>
      toMenuItem(item, item.key === "projects" ? projectCount : undefined),
    ).filter(Boolean)
    targets = Object.fromEntries(COMPANY_NAV.map((item) => [item.key, item.to]))
  } else {
    const project = getProject(state, nav.projectId)
    const projectItems = projectNav(nav.projectId)
    heading = {
      title: project?.name ?? "Project",
      subtitle: projectItems.find((item) => item.key === nav.active)?.label ?? "",
    }
    items = [
      { key: BACK_TO_COMPANY.key, icon: BACK_TO_COMPANY.icon, label: BACK_TO_COMPANY.label },
      { type: "divider" },
      {
        type: "group",
        key: "project",
        label: (
          <Text type="secondary" ellipsis className="company-nav-project">
            {project?.name ?? "Project"}
          </Text>
        ),
        children: projectItems.map((item) => toMenuItem(item)).filter(Boolean),
      },
    ]
    targets = {
      [BACK_TO_COMPANY.key]: BACK_TO_COMPANY.to,
      ...Object.fromEntries(projectItems.map((item) => [item.key, item.to])),
    }
  }

  const go = (key: string) => {
    setDrawerOpen(false)
    const target = targets[key]
    if (target) onNavigate(target.screen, target.params)
  }

  const menu = (className: string) => (
    <Menu
      mode="inline"
      selectedKeys={[nav.active]}
      items={items}
      inlineIndent={18}
      className={className}
      onClick={({ key }) => go(key)}
    />
  )
  const settings = (className?: string) => (
    <Menu
      mode="inline"
      selectable={false}
      inlineIndent={18}
      items={[
        {
          key: "settings",
          icon: <SettingOutlined />,
          label: <SoonLabel label="Settings" />,
          disabled: true,
        },
      ]}
      className={className}
    />
  )

  return (
    <Layout className={`company-dashboard h-full ${className ?? ""}`}>
      <Drawer
        title={<LogoHorizontal height={24} />}
        placement="left"
        size={300}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        classNames={{ body: "company-mobile-nav-body" }}
      >
        {menu("")}
        {settings("company-settings-menu")}
      </Drawer>

      <Sider
        breakpoint="lg"
        collapsedWidth={72}
        width={240}
        theme="light"
        trigger={null}
        className="hidden md:block company-sider"
      >
        <Flex vertical className="h-full">
          <Flex align="center" className="company-logo">
            <LogoHorizontal height={24} className="company-logo-full" />
            <span className="company-logo-mark">
              <HIcon size={28} />
            </span>
          </Flex>
          {menu("company-main-menu flex-1 border-0! overflow-y-auto")}
          {settings("company-settings-menu")}
        </Flex>
      </Sider>

      <Layout className="min-w-0">
        <Header className="company-header">
          <Flex align="center" gap="middle" className="h-full">
            <Button
              aria-label="Open navigation"
              icon={<MenuOutlined />}
              className="md:hidden! shrink-0"
              onClick={() => setDrawerOpen(true)}
            />
            <div className="min-w-0 flex-1 h-full">
              {header ?? (
                <Flex align="center" justify="space-between" gap="middle" className="h-full">
                  <Flex vertical className="min-w-0">
                    <Title level={5} ellipsis className="company-heading! m-0!">
                      {heading.title}
                    </Title>
                    <Text type="secondary" ellipsis>
                      {heading.subtitle}
                    </Text>
                  </Flex>
                  {actions && (
                    <Flex gap="small" className="shrink-0">
                      {actions}
                    </Flex>
                  )}
                </Flex>
              )}
            </div>
          </Flex>
        </Header>
        <Content className="overflow-y-auto">{children}</Content>
      </Layout>
    </Layout>
  )
}
