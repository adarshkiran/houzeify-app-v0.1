import { Tooltip } from "antd"
import { cloneElement, type ReactElement } from "react"

/**
 * Renders a button as-is when `allowed`; otherwise disabled with an
 * explanatory tooltip (a bare disabled button can't show one).
 */
export default function Gated({
  allowed,
  children,
  reason = "You don't have permission to do this.",
}: {
  allowed: boolean
  children: ReactElement<{ disabled?: boolean }>
  reason?: string
}) {
  if (allowed) return children
  return (
    <Tooltip title={reason}>
      <span style={{ display: "inline-block" }}>
        {cloneElement(children, { disabled: true })}
      </span>
    </Tooltip>
  )
}
