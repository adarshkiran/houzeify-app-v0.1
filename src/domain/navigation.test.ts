import { describe, expect, it } from "vitest"
import type { ProjectMembership } from "./models"
import {
  buildHash,
  isAppScreen,
  nextParams,
  parseHash,
  resolveRoute,
  routes,
  type AccessContext,
} from "./navigation"
import { permissionsForRole } from "./permissions"
import {
  canOnProject,
  projectIdsWithPermission,
  projectPermissions,
  type Session,
} from "./session"

const manager: Session = {
  accountType: "business",
  personId: "person-arjun",
  organizationId: "org-1",
}
const homeowner: Session = { accountType: "homeowner", personId: "person-home" }

function membership(
  personId: string,
  projectId: string,
  role: string,
  status: ProjectMembership["status"] = "active",
): ProjectMembership {
  return {
    id: `m-${personId}-${projectId}`,
    projectId,
    principalType: "person",
    principalId: personId,
    role: role as ProjectMembership["role"],
    scope: { projectUnitIds: [], stageIds: [], tradeIds: [] },
    permissions: permissionsForRole(role),
    status,
  }
}

const memberships = [
  membership("person-arjun", "p1", "project-manager"),
  membership("person-arjun", "p3", "project-manager", "inactive"),
  membership("person-home", "p1", "homeowner"),
]

const ctx = (session: Session | null): AccessContext => ({
  session,
  memberships,
  knownProjectIds: new Set(["p1", "p2", "p3"]),
})

describe("route table", () => {
  it("recognises only declared screens", () => {
    expect(isAppScreen("tasks")).toBe(true)
    expect(isAppScreen("material-estimate")).toBe(false)
    expect(isAppScreen("toString")).toBe(false)
    expect(Object.keys(routes)).toContain("workforce")
  })
})

describe("hash parsing", () => {
  it("round-trips screen and params", () => {
    const location = {
      screen: "task-detail" as const,
      params: { project_id: "p1", task_id: "t 1" },
    }
    expect(parseHash(buildHash(location))).toEqual(location)
  })

  it("rejects unknown screens and keeps phone out of the URL", () => {
    expect(parseHash("#nope")).toBeNull()
    expect(parseHash("")).toBeNull()
    expect(buildHash({ screen: "otp", params: { phone: "98765" } })).toBe("#otp")
  })
})

describe("nextParams", () => {
  it("drops scoped ids from the previous screen but keeps flow params", () => {
    const next = nextParams(
      { project_id: "p1", task_id: "t1", location: "Pune" },
      { project_id: "p2" },
    )
    expect(next).toEqual({ location: "Pune", project_id: "p2" })
  })

  it("does not carry a project id when none is passed", () => {
    expect(nextParams({ project_id: "p1" }, undefined)).toEqual({})
  })
})

describe("resolveRoute", () => {
  it("allows public screens without a session", () => {
    expect(resolveRoute({ screen: "login", params: {} }, ctx(null))).toEqual({
      ok: true,
    })
  })

  it("sends signed-out users to login", () => {
    const decision = resolveRoute({ screen: "company-dashboard", params: {} }, ctx(null))
    expect(decision).toMatchObject({ ok: false, redirect: { screen: "login" } })
  })

  it("keeps each account type on its own side", () => {
    expect(
      resolveRoute({ screen: "company-dashboard", params: {} }, ctx(homeowner)),
    ).toMatchObject({ ok: false, redirect: { screen: "dashboard-home" } })
    expect(
      resolveRoute({ screen: "dashboard-home", params: {} }, ctx(manager)),
    ).toMatchObject({ ok: false, redirect: { screen: "company-dashboard" } })
  })

  it("redirects instead of defaulting when project_id is missing", () => {
    expect(
      resolveRoute({ screen: "tasks", params: {} }, ctx(manager)),
    ).toMatchObject({
      ok: false,
      reason: "missing-param:project_id",
      redirect: { screen: "company-dashboard" },
    })
  })

  it("allows the company-wide review queue without a project", () => {
    expect(
      resolveRoute({ screen: "daily-progress-review", params: {} }, ctx(manager)),
    ).toEqual({ ok: true })
    expect(
      resolveRoute({ screen: "daily-progress-review", params: {} }, ctx(homeowner)),
    ).toMatchObject({ ok: false, reason: "wrong-account-type" })
  })

  it("keeps attendance history project-scoped and business-side", () => {
    expect(
      resolveRoute({ screen: "attendance-history", params: { project_id: "p1" } }, ctx(manager)),
    ).toEqual({ ok: true })
    expect(
      resolveRoute({ screen: "attendance-history", params: {} }, ctx(manager)),
    ).toMatchObject({ ok: false, reason: "missing-param:project_id" })
    expect(
      resolveRoute({ screen: "attendance-history", params: { project_id: "p1" } }, ctx(homeowner)),
    ).toMatchObject({ ok: false, reason: "wrong-account-type" })
  })

  it("requires task_id for task detail", () => {
    expect(
      resolveRoute({ screen: "task-detail", params: { project_id: "p1" } }, ctx(manager)),
    ).toMatchObject({ ok: false, reason: "missing-param:task_id" })
  })

  it("requires issue_id for issue detail, and keeps issues company-side", () => {
    expect(
      resolveRoute({ screen: "issue-detail", params: { project_id: "p1" } }, ctx(manager)),
    ).toMatchObject({ ok: false, reason: "missing-param:issue_id" })
    expect(
      resolveRoute({ screen: "issue-detail", params: { project_id: "p1", issue_id: "i1" } }, ctx(manager)),
    ).toEqual({ ok: true })
    expect(
      resolveRoute({ screen: "issues", params: { project_id: "p1" } }, ctx(homeowner)),
    ).toMatchObject({ ok: false, reason: "wrong-account-type" })
  })

  it("does not carry an issue id to the next screen", () => {
    expect(nextParams({ project_id: "p1", issue_id: "i1" }, { project_id: "p1" })).toEqual({ project_id: "p1" })
  })

  it("rejects unknown projects", () => {
    expect(
      resolveRoute({ screen: "tasks", params: { project_id: "zzz" } }, ctx(manager)),
    ).toMatchObject({ ok: false, reason: "unknown-project" })
  })

  it("rejects projects the person has no active membership on", () => {
    expect(
      resolveRoute({ screen: "tasks", params: { project_id: "p2" } }, ctx(manager)),
    ).toMatchObject({ ok: false, reason: "missing-permission" })
    expect(
      resolveRoute({ screen: "tasks", params: { project_id: "p3" } }, ctx(manager)),
    ).toMatchObject({ ok: false, reason: "missing-permission" })
  })

  it("lets a manager into every project screen they have rights for", () => {
    for (const screen of [
      "project-overview",
      "project-structure",
      "project-team",
      "work-plan",
      "tasks",
      "issues",
      "project-messages",
      "daily-progress-submit",
      "daily-progress-review",
      "customer-daily-update",
    ] as const) {
      expect(
        resolveRoute({ screen, params: { project_id: "p1" } }, ctx(manager)),
      ).toEqual({ ok: true })
    }
  })

  it("lets a read-only homeowner view updates but not review or manage", () => {
    const p = { project_id: "p1" }
    expect(
      resolveRoute({ screen: "customer-daily-update", params: p }, ctx(homeowner)),
    ).toEqual({ ok: true })
    expect(
      resolveRoute({ screen: "daily-progress-review", params: p }, ctx(homeowner)),
    ).toMatchObject({ ok: false, redirect: { screen: "dashboard-home" } })
    expect(
      resolveRoute({ screen: "tasks", params: p }, ctx(homeowner)),
    ).toMatchObject({ ok: false, reason: "wrong-account-type" })
  })

  it("falls back to the overview when the person can read but not act", () => {
    const worker = membership("person-w", "p1", "worker")
    const decision = resolveRoute(
      { screen: "work-plan", params: { project_id: "p1" } },
      {
        session: { accountType: "business", personId: "person-w" },
        memberships: [worker],
        knownProjectIds: new Set(["p1"]),
      },
    )
    expect(decision).toMatchObject({
      ok: false,
      redirect: { screen: "project-overview", params: { project_id: "p1" } },
    })
  })
})

describe("session permissions", () => {
  it("ignores inactive memberships and other people", () => {
    expect(projectPermissions(manager, memberships, "p3")).toEqual([])
    expect(projectPermissions(null, memberships, "p1")).toEqual([])
    expect(canOnProject(homeowner, memberships, "p1", "progress.review")).toBe(false)
    expect(canOnProject(manager, memberships, "p1", "progress.review")).toBe(true)
  })

  it("lists only projects the person may review", () => {
    const ids = projectIdsWithPermission(manager, memberships, "progress.review")
    expect([...ids]).toEqual(["p1"]) // p3 membership is inactive
    expect(projectIdsWithPermission(homeowner, memberships, "progress.review").size).toBe(0)
  })
})
