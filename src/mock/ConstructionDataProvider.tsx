import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { ConstructionDataState } from "../domain/models"
import type { Clock, Command, ConstructionRepository, IdGenerator } from "../domain/ports"
import {
  canTransitionTask,
  getAllowedTaskTransitions,
} from "../domain/taskTransitions"
import { emptyConstructionState, loadState } from "../data/adapter"
import { createLatestWinsLoader } from "../data/latestLoad"
import { getSupabaseClient } from "../data/supabaseClient"
import { sessionDataKey } from "../session/dataKey"
import { SUPABASE_DATA_SOURCE, useSession } from "../session/SessionProvider"
import {
  createInMemoryRepository,
  systemClock,
  uuidGenerator,
} from "./repository"
import {
  memoryCommands,
  supabaseCommands,
  type CommandSurface,
} from "./commandSurface"

export type {
  AddEvidenceInput,
  AddLibraryStageInput,
  AddLibraryTradeInput,
  AddLibraryWorkTypeInput,
  AddProjectUnitInput,
  AddWorkPlanItemInput,
  AddWorkerInput,
  AssignWorkerToProjectInput,
  CreateProjectInput,
  CreateTaskInput,
  InviteProjectMemberInput,
  IssueEvidenceInput,
  ReportIssueInput,
  ResubmitDailyProgressInput,
  SubmitDailyProgressInput,
} from "../domain/commandInputs"
export type { AttendancePunchInput, CommandSurface } from "./commandSurface"

export type ConstructionDataContextValue = CommandSurface & {
  state: ConstructionDataState
  /**
   * False while the signed-in person's data is still loading. Anything that
   * decides from `state` (route guards) must wait for it, or it sees an empty
   * project list and treats real projects as unknown.
   */
  loaded: boolean
}

export { getAllowedTaskTransitions, canTransitionTask }

const ConstructionDataContext =
  createContext<ConstructionDataContextValue | null>(null)

interface ConstructionDataProviderProps {
  children: ReactNode
  /** In-memory store for the memory data source. Ignored in supabase mode. */
  repository?: ConstructionRepository
  clock?: Clock
  ids?: IdGenerator
}

/**
 * Serves the screens one command surface. With VITE_DATA_SOURCE=supabase the
 * state is loaded from the stack on sign-in and reloaded after each write;
 * otherwise the in-memory store runs the domain commands as before.
 */
export default function ConstructionDataProvider({
  children,
  repository,
  clock = systemClock,
  ids = uuidGenerator,
}: ConstructionDataProviderProps) {
  const { session } = useSession()

  // Dependencies are fixed for the provider's lifetime.
  const repo = useRef<ConstructionRepository>(
    repository ?? createInMemoryRepository(),
  ).current
  const client = useRef(SUPABASE_DATA_SOURCE ? getSupabaseClient() : null).current
  const [state, setState] = useState<ConstructionDataState>(() =>
    client ? emptyConstructionState() : repo.load(),
  )

  // Commands read the latest state and session through refs so they never see
  // stale values, and back-to-back commands in one tick compose correctly.
  const stateRef = useRef(state)
  const sessionRef = useRef(session)
  sessionRef.current = session

  // Whose data `state` currently holds ("none" once signed out). The state is
  // trustworthy for routing only when this matches the current session.
  const sessionKey = sessionDataKey(session)
  const sessionKeyRef = useRef(sessionKey)
  sessionKeyRef.current = sessionKey
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  /** Commits a new state for rendering and for the next command. */
  const commit = useCallback((next: ConstructionDataState) => {
    stateRef.current = next
    setState(next)
  }, [])

  /** Runs a pure command against current state, commits the result, returns it. */
  const run = useCallback(
    <T,>(command: Command<T>): T => {
      const { state: next, result } = command(stateRef.current, {
        actor: sessionRef.current,
        clock,
        ids,
      })
      if (next !== stateRef.current) {
        repo.save(next)
        commit(next)
      }
      return result
    },
    [repo, clock, ids, commit],
  )

  /** Runs a read-only command against the latest state and returns its result. Nothing is committed. */
  const read = useCallback(
    <T,>(command: Command<T>): T =>
      command(stateRef.current, {
        actor: sessionRef.current,
        clock,
        ids,
      }).result,
    [clock, ids],
  )

  // Supabase mode: every load (sign-in, and the reload after each write) goes
  // through one loader so only the newest result is committed, and results that
  // were in flight across a sign-out or account switch are dropped.
  const loader = useRef(
    client
      ? createLatestWinsLoader(
          () => loadState(client),
          (next) => {
            commit(next)
            setLoadedKey(sessionKeyRef.current)
          },
        )
      : null,
  ).current

  // Load the state the signed-in person can read; clear it on sign-out.
  useEffect(() => {
    if (!client || !loader) return
    loader.invalidate()
    if (!session) {
      commit(emptyConstructionState())
      setLoadedKey(sessionDataKey(null))
      return
    }
    loader.reload().catch((error: unknown) => {
      console.warn("[data] load failed:", error)
      // Stop waiting; routing then proceeds with whatever the person can see.
      setLoadedKey(sessionKeyRef.current)
    })
  }, [client, loader, session, commit])

  /** Supabase mode: one adapter write, then a reload so the screens see the stored rows. */
  const write = useCallback(
    async <T,>(call: () => Promise<T>): Promise<T> => {
      const result = await call()
      // No reload after sign-out: it would load as anonymous and replace the cleared state.
      if (loader && sessionRef.current) await loader.reload()
      return result
    },
    [loader],
  )

  const surface = useMemo<CommandSurface>(
    () =>
      client
        ? supabaseCommands({ client, write, read, getState: () => stateRef.current })
        : memoryCommands({ run, read, getState: () => stateRef.current }),
    [client, write, run, read],
  )

  const value = useMemo<ConstructionDataContextValue>(
    () => ({ ...surface, state, loaded: !client || loadedKey === sessionKey }),
    [surface, state, client, loadedKey, sessionKey],
  )

  return (
    <ConstructionDataContext.Provider value={value}>
      {children}
    </ConstructionDataContext.Provider>
  )
}

export function useConstructionData() {
  const context = useContext(ConstructionDataContext)

  if (!context) {
    throw new Error(
      "useConstructionData must be used within ConstructionDataProvider",
    )
  }

  return context
}
