import { describe, expect, it } from "vitest"
import { seedConstructionData } from "../mock/seed"
import * as commands from "./constructionCommands"
import { ConflictError, IntegrityError } from "./errors"
import type {
  ConstructionDataState,
  PermissionScope,
  ProjectMembership,
  ProjectUnit,
  Task,
} from "./models"
import { permissionsForRole } from "./permissions"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import { PermissionError, type Session } from "./session"

const clock: Clock = { now: () => new Date("2026-09-27T09:30:00.000Z") }
function ids(): IdGenerator {
  let n = 0
  // Distinct from seed ids ("issue-1", "task-1", ...) so lookups cannot collide.
  return { next: (p) => `${p}-new-${++n}`, short: () => `s${++n}` }
}
const ctxFor = (actor: Session | null): CommandContext => ({ actor, clock, ids: ids() })

const P = "project-sharma"
const OTHER = "project-reddy"
const base = seedConstructionData
const root = base.projectUnits.find((u) => u.projectId === P)!
const template = base.tasks.find((t) => t.projectId === P)!

const unit = (id: string, parentUnitId: string | undefined): ProjectUnit => ({
  id, projectId: P, parentUnitId, kind: "block", code: id, name: id, status: "active", sequence: 9,
})
const units = [unit("block-a", root.id), unit("floor-a1", "block-a"), unit("block-b", root.id)]
const taskIn = (id: string, projectUnitId: string): Task => ({ ...template, id, projectUnitId, status: "in-progress" })

function member(personId: string, role: string, scope: Partial<PermissionScope> = {}, id = `m-${personId}`, status: ProjectMembership["status"] = "active"): ProjectMembership {
  return {
    id, projectId: P, principalType: "person", principalId: personId,
    role: role as ProjectMembership["role"],
    scope: { projectUnitIds: [], stageIds: [], tradeIds: [], ...scope },
    permissions: permissionsForRole(role), status,
  }
}
const session = (personId: string): Session => ({ accountType: "business", personId, organizationId: "org-buildright" })

const manager = session("person-arjun")
const sup = session("person-sup")
const worker = session("person-wk")
const homeowner: Session = { accountType: "homeowner", personId: "person-demo-homeowner" }

function world(memberships: ProjectMembership[] = []): ConstructionDataState {
  return {
    ...base,
    people: [...base.people, { id: "person-sup", name: "Sup" }, { id: "person-wk", name: "Wk" }],
    projectUnits: [...base.projectUnits, ...units],
    tasks: [...base.tasks, taskIn("task-a1", "floor-a1"), taskIn("task-b", "block-b")],
    memberships: [...base.memberships, member("person-sup", "supervisor"), member("person-wk", "worker"), ...memberships],
  }
}

const report = (extra: Record<string, unknown> = {}) => ({
  projectId: P, title: "Cracked lintel", description: "Hairline crack", severity: "high" as const, ...extra,
})

describe("reporting an issue", () => {
  const state = world()

  it("records location, task link, reporter and evidence", () => {
    const { result, state: after } = commands.reportIssue(
      report({ taskId: "task-a1", evidence: [{ type: "photo", url: "u1" }] }),
    )(state, ctxFor(sup))
    expect(result).toMatchObject({
      id: "issue-new-1", status: "open", projectId: P, taskId: "task-a1",
      projectUnitId: "floor-a1", stageId: template.stageId, tradeId: template.tradeId,
      createdByMembershipId: "m-person-sup", createdAt: "2026-09-27T09:30:00.000Z",
    })
    expect(result.evidenceIds).toHaveLength(1)
    const ev = after.evidence.find((e) => e.id === result.evidenceIds[0])!
    expect(ev).toMatchObject({ projectId: P, taskId: "task-a1", projectUnitId: "floor-a1", customerVisibility: "private", capturedByMembershipId: "m-person-sup" })
    expect(after.issues[after.issues.length - 1]).toBe(result)
  })

  it("can be raised from a daily progress record, taking its location", () => {
    const submitted = commands.submitDailyProgress({
      projectId: P, projectUnitId: "floor-a1", taskId: "task-a1", stageId: template.stageId,
      tradeId: template.tradeId, workTypeId: template.workTypeId, workersPresent: 1,
      progressAfter: 5, todaySummary: "x", tomorrowPlan: "y", evidence: [],
    })(state, ctxFor(manager))
    const { result } = commands.reportIssue(report({ dailyProgressId: submitted.result.id }))(submitted.state, ctxFor(manager))
    expect(result).toMatchObject({ dailyProgressId: submitted.result.id, projectUnitId: "floor-a1" })
  })

  it("workers and supervisors can report; read-only roles cannot", () => {
    expect(() => commands.reportIssue(report({ projectUnitId: "block-b" }))(state, ctxFor(worker))).not.toThrow()
    expect(() => commands.reportIssue(report({ projectUnitId: "block-b" }))(state, ctxFor(sup))).not.toThrow()
    expect(() => commands.reportIssue(report())(state, ctxFor(homeowner))).toThrow(PermissionError)
    expect(() => commands.reportIssue(report())(state, ctxFor(null))).toThrow(PermissionError)
  })

  it("requires a title", () => {
    expect(() => commands.reportIssue(report({ title: "   " }))(state, ctxFor(manager))).toThrow(/title/i)
  })

  it("rejects ids that do not fit together", () => {
    const foreignTask = base.tasks.find((t) => t.projectId === OTHER)!
    expect(() => commands.reportIssue(report({ taskId: foreignTask.id }))(state, ctxFor(manager))).toThrow(IntegrityError)
    const foreignUnit = base.projectUnits.find((u) => u.projectId === OTHER)!
    expect(() => commands.reportIssue(report({ projectUnitId: foreignUnit.id }))(state, ctxFor(manager))).toThrow(IntegrityError)
    expect(() => commands.reportIssue(report({ taskId: "task-a1", projectUnitId: "block-b" }))(state, ctxFor(manager))).toThrow(IntegrityError)
    expect(() => commands.reportIssue(report({ dailyProgressId: "nope" }))(state, ctxFor(manager))).toThrow(IntegrityError)
  })
})

describe("scope for reporting", () => {
  const scopedWorker = world([member("person-scoped", "worker", { projectUnitIds: ["block-a"] })])
  const scoped = session("person-scoped")

  it("a unit-scoped worker can report inside scope, including descendants", () => {
    expect(() => commands.reportIssue(report({ projectUnitId: "block-a" }))(scopedWorker, ctxFor(scoped))).not.toThrow()
    expect(() => commands.reportIssue(report({ taskId: "task-a1" }))(scopedWorker, ctxFor(scoped))).not.toThrow()
  })

  it("but not outside scope, and not a whole-project issue with no location", () => {
    expect(() => commands.reportIssue(report({ projectUnitId: "block-b" }))(scopedWorker, ctxFor(scoped))).toThrow(PermissionError)
    expect(() => commands.reportIssue(report({ taskId: "task-b" }))(scopedWorker, ctxFor(scoped))).toThrow(PermissionError)
    expect(() => commands.reportIssue(report())(scopedWorker, ctxFor(scoped))).toThrow(PermissionError)
  })
})

describe("managing an issue", () => {
  const base0 = world()
  const made = commands.reportIssue(report({ taskId: "task-a1" }))(base0, ctxFor(sup))
  const state = made.state
  const issueId = made.result.id

  it("only ISSUE_MANAGE holders may assign or change status", () => {
    expect(() => commands.transitionIssue(issueId, "in-progress")(state, ctxFor(worker))).toThrow(PermissionError)
    expect(() => commands.assignIssue(issueId, "m-person-sup")(state, ctxFor(worker))).toThrow(PermissionError)
    expect(() => commands.transitionIssue(issueId, "in-progress")(state, ctxFor(homeowner))).toThrow(PermissionError)
    expect(() => commands.transitionIssue(issueId, "in-progress")(state, ctxFor(sup))).not.toThrow()
  })

  it("the reporter is not special: a different manager can close it", () => {
    const ctx = ctxFor(manager)
    const a = commands.transitionIssue(issueId, "resolved", "Replaced")(state, ctx)
    const b = commands.transitionIssue(issueId, "closed")(a.state, ctx)
    expect(b.state.issues.find((i) => i.id === issueId)!.status).toBe("closed")
  })

  it("walks the lifecycle and stamps times and the resolution note", () => {
    const ctx = ctxFor(sup)
    const find = (s: ConstructionDataState) => s.issues.find((i) => i.id === issueId)!
    const s1 = commands.transitionIssue(issueId, "in-progress")(state, ctx).state
    expect(find(s1)).toMatchObject({ status: "in-progress", updatedAt: "2026-09-27T09:30:00.000Z" })
    const s2 = commands.transitionIssue(issueId, "resolved", "  Cured  ")(s1, ctx).state
    expect(find(s2)).toMatchObject({ status: "resolved", resolvedAt: "2026-09-27T09:30:00.000Z", resolutionNote: "Cured" })
    const s3 = commands.transitionIssue(issueId, "closed")(s2, ctx).state
    expect(find(s3)).toMatchObject({ status: "closed", closedAt: "2026-09-27T09:30:00.000Z", resolutionNote: "Cured" })
    const s4 = commands.transitionIssue(issueId, "open")(s3, ctx).state
    expect(find(s4).status).toBe("open")
    expect(find(s4).resolvedAt).toBeUndefined()
    expect(find(s4).closedAt).toBeUndefined()
    expect(find(s4).resolutionNote).toBeUndefined()
  })

  it("rejects an invalid move with a message for people", () => {
    const attempt = () => commands.transitionIssue(issueId, "closed")(state, ctxFor(sup))
    expect(attempt).toThrow(ConflictError)
    expect(attempt).toThrow(/open.*closed|closed/i)
  })

  it("assigns only to an active member of this project, and can unassign", () => {
    const ctx = ctxFor(sup)
    const ok = commands.assignIssue(issueId, "m-person-wk")(state, ctx)
    expect(ok.state.issues.find((i) => i.id === issueId)!.assignedMembershipId).toBe("m-person-wk")
    const cleared = commands.assignIssue(issueId, undefined)(ok.state, ctx)
    expect(cleared.state.issues.find((i) => i.id === issueId)!.assignedMembershipId).toBeUndefined()

    const invited = world([member("person-inv", "worker", {}, "m-inv", "invited")])
    const made2 = commands.reportIssue(report({ taskId: "task-a1" }))(invited, ctxFor(sup))
    expect(() => commands.assignIssue(made2.result.id, "m-inv")(made2.state, ctxFor(sup))).toThrow(IntegrityError)
    const otherProjectMember = base.memberships.find((m) => m.projectId === OTHER)!
    expect(() => commands.assignIssue(issueId, otherProjectMember.id)(state, ctxFor(sup))).toThrow(IntegrityError)
    expect(() => commands.assignIssue("nope", "m-person-wk")(state, ctxFor(sup))).toThrow(PermissionError)
  })

  it("cannot assign a closed issue", () => {
    const ctx = ctxFor(sup)
    let s = commands.transitionIssue(issueId, "resolved")(state, ctx).state
    s = commands.transitionIssue(issueId, "closed")(s, ctx).state
    expect(() => commands.assignIssue(issueId, "m-person-wk")(s, ctx)).toThrow(ConflictError)
  })
})

describe("scope for managing", () => {
  const scopedSup = world([member("person-ssup", "supervisor", { projectUnitIds: ["block-a"] })])
  const ssup = session("person-ssup")
  const ctx = ctxFor(manager) // one generator, so the two issues get different ids
  const inScope = commands.reportIssue(report({ taskId: "task-a1" }))(scopedSup, ctx)
  const both = commands.reportIssue(report({ taskId: "task-b" }))(inScope.state, ctx)

  it("manages issues in scope, not outside it", () => {
    expect(() => commands.transitionIssue(inScope.result.id, "in-progress")(both.state, ctxFor(ssup))).not.toThrow()
    expect(() => commands.transitionIssue(both.result.id, "in-progress")(both.state, ctxFor(ssup))).toThrow(PermissionError)
    expect(() => commands.assignIssue(both.result.id, "m-person-wk")(both.state, ctxFor(ssup))).toThrow(PermissionError)
  })
})

describe("issue evidence", () => {
  const made = commands.reportIssue(report({ taskId: "task-a1" }))(world(), ctxFor(sup))

  it("attaches more evidence, attributed to the actor", () => {
    const { state, result } = commands.addIssueEvidence(made.result.id, [{ type: "photo", url: "u2" }])(made.state, ctxFor(worker))
    const issue = state.issues.find((i) => i.id === made.result.id)!
    expect(issue.evidenceIds).toHaveLength(1)
    expect(result).toHaveLength(1)
    expect(state.evidence.find((e) => e.id === issue.evidenceIds[0])!.capturedByMembershipId).toBe("m-person-wk")
  })

  it("is denied to read-only roles and refused on a closed issue", () => {
    expect(() => commands.addIssueEvidence(made.result.id, [{ type: "photo", url: "u" }])(made.state, ctxFor(homeowner))).toThrow(PermissionError)
    const ctx = ctxFor(sup)
    let s = commands.transitionIssue(made.result.id, "resolved")(made.state, ctx).state
    s = commands.transitionIssue(made.result.id, "closed")(s, ctx).state
    expect(() => commands.addIssueEvidence(made.result.id, [{ type: "photo", url: "u" }])(s, ctx)).toThrow(ConflictError)
  })
})

describe("duplicate phone numbers", () => {
  // Seed workers have no phone, so give one an existing number.
  const plain = world()
  const state: ConstructionDataState = {
    ...plain,
    workers: plain.workers.map((w, i) => (i === 0 ? { ...w, phone: "+91 98765 12345" } : w)),
  }
  const existing = state.workers[0]

  it("rejects a worker whose phone is already in the organization, however formatted", () => {
    const digits = existing.phone!.replace(/\D/g, "").slice(-10)
    const add = (phone: string) =>
      commands.addWorker({ organizationId: "org-buildright", name: "Dup", tradeIds: [], phone })(state, ctxFor(manager))
    expect(() => add(existing.phone!)).toThrow(ConflictError)
    expect(() => add(`+91 ${digits.slice(0, 5)} ${digits.slice(5)}`)).toThrow(/phone/i)
    expect(() => add("+91 90000 11111")).not.toThrow()
    expect(() => commands.addWorker({ organizationId: "org-buildright", name: "NoPhone", tradeIds: [] })(state, ctxFor(manager))).not.toThrow()
  })

  it("allows the same number in a different organization", () => {
    const foreign = { ...state, workers: [...state.workers, { ...existing, id: "w-x", organizationId: "org-other" }] }
    const otherPhone = "+91 90000 22222"
    const withOther = { ...foreign, workers: foreign.workers.map((w) => (w.id === "w-x" ? { ...w, phone: otherPhone } : w)) }
    expect(() =>
      commands.addWorker({ organizationId: "org-buildright", name: "Same", tradeIds: [], phone: otherPhone })(withOther, ctxFor(manager)),
    ).not.toThrow()
  })

  it("rejects inviting someone whose phone is already on this project's team", () => {
    const invite = (projectId: string, phone: string) =>
      commands.inviteProjectMember({ projectId, name: "New", role: "supervisor", phone })(state, ctxFor(manager))
    const first = invite(P, "+91 91111 33333")
    expect(() => commands.inviteProjectMember({ projectId: P, name: "Again", role: "worker", phone: "9111133333" })(first.state, ctxFor(manager))).toThrow(ConflictError)
    // a different project is a different team
    expect(() => commands.inviteProjectMember({ projectId: OTHER, name: "Again", role: "worker", phone: "9111133333" })(first.state, ctxFor(manager))).not.toThrow()
  })
})
