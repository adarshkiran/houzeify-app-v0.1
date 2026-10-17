# Staging runbook

One hosted Supabase project, `houzeify-staging`, for verifying the app end to end. **Staging only: never run any of this against production.** Spec: `docs/superpowers/specs/2026-10-17-staging-environment-design.md`.

## Rules

- Run commands in a real **Terminal-panel tab** (or your own terminal), not the chat input box: the hidden prompts need real input.
- Paste secrets **only** at a `read -rs` prompt (nothing is echoed). Never paste a key, password or token into chat, a file in the repo, or a normal shell prompt.
- The service-role key is used for one command (demo users). The anon key is public and may go in `.env.staging.local`.
- Everything here is idempotent: re-running a step is safe.
- The staging guard enforces **agreement, not identity**. It checks that the target URL, `STAGING_PROJECT_REF`, the linked project and the ref you retype all agree, but it cannot tell staging from production. So never export a production project's ref as `STAGING_PROJECT_REF`, and before the first run confirm in the dashboard that the project is named `houzeify-staging`.

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

Copy `.env.staging.example` to `.env.staging.local` and fill `VITE_SUPABASE_URL=https://<ref>.supabase.co`, `VITE_SUPABASE_ANON_KEY` (anon key from the dashboard) and `STAGING_PROJECT_REF`. Confirm the file is ignored: `git check-ignore -q .env.staging.local && echo ignored || echo tracked-able` must print `ignored`.

All three `VITE_` keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DATA_SOURCE=supabase`) must be set in `.env.staging.local`. Vite also loads `.env.local`, and any key missing from the staging file silently falls through to the local stack.

Node's `--env-file` (used by `npm run smoke:staging`) does not override variables already exported in your shell. If you ever exported them, run `unset VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY` first.

Then:

```bash
npm run dev:staging
```

Open the browser's network tab and check that requests go to `https://<ref>.supabase.co`, not `127.0.0.1`. Sign in at `#onboarding-business` with `+919000011101` and code `123456` (the legacy `#login` screen is mock-only).

## 8. Verify

```bash
npm run smoke:staging
```

It asks you to retype the project ref, then checks sign-in, RLS reads, the plan's `ai.narrative` entitlement and limit, one real model call, a no-token 401 and a malformed-body 400. It must end with `smoke passed`.

Each smoke run consumes one narrative unit of the monthly cap (10), and repeated runs can hit hosted OTP send rate limits, so do not loop it.

The usage ledger is private by design, so confirm it in the dashboard SQL editor:

```sql
select status, count(*) from ai_usage_events group by status;
```

After the smoke run there should be one `consumed` row (that is the unit it used). To see the refund path, temporarily unset the secret (`npx supabase secrets unset ANTHROPIC_API_KEY --project-ref "$STAGING_PROJECT_REF"`), click Rewrite once in the app (you get "The AI writer isn't available right now"), and expect a `refunded` row; then set the secret again with section 6.

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
