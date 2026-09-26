import type { Issue } from "./models"

export type IssueStatus = Issue["status"]

/**
 * Allowed issue status moves. Resolving goes through `resolved` before
 * `closed`, and anything settled can be reopened.
 */
const transitions: Record<IssueStatus, readonly IssueStatus[]> = {
  open: ["in-progress", "resolved"],
  "in-progress": ["open", "resolved"],
  resolved: ["closed", "open"],
  closed: ["open"],
}

export function getAllowedIssueTransitions(status: IssueStatus): IssueStatus[] {
  return [...transitions[status]]
}

export function canTransitionIssue(from: IssueStatus, to: IssueStatus): boolean {
  return transitions[from].includes(to)
}
