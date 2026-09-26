import type { Worker } from "../domain/models"
import { workerForSession } from "../domain/workerTasks"
import { useConstructionData } from "../mock/ConstructionDataProvider"
import { useSession } from "./SessionProvider"

/** The Worker the signed-in worker account is, or undefined (not linked / not a worker). */
export function useSignedInWorker(): Worker | undefined {
  const { session } = useSession()
  const { state } = useConstructionData()
  return workerForSession(state, session)
}
