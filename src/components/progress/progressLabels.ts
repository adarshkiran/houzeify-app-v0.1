import type { Evidence, ReviewStatus } from "../../domain/models"

/** Company-side review status wording. */
export const reviewStatusLabel: Record<ReviewStatus, { text: string; color: string }> = {
  draft: { text: "Draft", color: "default" },
  submitted: { text: "Waiting for review", color: "warning" },
  approved: { text: "Approved", color: "success" },
  "changes-requested": { text: "Changes requested", color: "orange" },
  rejected: { text: "Rejected", color: "error" },
  superseded: { text: "Superseded", color: "default" },
}

/** Who can see a piece of evidence. */
export const visibilityLabel: Record<Evidence["customerVisibility"], { text: string; color: string }> = {
  private: { text: "Internal only", color: "default" },
  "review-required": { text: "Not shared", color: "warning" },
  "customer-visible": { text: "Shared with homeowner", color: "success" },
}
