import { describe, expect, it } from "vitest"
import {
  ISSUE_REPORT_PERMISSIONS,
  Permissions,
  permissionsForRole,
} from "./permissions"

describe("issue permissions", () => {
  it("reporting is progress-submit OR issue-manage", () => {
    expect(ISSUE_REPORT_PERMISSIONS).toEqual([
      Permissions.PROGRESS_SUBMIT,
      Permissions.ISSUE_MANAGE,
    ])
  })

  it("site roles can report, so they hold at least one reporting permission", () => {
    for (const role of ["worker", "subcontractor", "contractor", "supervisor", "project-manager"]) {
      const granted = permissionsForRole(role)
      expect(ISSUE_REPORT_PERMISSIONS.some((p) => granted.includes(p)), role).toBe(true)
    }
  })

  it("read-only roles cannot report", () => {
    for (const role of ["homeowner", "consultant"]) {
      const granted = permissionsForRole(role)
      expect(ISSUE_REPORT_PERMISSIONS.some((p) => granted.includes(p)), role).toBe(false)
    }
  })

  it("only managers and supervisors (and admins) manage issues", () => {
    const managers = ["project-manager", "supervisor", "developer-admin"]
    for (const role of managers) {
      expect(permissionsForRole(role)).toContain(Permissions.ISSUE_MANAGE)
    }
    for (const role of ["worker", "subcontractor", "contractor", "homeowner", "consultant"]) {
      expect(permissionsForRole(role)).not.toContain(Permissions.ISSUE_MANAGE)
    }
  })
})
