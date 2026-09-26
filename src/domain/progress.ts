import type { DailyProgress, Project } from "./models"

/**
 * Project progress aggregation (Phase 0).
 *
 * Rule:
 * - Consider only approved daily-progress records for the project.
 * - Use the latest approved `progressAfter` by date/submittedAt when present.
 * - Otherwise keep the project's stored progress (supports mid-project bootstrap
 *   via `trackingStartedMidProject` and manual seed values).
 *
 * Future evolution: weight by work-type quantities, then roll up
 * task → work type → stage → unit → project.
 */
export function calculateProjectProgress(
  project: Project,
  dailyProgress: readonly DailyProgress[],
): number {
  const approved = dailyProgress
    .filter(
      (item) =>
        item.projectId === project.id &&
        item.reviewStatus === "approved" &&
        typeof item.progressAfter === "number",
    )
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        right.submittedAt.localeCompare(left.submittedAt),
    )

  const latest = approved[0]
  if (latest && typeof latest.progressAfter === "number") {
    return clampPercent(latest.progressAfter)
  }

  return clampPercent(project.progress)
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(100, Math.max(0, value))
}
