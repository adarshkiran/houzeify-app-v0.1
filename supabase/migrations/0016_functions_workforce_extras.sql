-- Workforce extras (spec B4), batch 23: assignWorkerToProject, addWorker,
-- inviteProjectMember, cancelWorkerOnboarding. Message texts match
-- src/domain/constructionCommands.ts; permission/conflict prefixes match the
-- convention from migrations 0006-0009, 0014, 0015 (refusalFrom in
-- src/data/adapter.ts).
--
-- Schema fix carried by this migration: worker_project_assignments.status only
-- allowed 'active'/'inactive' (migration 0002). src/domain/models.ts
-- WorkerProjectAssignment.status is "invited" | "active" | "inactive" (R12: an
-- invited worker's assignment starts invited and activates on acceptance), so
-- the check constraint is widened here to match.
alter table worker_project_assignments drop constraint worker_project_assignments_status_check;
alter table worker_project_assignments
  add constraint worker_project_assignments_status_check
  check (status in ('invited', 'active', 'inactive'));

-- src/domain/models.ts WorkerProjectAssignment.startedAt is absent while an
-- assignment is still invited (set only when it activates), so started_at must
-- be nullable, and without a default -- an invited assignment must not get one.
alter table worker_project_assignments alter column started_at drop not null;
alter table worker_project_assignments alter column started_at drop default;

-- src/domain/phone.ts normalizePhone: digits only, keeping the last 10, so
-- "+91 98765 43210", "098765-43210" and "9876543210" compare equal.
create or replace function public.normalize_phone(phone text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) > 10
      then right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)
    else regexp_replace(coalesce(phone, ''), '\D', '', 'g')
  end
$$;

-- src/domain/permissions.ts permissionsForRole / RolePermissions, ported as-is.
create or replace function public.permissions_for_role(role text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case role
    when 'project-manager' then array['project.read','project.manage','task.manage','progress.submit',
      'progress.review','customer.publish','workforce.manage','evidence.capture','issue.manage']
    when 'supervisor' then array['project.read','task.manage','progress.submit','progress.review',
      'customer.publish','workforce.manage','evidence.capture','issue.manage']
    when 'contractor' then array['project.read','task.manage','progress.submit','evidence.capture']
    when 'worker' then array['project.read','progress.submit','evidence.capture']
    when 'homeowner' then array['project.read']
    when 'developer-admin' then array['project.read','project.manage','task.manage','progress.submit',
      'progress.review','customer.publish','workforce.manage','evidence.capture','issue.manage']
    when 'subcontractor' then array['project.read','progress.submit','evidence.capture']
    when 'consultant' then array['project.read']
    else array['project.read']
  end
$$;

-- src/domain/constructionCommands.ts assertPhoneFree: the shared duplicate-
-- phone check used by both addWorker and the worker role of
-- inviteProjectMember. A worker with no phone never collides.
create or replace function public.assert_phone_free(organization_id uuid, phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if assert_phone_free.phone is null or public.normalize_phone(assert_phone_free.phone) = '' then
    return;
  end if;
  if exists (
    select 1 from workers w
    where w.organization_id = assert_phone_free.organization_id
      and public.normalize_phone(w.phone) = public.normalize_phone(assert_phone_free.phone)
  ) then
    raise exception 'conflict:A worker with this phone number already exists in your organization.';
  end if;
end;
$$;

-- src/domain/constructionCommands.ts newWorkerRecord: the one way a worker row
-- is created, shared by addWorker and the worker role of inviteProjectMember.
-- The worker starts invited with a manual onboarding. Not callable by clients;
-- callers must run assert_phone_free first (same order as the domain).
create or replace function public.new_worker_record(
  organization_id uuid, name text, phone text, trade_ids text[], languages text[], user_id uuid
)
returns workers
language plpgsql
security definer
set search_path = public
as $$
declare
  w workers%rowtype;
begin
  insert into workers (organization_id, user_id, phone, name, trade_ids, languages, onboarding_method, status)
  values (
    new_worker_record.organization_id, new_worker_record.user_id, coalesce(new_worker_record.phone, ''),
    new_worker_record.name, coalesce(new_worker_record.trade_ids, '{}'),
    case when new_worker_record.languages is null or array_length(new_worker_record.languages, 1) is null
      then array['en'] else new_worker_record.languages end,
    'manual', 'invited'
  )
  returning * into w;

  insert into worker_onboardings (worker_id, organization_id, method, status, invited_at)
  values (w.id, w.organization_id, 'manual', 'invited', now());

  return w;
end;
$$;

revoke all on function public.new_worker_record(uuid, text, text, text[], text[], uuid) from public, anon, authenticated;

-- src/domain/constructionCommands.ts assignmentTargets + the authorizeProject
-- loop in assignWorkerToProject/addWorker: every unit x trade combination an
-- assignment touches must carry workforce.manage in scope (an empty list on
-- either side means the whole project / every trade). Not callable by clients.
create or replace function public.authorize_workforce_targets(
  project_id uuid, project_unit_ids uuid[], trade_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  units uuid[] := case when project_unit_ids is null or array_length(project_unit_ids, 1) is null
    then array[null]::uuid[] else project_unit_ids end;
  trades uuid[] := case when trade_ids is null or array_length(trade_ids, 1) is null
    then array[null]::uuid[] else trade_ids end;
  u uuid;
  t uuid;
begin
  foreach u in array units loop
    foreach t in array trades loop
      if not (
        public.has_permission(authorize_workforce_targets.project_id, 'workforce.manage')
        and public.in_scope(authorize_workforce_targets.project_id, u, null, t)
      ) then
        raise exception 'permission:Missing permission "workforce.manage" on project %', authorize_workforce_targets.project_id;
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.authorize_workforce_targets(uuid, uuid[], uuid[]) from public, anon, authenticated;

-- Adds a worker to the organization (workforce.manage on the organization),
-- optionally assigning them to a project in the same call (workforce.manage on
-- the project, scoped to every unit x trade the assignment touches).
create or replace function public.add_worker(
  organization_id uuid,
  name text,
  phone text,
  trade_ids uuid[],
  languages text[],
  project_id uuid,
  project_unit_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proj projects%rowtype;
  w workers%rowtype;
  result_assignment worker_project_assignments%rowtype;
  unit_id uuid;
begin
  if not public.has_org_permission(add_worker.organization_id, 'workforce.manage') then
    raise exception 'permission:Missing permission "workforce.manage"';
  end if;

  perform public.assert_phone_free(add_worker.organization_id, add_worker.phone);

  if add_worker.project_id is not null then
    select * into proj from projects where id = add_worker.project_id;
    if proj.id is null or proj.organization_id <> add_worker.organization_id then
      raise exception 'Project % belongs to a different organization', add_worker.project_id;
    end if;

    perform public.authorize_workforce_targets(add_worker.project_id, add_worker.project_unit_ids, add_worker.trade_ids);

    if add_worker.project_unit_ids is not null then
      foreach unit_id in array add_worker.project_unit_ids loop
        perform public.assert_unit_in_project(add_worker.project_id, unit_id);
      end loop;
    end if;
  end if;

  w := public.new_worker_record(
    add_worker.organization_id, add_worker.name, add_worker.phone,
    coalesce(add_worker.trade_ids, '{}')::text[], add_worker.languages, null
  );

  if add_worker.project_id is not null then
    -- The worker is freshly created and always starts invited (newWorkerRecord),
    -- so buildAssignment always produces an invited assignment here.
    insert into worker_project_assignments (project_id, worker_id, project_unit_ids, status)
    values (add_worker.project_id, w.id, coalesce(add_worker.project_unit_ids, '{}'), 'invited')
    returning * into result_assignment;
  end if;

  return jsonb_build_object(
    'worker', to_jsonb(w),
    'assignment', case when result_assignment.id is null then null else to_jsonb(result_assignment) end
  );
end;
$$;

-- Invites a project team member (project.manage, unscoped). A phone already on
-- the project team is refused; a worker-role invite also runs the shared
-- duplicate-phone check (assert_phone_free) and creates the worker record.
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

  if invite_project_member.phone is not null and public.normalize_phone(invite_project_member.phone) <> '' then
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

  insert into people (phone, full_name)
  values (invite_project_member.phone, invite_project_member.name)
  returning * into new_person;

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

-- Assigns a worker to a project (workforce.manage, scoped to every unit x trade
-- the assignment touches). An invited worker's assignment starts invited with
-- no started_at; an active worker's assignment starts active immediately (R12).
-- A worker already invited to the project is refused; already active returns
-- the existing row. A worker linked to a sign-in also gets an active project
-- membership, unless an invited-or-active worker membership already exists
-- (the team-invite path activates its own membership on acceptance instead).
create or replace function public.assign_worker_to_project(
  worker_id uuid,
  project_id uuid,
  project_unit_ids uuid[],
  trade_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proj projects%rowtype;
  w workers%rowtype;
  existing worker_project_assignments%rowtype;
  result_row worker_project_assignments%rowtype;
  unit_id uuid;
  existing_membership_count int;
begin
  perform public.authorize_workforce_targets(
    assign_worker_to_project.project_id, assign_worker_to_project.project_unit_ids, assign_worker_to_project.trade_ids
  );

  select * into proj from projects where id = assign_worker_to_project.project_id;
  if proj.id is null then
    raise exception 'Unknown project %', assign_worker_to_project.project_id;
  end if;

  select * into w from workers where id = assign_worker_to_project.worker_id;
  if w.id is null or w.organization_id <> proj.organization_id then
    raise exception 'Worker % is not in the organization that owns project %',
      assign_worker_to_project.worker_id, assign_worker_to_project.project_id;
  end if;

  if assign_worker_to_project.project_unit_ids is not null then
    foreach unit_id in array assign_worker_to_project.project_unit_ids loop
      perform public.assert_unit_in_project(assign_worker_to_project.project_id, unit_id);
    end loop;
  end if;

  select * into existing from worker_project_assignments a
  where a.worker_id = assign_worker_to_project.worker_id
    and a.project_id = assign_worker_to_project.project_id
    and a.status in ('active', 'invited')
    and a.ended_at is null
  limit 1;

  if existing.id is not null and existing.status = 'invited' then
    raise exception 'conflict:This worker is already assigned to this project.';
  end if;
  if existing.id is not null then
    return to_jsonb(existing);
  end if;

  insert into worker_project_assignments (project_id, worker_id, project_unit_ids, status, started_at)
  values (
    assign_worker_to_project.project_id, assign_worker_to_project.worker_id,
    coalesce(assign_worker_to_project.project_unit_ids, '{}'),
    case when w.status = 'invited' then 'invited' else 'active' end,
    case when w.status = 'invited' then null else now() end
  )
  returning * into result_row;

  if w.user_id is not null then
    select count(*) into existing_membership_count
    from memberships m
    where m.project_id = assign_worker_to_project.project_id
      and m.person_id = w.user_id
      and m.role = 'worker'
      and m.status in ('active', 'invited');

    if existing_membership_count = 0 then
      insert into memberships (person_id, organization_id, project_id, role, permissions, scope, status)
      values (
        w.user_id, proj.organization_id, assign_worker_to_project.project_id, 'worker',
        public.permissions_for_role('worker'),
        jsonb_build_object(
          'projectUnitIds', coalesce(to_jsonb(result_row.project_unit_ids), '[]'::jsonb),
          'stageIds', '[]'::jsonb,
          'tradeIds', coalesce(to_jsonb(assign_worker_to_project.trade_ids), '[]'::jsonb)
        ),
        'active'
      );
    end if;
  end if;

  return to_jsonb(result_row);
end;
$$;

-- Cancels an invited onboarding (workforce.manage on its organization). The
-- worker record is kept. Only an invited (not yet accepted) onboarding can be
-- cancelled.
create or replace function public.cancel_worker_onboarding(onboarding_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ob worker_onboardings%rowtype;
  result_row worker_onboardings%rowtype;
begin
  select * into ob from worker_onboardings o
  where o.id = cancel_worker_onboarding.onboarding_id
  for update;
  if not found then
    raise exception 'conflict:That onboarding no longer exists.';
  end if;

  if not public.has_org_permission(ob.organization_id, 'workforce.manage') then
    raise exception 'permission:Missing permission "workforce.manage"';
  end if;

  if ob.status <> 'invited' then
    raise exception 'conflict:Only an invitation that hasn''t been accepted can be cancelled.';
  end if;

  update worker_onboardings o set status = 'cancelled' where o.id = ob.id
  returning * into result_row;

  return to_jsonb(result_row);
end;
$$;
