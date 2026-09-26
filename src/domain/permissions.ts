/**
 * Permission vocabulary for the construction domain.
 * Phase 0 defines names/constants only — no real authentication yet.
 */
export const Permissions = {
  PROJECT_READ: "project.read",
  PROJECT_MANAGE: "project.manage",
  TASK_MANAGE: "task.manage",
  PROGRESS_SUBMIT: "progress.submit",
  PROGRESS_REVIEW: "progress.review",
  CUSTOMER_PUBLISH: "customer.publish",
  WORKFORCE_MANAGE: "workforce.manage",
  EVIDENCE_CAPTURE: "evidence.capture",
} as const

export type Permission = typeof Permissions[keyof typeof Permissions]

export const ALL_PERMISSIONS: Permission[] = Object.values(Permissions)

/** Default permission sets by project role (prototype matrix). */
export const RolePermissions: Record<string, Permission[]> = {
  "project-manager": [
    Permissions.PROJECT_READ,
    Permissions.PROJECT_MANAGE,
    Permissions.TASK_MANAGE,
    Permissions.PROGRESS_SUBMIT,
    Permissions.PROGRESS_REVIEW,
    Permissions.CUSTOMER_PUBLISH,
    Permissions.WORKFORCE_MANAGE,
    Permissions.EVIDENCE_CAPTURE,
  ],
  supervisor: [
    Permissions.PROJECT_READ,
    Permissions.TASK_MANAGE,
    Permissions.PROGRESS_SUBMIT,
    Permissions.PROGRESS_REVIEW,
    Permissions.WORKFORCE_MANAGE,
    Permissions.EVIDENCE_CAPTURE,
  ],
  contractor: [
    Permissions.PROJECT_READ,
    Permissions.TASK_MANAGE,
    Permissions.PROGRESS_SUBMIT,
    Permissions.EVIDENCE_CAPTURE,
  ],
  worker: [
    Permissions.PROJECT_READ,
    Permissions.PROGRESS_SUBMIT,
    Permissions.EVIDENCE_CAPTURE,
  ],
  homeowner: [Permissions.PROJECT_READ],
  "developer-admin": ALL_PERMISSIONS,
  subcontractor: [
    Permissions.PROJECT_READ,
    Permissions.PROGRESS_SUBMIT,
    Permissions.EVIDENCE_CAPTURE,
  ],
  consultant: [Permissions.PROJECT_READ],
}

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value)
}

export function hasPermission(
  granted: readonly string[],
  permission: Permission,
): boolean {
  return granted.includes(permission)
}

export function permissionsForRole(role: string): Permission[] {
  return RolePermissions[role] ?? [Permissions.PROJECT_READ]
}
