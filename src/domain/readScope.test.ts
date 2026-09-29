import { describe, expect, it } from "vitest"
import { getOpenIssues, getOpenTasks, getOrganizationDashboard } from "../mock/selectors"
import { seedConstructionData } from "../mock/seed"
import type {
  ConstructionDataState,
  Issue,
  PermissionScope,
  ProjectMembership,
  ProjectUnit,
  Task,
} from "./models"
import { permissionsForRole } from "./permissions"
import { scopeStateForReading, visibleMemberships } from "./readScope"
import type { Session } from "./session"

const P = "project-sharma"
const base = seedConstructionData
const root = base.projectUnits.find((u) => u.projectId === P)!
const template = base.tasks.find((t) => t.projectId === P)!

const unit = (id: string, parentUnitId?: string): ProjectUnit => ({
  id, projectId: P, parentUnitId, kind: "block", code: id, name: id, status: "active", sequence: 9,
})
const taskIn = (id: string, projectUnitId: string): Task => ({ ...template, id, projectUnitId })
const issueIn = (id: string, projectUnitId?: string, taskId?: string): Issue => ({
  id, projectId: P, projectUnitId, taskId, stageId: template.stageId, tradeId: template.tradeId,
  title: id, description: "", severity: "low", status: "open", evidenceIds: [],
  customerVisibility: "private",
  createdByMembershipId: "m", createdAt: "2026-01-01T00:00:00Z",
})

function member(personId: string, role: string, scope: Partial<PermissionScope> = {}, id = `m-${personId}`): ProjectMembership {
  return {
    id, projectId: P, principalType: "person", principalId: personId,
    role: role as ProjectMembership["role"],
    scope: { projectUnitIds: [], stageIds: [], tradeIds: [], ...scope },
    permissions: permissionsForRole(role), status: "active",
  }
}
const session = (personId: string): Session => ({ accountType: "business", personId, organizationId: "org-buildright" })
const manager = session("person-arjun")
const scopedA = session("person-a")

const state: ConstructionDataState = {
  ...base,
  people: [...base.people, { id: "person-a", name: "A" }, { id: "person-b", name: "B" }],
  projectUnits: [...base.projectUnits, unit("block-a", root.id), unit("floor-a1", "block-a"), unit("block-b", root.id)],
  tasks: [...base.tasks, taskIn("task-a1", "floor-a1"), taskIn("task-b", "block-b")],
  issues: [...base.issues, issueIn("issue-a", "floor-a1"), issueIn("issue-b", "block-b"), issueIn("issue-whole")],
  memberships: [
    ...base.memberships,
    member("person-a", "supervisor", { projectUnitIds: ["block-a"] }),
    member("person-b", "supervisor", { projectUnitIds: ["block-b"] }, "m-b"),
  ],
}

describe("scopeStateForReading", () => {
  it("leaves an unscoped manager's view of their projects intact", () => {
    const view = scopeStateForReading(state, manager)
    expect(view.tasks).toEqual(state.tasks)
    expect(view.issues).toEqual(state.issues)
    expect(view.projectUnits).toEqual(state.projectUnits)
  })

  it("shows a scoped member only their unit's tasks, issues and units", () => {
    const view = scopeStateForReading(state, scopedA)
    const sharma = (ids: { id: string; projectId: string }[]) => ids.filter((i) => i.projectId === P).map((i) => i.id)
    expect(sharma(view.tasks)).toContain("task-a1")
    expect(sharma(view.tasks)).not.toContain("task-b")
    expect(sharma(view.issues).sort()).toEqual(["issue-a"])
    expect(sharma(view.projectUnits).sort()).toEqual(["block-a", "floor-a1"])
  })

  it("hides whole-project (no location) items from a scoped member", () => {
    expect(scopeStateForReading(state, scopedA).issues.some((i) => i.id === "issue-whole")).toBe(false)
    expect(scopeStateForReading(state, manager).issues.some((i) => i.id === "issue-whole")).toBe(true)
  })

  it("hides everything in a project the person is not a member of", () => {
    const other = base.tasks.find((t) => t.projectId !== P)!
    expect(scopeStateForReading(state, scopedA).tasks.some((t) => t.id === other.id)).toBe(false)
  })

  it("keeps task assignments and evidence only for visible tasks", () => {
    const withAssign: ConstructionDataState = {
      ...state,
      assignments: [
        ...state.assignments,
        { id: "as-a", taskId: "task-a1", assigneeType: "worker", assigneeId: "w", assignedByMembershipId: "m", status: "assigned", assignedAt: "x" },
        { id: "as-b", taskId: "task-b", assigneeType: "worker", assigneeId: "w", assignedByMembershipId: "m", status: "assigned", assignedAt: "x" },
      ],
      evidence: [
        ...state.evidence,
        { id: "ev-a", projectId: P, taskId: "task-a1", type: "photo", url: "u", capturedAt: "x", customerVisibility: "private" },
        { id: "ev-b", projectId: P, taskId: "task-b", type: "photo", url: "u", capturedAt: "x", customerVisibility: "private" },
      ],
    }
    const view = scopeStateForReading(withAssign, scopedA)
    expect(view.assignments.map((a) => a.id)).toContain("as-a")
    expect(view.assignments.map((a) => a.id)).not.toContain("as-b")
    expect(view.evidence.map((e) => e.id)).toContain("ev-a")
    expect(view.evidence.map((e) => e.id)).not.toContain("ev-b")
  })

  it("makes the existing selectors scope-correct", () => {
    const view = scopeStateForReading(state, scopedA)
    expect(getOpenIssues(view, P).map((i) => i.id)).toEqual(["issue-a"])
    expect(getOpenIssues(state, P).length).toBeGreaterThan(1)
    expect(getOpenTasks(view, P).some((t) => t.id === "task-b")).toBe(false)
    const dash = getOrganizationDashboard(view, "org-buildright")
    expect(dash.openIssues.filter((i) => i.projectId === P).map((i) => i.id)).toEqual(["issue-a"])
  })
})

describe("visibleMemberships", () => {
  it("an unscoped viewer sees the whole team", () => {
    const all = state.memberships.filter((m) => m.projectId === P)
    expect(visibleMemberships(manager, state.memberships, state.projectUnits, P)).toEqual(all)
  })

  it("a scoped viewer sees project-wide roles, overlapping members and themselves, not other locations' teams", () => {
    const ids = visibleMemberships(scopedA, state.memberships, state.projectUnits, P).map((m) => m.id)
    expect(ids).toContain("m-person-a") // self
    expect(ids).toContain("membership-manager-1") // project-wide manager
    expect(ids).not.toContain("m-b") // scoped to block-b only
  })

  it("someone with no membership on the project sees no one", () => {
    expect(visibleMemberships(session("person-nobody"), state.memberships, state.projectUnits, P)).toEqual([])
  })
})
