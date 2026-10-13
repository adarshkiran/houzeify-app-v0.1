-- RLS/permission hardening from the FINAL SQL-LAYER REVIEW's "Notable but not
-- blocking" list (task 29): M1-M4, each a direct-write or over-broad-permission
-- path that bypasses a function meant to be the only legitimate entry point,
-- violating the spec's rule that RLS is the backstop for every table (B3). See
-- .superpowers/sdd/2026-10-06-phase-11-production-backend/progress.md.

-- ── M1: create_project (0014) accepted any project-scoped staff membership in
-- the organization (is_org_staff: any non-worker/homeowner role, anywhere in
-- the org), letting e.g. a site supervisor on one project create a new project
-- and become its project manager. src/domain/constructionCommands.ts
-- createProject calls authorizeOrganization(ctx, organizationId,
-- PROJECT_MANAGE), which requires the actor's own organization-level
-- membership to carry project.manage -- not a project-scoped grant. is_org_manager
-- (0020, added for S3's update_organization_profile) already encodes exactly
-- this: an active membership with project_id is null and project.manage in
-- permissions. Reuse it here.
create or replace function public.create_project(
  organization_id uuid,
  name text,
  kind text,
  status text,
  location text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proj projects%rowtype;
  actor_id uuid := public.current_person_id();
begin
  if not public.is_org_manager(create_project.organization_id) then
    raise exception 'permission:Missing permission "project.manage"';
  end if;

  insert into projects (organization_id, name, status, location, kind, require_checkout, created_at)
  values (
    create_project.organization_id, create_project.name, create_project.status,
    create_project.location, create_project.kind, false, now()
  )
  returning * into proj;

  if create_project.kind = 'individual-house' then
    insert into project_units (project_id, parent_id, name, created_at)
    values (proj.id, null, 'Main House', now());
  end if;

  if actor_id is not null then
    insert into memberships (person_id, organization_id, project_id, role, permissions, scope, status)
    values (
      actor_id, create_project.organization_id, proj.id, 'project-manager',
      array['project.read', 'project.manage', 'task.manage', 'progress.submit', 'progress.review',
        'customer.publish', 'workforce.manage', 'evidence.capture', 'issue.manage'],
      '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active'
    );
  end if;

  return to_jsonb(proj);
end;
$$;

-- ── M2a: tasks_update_task_manager (0005) let any task.manage holder in scope
-- set tasks.status directly, bypassing task_transition_allowed entirely (any
-- status to any status, no state machine). transition_task (0015) is the only
-- legitimate path that changes status (assign_task also sets it, draft ->
-- assigned, as part of the assignment flow). No src code issues a direct
-- client update to tasks at all (adapter.ts only selects tasks and calls the
-- transition_task/assign_task/create_task RPCs), so there is no genuinely
-- safe directly-writable field to carve out -- unlike projects (S5), tasks
-- never had a table-level UPDATE revoke, so a column-specific revoke alone
-- would have no effect (the table-level grant already covers every column).
-- Revoke the table-level grant outright, the same starting point 0008 used
-- for projects before carving out its own safe column list.
revoke update on public.tasks from anon, authenticated;

-- ── M2b: task_assignments_insert_task_manager (0005) let any task.manage
-- holder insert an assignment row directly, skipping assign_task's checks that
-- the worker belongs to the project's organization and is actively assigned to
-- the project. No src code issues a direct client insert into task_assignments
-- (adapter.ts only selects the table and calls the assign_task RPC), so the
-- policy has no legitimate use, same reasoning as S6/S7's dropped policies.
drop policy task_assignments_insert_task_manager on task_assignments;

-- ── M3: estimates/marketplace_requirements direct insert/update (0005) let a
-- homeowner write any column directly, bypassing generate_estimate (which
-- computes totals/breakdown server-side), confirm_estimate (the only path to
-- review_status = 'confirmed'), and post_requirement (the only path to
-- status/posted_at, and the only inserter of marketplace_requirements at all).
-- A homeowner could otherwise post arbitrary totals, confirm an estimate
-- without review, or set a requirement's status to 'awarded' with any
-- awarded_proposal_id directly. No src code issues a direct client
-- insert/update to either table (adapter.ts only selects them and calls
-- generate_estimate/confirm_estimate/post_requirement), so the write policies
-- have no legitimate use and are dropped outright; select-by-owner stays.
drop policy estimates_insert_owner on estimates;
drop policy estimates_update_owner on estimates;
drop policy marketplace_requirements_insert_owner on marketplace_requirements;
drop policy marketplace_requirements_update_owner on marketplace_requirements;

-- ── M4: invite_project_member (0016) always inserted a new people row, so
-- inviting a phone that already belongs to an existing person (invited to a
-- different project, or already a worker/homeowner elsewhere) failed on
-- people.phone's unique constraint instead of linking the new project
-- membership to that existing person. Find-or-create by normalized phone
-- within the call, same matching rule normalize_phone already uses elsewhere
-- in this function and in assert_phone_free.
create or replace function public.invite_project_member(
  project_id uuid,
  name text,
  phone text,
  role text,
  project_unit_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proj projects%rowtype;
  new_person people%rowtype;
  new_membership memberships%rowtype;
  w workers%rowtype;
  has_phone boolean := invite_project_member.phone is not null
    and public.normalize_phone(invite_project_member.phone) <> '';
begin
  if not (
    public.has_permission(invite_project_member.project_id, 'project.manage')
    and public.in_scope(invite_project_member.project_id, null, null, null)
  ) then
    raise exception 'permission:Missing permission "project.manage" on project %', invite_project_member.project_id;
  end if;

  select * into proj from projects where id = invite_project_member.project_id;
  if proj.id is null then
    raise exception 'Unknown project %', invite_project_member.project_id;
  end if;

  if has_phone then
    if exists (
      select 1
      from memberships m
      join people p on p.id = m.person_id
      where m.project_id = invite_project_member.project_id
        and public.normalize_phone(p.phone) = public.normalize_phone(invite_project_member.phone)
    ) then
      raise exception 'conflict:Someone with this phone number is already on the project team.';
    end if;
  end if;

  if invite_project_member.role = 'worker' then
    perform public.assert_phone_free(proj.organization_id, invite_project_member.phone);
  end if;

  if has_phone then
    select * into new_person from people p
    where public.normalize_phone(p.phone) = public.normalize_phone(invite_project_member.phone);
  end if;

  if new_person.id is null then
    insert into people (phone, full_name)
    values (invite_project_member.phone, invite_project_member.name)
    returning * into new_person;
  end if;

  insert into memberships (person_id, organization_id, project_id, role, permissions, scope, status)
  values (
    new_person.id, proj.organization_id, invite_project_member.project_id, invite_project_member.role,
    public.permissions_for_role(invite_project_member.role),
    jsonb_build_object(
      'projectUnitIds', coalesce(to_jsonb(invite_project_member.project_unit_ids), '[]'::jsonb),
      'stageIds', '[]'::jsonb,
      'tradeIds', '[]'::jsonb
    ),
    'invited'
  )
  returning * into new_membership;

  if invite_project_member.role = 'worker' then
    w := public.new_worker_record(
      proj.organization_id, invite_project_member.name, invite_project_member.phone,
      '{}', array['en'], new_person.id
    );
  end if;

  return to_jsonb(new_membership);
end;
$$;
