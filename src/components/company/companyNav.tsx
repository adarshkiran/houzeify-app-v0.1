import type { ReactNode } from "react"
import {
  AppstoreOutlined,
  ApartmentOutlined,
  ArrowLeftOutlined,
  BarChartOutlined,
  CheckSquareOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  HomeOutlined,
  LineChartOutlined,
  ProjectOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  SnippetsOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons"
import type { AppScreen, NavigationData } from "../../domain/navigation"

/**
 * The company app's side navigation, defined once. Every company screen
 * renders it through CompanyLayout, so items, labels, icons and order can't
 * drift between screens.
 *
 * - Company menu: workspace-wide screens.
 * - Project menu: shown on every screen inside a project.
 * Items without a `to` are planned but not built yet; they render disabled
 * with a "Soon" tag.
 */

export type CompanyNavKey =
  | "home"
  | "projects"
  | "library"
  | "progress"
  | "site-ops"
  | "workforce"
  | "live-site"
  | "documents"
  | "reports"
  | "team"
  | "hozie"

export type ProjectNavKey =
  | "overview"
  | "structure"
  | "work-plan"
  | "tasks"
  | "progress"
  | "issues"
  | "team"
  | "documents"

export interface NavTarget {
  screen: AppScreen
  params?: NavigationData
}

export interface NavItem<K extends string> {
  key: K
  label: string
  icon: ReactNode
  /** Where it goes. Omitted = planned, not built yet ("Soon"). */
  to?: NavTarget
}

/** Order and labels follow DESIGN.md → "Navigation — Construction Management". */
export const COMPANY_NAV: NavItem<CompanyNavKey>[] = [
  { key: "home", label: "Home", icon: <HomeOutlined />, to: { screen: "company-dashboard" } },
  { key: "projects", label: "Projects", icon: <ProjectOutlined />, to: { screen: "company-projects" } },
  { key: "library", label: "Work Library", icon: <SnippetsOutlined />, to: { screen: "work-library" } },
  { key: "progress", label: "Progress", icon: <LineChartOutlined />, to: { screen: "daily-progress-review" } },
  { key: "site-ops", label: "Site Operations", icon: <SafetyCertificateOutlined /> },
  { key: "workforce", label: "Workforce", icon: <TeamOutlined />, to: { screen: "workforce" } },
  { key: "live-site", label: "Live Site", icon: <VideoCameraOutlined /> },
  { key: "documents", label: "Documents", icon: <FileTextOutlined /> },
  { key: "reports", label: "Reports", icon: <BarChartOutlined /> },
  { key: "team", label: "Team", icon: <UsergroupAddOutlined /> },
  { key: "hozie", label: "Hozie AI", icon: <RobotOutlined /> },
]

export function projectNav(projectId: string): NavItem<ProjectNavKey>[] {
  const p = { project_id: projectId }
  return [
    { key: "overview", label: "Overview", icon: <AppstoreOutlined />, to: { screen: "project-overview", params: p } },
    { key: "structure", label: "Structure", icon: <ApartmentOutlined />, to: { screen: "project-structure", params: p } },
    { key: "work-plan", label: "Work Plan", icon: <ScheduleOutlined />, to: { screen: "work-plan", params: p } },
    { key: "tasks", label: "Tasks", icon: <CheckSquareOutlined />, to: { screen: "tasks", params: p } },
    { key: "progress", label: "Progress", icon: <LineChartOutlined />, to: { screen: "daily-progress-review", params: p } },
    { key: "issues", label: "Issues", icon: <ExclamationCircleOutlined />, to: { screen: "issues", params: p } },
    { key: "team", label: "Project Team", icon: <TeamOutlined />, to: { screen: "project-team", params: p } },
    { key: "documents", label: "Documents", icon: <FileTextOutlined /> },
  ]
}

/** "← Company home", pinned above the project menu. */
export const BACK_TO_COMPANY = {
  key: "back-to-company",
  label: "Company home",
  icon: <ArrowLeftOutlined />,
  to: { screen: "company-dashboard" } as NavTarget,
}
