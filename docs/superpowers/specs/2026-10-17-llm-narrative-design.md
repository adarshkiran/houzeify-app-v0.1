# LLM Narrative — Design

**Status:** Draft for review

**Source of truth:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` §10 (AI governance: every AI record carries `source`, `confidence`/assumptions, `createdBy`, review status, `approvedBy`, `approvedAt`; "Do not let AI silently mutate official project records") and §33, which deferred real AI APIs until the construction core was stable. Phase 11 (production backend) is merged, so that deferral is lifted for this milestone only.

**Builds on:** Project AI report (`2026-10-15-project-ai-report-design.md`) and Site AI weekly summary (`2026-10-16-site-ai-weekly-summary-design.md`), both deterministic with `engine: "rules-v1"`.

## Goal

Let a business user ask Claude to rewrite the management summary of a Project Report or a Weekly Summary as readable prose, from computed facts only, with the rules-engine text as the always-available fallback and the existing human approval step unchanged.

## Decisions (made during brainstorming)

| Question | Decision |
|---|---|
| First surface | Report and weekly-summary narrative only. The rules engine keeps computing every number, signal and status; Claude only writes prose. |
| Data sent to the model | Computed facts only. No person names, phone numbers or customer details. No task or issue titles in v1. |
| Trigger | On demand, per user click. No automatic or scheduled calls. |
| Metering | Plan entitlement plus a monthly cap per organization. The credit wallet is not touched. |
| Architecture | Supabase Edge Function called with the user's JWT. |
| Model | `claude-opus-5-5` default, read from a function secret so it can change without a deploy of app code. |

## Out of scope

- Voice-to-draft extraction, speech-to-text, the homeowner estimate and advisor (later surfaces on the same pipeline).
- Scheduled or cached generation, streaming responses, customer-facing chat.
- Sending task or issue titles, or any free text a user typed, to the model.
- Any AI text visible to homeowners (their summaries stay rules-only).
- Hosted staging setup (separate milestone; this one is verified locally).

## 1. Flow

1. The user opens the Project Report or a Weekly Summary card and clicks **Rewrite with AI**.
2. The client builds a facts packet from the existing analyzer output (section 2) and calls `narrate-report`.
3. The function authenticates, authorizes, consumes one usage unit, calls Claude, validates the output (section 4) and returns the narrative.
4. The card shows the AI text tagged "AI-written, not yet reviewed". The rules text remains one click away.
5. Nothing is stored or shared without the existing approve step.

On any failure (cap reached, model error, refusal, guard rejection, timeout) the rules text stays shown with a plain-language message. The feature never blocks the report.

## 2. Facts packet — `src/domain/narrative/facts.ts`

Pure function `buildNarrativeFacts(input: ProjectReport | WeeklySummary): NarrativeFacts`. An allowlist: fields are copied explicitly, and anything not copied is not sent.

Included: report kind, status, `asOf` date, overall and per-stage percent, stage names, planned-vs-actual counts and variance, issue counts by severity and status, signal kind, severity and day counts, days since last update, confidence level and assumption codes.

Excluded: person names and ids, phone numbers, organization and customer names, task and issue titles, free text, entity ids.

Signal messages (which can embed titles) are not sent. Each signal is sent as `{kind, severity, days?}` and the model is told to describe it generically.

`factsHash` is the SHA-256 of the canonical JSON of the packet. It is stored with the narrative so a reviewer can tell whether the data changed after generation.

Tests: a fixture containing names, phone numbers and titles in every field asserts none appear in the serialized packet; a snapshot test pins the packet shape.

## 3. Edge function — `supabase/functions/narrate-report/`

Request: `{ projectId, kind: "report" | "weekly-company", facts }`. Response: `{ narrative: { text, engine, generatedAt, factsHash } }` or `{ error: <code> }` with codes `unauthorized`, `forbidden`, `limit-reached`, `unavailable`, `rejected`.

Steps, in order:

1. Verify the caller's JWT. Build a user-scoped Supabase client so RLS applies; the service-role key is not used by this function.
2. Authorize: caller must hold `project.manage` on `projectId` (same check as `approve_project_report`) and the organization must hold the `ai.narrative` entitlement.
3. Call `consume_ai_narrative(organization_id)` (section 5). Cap reached returns `limit-reached` without calling the model.
4. Call Claude with the `@anthropic-ai/sdk` through the function's `ANTHROPIC_API_KEY` secret: fixed system prompt, facts as the user message, `output_config.format` JSON schema `{ paragraphs: string[] }` (1–4 paragraphs, bounded length), adaptive thinking, an explicit `output_config.effort`, a request timeout and a `max_tokens` cap. The model id comes from the `NARRATIVE_MODEL` secret.
5. Check `stop_reason`. Anything other than a normal end of turn (including `refusal`) is an `unavailable` failure.
6. Run the output guard (section 4).
7. On any failure after step 3, call `refund_ai_narrative(organization_id)` so a failed call does not consume the user's cap.
8. Return the narrative. The function stores nothing about the content; it records only usage counts and a status (section 5).

The system prompt states: write for a construction manager, use only the facts provided, mention no names, quote numbers exactly as given, do not speculate about causes, do not give legal or financial advice, and say "not enough data" where a fact is absent.

The function never logs the facts or the generated text.

## 4. Output guard — `supabase/functions/narrate-report/guard.ts` (pure, unit-tested)

The text is rejected if any of these hold:

- A number or percentage appears in the prose that is not present in the facts packet (allowing the same value rendered as a percentage, an integer or a word-number for 0–10).
- A capitalized token that is not in an allowed vocabulary (stage names from the packet, a fixed list of construction terms and month names) appears, to catch invented names.
- It contains a URL, email address or phone-like digit run.
- It is empty or over the length cap.

A rejected narrative returns `rejected`; the client shows the rules text and "AI text didn't pass our accuracy check". The guard is deliberately conservative: a false reject costs one refunded click, a false accept puts an invented figure in a report.

## 5. Metering and schema (one migration)

- `plans.limits jsonb not null default '{}'`. Existing plans are unchanged. Seed plans that include AI get `{"ai_narratives_per_month": N}` and the `ai.narrative` entitlement. Entitlements stay boolean keys, as today; the numeric cap lives in `limits` because `entitlements` is a `text[]`.
- `ai_usage` table: `organization_id`, `period` (first day of the Kolkata calendar month), `kind`, `count`, `updated_at`, primary key `(organization_id, period, kind)`. RLS: select for org staff; no insert, update or delete policy (written only by the functions below).
- `consume_ai_narrative(organization_id uuid)`: security definer. Checks the caller is org staff and holds `ai.narrative`, reads the cap from the active plan's `limits`, and increments with a single atomic upsert guarded by `count < cap`. Raises `conflict: AI usage limit reached` when full, `permission: ...` otherwise. These prefixes are added to `USER_FACING_RAISES` and the migration scan test.
- `refund_ai_narrative(organization_id uuid)`: security definer, decrements, never below zero, callable only for the caller's own organization.
- Concurrency: two simultaneous clicks at `cap - 1` produce exactly one success (pgTAP-asserted with sequential-simulated races plus the guarded upsert).

A plan with no `ai.narrative` entitlement hides the button and shows a short upgrade note.

## 6. Domain, adapter and UI

- `ProjectReport` and `WeeklySummary` gain optional `narrative?: { text, engine, generatedAt, factsHash }`. `engine` is `"claude:<model-id>"`. The report's own `engine` stays `"rules-v1"` because the numbers and signals are still produced by rules.
- Port `NarrativeService.narrate(request): Promise<NarrativeResult>`. Memory mode uses a deterministic fake (so the app works offline and tests need no network); Supabase mode calls `supabase.functions.invoke("narrate-report")`.
- `commandSurface` exposes `narrateReport`. Errors map to the existing `describeCommandError` pattern with fixed, user-facing text per error code.
- Report screen and `WeeklySummaryCard` gain the button, a loading state, the AI tag, a "Show rules summary" toggle and the failure messages.
- **Approval:** `approve_project_report` already snapshots the payload. The payload now includes `narrative` when the user chose AI text, and nothing when they chose the rules text, so history shows exactly what a person approved and which engine wrote it. The function validates `narrative.engine` matches `claude:*` and `factsHash` is present.
- **Weekly summary, homeowner audience:** not supported in v1. The homeowner view keeps the rules text, so no AI text can reach a homeowner and no publish/persistence mechanism is needed. A reviewed, published narrative for homeowners is a follow-up with its own design.

## 7. Secrets and configuration

- `ANTHROPIC_API_KEY` and `NARRATIVE_MODEL` are Supabase function secrets. Locally they live in an untracked `supabase/.env.local` (added to `.gitignore`); `supabase/config.toml` references them via `env(...)` and never contains a value.
- No key is committed, logged, sent to the browser or echoed in chat. The service-role key is not used by this feature.
- CI does not call the real API. It runs unit, Deno and pgTAP tests only.

## 8. Testing

- `facts.test.ts`: allowlist, leak fixture, snapshot, hash stability.
- `guard.test.ts`: each rejection rule at its boundary, plus accepted realistic prose.
- Edge function tests (Deno) with a fake Anthropic client: unauthorized, forbidden, no entitlement, cap reached (no model call), model error and refusal (usage refunded), guard rejection (refunded), success.
- pgTAP: `consume`/`refund` permissions, cap enforcement, refund floor, RLS on `ai_usage`, migration scan for the new raise prefixes.
- Adapter integration test against the local stack for `narrateReport` using the fake model path.
- Live check in the browser as the business user in Supabase mode with a real key: a successful narrative, the cap message, the rules fallback when the key is removed, and an approved report whose stored snapshot carries the narrative and engine tag. A passing automated suite alone is not accepted as done.

## 9. Delivery

| PR | Contents |
|---|---|
| 1 | Facts packet, guard, `NarrativeService` port and fake, domain types, tests. No network, no schema. |
| 2 | Migration (`plans.limits`, `ai_usage`, consume/refund, seed), pgTAP, adapter plumbing. |
| 3 | Edge function, secrets wiring, Deno tests. |
| 4 | UI on the report and weekly summary, approval payload, live browser verification. |

Each PR is opened before it is merged, and the author does not merge.

## 10. Risks

- **Invented figures.** Mitigated by the numeric allowlist guard and by sending computed facts only. Residual risk is wording that is misleading but numerically correct; the human review gate covers it.
- **Prompt injection.** The model only sees numbers and fixed vocabulary, never user-typed text, so there is no injection surface in v1. This is the main reason titles are excluded.
- **Cost.** About 1.5k input and 400 output tokens per call (roughly 1–2 cents on the default model), bounded by the monthly cap and by on-demand triggering.
- **Availability.** Provider outages degrade to the rules text; the feature is never on the critical path.
- **Data retention.** Calls go to the first-party API under the account's data terms. Because only anonymized computed facts are sent, no customer data statement is needed for this surface; widening what is sent (titles, names) requires one.
