import type { EntityId, ProjectMembership } from "./models"
import { Permissions, type Permission } from "./permissions"
import {
  projectPermissions,
  type AccountType,
  type Session,
} from "./session"

export type NavigationData = Record<string, string>

/**
 * How a screen may be reached:
 * - public: anyone
 * - account: any signed-in session (optionally restricted to account types)
 * - project: signed-in and holding `permission` on the `project_id` param
 */
export type Access =
  | { kind: "public" }
  | { kind: "account"; accountTypes?: readonly AccountType[] }
  | {
      kind: "project"
      permission: Permission
      accountTypes?: readonly AccountType[]
    }

interface RouteDef {
  access: Access
  /** Params that must be present for the screen to render. */
  requires?: readonly string[]
  /**
   * The screen also works without `project_id` (company-wide view). It is then
   * checked as an account-level screen instead of a project one.
   */
  optionalProject?: boolean
}

const PUBLIC: Access = { kind: "public" }
const HOMEOWNER: Access = { kind: "account", accountTypes: ["homeowner"] }
const BUSINESS: Access = { kind: "account", accountTypes: ["business"] }
const WORKER: Access = { kind: "account", accountTypes: ["worker"] }
/** Company-side project screens: business accounts holding `permission`. */
const project = (permission: Permission): Access => ({
  kind: "project",
  permission,
  accountTypes: ["business"],
})
/** Worker-app project screens: worker accounts holding `permission`. */
const workerProject = (permission: Permission): Access => ({
  kind: "project",
  permission,
  accountTypes: ["worker"],
})
/** Customer-facing project screen: any account holding `permission`. */
const customerProject = (permission: Permission): Access => ({
  kind: "project",
  permission,
})

/** Single source of truth for screens; `AppScreen` is derived from it. */
export const routes = {
  splash: { access: PUBLIC },
  welcome: { access: PUBLIC },
  login: { access: PUBLIC },
  otp: { access: PUBLIC },
  "create-account": { access: PUBLIC },
  "account-created": { access: PUBLIC },
  role: { access: PUBLIC },
  "onboarding-homeowner": { access: PUBLIC },
  "onboarding-business": { access: PUBLIC },
  "onboarding-worker": { access: PUBLIC },

  "dashboard-home": { access: HOMEOWNER },
  "ai-advisor": { access: HOMEOWNER },
  "create-project": { access: HOMEOWNER },
  "estimate-loading": { access: HOMEOWNER },
  "estimate-dashboard": { access: HOMEOWNER },
  "cost-breakdown": { access: HOMEOWNER },
  "boq": { access: HOMEOWNER },

  "company-dashboard": { access: BUSINESS },
  "company-projects": { access: BUSINESS },
  "company-create-project": { access: BUSINESS },
  "work-library": { access: BUSINESS },
  workforce: { access: BUSINESS },

  "worker-today": { access: WORKER },
  "worker-task": {
    access: workerProject(Permissions.PROJECT_READ),
    requires: ["project_id", "task_id"],
  },
  "worker-submit": {
    access: workerProject(Permissions.PROGRESS_SUBMIT),
    requires: ["project_id", "task_id"],
  },
  "worker-messages": { access: WORKER },

  "project-overview": {
    access: project(Permissions.PROJECT_READ),
    requires: ["project_id"],
  },
  "project-structure": {
    access: project(Permissions.PROJECT_MANAGE),
    requires: ["project_id"],
  },
  "project-team": {
    access: project(Permissions.PROJECT_MANAGE),
    requires: ["project_id"],
  },
  "work-plan": {
    access: project(Permissions.TASK_MANAGE),
    requires: ["project_id"],
  },
  tasks: {
    access: project(Permissions.PROJECT_READ),
    requires: ["project_id"],
  },
  "task-detail": {
    access: project(Permissions.PROJECT_READ),
    requires: ["project_id", "task_id"],
  },
  "daily-progress-submit": {
    access: project(Permissions.PROGRESS_SUBMIT),
    requires: ["project_id"],
  },
  "daily-progress-review": {
    access: project(Permissions.PROGRESS_REVIEW),
    optionalProject: true,
  },
  issues: {
    access: project(Permissions.PROJECT_READ),
    requires: ["project_id"],
  },
  "project-documents": {
    access: project(Permissions.PROJECT_READ),
    requires: ["project_id"],
  },
  "project-messages": {
    access: project(Permissions.PROJECT_READ),
    requires: ["project_id"],
  },
  "issue-detail": {
    access: project(Permissions.PROJECT_READ),
    requires: ["project_id", "issue_id"],
  },
  "customer-daily-update": {
    access: customerProject(Permissions.PROJECT_READ),
    requires: ["project_id"],
  },
} as const satisfies Record<string, RouteDef>

export type AppScreen = keyof typeof routes

export type Navigate = (screen: AppScreen, data?: NavigationData) => void

export function isAppScreen(screen: string): screen is AppScreen {
  return Object.prototype.hasOwnProperty.call(routes, screen)
}

export interface RouteLocation {
  screen: AppScreen
  params: NavigationData
}

/** Params that describe *where* we are; they never carry over between screens. */
const SCOPED_PARAMS = new Set(["project_id", "task_id", "issue_id", "thread_id", "setup", "from", "estimate_id"])

/** Params never written to the URL. */
const PRIVATE_PARAMS = new Set(["phone"])

/** Parse `#screen?a=1&b=2` (leading `#` optional). Unknown screens return null. */
export function parseHash(hash: string): RouteLocation | null {
  const raw = hash.replace(/^#/, "")
  const [screen, query = ""] = raw.split("?", 2)
  if (!isAppScreen(screen)) return null
  const params: NavigationData = {}
  new URLSearchParams(query).forEach((value, key) => {
    params[key] = value
  })
  return { screen, params }
}

export function buildHash(location: RouteLocation): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(location.params)) {
    if (value !== "" && !PRIVATE_PARAMS.has(key)) query.set(key, value)
  }
  const qs = query.toString()
  return `#${location.screen}${qs ? `?${qs}` : ""}`
}

/**
 * Params for the next screen: flow params (property_type, location, …) carry
 * forward, but scoped ids (project_id, task_id) come only from `data`, so they
 * can't leak from a previous screen.
 */
export function nextParams(
  current: NavigationData,
  data: NavigationData | undefined,
): NavigationData {
  const next: NavigationData = {}
  for (const [key, value] of Object.entries(current)) {
    if (!SCOPED_PARAMS.has(key)) next[key] = value
  }
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value !== "") next[key] = value
  }
  return next
}

/** Where a signed-in session lands by default. */
export function homeScreenFor(session: Session | null): AppScreen {
  if (!session) return "welcome"
  switch (session.accountType) {
    case "business":
      return "company-dashboard"
    case "worker":
      return "worker-today"
    default:
      return "dashboard-home"
  }
}

export type RouteDecision =
  | { ok: true }
  | { ok: false; reason: string; redirect: RouteLocation }

export interface AccessContext {
  session: Session | null
  memberships: readonly ProjectMembership[]
  knownProjectIds: ReadonlySet<EntityId>
}

export function resolveRoute(
  location: RouteLocation,
  ctx: AccessContext,
): RouteDecision {
  const def = routes[location.screen] as RouteDef
  const { access, requires = [] } = def
  const { session } = ctx
  const deny = (
    reason: string,
    screen: AppScreen,
    params: NavigationData = {},
  ): RouteDecision => ({ ok: false, reason, redirect: { screen, params } })

  if (access.kind === "public") return { ok: true }

  if (!session) return deny("not-signed-in", "login")

  if (
    access.accountTypes &&
    !access.accountTypes.includes(session.accountType)
  ) {
    return deny("wrong-account-type", homeScreenFor(session))
  }

  const missing = requires.find((key) => !location.params[key])
  if (missing) return deny(`missing-param:${missing}`, homeScreenFor(session))

  if (access.kind === "project" && !(def.optionalProject && !location.params.project_id)) {
    const projectId = location.params.project_id
    if (!ctx.knownProjectIds.has(projectId)) {
      return deny("unknown-project", homeScreenFor(session))
    }
    const granted = projectPermissions(session, ctx.memberships, projectId)
    if (!granted.includes(access.permission)) {
      // Fall back to the (company-side) project overview when the person can
      // at least read it.
      if (
        session.accountType === "business" &&
        location.screen !== "project-overview" &&
        granted.includes(Permissions.PROJECT_READ)
      ) {
        return deny("missing-permission", "project-overview", {
          project_id: projectId,
        })
      }
      return deny("missing-permission", homeScreenFor(session))
    }
  }

  return { ok: true }
}
