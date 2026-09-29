import { describe, expect, it } from "vitest"
import { isAppScreen } from "../../domain/navigation"
import { BACK_TO_COMPANY, COMPANY_NAV, projectNav } from "./companyNav"

describe("company navigation", () => {
  const project = projectNav("project-sharma")

  it("points every built item at a real screen", () => {
    for (const item of [...COMPANY_NAV, ...project, BACK_TO_COMPANY]) {
      if (item.to) expect(isAppScreen(item.to.screen), item.key).toBe(true)
    }
  })

  it("has unique keys within each menu", () => {
    for (const menu of [COMPANY_NAV, project]) {
      const keys = menu.map((item) => item.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it("keeps the DESIGN.md order and scopes project items to the project", () => {
    expect(COMPANY_NAV.map((item) => item.label)).toEqual([
      "Dashboard", "Projects", "Work Library", "Progress", "Site Operations", "Workforce",
      "Live Site", "Documents", "Reports", "Team", "Hozie AI",
    ])
    for (const item of project) {
      if (item.to) expect(item.to.params).toEqual({ project_id: "project-sharma" })
    }
  })

  it("marks only unbuilt features as Soon", () => {
    expect(COMPANY_NAV.filter((item) => !item.to).map((item) => item.key)).toEqual([
      "site-ops", "live-site", "documents", "reports", "team", "hozie",
    ])
    expect(project.filter((item) => !item.to).map((item) => item.key)).toEqual([])
  })
})
