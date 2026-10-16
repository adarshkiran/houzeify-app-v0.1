import { createClient } from "npm:@supabase/supabase-js@2.117.2"
import { createAnthropicModel } from "./anthropicModel.ts"
import { handleRequest } from "./handler.ts"

const model = createAnthropicModel(Deno.env.get("ANTHROPIC_API_KEY"), Deno.env.get("NARRATIVE_MODEL") ?? "claude-opus-5-5")

Deno.serve((req) => {
  // A user-scoped client: the caller's JWT travels to Postgres, so RLS and the
  // RPCs' own permission checks apply. The service-role key is never used.
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  })
  return handleRequest(req, {
    rpc: (fn, args) => db.rpc(fn, args),
    model,
    now: () => new Date().toISOString(),
  })
})
