-- Found during the Phase 11 live browser walkthrough's B2 diagnostic
-- (.superpowers/sdd/2026-10-06-phase-11-production-backend/progress.md):
-- the "disappearing credit wallet" was never data loss. Confirmed directly:
-- the row exists at every check via a superuser connection, but the signed-in
-- business user's own authenticated session (RLS context) gets back [] for
-- both credit_wallets and subscriptions.
--
-- Root cause: is_org_member (0005), like is_org_manager before its R1 fix
-- (0023), required an org-level (project_id is null) active membership.
-- Nothing in seed data or any command ever creates one for a business
-- user -- every seeded staff membership (including Arjun's five
-- project-manager rows) is project-scoped. So is_org_member has been false
-- for every real business user since it was introduced; only the pgTAP
-- fixture's partner-org row (project_id null, used solely to probe
-- marketplace_unlocks/proposals visibility) ever satisfied it, which is why
-- 839 passing SQL tests never caught this -- no test exercises
-- organizations_select_member, subscriptions_select_member or
-- credit_wallets_select_member for a project-scoped staff membership.
--
-- Fix, same shape as R1: drop the "project_id is null" restriction from
-- is_org_member so any active membership (any role, any project scope)
-- counts -- this table (and the partner-org checks on marketplace_unlocks/
-- proposals/marketplace_requirements) are read access to the org's own
-- profile/marketplace data, not a staff-only permission gate.
--
-- Separately, subscriptions/credit_wallets/credit_transactions are the
-- organization's internal billing state -- a homeowner's or worker's
-- membership should not grant them visibility into their contractor's
-- subscription plan or credit balance, even though the same membership
-- row should let them see the organization's name/profile. is_org_staff
-- (0014) already encodes exactly the right bar (active membership, any
-- project scope, role not worker/homeowner -- the same business-account
-- distinction src/domain/constructionCommands.ts's authorizeOrganization
-- and src/data/session.ts's resolveSession already draw). Repointing these
-- three policies at is_org_staff fixes the live bug for business users
-- without opening a new confidentiality gap for homeowners/workers.

create or replace function public.is_org_member(oid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.organization_id = oid and m.status = 'active'
  )
$$;

drop policy if exists subscriptions_select_member on subscriptions;
create policy subscriptions_select_member on subscriptions
  for select using (public.is_org_staff(organization_id));

drop policy if exists credit_wallets_select_member on credit_wallets;
create policy credit_wallets_select_member on credit_wallets
  for select using (public.is_org_staff(organization_id));

drop policy if exists credit_transactions_select_member on credit_transactions;
create policy credit_transactions_select_member on credit_transactions
  for select using (public.is_org_staff(organization_id));
