import type { TaskStatus } from "./models"

/**
 * Authoritative task status transition map.
 * UI and provider mutations must go through these helpers.
 */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  draft: ["assigned", "cancelled"],
  assigned: ["accepted", "blocked", "cancelled"],
  accepted: ["ready", "blocked", "delayed", "cancelled"],
  ready: ["in-progress", "blocked", "delayed", "cancelled"],
  "in-progress": ["submitted", "blocked", "delayed", "cancelled"],
  submitted: ["review", "reopened"],
  review: ["approved", "reopened"],
  approved: ["completed", "reopened"],
  completed: ["reopened"],
  blocked: ["ready", "in-progress", "cancelled"],
  delayed: ["ready", "in-progress", "cancelled"],
  reopened: ["ready", "in-progress", "cancelled"],
  cancelled: ["reopened"],
}

export function getAllowedTaskTransitions(status: TaskStatus): TaskStatus[] {
  return TASK_TRANSITIONS[status]
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from].includes(to)
}

/** After daily progress is submitted, move the linked task toward review. */
export function statusAfterProgressSubmit(
  status: TaskStatus,
): TaskStatus | null {
  if (canTransitionTask(status, "review")) return "review"
  if (canTransitionTask(status, "submitted")) return "submitted"
  return null
}

/**
 * After daily progress is approved, advance the linked task to approved
 * via legal intermediate steps (e.g. submitted → review → approved).
 */
export function statusAfterProgressApproval(status: TaskStatus): TaskStatus {
  let current = status
  if (canTransitionTask(current, "review")) current = "review"
  if (canTransitionTask(current, "approved")) current = "approved"
  return current
}

/** After daily progress is rejected, reopen the linked task when allowed. */
export function statusAfterProgressRejection(
  status: TaskStatus,
): TaskStatus | null {
  if (canTransitionTask(status, "reopened")) return "reopened"
  return null
}
