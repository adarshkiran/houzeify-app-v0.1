-- Fixes from the SCOPED RE-REVIEW (task 30): a regression in the S3/M1 fix
-- sequence plus three still-live-exploitable gaps. See
-- .superpowers/sdd/2026-10-06-phase-11-production-backend/progress.md,
-- "SCOPED RE-REVIEW" section, rulings R1-R3 and New Issue 4.

-- ── R1 (New Issue 1, regression): is_org_manager (0020) required an org-level
-- (project_id is null) membership with project.manage. Nothing in seed data or
-- any command ever creates one -- business users (incl. seeded Arjun, who only
-- holds project-scoped project-manager memberships) could no longer
-- create_project or update_organization_profile at all. Ground truth, verified
-- directly against src/domain/constructionCommands.ts: authorizeOrganization
-- does not check the `permission` argument against anything -- it only checks
-- actor.accountType === "business" && actor.organizationId === organizationId.
-- updateOrganizationProfile has no authorization call at all beyond that.
-- Fix: require only that the caller have ANY active membership with
-- project.manage (project-scoped or org-level) in the organization -- not an
-- org-level-only membership. The permission check itself is kept (dropping it
-- too would let a worker or homeowner membership qualify, which nothing in
-- the domain or the rest of the spec's permission matrix intends); only the
-- "project_id is null" restriction, which has no grounding in
-- authorizeOrganization at all, is dropped. This still refuses anon and
-- cross-org actors (zero memberships there) and a worker with no
-- project.manage anywhere in the org.
create or replace function public.is_org_manager(oid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.organization_id = oid
      and m.status = 'active' and 'project.manage' = any (m.permissions)
  )
$$;

-- ── R2 (New Issue 2, self-escalation): membership_target_allowed's org-level
-- branch (project_id is null) accepts any existing membership in the org that
-- already carries project.manage -- including a project-scoped one. That is
-- the right bar for granting a membership to someone else (and matches what
-- S4 already intended), but it lets the holder insert or update a membership
-- row for THEMSELVES: a project-scoped project-manager can insert a brand-new
-- org-level row for their own person_id with an arbitrary permissions array,
-- escalating from one project's scope to unscoped, organization-wide standing
-- with permissions never individually checked against what they already hold.
-- Fix: keep the existing project.manage bar (per-project for a project-scoped
-- target, org-wide for an org-level target) but additionally refuse any
-- insert/update whose target person_id is the caller's own. Self-service
-- membership changes have no legitimate direct-table path (create_project and
-- invite_project_member, the only code that grants memberships, are both
-- security definer and bypass RLS entirely), so this closes the escalation
-- path without blocking the legitimate case of granting someone else a new
-- membership.
create or replace function public.membership_target_allowed(oid uuid, pid uuid, target_person uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when pid is not null then
      oid = (select p.organization_id from projects p where p.id = pid)
      and public.has_permission(pid, 'project.manage')
      and target_person is distinct from public.current_person_id()
    else
      public.has_org_permission(oid, 'project.manage')
      and target_person is distinct from public.current_person_id()
  end
$$;

drop policy memberships_insert_manager on memberships;
create policy memberships_insert_manager on memberships
  for insert with check (public.membership_target_allowed(organization_id, project_id, person_id));

drop policy memberships_update_manager on memberships;
create policy memberships_update_manager on memberships
  for update using (public.membership_target_allowed(organization_id, project_id, person_id))
  with check (public.membership_target_allowed(organization_id, project_id, person_id));

-- ── R3 (New Issue 3, INSERT-side visibility bypass): S6 (0020) dropped the
-- direct UPDATE policies on evidence/documents/issues so a holder of
-- progress.submit/issue.manage could no longer flip visibility after the
-- fact, but the INSERT policies on these tables (and on daily_progress) never
-- pinned the row's initial state -- a worker/submitter could insert a row
-- that is ALREADY in its published/customer-visible state, skipping review
-- and the publish_* functions entirely. Fix: add a WITH CHECK that pins each
-- insert to the correct initial, unpublished state. The publish_document /
-- publish_issue / publish_daily_progress_evidence / review-and-publish
-- functions are all security definer and so are unaffected -- they bypass RLS
-- when flipping visibility afterward.
drop policy evidence_insert_capturer on evidence;
create policy evidence_insert_capturer on evidence
  for insert with check (
    (public.has_permission(project_id, 'progress.submit') or public.has_permission(project_id, 'project.manage'))
    and public.in_scope(project_id, project_unit_id, null, null)
    and customer_visibility is distinct from 'customer-visible'
  );

drop policy documents_insert_manager on documents;
create policy documents_insert_manager on documents
  for insert with check (
    (public.has_permission(project_id, 'progress.submit') or public.has_permission(project_id, 'project.manage'))
    and (shared_with_homeowner is null or shared_with_homeowner = false)
  );

drop policy issues_insert_reporter on issues;
create policy issues_insert_reporter on issues
  for insert with check (
    (public.has_permission(project_id, 'progress.submit') or public.has_permission(project_id, 'issue.manage'))
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
    and public.is_own_membership(created_by_membership_id)
    and (customer_visible is null or customer_visible = false)
  );

drop policy daily_progress_insert_submitter on daily_progress;
create policy daily_progress_insert_submitter on daily_progress
  for insert with check (
    public.has_permission(project_id, 'progress.submit')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
    and public.is_own_membership(submitted_by_membership_id)
    and review_status in ('draft', 'submitted')
    and publication_status = 'private'
  );

-- ── New Issue 4 (M2 completion): tasks INSERT still allowed any status, not
-- just the 'draft' create_task always inserts; task_assignments UPDATE still
-- let a task.manage holder repoint worker_id to any worker row at all,
-- including one from a different organization or project, bypassing
-- assign_task's checks that the worker belongs to the project's organization
-- and is actively assigned to the project. assign_task is the only legitimate
-- path that changes an assignment's worker (M2b already dropped the INSERT
-- policy for the same reason); there is no legitimate direct-table use for
-- either gap.
drop policy tasks_insert_task_manager on tasks;
create policy tasks_insert_task_manager on tasks
  for insert with check (
    public.has_permission(project_id, 'task.manage')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
    and status = 'draft'
  );

drop policy task_assignments_update_task_manager on task_assignments;
