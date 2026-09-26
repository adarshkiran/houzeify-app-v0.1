import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session } from "../domain/session"

const SESSION_KEY = "houzeify:session"

function readStoredSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session>
    if (
      (parsed.accountType === "homeowner" || parsed.accountType === "business") &&
      typeof parsed.personId === "string"
    ) {
      return parsed as Session
    }
  } catch {
    // Storage unavailable or corrupt: behave as signed out.
  }
  return null
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

/** Demo identities the prototype signs in as after onboarding (no real auth yet). */
export const DEMO_IDENTITIES = {
  business: {
    accountType: "business",
    personId: "person-arjun",
    organizationId: "org-buildright",
  },
  homeowner: {
    accountType: "homeowner",
    personId: "person-demo-homeowner",
  },
} as const satisfies Record<string, Session>
