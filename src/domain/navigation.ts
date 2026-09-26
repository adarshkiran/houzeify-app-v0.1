export type AppScreen =
  | "splash"
  | "welcome"
  | "login"
  | "otp"
  | "create-account"
  | "account-created"
  | "role"
  | "onboarding-homeowner"
  | "onboarding-business"
  | "dashboard-home"
  | "ai-advisor"
  | "create-project"
  | "estimate-loading"
  | "estimate-dashboard"
  | "cost-breakdown"
  | "company-dashboard"
  | "company-projects"
  | "company-create-project"
  | "project-overview"
  | "project-structure"
  | "project-team"
  | "work-library"
  | "work-plan"
  | "tasks"
  | "task-detail"
  | "daily-progress-submit"
  | "daily-progress-review"
  | "customer-daily-update"

export type NavigationData = Record<string, string>

export type Navigate = (screen: AppScreen, data?: NavigationData) => void

const appScreens = new Set<AppScreen>([
  "splash",
  "welcome",
  "login",
  "otp",
  "create-account",
  "account-created",
  "role",
  "onboarding-homeowner",
  "onboarding-business",
  "dashboard-home",
  "ai-advisor",
  "create-project",
  "estimate-loading",
  "estimate-dashboard",
  "cost-breakdown",
  "company-dashboard",
  "company-projects",
  "company-create-project",
  "project-overview",
  "project-structure",
  "project-team",
  "work-library",
  "work-plan",
  "tasks",
  "task-detail",
  "daily-progress-submit",
  "daily-progress-review",
  "customer-daily-update",
])

export function isAppScreen(screen: string): screen is AppScreen {
  return appScreens.has(screen as AppScreen)
}
