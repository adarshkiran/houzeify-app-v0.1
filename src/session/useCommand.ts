import { App, message as staticMessage } from "antd"
import { useCallback } from "react"
import { describeCommandError } from "../domain/errors"

export type CommandOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown }

/**
 * Runs a command (a call into the data provider) and reports failure to the
 * user instead of letting it throw silently in an event handler. Callers use
 * the outcome to decide whether to close a modal or navigate.
 * Prefer rendering inside CompanyThemeProvider, which supplies antd's `App`
 * context (themed messages). Outside it antd's context is an empty object, so
 * fall back to the static `message` rather than crash.
 */
export function useCommand() {
  const app = App.useApp()
  const message = typeof app.message.error === "function" ? app.message : staticMessage
  return useCallback(
    <T,>(action: () => T, options?: { success?: string }): CommandOutcome<T> => {
      try {
        const value = action()
        if (options?.success) message.success(options.success)
        return { ok: true, value }
      } catch (error) {
        console.warn("[command] failed:", error)
        message.error(describeCommandError(error))
        return { ok: false, error }
      }
    },
    [message],
  )
}
