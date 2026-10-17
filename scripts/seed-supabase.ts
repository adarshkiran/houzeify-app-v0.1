/**
 * Demo data for the Supabase stack.
 *
 *   npx tsx scripts/seed-supabase.ts --check   report demo rows and auth users
 *   npx tsx scripts/seed-supabase.ts           create demo auth users, link people rows
 *   add --staging to run against the hosted staging project; needs STAGING_PROJECT_REF
 *   and asks you to retype it (never for production)
 *
 * Rows come from supabase/seed.sql (applied by `supabase db reset`). This script
 * creates the demo auth users through the admin API, using the Supabase test
 * phone numbers, and sets people.auth_user_id. Env: VITE_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js"
import { requireStagingTarget } from "./lib/stagingGuard.ts"

const DEMO_ORGANIZATION_LEGACY_ID = "org-buildright"
const DEMO_WORKER_LEGACY_ID = "worker-2"

/** Supabase test numbers. Local and staging only. */
const DEMO_PEOPLE = [
  { legacyId: "person-arjun", phone: "+919000011101", name: "Arjun Mehta" },
  { legacyId: "person-demo-homeowner", phone: "+919000011103", name: "Demo Homeowner" },
  { legacyId: "person-ravi", phone: "+919000011122", name: "Ravi Naik" },
] as const

const args = new Set(process.argv.slice(2))
const checkOnly = args.has("--check")
const staging = args.has("--staging")

function fail(message: string): never {
  console.error(`seed-supabase: ${message}`)
  process.exit(1)
}

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url) fail("VITE_SUPABASE_URL is not set")
if (!serviceKey) fail("SUPABASE_SERVICE_ROLE_KEY is not set")

const host = new URL(url).hostname
if (staging) {
  try {
    await requireStagingTarget()
  } catch (error) {
    fail(error instanceof Error ? error.message : "staging guard failed")
  }
} else if (host !== "127.0.0.1") {
  fail(`refusing to seed ${host} without --staging (demo test numbers are local/staging only)`)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function digits(phone: string) {
  return phone.replace(/\D/g, "")
}

async function listAuthUsers() {
  const users: { id: string; phone?: string }[] = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail(`listUsers failed: ${error.message}`)
    users.push(...data.users)
    if (data.users.length < 200) return users
  }
}

async function check() {
  const problems: string[] = []
  const report = (label: string, present: boolean) => {
    console.log(`${present ? "ok     " : "missing"} ${label}`)
    if (!present) problems.push(label)
  }

  const org = await supabase.from("organizations").select("id").eq("legacy_id", DEMO_ORGANIZATION_LEGACY_ID)
  if (org.error) fail(`organizations query failed: ${org.error.message}`)
  report(`organization ${DEMO_ORGANIZATION_LEGACY_ID}`, (org.data ?? []).length > 0)

  const worker = await supabase.from("workers").select("id").eq("legacy_id", DEMO_WORKER_LEGACY_ID)
  if (worker.error) fail(`workers query failed: ${worker.error.message}`)
  report(`worker ${DEMO_WORKER_LEGACY_ID}`, (worker.data ?? []).length > 0)

  const authUsers = await listAuthUsers()
  for (const person of DEMO_PEOPLE) {
    const found = authUsers.some((user) => digits(user.phone ?? "") === digits(person.phone))
    report(`auth user for ${person.legacyId}`, found)
  }

  if (problems.length > 0) {
    console.log(`check failed: ${problems.length} missing`)
    process.exit(1)
  }
  console.log("check passed")
}

async function seed() {
  const org = await supabase.from("organizations").select("id").eq("legacy_id", DEMO_ORGANIZATION_LEGACY_ID)
  if (org.error) fail(`organizations query failed: ${org.error.message}`)
  if (!org.data?.length) fail("demo rows are missing; run `npx supabase db reset` first")

  const authUsers = await listAuthUsers()
  for (const person of DEMO_PEOPLE) {
    let authUser = authUsers.find((user) => digits(user.phone ?? "") === digits(person.phone))
    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        phone: person.phone,
        phone_confirm: true,
      })
      if (error || !data.user) fail(`createUser for ${person.legacyId} failed: ${error?.message}`)
      authUser = data.user
      console.log(`created auth user for ${person.legacyId}`)
    }
    const update = await supabase
      .from("people")
      .update({ auth_user_id: authUser.id })
      .eq("legacy_id", person.legacyId)
      .select("id")
    if (update.error) fail(`linking ${person.legacyId} failed: ${update.error.message}`)
    if (!update.data?.length) fail(`people row ${person.legacyId} is missing; run db reset`)
    console.log(`linked ${person.legacyId}`)
  }
}

if (checkOnly) {
  await check()
} else {
  await seed()
}
