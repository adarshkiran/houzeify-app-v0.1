# Staging Environment — Design

**Status:** Draft for review

**Source of truth:** `docs/superpowers/specs/2026-10-06-phase-11-production-backend-design.md`, which already fixes the environment model:

- **B8:** a local Supabase stack for development and **one hosted staging project**; nothing deploys to production.
- **B9:** secrets stay out of git; keys come from environment variables; `.env*` files are ignored.
- **§5:** demo accounts exist in staging only, as auth users with Supabase **test phone numbers and fixed test OTPs**, never in a production project; test numbers are not routable to real phones.

This design does not change those decisions. It adds the missing mechanics: the hosted project, how migrations, auth settings, the `narrate-report` function and its secrets reach it, how demo data is seeded, and how to verify it.

## Goal

A single hosted Supabase project, `houzeify-staging`, that is **repeatable to deploy** from this repository, safe by construction (staging only, no secrets in git or chat), and proven by a smoke check, so the app can be run locally against it, including a real "Rewrite with AI" call.

## Decisions (made during brainstorming)

| Question | Decision |
|---|---|
| Scope of this pass | Backend only: project, migrations, auth config, seed data, function + secrets, verification. No hosted website. |
| Deploy mechanism | Scripted Supabase CLI commands, documented in a runbook and run from the owner's machine. A GitHub Actions deploy is a later option, not part of this work. |
| Project creation | The owner creates the project in the Supabase dashboard (region Mumbai). Only the non-secret project ref reaches the repo or chat. |
| Configuration | `supabase/config.toml` remains the source of truth for auth settings and is applied with `supabase config push`. |
| Anthropic key | A separate key for staging with a spending limit, stored only as a Supabase function secret. |

## Out of scope

- A hosted frontend (Vercel/Netlify/Cloudflare), custom domains, and Auth redirect URLs for a public site.
- Production anything.
- CI-driven deploys, preview branches, and Supabase branching.
- Real SMS delivery. Staging uses test numbers only; a real SMS provider is a production concern.
- Storage buckets beyond what migrations already create; data migration from any other source.

## 1. The hosted project

- Name `houzeify-staging`, region Mumbai (`ap-south-1`), the smallest plan that is not paused for inactivity if available (free projects pause after inactivity; the runbook notes how to resume).
- The owner creates it and chooses the database password, which is stored in a password manager. The password is needed only for `supabase link` and `db push`, which prompt for it; it is never written to a file.
- Artifacts the repo records, none secret: the **project ref** (a constant in the runbook and in the staging guard, section 6) and the project URL derived from it.

## 2. Configuration as code

- `supabase config push` applies the auth section of `config.toml` to the linked project: phone provider enabled with the placeholder Twilio values already used locally, the `[auth.sms.test_otp]` map for the three demo numbers, and the function's `verify_jwt` setting.
- Environment differences (project id, site and redirect URLs) are expressed with a `[remotes.staging]` block if the pinned CLI supports it; otherwise they are set once in the dashboard and `config diff` is used to confirm no drift. This is verified first (section 9).
- `supabase config diff` is part of the runbook so drift between `config.toml` and the hosted project is visible.
- The Twilio auth token stays an `env()` reference. The staging run supplies an obviously fake value; no real SMS credential is required or stored.

## 3. Database and demo data

- `supabase db push` applies the 31 migrations to the empty project. Re-running it is a no-op.
- Demo rows come from `supabase/seed.sql`. Because `db push` does not run `seed.sql`, the runbook applies it once with the CLI's query command against the linked project, guarded so it cannot run twice (the seed already uses `on conflict do nothing`).
- `npx tsx scripts/seed-supabase.ts --staging` creates the three demo auth users with the test numbers and links `people.auth_user_id`. It needs `VITE_SUPABASE_URL` and the **service-role key**, supplied only as environment variables in the owner's terminal for that one command; never written to a file in the repo and never sent to chat.
- The script already refuses to run against a non-local project without `--staging`; this work adds the same staging-only guard described in section 6.

## 4. The `narrate-report` function and its secrets

- `supabase functions deploy narrate-report` deploys the function; `verify_jwt = true` is applied through the config push.
- `supabase secrets set ANTHROPIC_API_KEY=… NARRATIVE_MODEL=claude-opus-5-5` runs in the owner's terminal. The key is entered through a hidden prompt (`read -rs`), validated against the Anthropic API first (the same checked-paste pattern used for the local run), and is never placed in a file, a command in chat, or the shell history.
- The staging key is separate from any local or future production key, created with a workspace spending limit in the Anthropic Console.
- Secret names starting with `SUPABASE_` are reserved by the platform and are not used.

## 5. Running the app against staging

- A git-ignored `.env.staging.local` holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_DATA_SOURCE=supabase`. The anon key is public by design and may appear in the browser. `npm run dev` with `--mode staging` (Vite loads `.env.staging.local`) points the app at staging.
- The legacy `#login` screen is mock-only; staging sign-in uses the real flow at `#onboarding-business` with the test numbers (as local).

## 6. Safety guards

- A `STAGING_PROJECT_REF` constant is the only project any staging script will touch. Scripts print the target URL and require the operator to type the project ref to continue, and refuse to run if the linked project's ref differs.
- Test OTP numbers and demo accounts are applied only through the staging path. The runbook states that `config push` to any other project would enable fixed test OTPs there, and that production gets a different config file and checklist when it exists.
- Secrets never enter git: `.env*` is already ignored (`.gitignore:5`), the runbook uses hidden prompts, and no step echoes a key.
- The service-role key is used for the seed step only, from the operator's terminal; it is never put in the browser, in `.env.staging.local`, or in CI.

## 7. Verification (`scripts/staging-smoke.ts`)

A read-and-call script using only the **anon** key and the test numbers (no service-role key):

1. Phone OTP sign-in as the demo business user with the test OTP; assert a session and the linked person.
2. Read through RLS: the demo organization's projects and the seeded plan with `ai.narrative` and its monthly limit.
3. Call `narrate-report` with a sample facts packet: expect a narrative with a `claude:` engine tag (one real model call), or print the typed error code and the function log hint.
4. Call it without a token (expect a gateway 401) and with a malformed body (expect a 400).
Exit non-zero on any failed step; print only non-secret values (counts, codes, engine tag).

One check stays manual because the usage ledger is private by design (no client can read it): after step 3, the owner confirms in the dashboard SQL editor that `select status, count(*) from ai_usage_events group by status` shows the consumed ticket from the real call, and that a failed call (for example with the secret temporarily unset) leaves a `refunded` ticket.

## 8. Operations and rollback

- **Redeploy:** every step is idempotent: `db push`, `config push`, `functions deploy`, `secrets set`.
- **Function rollback:** redeploy the previous commit's function.
- **Reset staging:** staging is disposable. The runbook documents a full reset (`supabase db reset --linked`) and re-seed, with a prominent warning that it destroys all data in the linked project and is only valid for staging because the guard checks the ref.
- **Rotating the Anthropic key:** create a new key, validate it, `secrets set`, delete the old key.
- **Cost:** a small Supabase plan plus pay-per-use model calls capped by the cap table (Starter 10/month) and the key's spending limit.

## 9. Risks and first-step verifications

These are checked before anything else is built, because the design depends on them:

1. **Test OTP with placeholder SMS credentials on hosted Supabase.** Local works this way. If hosted Auth rejects it, the fallback is a Twilio trial account (still no real delivery to anyone but verified numbers) and the spec is revised.
2. **`config push` coverage and `[remotes.*]` syntax** in the pinned CLI 2.121.0 (confirmed present: `config push`, `config diff`, `db push`, `functions deploy`, `secrets set`, `link`). If a field is not pushed, it is set in the dashboard and `config diff` documents it.
3. **Free-tier pausing** of the project after inactivity; the runbook includes how to resume and what breaks while paused.
4. **Seed application path:** `db push` does not run `seed.sql`; the chosen mechanism is confirmed against a throwaway check before the real seed.

## 10. Files

| File | Purpose |
|---|---|
| `docs/runbooks/staging.md` | Step-by-step: create the project, log in and link, config push, db push, seed, deploy the function, set secrets, verify, reset, rotate. Owner steps and Claude steps are separated. |
| `scripts/staging-smoke.ts` | The verification in section 7. |
| `scripts/staging-guard.ts` (or shared helper) | Reads `STAGING_PROJECT_REF`, prints the target, enforces the typed confirmation and the ref match. Used by the seed script's `--staging` path and the smoke script. |
| `supabase/config.toml` | Add `[remotes.staging]` if supported; otherwise a documented dashboard step. |
| `.env.staging.example` | Names only, empty values; the real file is git-ignored. |
| `package.json` | `dev:staging` script (`vite --mode staging`). |

## 11. Division of work

| Step | Who |
|---|---|
| Create the Supabase project, choose region and database password | Owner (dashboard) |
| `supabase login`, `supabase link --project-ref …` | Owner (needs credentials) |
| Write the runbook, scripts, config block, env example | Assistant |
| `config push`, `db push`, seed, `functions deploy`, `secrets set` | Owner runs from the runbook; the assistant reads non-secret output and fixes problems |
| Create the Anthropic staging key with a spending limit | Owner (Console) |
| Run the smoke script and report results | Assistant (anon key only), after the owner confirms the function is deployed |

## 12. Testing

- Unit tests for the guard helper: refuses a mismatched ref, refuses a local URL for `--staging`, requires the typed confirmation, never prints a secret.
- The smoke script is itself the integration test and is run manually; it is not part of CI (it needs a hosted project and a real key).
- `npm run typecheck`, `vitest run` and the build stay green; `config.toml` changes are validated with the local stack (`supabase start` accepts the file).

## 13. Delivery

One PR: the runbook, guard helper and its tests, smoke script, `dev:staging` script, config block and env example. The hosted project is created and deployed by the owner following the runbook after the PR merges (or from the branch, since nothing in the PR changes production behaviour). The PR is opened before it is merged, and the assistant does not merge.
