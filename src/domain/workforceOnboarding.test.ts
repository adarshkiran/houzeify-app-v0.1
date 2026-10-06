import { describe, expect, it } from "vitest"
import { seedConstructionData as seed } from "../mock/seed"
import { addWorker } from "./constructionCommands"
import { generateJoinCode, openOnboardingFor } from "./workforceOnboarding"
import type { Clock, CommandContext, IdGenerator } from "./ports"
import type { Session } from "./session"

const ORG = "org-buildright"
const manager: Session = { accountType: "business", personId: "person-arjun", organizationId: ORG }
const clock: Clock = { now: () => new Date("2026-10-06T10:00:00.000Z") }
const ids = (): IdGenerator => {
  let n = 0
  return { next: (p) => `${p}-new-${++n}`, short: () => `ab${++n}cd` }
}
const as = (actor: Session | null): CommandContext => ({ actor, clock, ids: ids() })

describe("generateJoinCode", () => {
  it("returns a 6-character uppercase code", () => {
    const code = generateJoinCode(as(manager))
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
  })
})

describe("addWorker creates an invited worker and a manual onboarding", () => {
  const input = { organizationId: ORG, name: "Test Mason", phone: "+91 90000 00001", tradeIds: [], languages: ["en"] }

  it("creates a worker in invited status and one manual onboarding", () => {
    const { state, result } = addWorker(input as never)(seed, as(manager))
    expect(result.worker.status).toBe("invited")
    const onboarding = state.workerOnboardings.find((o) => o.workerId === result.worker.id)!
    expect(onboarding.method).toBe("manual")
    expect(onboarding.status).toBe("invited")
    expect(openOnboardingFor(state, result.worker.id)).toEqual(onboarding)
  })

  it("never creates two open onboardings for one worker", () => {
    const { state, result } = addWorker(input as never)(seed, as(manager))
    const open = state.workerOnboardings.filter(
      (o) => o.workerId === result.worker.id && (o.status === "invited" || o.status === "accepted"),
    )
    expect(open).toHaveLength(1)
  })
})
