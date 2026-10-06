import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * The Supabase client for the browser, from the Vite env. Throws when either
 * value is missing so a misconfigured build fails at startup, not on first call.
 */
export function createSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set (see .env.local).")
  }
  return createClient(url, anonKey)
}

let sharedClient: SupabaseClient | undefined

/** One client per page, shared by the session provider and the sign-in screens. */
export function getSupabaseClient(): SupabaseClient {
  sharedClient ??= createSupabaseClient()
  return sharedClient
}
