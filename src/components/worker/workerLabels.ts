import type { DailyProgress, Task, TaskStatus } from "../../domain/models"

/** Plain-language task status for workers. */
export const workerStatusLabel: Record<TaskStatus, string> = {
  draft: "Not ready",
  assigned: "New",
  accepted: "Accepted",
  ready: "Ready to start",
  "in-progress": "In progress",
  submitted: "Waiting for review",
  review: "Waiting for review",
  approved: "Approved",
  completed: "Completed",
  blocked: "Blocked",
  delayed: "Delayed",
  reopened: "Sent back — redo",
  cancelled: "Cancelled",
}

export function workerStatusColor(status: TaskStatus): string {
  switch (status) {
    case "assigned":
      return "purple"
    case "in-progress":
      return "processing"
    case "submitted":
    case "review":
      return "warning"
    case "approved":
    case "completed":
      return "success"
    case "blocked":
    case "reopened":
      return "error"
    default:
      return "default"
  }
}

export const priorityColor = (priority: Task["priority"]) =>
  priority === "critical" || priority === "high" ? "red" : undefined

/** How the worker's own update stands with the supervisor. */
export const reviewLabel: Record<DailyProgress["reviewStatus"], {
  text: string
  color: string
}> = {
  draft: { text: "Draft", color: "default" },
  submitted: { text: "Waiting for review", color: "warning" },
  approved: { text: "Approved", color: "success" },
  "changes-requested": { text: "Fix and resend", color: "error" },
  rejected: { text: "Not accepted", color: "error" },
  superseded: { text: "Replaced by a newer update", color: "default" },
}

export const formatQuantity = (quantity?: { value: number; unit: string }) =>
  quantity ? `${quantity.value} ${quantity.unit}` : "—"
