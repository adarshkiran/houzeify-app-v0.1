import { describe, expect, it } from "vitest"
import { seedConstructionData } from "../mock/seed"
import { DEMO_IDENTITIES } from "./SessionProvider"

describe("demo worker session", () => {
  it("carries the seeded worker's phone so attendance can match the session", () => {
    const worker = seedConstructionData.people.find(
      (person) => person.id === DEMO_IDENTITIES.worker.personId,
    )
    expect(worker).toBeDefined()
    expect(DEMO_IDENTITIES.worker.phone).toBe(worker?.phone)
  })
})
