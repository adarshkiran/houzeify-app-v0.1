import { describe, expect, it, vi } from "vitest"
import { runCommand } from "./useCommand"

// Task 19 concern: useCommand must await its action end to end. In supabase
// mode the provider's write wrappers return a Promise; if the hook didn't
// await it, a rejected write wouldn't be caught (no error toast, and a
// success toast could fire before the database actually responded). This
// tests the hook's testable core directly (no React/antd context needed),
// following the pattern in mock/providerAsync.test.ts of exercising the
// async contract with a minimal stand-in rather than a real provider.
describe("runCommand", () => {
  it("awaits an async action and resolves with its value", async () => {
    const message = { success: vi.fn(), error: vi.fn() }
    const action = async () => "the value"

    const outcome = await runCommand(action, { success: "Saved" }, message)

    expect(outcome).toEqual({ ok: true, value: "the value" })
    expect(message.success).toHaveBeenCalledWith("Saved")
    expect(message.error).not.toHaveBeenCalled()
  })

  it("resolves a synchronous action immediately, unchanged from in-memory-store behavior", async () => {
    const message = { success: vi.fn(), error: vi.fn() }
    const action = () => 42

    const outcome = await runCommand(action, undefined, message)

    expect(outcome).toEqual({ ok: true, value: 42 })
    expect(message.success).not.toHaveBeenCalled()
  })

  it("surfaces a rejected action as {ok: false} and shows the error message instead of the success toast", async () => {
    const message = { success: vi.fn(), error: vi.fn() }
    const refusal = new Error("write refused")
    const action = async () => {
      throw refusal
    }

    const outcome = await runCommand(action, { success: "Saved" }, message)

    expect(outcome).toEqual({ ok: false, error: refusal })
    expect(message.success).not.toHaveBeenCalled()
    expect(message.error).toHaveBeenCalledTimes(1)
  })

  it("surfaces a synchronously thrown action the same way as a rejected promise", async () => {
    const message = { success: vi.fn(), error: vi.fn() }
    const refusal = new Error("refused synchronously")
    const action = () => {
      throw refusal
    }

    const outcome = await runCommand(action, { success: "Saved" }, message)

    expect(outcome).toEqual({ ok: false, error: refusal })
    expect(message.success).not.toHaveBeenCalled()
    expect(message.error).toHaveBeenCalledTimes(1)
  })
})
