import type { HTMLAttributes, KeyboardEvent, MouseEvent } from "react"

/**
 * Table `onRow` props that open the row's record on click, or on Enter/Space
 * when the row has keyboard focus. Buttons and links inside the row keep
 * their own action (they stop the click; see `stopRowClick`).
 */
export function clickableRow(open: () => void, label: string): HTMLAttributes<HTMLElement> {
  return {
    className: "clickable-row",
    tabIndex: 0,
    "aria-label": label,
    onClick: open,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      // Only when the row itself is focused, not a button inside it.
      if (event.target !== event.currentTarget) return
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        open()
      }
    },
  }
}

/** For a button or link inside a clickable row: do its own thing, don't also open the row. */
export const stopRowClick = (event: MouseEvent) => event.stopPropagation()
