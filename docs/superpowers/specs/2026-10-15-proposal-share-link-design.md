# Partner AI — Proposal Share Link Design

**Status:** Approved design

**Source:** `HOUZEIFY_CURSOR_MASTER_BUILD_PLAN_v0_1.md` §10.2 ("→ Share proposal link"), master plan FR-025: "A contractor can share a proposal through a secure link. Recipient sees only fields intended for sharing." Phase 9 deferred this explicitly.

Decisions (brainstorming): anyone with the link can open it, no sign-in; links expire after 14 days and are revocable; the recipient may see the contractor's organization name.

## What the recipient sees (allowlist)

- `partnerName`: the proposing organization's name
- `location` (city segment), `propertyType`, `areaBand`: the same fields every partner sees before unlocking
- `lines`: `category`, `item`, `quantity`, `unit`, `rate`, `amount` (no ids, source or confidence)
- `total`, `assumptions`, `exclusions`, `submittedAt`
- `expiresAt`

Never exposed: homeowner name or contact, project name, exact area, construction level, any internal id, the submitter's identity, other proposals, credits, or the proposal's selected/rejected status.

## Data

`proposal_shares`: `id`, `proposal_id` (cascade), `token_hash` (unique; SHA-256 hex of the token), `created_by` (people), `created_at`, `expires_at`, `revoked_at`. The raw token is never stored. RLS: select for staff of the proposing organization only; no direct write policies.

## Functions (security definer)

| Function | Caller | Behaviour |
|---|---|---|
| `create_proposal_share(proposal_id)` | partner org staff | Refuses other orgs and rejected proposals. Revokes any active link for the proposal, creates one expiring in 14 days, returns `{ id, proposalId, token, createdAt, expiresAt }`. The token (two `gen_random_uuid()`s, 244 bits) is returned once. |
| `revoke_proposal_share(proposal_id)` | partner org staff | Marks the active link revoked; no-op refusal `conflict:` if there is none. |
| `get_shared_proposal(token)` | `anon`, `authenticated` | Returns the allowlist above, or `null` for unknown, revoked or expired tokens (uniformly, so existence is not confirmed). |

Refusals use the existing `conflict:` / `permission:` prefixes.

## Domain / data layers

- Model: `ProposalShare` (`id`, `proposalId`, `createdByPersonId`, `createdAt`, `expiresAt`, `revokedAt?`, and `token?` which only the in-memory prototype store holds), `SharedProposal` (the allowlist), `state.proposalShares`.
- Commands: `createProposalShare(proposalId) → { share, token }`, `revokeProposalShare(proposalId)`. Read: `getSharedProposal(token) → SharedProposal | null` (async; the memory path resolves from state, the supabase path calls the function).
- `loadState` reads `proposal_shares` (RLS-scoped) so the contractor sees whether a link is active and when it expires.

## UI

- Public route `shared-proposal` (`token` required, no session needed): read-only page showing the allowlist, with "This link is no longer available" for `null`.
- The contractor's "Your proposal" card: "Share proposal" creates a link and shows the URL with Copy and the expiry; with an active link it shows "Active until …", Revoke and "Create new link". The URL cannot be shown again after leaving the screen.

## Tests

- pgTAP: other org / homeowner / rejected proposal refused; token not stored; replace-on-create; exact key set returned and no homeowner fields; unknown, expired and revoked tokens return null; anon can call `get_shared_proposal`; RLS visibility of share rows.
- Domain: create/revoke/resolve incl. expiry, revocation, replacement, permission refusals.
- Rows/adapter wrapper tests; drift guard for new SQL raises.
- Live: open the link in a signed-out session, revoke, confirm it stops working.

## Out of scope

View tracking, emailing or messaging the link, per-link passwords, showing project name or exact area.
