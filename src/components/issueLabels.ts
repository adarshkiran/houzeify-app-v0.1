import type { Issue } from "../domain/models"

export const issueStatusLabel: Record<Issue["status"], string> = {
  open: "Open",
  "in-progress": "In progress",
  resolved: "Resolved",
  closed: "Closed",
}

export function issueStatusColor(status: Issue["status"]) {
  if (status === "open") return "error"
  if (status === "in-progress") return "processing"
  if (status === "resolved") return "success"
  return "default"
}

export function issueSeverityColor(severity: Issue["severity"]) {
  if (severity === "critical" || severity === "high") return "error"
  if (severity === "medium") return "warning"
  return "default"
}

/** Button text for moving an issue to `next` from `from`. */
export function issueActionLabel(from: Issue["status"], next: Issue["status"]) {
  if (next === "in-progress") return "Start work"
  if (next === "resolved") return "Resolve"
  if (next === "closed") return "Close issue"
  return from === "in-progress" ? "Move back to open" : "Reopen"
}
