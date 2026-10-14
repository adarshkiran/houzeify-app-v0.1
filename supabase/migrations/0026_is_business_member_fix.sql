-- Found while seeding demo data to exercise the marketplace unlock flow live
-- (.superpowers/sdd/2026-10-06-phase-11-production-backend/progress.md):
-- is_business_member (0006), used by unlock_requirement, submit_proposal and
-- purchase_credits, has the exact same defect 0025 fixed in is_org_member --
-- it requires an active membership with project_id is null. Nothing in seed
-- data or any command ever creates one for a business user (every seeded
-- staff membership, including all five of Arjun's, is project-scoped), so
-- every one of these three billing/marketplace write paths has been
-- unreachable for a real business user since 0006 was written. The only
-- pgTAP fixture that ever satisfied it is explicitly commented "Business
-- memberships are organization-level (no project)" (0006_functions.sql) --
-- an artificial shape that masked the bug the same way 0005_rls.sql's
-- lone org-level partner row masked is_org_member's.
--
-- Fix: same bar as is_org_staff (0014) -- any active membership, any
-- project scope, role not worker/homeowner. is_business_member IS that
-- same "is this person on this org's business team" question, so it now
-- delegates to is_org_staff directly rather than duplicating the role list.

create or replace function public.is_business_member(oid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_org_staff(oid)
$$;
