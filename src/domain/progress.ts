import type { ConstructionStage, Project, Task } from "./models"

/**
 * Official project progress (build plan §18).
 *
 * Task % → stage % (over every unit) → fixed stage weights → project %.
 * The % a submitter types on a daily update is their estimate only; it never
 * changes the project figure.
 *
 * Known simplification: a stage's tasks are assumed to cover the work its
 * baseline leaves, so one tracked task at 100% completes a stage with a 40%
 * baseline. A BOQ / cost weighting replaces this later.
 */

/** Weight of each stage by stage code. Sums to 100; unknown codes weigh 0. */
export const STAGE_WEIGHTS: Readonly<Record<string, number>> = {
  SITE: 5,
  FND: 12,
  RCC: 25,
  MSN: 12,
  PLS: 10,
  WPF: 5,
  SRV: 13,
  FLR: 8,
  FIN: 10,
}

const DONE_STATUSES: ReadonlySet<Task["status"]> = new Set(["approved", "completed"])

/** How complete one task is, 0–100. */
export function taskPercent(task: Task): number {
  const planned = task.plannedQuantity
  if (planned && planned.value > 0) {
    const done = task.completedQuantity
    if (!done || done.unit !== planned.unit) return 0
    return clampPercent((done.value / planned.value) * 100)
  }
  return DONE_STATUSES.has(task.status) ? 100 : 0
}

/** baseline + (100 − baseline) × average task %; the baseline alone when there are no tasks. */
export function stagePercent(baseline: number, tasks: readonly Task[]): number {
  const base = clampPercent(baseline)
  if (!tasks.length) return base
  const average = tasks.reduce((sum, task) => sum + taskPercent(task), 0) / tasks.length
  return base + ((100 - base) * average) / 100
}

export function calculateProjectProgress(
  project: Project,
  stages: readonly ConstructionStage[],
  tasks: readonly Task[],
): number {
  const projectTasks = tasks.filter(
    (task) => task.projectId === project.id && task.status !== "cancelled",
  )
  const total = stages.reduce((sum, stage) => {
    const weight = STAGE_WEIGHTS[stage.code] ?? 0
    if (!weight) return sum
    const stageTasks = projectTasks.filter((task) => task.stageId === stage.id)
    const percent = stagePercent(project.stageBaselines[stage.id] ?? 0, stageTasks)
    return sum + (weight * percent) / 100
  }, 0)
  return Math.round(clampPercent(total))
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(100, Math.max(0, value))
}
