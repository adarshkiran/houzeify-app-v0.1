import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { EntityId } from "../domain/models"
import { parseStoredSession, type Session } from "../domain/session"
import { ACTIVE_ORGANIZATION_ID, DEMO_WORKER_PERSON_ID } from "../mock/seed"

const SESSION_KEY = "houzeify:session"

function readStoredSession(): Session | null {
  try {
    return parseStoredSession(window.localStorage.getItem(SESSION_KEY))
  } catch {
    return null // storage unavailable
  }
}

function writeStoredSession(session: Session | null) {
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // Non-fatal: the session just won't survive a reload.
  }
}

interface SessionContextValue {
  session: Session | null
  signIn: (session: Session) => void
  signOut: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readStoredSession)

  const signIn = useCallback((next: Session) => {
    writeStoredSession(next)
    setSession(next)
  }, [])

  const signOut = useCallback(() => {
    writeStoredSession(null)
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ session, signIn, signOut }),
    [session, signIn, signOut],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)
  if (!context) throw new Error("useSession must be used inside SessionProvider")
  return context
}

/** The signed-in business's organization. Only call from business-only screens. */
export function useOrganizationId(): EntityId {
  const { session } = useSession()
  if (!session?.organizationId) {
    throw new Error("useOrganizationId needs a business session")
  }
  return session.organizationId
}

/** Demo identities the prototype signs in as after onboarding (no real auth yet). */
export const DEMO_IDENTITIES = {
  business: {
    accountType: "business",
    personId: "person-arjun",
    organizationId: ACTIVE_ORGANIZATION_ID,
  },
  homeowner: {
    accountType: "homeowner",
    personId: "person-demo-homeowner",
  },
  worker: {
    accountType: "worker",
    personId: DEMO_WORKER_PERSON_ID,
    organizationId: ACTIVE_ORGANIZATION_ID,
  },
} as const satisfies Record<string, Session>
