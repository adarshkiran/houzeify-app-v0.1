# Staging Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a hosted `houzeify-staging` Supabase project repeatable to deploy and verify from this repository, with guards that make it impossible to point the staging scripts at the wrong target.

**Architecture:** Repository code adds a pure, tested "staging guard" (target must be a hosted project whose ref equals `STAGING_PROJECT_REF` and the operator must type that ref), wires it into the existing seed script, adds an anon-key smoke script and a `dev:staging` mode, and documents every deploy step in a runbook. The hosted project itself, credentials and secrets are created and entered by the owner in their own terminal; the assistant never handles them.

**Tech Stack:** TypeScript (tsx scripts, vitest), Supabase CLI 2.121.0 (`link`, `config push`, `db push`, `functions deploy --use-api`, `secrets set --env-file`), Vite env modes.

**Spec:** `docs/superpowers/specs/2026-10-17-staging-environment-design.md`

## Global Constraints

- Staging only. Nothing in this plan deploys, seeds or configures a production project.
- Secrets never enter git or chat: the service-role key, database password and Anthropic key are typed only at hidden prompts in the owner's terminal (`read -rs`), never written to a tracked file, never echoed, never put in `.env.staging.local`. The anon key is public by design.
- The service-role key is used for exactly one command (seeding demo auth users) and never in the browser or CI.
- Only non-secret values may be printed by any script: counts, status codes, the engine tag, the target URL.
- Test OTP numbers (`+919000011101`, `+919000011103`, `+919000011122` with OTP `123456`) exist in staging only.
- Double quotes for strings containing apostrophes; tests next to code as `*.test.ts`; commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. PRs are opened before they are merged and the assistant does not merge unless asked.
- Do not delete or alter `.claude/`, `Houzeify_Master_Plan_v0_2_FINAL.md`, or uncommitted/ignored files. Do not switch branches in the main checkout while `supabase functions serve` is running; use `git worktree` for cross-branch work.

## Deviations from the spec (deliberate)

1. The staging project ref is supplied as the environment variable `STAGING_PROJECT_REF` rather than committed as a constant, because the ref does not exist until the owner creates the project and a committed placeholder would be a stub. The guard requires it, compares it to the target URL, and requires the operator to retype it.
2. No `[remotes.staging]` block is added to `config.toml` in the code PR: its syntax and effect on `config push` are unverified and the ref is unknown. Task 6 (owner-run) verifies `config diff`/`config push` against the real project and records what, if anything, must be set in the dashboard instead.
3. Seeding the demo rows uses `supabase db push --linked --include-seed` first (verified with `seed-supabase.ts --check`), with pasting `supabase/seed.sql` into the dashboard SQL editor as the documented fallback, because the CLI reference does not say that `--include-seed` runs `seed.sql` remotely.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/stagingGuard.ts` | Pure `projectRefFromUrl`, `checkStagingTarget`, plus `readLinkedRef` and `requireStagingTarget` (prompt injectable for tests). |
| `scripts/lib/stagingGuard.test.ts` | Unit tests for the guard. |
| `scripts/seed-supabase.ts` | Modify: the `--staging` path uses the guard instead of the bare host check. |
| `scripts/staging-smoke.ts` | Anon-key verification of a deployed staging project. |
| `docs/runbooks/staging.md` | Owner and assistant steps, end to end. |
| `.env.staging.example` | Names only, empty values. |
| `package.json` | Add `dev:staging`, `smoke:staging`. |
| `vite.config.ts`, `tsconfig.json`, `.gitignore` | Include `scripts/**` tests and type-checking; un-ignore the example file. |

---

### Task 1: Staging guard helper

**Files:**
- Create: `scripts/lib/stagingGuard.ts`
- Test: `scripts/lib/stagingGuard.test.ts`
- Modify: `vite.config.ts` (test include), `tsconfig.json` (include)

**Interfaces:**
- Produces (used by Tasks 2–3):
  - `projectRefFromUrl(url: string): string | undefined` — the 20-letter ref of `https://<ref>.supabase.co`, else `undefined`.
  - `interface StagingTargetInput { url: string | undefined; expectedRef: string | undefined; typedRef: string | undefined; linkedRef?: string | undefined }`
  - `type StagingTargetResult = { ok: true; ref: string } | { ok: false; reason: string }`
  - `checkStagingTarget(input: StagingTargetInput): StagingTargetResult`
  - `readLinkedRef(path?: string): string | undefined` — contents of `supabase/.temp/project-ref`, trimmed.
  - `requireStagingTarget(options?: { env?: NodeJS.ProcessEnv; ask?: (question: string) => Promise<string>; linkedRef?: string }): Promise<string>` — resolves to the confirmed ref or throws `Error("staging guard: …")`.

- [ ] **Step 1: Branch and wire tests and type-checking to `scripts/`**

```bash
git checkout main && git pull && git checkout -b feature/staging-environment
```

In `vite.config.ts` change `test.include` to:

```ts
      include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts", "scripts/**/*.test.ts"],
```

In `tsconfig.json` change `include` to (keep the existing entries and add `scripts`):

```json
  "include": ["src", "scripts", "vite.config.ts", "supabase/functions/_shared", "supabase/functions/narrate-report/handler.ts", "supabase/functions/narrate-report/interpret.ts"],
```

(Read both files first and preserve any other entries already present; only add `"scripts/**/*.test.ts"` and `"scripts"`.)

- [ ] **Step 2: Write the failing test**

Create `scripts/lib/stagingGuard.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import { checkStagingTarget, projectRefFromUrl, requireStagingTarget } from "./stagingGuard.ts"

const REF = "abcdefghijklmnopqrst"
const URL_OK = `https://${REF}.supabase.co`

describe("projectRefFromUrl", () => {
  it("reads the ref of a hosted project", () => {
    expect(projectRefFromUrl(URL_OK)).toBe(REF)
    expect(projectRefFromUrl(`${URL_OK}/functions/v1/x`)).toBe(REF)
  })

  it("returns undefined for local stacks, custom domains, junk and wrong-length refs", () => {
    for (const url of [
      "http://127.0.0.1:54321",
      "http://localhost:54321",
      "https://example.com",
      "https://staging.example.co",
      "https://short.supabase.co",
      "https://UPPERCASEUPPERCASEUP.supabase.co",
      "not a url",
      "",
    ]) {
      expect(projectRefFromUrl(url)).toBeUndefined()
    }
  })
})

describe("checkStagingTarget", () => {
  const base = { url: URL_OK, expectedRef: REF, typedRef: REF }

  it("accepts a matching hosted target the operator confirmed", () => {
    expect(checkStagingTarget(base)).toEqual({ ok: true, ref: REF })
    expect(checkStagingTarget({ ...base, linkedRef: REF })).toEqual({ ok: true, ref: REF })
  })

  it.each([
    ["no expected ref", { ...base, expectedRef: undefined }],
    ["a malformed expected ref", { ...base, expectedRef: "not-a-ref" }],
    ["no url", { ...base, url: undefined }],
    ["a local url", { ...base, url: "http://127.0.0.1:54321" }],
    ["a custom domain", { ...base, url: "https://api.example.com" }],
    ["a different project in the url", { ...base, url: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co" }],
    ["a different linked project", { ...base, linkedRef: "zzzzzzzzzzzzzzzzzzzz" }],
    ["no typed ref", { ...base, typedRef: undefined }],
    ["a wrong typed ref", { ...base, typedRef: "zzzzzzzzzzzzzzzzzzzz" }],
  ])("refuses %s", (_name, input) => {
    const result = checkStagingTarget(input)
    expect(result.ok).toBe(false)
  })

  it("never puts the url, refs or keys in a refusal reason", () => {
    const secretUrl = `https://zzzzzzzzzzzzzzzzzzzz.supabase.co/?apikey=sk-secret-value`
    const result = checkStagingTarget({ url: secretUrl, expectedRef: REF, typedRef: REF })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      for (const leak of ["sk-secret-value", "zzzzzzzzzzzzzzzzzzzz", REF, "supabase.co"]) {
        expect(result.reason).not.toContain(leak)
      }
    }
  })
})

describe("requireStagingTarget", () => {
  const env = { VITE_SUPABASE_URL: URL_OK, STAGING_PROJECT_REF: REF } as NodeJS.ProcessEnv

  it("resolves to the ref when the operator types it", async () => {
    const ask = vi.fn(async () => ` ${REF} `)
    await expect(requireStagingTarget({ env, ask })).resolves.toBe(REF)
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it("throws when the typed ref is wrong", async () => {
    await expect(requireStagingTarget({ env, ask: async () => "nope" })).rejects.toThrow(/staging guard:/)
  })

  it("throws without prompting when the static checks already fail", async () => {
    const ask = vi.fn(async () => REF)
    await expect(
      requireStagingTarget({ env: { VITE_SUPABASE_URL: "http://127.0.0.1:54321", STAGING_PROJECT_REF: REF } as NodeJS.ProcessEnv, ask }),
    ).rejects.toThrow(/staging guard:/)
    await expect(requireStagingTarget({ env: { VITE_SUPABASE_URL: URL_OK } as NodeJS.ProcessEnv, ask })).rejects.toThrow(/staging guard:/)
    expect(ask).not.toHaveBeenCalled()
  })

  it("throws when the linked project differs", async () => {
    const ask = vi.fn(async () => REF)
    await expect(requireStagingTarget({ env, ask, linkedRef: "zzzzzzzzzzzzzzzzzzzz" })).rejects.toThrow(/staging guard:/)
    expect(ask).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run scripts/lib/stagingGuard.test.ts`
Expected: FAIL (`./stagingGuard.ts` not found).

- [ ] **Step 4: Implement**

Create `scripts/lib/stagingGuard.ts`:

```ts
import { readFileSync } from "node:fs"
import { createInterface } from "node:readline/promises"

// Guard for every script that touches the hosted staging project. A staging
// run must point at a hosted Supabase project whose ref equals
// STAGING_PROJECT_REF, must match the linked project when one is linked, and
// the operator must retype the ref. Reasons never echo the url, refs or keys.

const REF_PATTERN = /^[a-z]{20}$/

export function projectRefFromUrl(url: string): string | undefined {
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return undefined
  }
  return /^([a-z]{20})\.supabase\.co$/.exec(hostname)?.[1]
}

export interface StagingTargetInput {
  url: string | undefined
  expectedRef: string | undefined
  typedRef: string | undefined
  linkedRef?: string | undefined
}

export type StagingTargetResult = { ok: true; ref: string } | { ok: false; reason: string }

const refuse = (reason: string): StagingTargetResult => ({ ok: false, reason })

export function checkStagingTarget(input: StagingTargetInput): StagingTargetResult {
  const { url, expectedRef, typedRef, linkedRef } = input
  if (!expectedRef || !REF_PATTERN.test(expectedRef)) {
    return refuse("STAGING_PROJECT_REF must be set to the 20-letter staging project ref")
  }
  if (!url) return refuse("VITE_SUPABASE_URL is not set")
  const urlRef = projectRefFromUrl(url)
  if (!urlRef) return refuse("the target is not a hosted Supabase project; local stacks are not staging")
  if (urlRef !== expectedRef) return refuse("the target project does not match STAGING_PROJECT_REF")
  if (linkedRef !== undefined && linkedRef !== expectedRef) {
    return refuse("the linked Supabase project does not match STAGING_PROJECT_REF")
  }
  if (typedRef !== expectedRef) return refuse("the typed project ref does not match")
  return { ok: true, ref: expectedRef }
}

export function readLinkedRef(path = "supabase/.temp/project-ref"): string | undefined {
  try {
    return readFileSync(path, "utf8").trim() || undefined
  } catch {
    return undefined
  }
}

async function askOnTerminal(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return await rl.question(question)
  } finally {
    rl.close()
  }
}

export async function requireStagingTarget(
  options: {
    env?: NodeJS.ProcessEnv
    ask?: (question: string) => Promise<string>
    linkedRef?: string | undefined
  } = {},
): Promise<string> {
  const env = options.env ?? process.env
  const ask = options.ask ?? askOnTerminal
  const url = env.VITE_SUPABASE_URL
  const expectedRef = env.STAGING_PROJECT_REF

  // Every static check first, without prompting; the typed ref is only the last gate.
  const early = checkStagingTarget({ url, expectedRef, typedRef: expectedRef, linkedRef: options.linkedRef })
  if (!early.ok) throw new Error(`staging guard: ${early.reason}`)

  console.log(`Staging target: https://${early.ref}.supabase.co`)
  const typedRef = (await ask("Type the staging project ref to continue: ")).trim()
  const result = checkStagingTarget({ url, expectedRef, typedRef, linkedRef: options.linkedRef })
  if (!result.ok) throw new Error(`staging guard: ${result.reason}`)
  return result.ref
}
```

- [ ] **Step 5: Run to verify it passes, plus typecheck**

Run: `npx vitest run scripts/lib/stagingGuard.test.ts && npm run typecheck`
Expected: PASS, no type errors. If typecheck now fails inside `scripts/seed-supabase.ts` (newly included), fix only genuine type errors there with minimal changes and note them in the commit message.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts tsconfig.json scripts/lib
git commit -m "feat: staging guard helper for staging-only scripts

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Use the guard in the seed script

**Files:**
- Modify: `scripts/seed-supabase.ts`

**Interfaces:**
- Consumes: `requireStagingTarget`, `readLinkedRef` (Task 1).
- Produces: `--staging` runs refuse anything but the confirmed staging project; local runs (no flag) keep working.

- [ ] **Step 1: Replace the host check with the guard**

In `scripts/seed-supabase.ts` add the import after the supabase-js import:

```ts
import { readLinkedRef, requireStagingTarget } from "./lib/stagingGuard.ts"
```

Replace this block:

```ts
const host = new URL(url).hostname
if (host !== "127.0.0.1" && !staging) {
  fail(`refusing to seed ${host} without --staging (demo test numbers are local/staging only)`)
}
```

with:

```ts
const host = new URL(url).hostname
if (staging) {
  try {
    await requireStagingTarget({ linkedRef: readLinkedRef() })
  } catch (error) {
    fail(error instanceof Error ? error.message : "staging guard failed")
  }
} else if (host !== "127.0.0.1") {
  fail(`refusing to seed ${host} without --staging (demo test numbers are local/staging only)`)
}
```

Also update the header comment line `add --staging to run against a non-local project (never for production)` to:

```
 *   add --staging to run against the hosted staging project; needs STAGING_PROJECT_REF
 *   and asks you to retype it (never for production)
```

- [ ] **Step 2: Verify the refusals and that local use is unchanged**

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=x npx tsx scripts/seed-supabase.ts --staging --check; echo "exit $?"
```
Expected: `seed-supabase: staging guard: STAGING_PROJECT_REF must be set …` and `exit 1` (no prompt).

```bash
STAGING_PROJECT_REF=abcdefghijklmnopqrst VITE_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=x npx tsx scripts/seed-supabase.ts --staging --check; echo "exit $?"
```
Expected: `staging guard: the target is not a hosted Supabase project; local stacks are not staging`, `exit 1`.

```bash
npx tsx --env-file=.env.local scripts/seed-supabase.ts --check; echo "exit $?"
```
Expected (local stack running): `check passed`, `exit 0`.

- [ ] **Step 3: Typecheck, full tests, commit**

Run: `npm run typecheck && npx vitest run`
Expected: PASS.

```bash
git add scripts/seed-supabase.ts
git commit -m "feat: seed script's staging mode uses the staging guard

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Staging smoke script

**Files:**
- Create: `scripts/staging-smoke.ts`
- Modify: `package.json` (scripts `dev:staging`, `smoke:staging`)
- Create: `.env.staging.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `requireStagingTarget`, `readLinkedRef` (Task 1); `sampleReportFacts` from `supabase/functions/_shared/narrative/testFacts.ts`.
- Produces: `npm run smoke:staging` — exits 0 only when every step passes; prints only non-secret facts.

- [ ] **Step 1: Write the script**

Create `scripts/staging-smoke.ts`:

```ts
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
import { readLinkedRef, requireStagingTarget } from "./lib/stagingGuard.ts"

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
  await requireStagingTarget({ linkedRef: readLinkedRef() })
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
```

- [ ] **Step 2: Scripts, example env, and ignore rule**

In `package.json` add to `scripts`:

```json
    "dev:staging": "vite --host 0.0.0.0 --mode staging",
    "smoke:staging": "tsx --env-file=.env.staging.local scripts/staging-smoke.ts",
```

Create `.env.staging.example`:

```
# Copy to .env.staging.local (git-ignored) and fill in from the Supabase dashboard
# (Project Settings -> API). The anon key is public by design. NEVER put the
# service-role key, the database password or any Anthropic key in this file.
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_DATA_SOURCE=supabase
STAGING_PROJECT_REF=
```

In `.gitignore`, add on its own line directly after the existing `!.env.example` line:

```
!.env.staging.example
```

- [ ] **Step 3: Verify (no hosted project needed)**

```bash
git check-ignore -v .env.staging.example || echo "example file is tracked-able"
git check-ignore -v .env.staging.local
npm run typecheck
STAGING_PROJECT_REF=abcdefghijklmnopqrst VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=x npx tsx scripts/staging-smoke.ts; echo "exit $?"
```
Expected: the first prints `example file is tracked-able`; the second shows `.env.staging.local` ignored by `.env*`; typecheck passes; the smoke script refuses with `staging guard: the target is not a hosted Supabase project; local stacks are not staging` and `exit 1` without prompting.

- [ ] **Step 4: Full suite and commit**

Run: `npx vitest run && npm run build`
Expected: PASS.

```bash
git add scripts/staging-smoke.ts package.json .env.staging.example .gitignore
git commit -m "feat: staging smoke script, dev:staging mode and env example

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Runbook

**Files:**
- Create: `docs/runbooks/staging.md`

**Interfaces:**
- Consumes: Tasks 1–3 (`npm run smoke:staging`, `npm run dev:staging`, the seed script's `--staging` mode).
- Produces: the single document the owner follows; Task 5 executes it.

- [ ] **Step 1: Write the runbook**

Create `docs/runbooks/staging.md` with exactly this content:

````markdown
# Staging runbook

One hosted Supabase project, `houzeify-staging`, for verifying the app end to end. **Staging only: never run any of this against production.** Spec: `docs/superpowers/specs/2026-10-17-staging-environment-design.md`.

## Rules

- Run commands in a real **Terminal-panel tab** (or your own terminal), not the chat input box: the hidden prompts need real input.
- Paste secrets **only** at a `read -rs` prompt (nothing is echoed). Never paste a key, password or token into chat, a file in the repo, or a normal shell prompt.
- The service-role key is used for one command (demo users). The anon key is public and may go in `.env.staging.local`.
- Everything here is idempotent: re-running a step is safe.

## 1. Create the project (owner, dashboard)

1. Supabase dashboard, **New project**, name `houzeify-staging`, region **Mumbai (ap-south-1)**, the smallest plan.
2. Choose a strong database password; save it in your password manager only.
3. When ready, note the **project ref** (the 20 lowercase letters in `…/project/<ref>`).
4. Create a **separate Anthropic API key** for staging in the Anthropic Console, named for staging, with a workspace spending limit if offered.

Free projects pause after about a week of inactivity: if requests fail with connection errors, open the dashboard and click **Restore project**, wait a few minutes, and retry.

## 2. Log in and link (owner)

```bash
cd "<path to the repo>"
export STAGING_PROJECT_REF="<the 20-letter ref>"
npx supabase login
npx supabase link --project-ref "$STAGING_PROJECT_REF"
```

`link` prompts for the database password (hidden). Keep the same terminal tab for the next steps so `STAGING_PROJECT_REF` stays set (re-export it in any new tab).

## 3. Apply auth and project settings

```bash
npx supabase config diff
npx supabase config push --project-ref "$STAGING_PROJECT_REF"
```

Read the diff before pushing: it includes the phone provider (placeholder Twilio values, no SMS is sent), the three test OTP numbers, and the function's `verify_jwt`. After pushing, `config diff` should show no remaining differences. Anything it cannot push, set in the dashboard (Authentication, Providers, Phone) and note it here.

## 4. Apply migrations and demo rows

```bash
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Seed the demo rows (idempotent; the seed uses `on conflict do nothing`):

```bash
npx supabase db push --linked --include-seed
```

Then verify with section 5's `--check`. If the demo organization or worker rows are missing, use the fallback: open the dashboard SQL editor, paste the contents of `supabase/seed.sql`, and run it once.

## 5. Create the demo auth users (owner)

Get the **service-role key** from the dashboard (Project Settings, API) and paste it only at the prompt:

```bash
read -rs "SUPABASE_SERVICE_ROLE_KEY?Paste the service-role key, then Enter: " && echo \
  && export SUPABASE_SERVICE_ROLE_KEY \
  && VITE_SUPABASE_URL="https://$STAGING_PROJECT_REF.supabase.co" npx tsx scripts/seed-supabase.ts --staging \
  ; VITE_SUPABASE_URL="https://$STAGING_PROJECT_REF.supabase.co" npx tsx scripts/seed-supabase.ts --staging --check ; unset SUPABASE_SERVICE_ROLE_KEY
```

The script prints the target, asks you to retype the project ref, then creates three auth users with the test numbers and links them. `--check` should end with `check passed`.

## 6. Deploy the function and its secrets (owner)

```bash
npx supabase functions deploy narrate-report --project-ref "$STAGING_PROJECT_REF" --use-api
```

Set the secrets with a **checked** paste (the key is validated against Anthropic first, written to a private temp file, passed with `--env-file`, and deleted):

```bash
read -rs "K?Paste the STAGING Anthropic key, then Enter: " && echo && if [[ "$(curl -s -o /dev/null -w '%{http_code}' https://api.anthropic.com/v1/models -H "x-api-key: $K" -H 'anthropic-version: 2023-06-01')" == "200" ]]; then ( umask 077; F="$(mktemp)"; printf 'ANTHROPIC_API_KEY=%s\nNARRATIVE_MODEL=claude-opus-5-5\n' "$K" > "$F"; npx supabase secrets set --env-file "$F" --project-ref "$STAGING_PROJECT_REF"; rm -f "$F" ); unset K; echo "secrets set"; else unset K; echo "KEY REJECTED by Anthropic: nothing was set. Copy the key again."; fi
```

Check: `npx supabase secrets list --project-ref "$STAGING_PROJECT_REF"` shows `ANTHROPIC_API_KEY` and `NARRATIVE_MODEL` (values hidden).

## 7. Point the app at staging

Copy `.env.staging.example` to `.env.staging.local` (git-ignored) and fill `VITE_SUPABASE_URL=https://<ref>.supabase.co`, `VITE_SUPABASE_ANON_KEY` (anon key from the dashboard) and `STAGING_PROJECT_REF`. Then:

```bash
npm run dev:staging
```

Sign in at `#onboarding-business` with `+919000011101` and code `123456` (the legacy `#login` screen is mock-only).

## 8. Verify

```bash
npm run smoke:staging
```

It asks you to retype the project ref, then checks sign-in, RLS reads, the plan's `ai.narrative` entitlement and limit, one real model call, a no-token 401 and a malformed-body 400. It must end with `smoke passed`.

The usage ledger is private by design, so confirm it in the dashboard SQL editor:

```sql
select status, count(*) from ai_usage_events group by status;
```

After the smoke run there should be one `consumed` row. To see the refund path, temporarily unset the secret (`npx supabase secrets unset ANTHROPIC_API_KEY --project-ref "$STAGING_PROJECT_REF"`), click Rewrite once in the app (you get "The AI writer isn't available right now"), and expect a `refunded` row; then set the secret again with section 6.

## 9. Operations

- **Redeploy** after merging: `db push --linked`, `config push`, `functions deploy …` (sections 3, 4, 6).
- **Rotate the Anthropic key:** create a new key, run the section 6 secrets command with it, then delete the old key in the Console.
- **Reset staging (destroys all data in the linked project):** `npx supabase db reset --linked`, then repeat sections 4 and 5. The staging guard only protects the scripts, not this raw command: check `cat supabase/.temp/project-ref` equals your `STAGING_PROJECT_REF` first.
- **Roll back the function:** check out the previous commit and redeploy it.
- **Paused project:** restore it in the dashboard (section 1 note).

## 10. If something fails

| Symptom | Likely cause |
|---|---|
| Smoke step 1 fails (send code or verify) | Hosted Auth did not accept the test OTP with placeholder SMS credentials, or the phone provider is not enabled. Re-run `config diff`; check Authentication, Providers, Phone. Record the outcome (the spec's first risk). |
| `model error 401` in the function log (dashboard, Edge Functions, Logs) | The key set in section 6 is not a valid Anthropic key (wrong paste). Re-run section 6. |
| Smoke step 4 returns `limit-reached` | The monthly limit (10) is used: `delete from ai_usage_events;` in the SQL editor (staging only). |
| Anything about `staging guard:` | The URL, `STAGING_PROJECT_REF`, linked project or typed ref do not agree: fix the inputs, never bypass the guard. |
````

- [ ] **Step 2: Verify the runbook's commands are consistent with the code**

Run: `grep -n "smoke:staging\|dev:staging" package.json docs/runbooks/staging.md | head` and `grep -n "include-seed\|--use-api\|env-file" docs/runbooks/staging.md | head`
Expected: each referenced script exists in `package.json`; the runbook uses the verified flags (`db push --linked --dry-run`, `--include-seed`, `functions deploy --use-api --project-ref`, `secrets set --env-file --project-ref`, `config push --project-ref`).

- [ ] **Step 3: Commit and open the PR**

```bash
git add docs/runbooks/staging.md
git commit -m "docs: staging runbook

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin feature/staging-environment
gh pr create --base main --title "feat: staging environment tooling and runbook" --body "Implements docs/superpowers/specs/2026-10-17-staging-environment-design.md (plan: docs/superpowers/plans/2026-10-17-staging-environment.md). Adds the staging guard (tested), the guarded seed script, an anon-key smoke script, dev:staging mode and the runbook. Nothing here touches a hosted project; the owner creates it and runs the runbook (Task 5).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Check CI with `gh pr view` (no polling). Do not merge.

---

### Task 5: Execute against the hosted project (owner-run, assistant-verified)

**Files:** none (creates the project and records outcomes; may add a short "Known results" section to `docs/runbooks/staging.md` in a follow-up commit).

**Interfaces:**
- Consumes: the project ref (non-secret) from the owner and the merged or checked-out Task 1–4 tooling.
- Produces: a working staging project and a recorded answer to each first-step risk.

- [ ] **Step 1: Owner creates the project and the Anthropic staging key (runbook section 1)** and sends only the 20-letter project ref to the assistant. The assistant never receives the database password, anon key, service-role key or any Anthropic key.

- [ ] **Step 2: Owner runs runbook sections 2 and 3** (`login`, `link`, `config diff`, `config push`). The owner pastes the printed diff and the `config push` result (these contain no secrets). The assistant checks that nothing unexpected is being pushed and records: (a) whether `config push` applied the phone provider, test OTP map and function `verify_jwt`; (b) what, if anything, had to be set in the dashboard. If any `[remotes.*]` handling is needed, the assistant adds the minimal block to `supabase/config.toml` and verifies it with `supabase start` locally.

- [ ] **Step 3: Owner runs sections 4 and 5** (`db push --dry-run`, `db push`, seed, demo users). The owner pastes the `--check` output. Record whether `--include-seed` applied `seed.sql` remotely or the SQL-editor fallback was needed.

- [ ] **Step 4: Owner runs section 6** (function deploy and the checked secrets paste) and `secrets list` (values hidden).

- [ ] **Step 5: Owner creates `.env.staging.local` (section 7) and runs `npm run smoke:staging`.** Expected: `smoke passed`. The assistant reads the printed lines. A failure in step 1 answers the spec's first risk (test OTP with placeholder SMS credentials): follow runbook section 10 and, if hosted Auth rejects test numbers, revise the spec to the Twilio-trial fallback before continuing.

- [ ] **Step 6: Owner runs the manual ledger check** (section 8) and the forced-failure refund check. The assistant records the results.

- [ ] **Step 7: Record outcomes.** Add a "Known results" section to `docs/runbooks/staging.md` stating, for the real project: the answer to each of the four risks (test OTP with placeholder credentials; `config push` coverage and `[remotes]`; free-tier pause behaviour observed; seed path used), the date and the CLI version. Commit on a short-lived branch and open a PR; the assistant does not merge.

---

## Self-Review

**Spec coverage:** hosted project and ref handling (runbook §1–2, Task 5), config as code (§3 plus Task 5 step 2), database and demo data (§4–5, Task 2 guard), function and secrets (§6), running the app (§7, `dev:staging`, `.env.staging.example`), safety guards (Task 1–3), verification (Task 3 smoke plus the manual ledger check in §8), operations and rollback (§9), risks and first-step verifications (Task 5 and runbook §10), division of work (Task 5 and runbook rules). The spec's `[remotes.staging]` block and committed ref constant are replaced as listed under Deviations.

**Placeholder scan:** the only fill-ins are values that genuinely do not exist until the owner acts (the 20-letter project ref, the dashboard keys); they are named inputs, never silent stubs. No TBD/TODO.

**Type consistency:** `checkStagingTarget`, `requireStagingTarget`, `readLinkedRef`, `projectRefFromUrl` and `StagingTargetInput` are defined in Task 1 and used with the same names and signatures in Tasks 2 and 3; the env var names (`STAGING_PROJECT_REF`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) match across the guard, seed script, smoke script, runbook and example file.
