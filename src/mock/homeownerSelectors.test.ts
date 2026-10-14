import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "./seed"
import { getHomeownerProjects, getPersonFirstName } from "./selectors"

describe("getHomeownerProjects", () => {
  it("returns the projects the person holds an active homeowner membership on", () => {
    const projects = getHomeownerProjects(seed, "person-demo-homeowner")
    expect(projects.map((project) => project.id)).toEqual(["project-sharma"])
  })

  it("returns nothing for a person with no homeowner membership", () => {
    expect(getHomeownerProjects(seed, "person-arjun")).toEqual([])
    expect(getHomeownerProjects(seed, "person-unknown")).toEqual([])
  })

  it("ignores inactive memberships", () => {
    const state = {
      ...seed,
      memberships: seed.memberships.map((membership) =>
        membership.id === "membership-homeowner-sharma"
          ? { ...membership, status: "inactive" as const }
          : membership,
      ),
    }
    expect(getHomeownerProjects(state, "person-demo-homeowner")).toEqual([])
  })
})

describe("getPersonFirstName", () => {
  it("returns the first word of the person's name", () => {
    expect(getPersonFirstName(seed, "person-demo-homeowner")).toBe("Demo")
  })

  it("returns undefined when the person is unknown", () => {
    expect(getPersonFirstName(seed, "person-unknown")).toBeUndefined()
    expect(getPersonFirstName(seed, undefined)).toBeUndefined()
  })
})
