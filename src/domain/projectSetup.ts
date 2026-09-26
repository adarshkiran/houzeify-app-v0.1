import type { ProjectKind, ProjectUnitKind } from "./models"

/** Kinds that typically need hierarchical / bulk unit creation. */
export function isMultiUnitProjectKind(kind: ProjectKind): boolean {
  return (
    kind === "multiple-houses" ||
    kind === "villa-development" ||
    kind === "apartment" ||
    kind === "multi-block" ||
    kind === "commercial"
  )
}

/** Default root location for a newly created individual house project. */
export function defaultRootUnitForKind(
  kind: ProjectKind,
): { kind: ProjectUnitKind; code: string; name: string } | null {
  if (kind === "individual-house") {
    return { kind: "house", code: "HOUSE", name: "Main House" }
  }
  return null
}

export interface BatchUnitSpec {
  count: number
  kind: ProjectUnitKind
  codePrefix: string
  namePrefix: string
  padDigits?: number
}

/** Build sequential codes/names for bulk unit creation (e.g. V001–V170). */
export function buildBatchUnitLabels(
  spec: BatchUnitSpec,
): Array<{ code: string; name: string }> {
  const count = Math.max(0, Math.floor(spec.count))
  const pad = spec.padDigits ?? Math.max(2, String(count).length)
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1
    const suffix = String(n).padStart(pad, "0")
    return {
      code: `${spec.codePrefix}${suffix}`,
      name: `${spec.namePrefix} ${n}`,
    }
  })
}
