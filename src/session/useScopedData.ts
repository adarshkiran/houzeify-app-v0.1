import { useMemo } from "react"
import type { ConstructionDataState } from "../domain/models"
import { scopeStateForReading } from "../domain/readScope"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { useSession } from "./SessionProvider"

/**
 * The construction data as the signed-in person may read it (their scope).
 * Use for lists, counts and aggregates; use `useConstructionData().state`
 * only where the full data is genuinely needed (e.g. name lookups).
 */
export function useScopedData(): ConstructionDataState {
  const { session } = useSession()
  const { state } = useConstructionData()
  return useMemo(() => scopeStateForReading(state, session), [state, session])
}
