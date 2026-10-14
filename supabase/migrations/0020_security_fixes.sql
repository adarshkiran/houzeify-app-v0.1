-- Security fixes from the FINAL SQL-LAYER REVIEW (task 27): S1-S7, every one
-- confirmed live against the local stack. See
-- .superpowers/sdd/2026-10-06-phase-11-production-backend/progress.md.

-- ── S1: apply_credit_wallet_delta (0019) had no EXECUTE revoke. It is an
-- internal helper -- the permission check lives in purchase_credits, same
-- convention as new_worker_record (0016). Without the revoke, anon/authenticated
-- could call it directly to grant themselves free credits (or debit anyone).
revoke all on function public.apply_credit_wallet_delta(uuid, integer, text, uuid)
  from public, anon, authenticated;

-- ── S2: insert_daily_progress_row (0017) had no EXECUTE revoke either. It is
-- the shared insert path for submit_daily_progress/resubmit_daily_progress,
-- which hold every permission/scope check; called directly it let anyone
-- insert progress/evidence into any project and move task status with no
-- checks at all.
revoke all on function public.insert_daily_progress_row(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, integer, numeric, numeric,
  text, text, text, text, text, jsonb, integer, uuid
) from public, anon, authenticated;

-- ── S3: update_organization_profile (0014) had no caller check at all --
-- anon could rewrite any organization's name/kind (kind is the unlock gate).
-- Require an active org-level (project_id is null) membership with
-- project.manage in that organization, the same permission createProject
-- requires in src/domain/constructionCommands.ts authorizeOrganization.
create or replace function public.is_org_manager(oid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.organization_id = oid and m.project_id is null
      and m.status = 'active' and 'project.manage' = any (m.permissions)
  )
$$;

create or replace function public.update_organization_profile(
  organization_id uuid,
  name text,
  kind text,
  city text,
  phone text,
  team_size text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_manager(update_organization_profile.organization_id) then
    raise exception 'permission:Missing permission "project.manage"';
  end if;

  update organizations o
  set name = update_organization_profile.name,
      kind = update_organization_profile.kind,
      city = update_organization_profile.city,
      phone = update_organization_profile.phone,
      team_size = update_organization_profile.team_size
  where o.id = update_organization_profile.organization_id;
end;
$$;

-- ── S4: memberships insert/update RLS (0005) checked has_permission(project_id,
-- 'project.manage') but never that the row's organization_id actually matches
-- that project's organization -- a project manager in org A could insert a
-- membership with project_id = (a project they manage in org A) but
-- organization_id = org B, and every org-scoped check (has_org_permission,
-- is_org_member) reads organization_id directly, granting them org B access.
-- Fix: require organization_id to match the project's real organization when
-- project_id is set, and require an existing org-level project.manage (not
-- just project.manage on some unrelated project) when project_id is null.
create or replace function public.membership_target_allowed(oid uuid, pid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when pid is not null then
      oid = (select p.organization_id from projects p where p.id = pid)
      and public.has_permission(pid, 'project.manage')
    else
      public.has_org_permission(oid, 'project.manage')
  end
$$;

drop policy memberships_insert_manager on memberships;
create policy memberships_insert_manager on memberships
  for insert with check (public.membership_target_allowed(organization_id, project_id));

drop policy memberships_update_manager on memberships;
create policy memberships_update_manager on memberships
  for update using (public.membership_target_allowed(organization_id, project_id))
  with check (public.membership_target_allowed(organization_id, project_id));

-- ── S5: the projects UPDATE column grant (0008) included organization_id (and
-- legacy_id, created_at) -- a project.manage holder could move a project to a
-- different organization, breaking every org-scoped function downstream.
-- No domain path ever changes these three columns directly; name/status stay
-- directly updatable (require_checkout etc. already route only through
-- set_attendance_policy, unaffected here).
revoke update (organization_id, legacy_id, created_at) on public.projects from authenticated;

-- ── S6: evidence/documents/issues direct UPDATE RLS (0005) let
-- progress.submit/issue.manage holders flip customer_visibility/
-- shared_with_homeowner/customer_visible directly, bypassing customer.publish.
-- Every real write to these tables (submit_daily_progress, publish_document,
-- publish_issue, publish_daily_progress_evidence, assign_issue,
-- transition_issue) already goes through a security-definer function -- no
-- src code ever issues a direct client update to these tables -- so the direct
-- UPDATE policies have no legitimate use and are dropped outright.
drop policy evidence_update_capturer on evidence;
drop policy documents_update_manager on documents;
drop policy issues_update_issue_manager on issues;

-- ── S7: threads_update_participant (0005) let any reader of a thread update
-- any column on it, including audience and subject -- a worker could flip an
-- internal thread to homeowner-visible. mark_thread_read/markThreadUnread
-- write thread_reads, not threads, and every other thread write (post_message)
-- is already security definer, so this policy has no legitimate use.
drop policy threads_update_participant on threads;
