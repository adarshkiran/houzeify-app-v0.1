import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { currentSession } from "../data/session"
import { getSupabaseClient } from "../data/supabaseClient"
import type { EntityId } from "../domain/models"
import { parseStoredSession, type Session } from "../domain/session"
import {
  ACTIVE_ORGANIZATION_ID,
  DEMO_WORKER_PERSON_ID,
  DEMO_WORKER_PHONE,
} from "../mock/seed"

const SESSION_KEY = "houzeify:session"

/** True when the app runs against the Supabase stack (VITE_DATA_SOURCE=supabase). */
export const SUPABASE_DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE === "supabase"

/** Demo sign-in affordances: development builds on the in-memory store only. */
export const DEMO_SIGN_IN_ENABLED = import.meta.env.DEV && !SUPABASE_DATA_SOURCE

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
  const [session, setSession] = useState<Session | null>(() =>
    SUPABASE_DATA_SOURCE ? null : readStoredSession(),
  )
  const client: SupabaseClient | null = SUPABASE_DATA_SOURCE ? getSupabaseClient() : null

  // Supabase mode: the session follows the auth state, resolved to a role.
  useEffect(() => {
    if (!client) return
    let active = true
    const refresh = async () => {
      try {
        const next = await currentSession(client)
        if (active) setSession(next)
      } catch {
        if (active) setSession(null)
      }
    }
    const { data } = client.auth.onAuthStateChange((_event, authSession) => {
      // Deferred: supabase-js forbids awaiting auth calls inside this callback.
      if (!authSession) setSession(null)
      else setTimeout(() => void refresh(), 0)
    })
    void refresh()
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [client])

  const signIn = useCallback((next: Session) => {
    if (!SUPABASE_DATA_SOURCE) writeStoredSession(next)
    setSession(next)
  }, [])

  const signOut = useCallback(() => {
    if (client) void client.auth.signOut()
    else writeStoredSession(null)
    setSession(null)
  }, [client])

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
    phone: DEMO_WORKER_PHONE,
  },
} as const satisfies Record<string, Session>
