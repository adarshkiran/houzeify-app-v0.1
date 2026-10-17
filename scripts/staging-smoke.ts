/**
 * Verifies a deployed staging project using only the public anon key and the
 * demo test number. Run: npm run smoke:staging  (reads .env.staging.local)
 *
 * Needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and STAGING_PROJECT_REF. It
 * prints only non-secret facts and exits non-zero on any failed step. The usage
 * ledger is private by design: confirm the consumed/refunded ticket in the
 * dashboard SQL editor (see docs/runbooks/staging.md).
 */
import { createClient, FunctionsHttpError } from "@supabase/supabase-js"
import { sampleReportFacts } from "../supabase/functions/_shared/narrative/testFacts.ts"
import { requireStagingTarget } from "./lib/stagingGuard.ts"

const DEMO_PHONE = "+919000011101"
const DEMO_OTP = "123456"
const DEMO_PROJECT_LEGACY_ID = "project-sharma"

let failures = 0
async function step(name: string, run: () => Promise<string | void>) {
  try {
    const detail = await run()
    console.log(`ok     ${name}${detail ? ` — ${detail}` : ""}`)
  } catch (error) {
    failures += 1
    console.log(`FAILED ${name} — ${error instanceof Error ? error.message : "unknown error"}`)
  }
}

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) {
  console.error("staging-smoke: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set (see .env.staging.example)")
  process.exit(1)
}

try {
  await requireStagingTarget()
} catch (error) {
  console.error(`staging-smoke: ${error instanceof Error ? error.message : "staging guard failed"}`)
  process.exit(1)
}

const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
let projectId = ""

await step("phone OTP sign-in with the demo test number", async () => {
  const sent = await client.auth.signInWithOtp({ phone: DEMO_PHONE })
  if (sent.error) throw new Error(`send code failed: ${sent.error.message}`)
  const verified = await client.auth.verifyOtp({ phone: DEMO_PHONE, token: DEMO_OTP, type: "sms" })
  if (verified.error || !verified.data.session) throw new Error(`verify failed: ${verified.error?.message ?? "no session"}`)
})

await step("RLS read: the demo project is visible", async () => {
  const { data, error } = await client.from("projects").select("id, legacy_id")
  if (error) throw new Error(error.message)
  const demo = (data ?? []).find((row) => row.legacy_id === DEMO_PROJECT_LEGACY_ID)
  if (!demo) throw new Error(`project ${DEMO_PROJECT_LEGACY_ID} not found (seed missing or RLS blocks it)`)
  projectId = demo.id
  return `${data?.length} project(s) visible`
})

await step("plan has the ai.narrative entitlement and a monthly limit", async () => {
  const { data, error } = await client.from("plans").select("legacy_id, entitlements, limits")
  if (error) throw new Error(error.message)
  const plan = (data ?? []).find((row) => (row.entitlements as string[]).includes("ai.narrative"))
  if (!plan) throw new Error("no plan carries ai.narrative (seed missing?)")
  const cap = (plan.limits as { ai_narratives_per_month?: number }).ai_narratives_per_month
  if (!cap || cap < 1) throw new Error("the plan has no ai_narratives_per_month limit")
  return `${plan.legacy_id}, ${cap} per month`
})

await step("narrate-report returns a narrative (one real model call)", async () => {
  if (!projectId) throw new Error("skipped: no project id")
  const { data, error } = await client.functions.invoke("narrate-report", {
    body: { projectId, kind: "report", facts: sampleReportFacts() },
  })
  if (error) throw new Error(`function error: ${error.message}`)
  if (data?.error) throw new Error(`typed error code: ${String(data.error)}`)
  const engine = String(data?.narrative?.engine ?? "")
  if (!engine.startsWith("claude:")) throw new Error("response has no claude: engine tag")
  return `engine ${engine}`
})

await step("no token is refused by the gateway (401)", async () => {
  const response = await fetch(`${url}/functions/v1/narrate-report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  })
  if (response.status !== 401) throw new Error(`expected 401, got ${response.status}`)
})

await step("a malformed body is refused by the function (400)", async () => {
  const { error } = await client.functions.invoke("narrate-report", { body: {} })
  if (!(error instanceof FunctionsHttpError)) throw new Error("expected an HTTP error")
  if (error.context.status !== 400) throw new Error(`expected 400, got ${error.context.status}`)
})

await client.auth.signOut()
console.log(failures === 0 ? "smoke passed" : `smoke failed: ${failures} step(s)`)
process.exit(failures === 0 ? 0 : 1)
