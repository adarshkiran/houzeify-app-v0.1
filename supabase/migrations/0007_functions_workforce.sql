-- Workforce functions (spec B4): onboarding, join, and assignment end. Each function
-- is security definer, reads the caller through current_person_id() or the
-- organization and project permission helpers, performs every check before any
-- write, and refuses with P0001 and 'conflict:<text>' (state) or 'permission:<text>'
-- (who may act). Message texts match src/domain/constructionCommands.ts and
-- src/domain/workforceOnboarding.ts.

-- Activation shared by both accept paths: the onboarding is accepted, the worker
-- becomes active, the invited assignments start, and the invited worker-role
-- memberships of the worker become active. Not callable by clients.
create or replace function public.activate_worker_onboarding(onboarding_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ob worker_onboardings%rowtype;
  w workers%rowtype;
begin
  select o.* into ob from worker_onboardings o where o.id = activate_worker_onboarding.onboarding_id;
  select x.* into w from workers x where x.id = ob.worker_id;

  update worker_onboardings o
  set status = 'accepted', accepted_at = now()
  where o.id = ob.id;

  update workers x set status = 'active' where x.id = w.id;

  update worker_project_assignments a
  set status = 'active', started_at = now()
  where a.worker_id = w.id and a.ended_at is null and a.status = 'invited';

  if w.user_id is not null then
    update memberships m
    set status = 'active'
    where m.person_id = w.user_id
      and m.organization_id = w.organization_id
      and m.role = 'worker'
      and m.status = 'invited';
  end if;

  return w.id;
end;
$$;

revoke all on function public.activate_worker_onboarding(uuid) from public, anon, authenticated;

-- Starts a qr or supervisor-assisted onboarding for an invited worker. One open
-- onboarding per worker. A qr onboarding gets a 6-character join code.
create or replace function public.create_worker_onboarding(worker_id uuid, method text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w workers%rowtype;
  caller_membership_id uuid;
  new_row worker_onboardings%rowtype;
begin
  select x.* into w from workers x where x.id = create_worker_onboarding.worker_id;
  if not found then
    raise exception 'conflict:That worker no longer exists.';
  end if;
  if not public.has_org_permission(w.organization_id, 'workforce.manage') then
    raise exception 'permission:Missing permission "workforce.manage"';
  end if;
  if w.status <> 'invited' then
    raise exception 'conflict:Only invited workers need a join.';
  end if;
  if exists (
    select 1 from worker_onboardings o
    where o.worker_id = w.id and o.status in ('invited', 'accepted')
  ) then
    raise exception 'conflict:This worker already has an open onboarding.';
  end if;
  if method not in ('qr', 'supervisor-assisted') then
    raise exception 'conflict:Choose how this worker joins: a QR code or a supervisor.';
  end if;

  select m.id into caller_membership_id
  from memberships m
  where m.person_id = public.current_person_id()
    and m.organization_id = w.organization_id
    and m.status = 'active'
    and 'workforce.manage' = any (m.permissions)
  limit 1;

  insert into worker_onboardings (worker_id, organization_id, method, status, join_code, invited_by_membership_id, invited_at)
  values (
    w.id,
    w.organization_id,
    method,
    'invited',
    case when method = 'qr' then upper(substr(md5(gen_random_uuid()::text), 1, 6)) end,
    caller_membership_id,
    now()
  )
  returning * into new_row;

  return to_jsonb(new_row);
end;
$$;

-- Accepts an invited onboarding. A qr onboarding is accepted with the join code shown
-- to the worker; any other method is accepted by a supervisor with workforce.manage.
-- The worker must be linked to a sign-in (R7).
create or replace function public.accept_worker_onboarding(onboarding_id uuid, join_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ob worker_onboardings%rowtype;
  w workers%rowtype;
  state_message text;
begin
  select o.* into ob from worker_onboardings o
  where o.id = accept_worker_onboarding.onboarding_id
  for update;
  if not found then
    raise exception 'conflict:That onboarding no longer exists.';
  end if;

  if ob.status <> 'invited' then
    state_message := case ob.status
      when 'cancelled' then 'This invitation was cancelled.'
      when 'expired' then 'This invitation has expired.'
      else 'Only an invitation that hasn''t been accepted can be accepted.'
    end;
    raise exception 'conflict:%', state_message;
  end if;

  if ob.method = 'qr' then
    if accept_worker_onboarding.join_code is null or accept_worker_onboarding.join_code <> ob.join_code then
      raise exception 'conflict:That join code doesn''t match this invitation.';
    end if;
  elsif not public.has_org_permission(ob.organization_id, 'workforce.manage') then
    raise exception 'permission:Missing permission "workforce.manage"';
  end if;

  select x.* into w from workers x where x.id = ob.worker_id;
  if w.user_id is null then
    raise exception 'conflict:This worker isn''t linked to a sign-in yet.';
  end if;

  perform public.activate_worker_onboarding(ob.id);

  select x.* into w from workers x where x.id = ob.worker_id;
  return to_jsonb(w);
end;
$$;

-- The invited worker accepts with their own session. The session's person must be
-- the worker's user_id. A qr invitation is accepted only with its join code.
create or replace function public.accept_own_worker_onboarding(onboarding_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ob worker_onboardings%rowtype;
  w workers%rowtype;
  state_message text;
begin
  select o.* into ob from worker_onboardings o
  where o.id = accept_own_worker_onboarding.onboarding_id
  for update;
  if not found then
    raise exception 'conflict:That onboarding no longer exists.';
  end if;

  if ob.status <> 'invited' then
    state_message := case ob.status
      when 'cancelled' then 'This invitation was cancelled.'
      when 'expired' then 'This invitation has expired.'
      else 'Only an invitation that hasn''t been accepted can be accepted.'
    end;
    raise exception 'conflict:%', state_message;
  end if;

  select x.* into w from workers x where x.id = ob.worker_id;
  if w.user_id is null then
    raise exception 'conflict:This worker isn''t linked to a sign-in yet.';
  end if;
  if ob.method = 'qr' or public.current_person_id() is distinct from w.user_id then
    raise exception 'conflict:That phone number doesn''t match this invitation.';
  end if;

  perform public.activate_worker_onboarding(ob.id);

  select x.* into w from workers x where x.id = ob.worker_id;
  return to_jsonb(w);
end;
$$;

-- Supervisor path for a non-qr invitation ("Mark as joined"). Requires workforce.manage.
create or replace function public.mark_worker_joined(onboarding_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ob worker_onboardings%rowtype;
  w workers%rowtype;
  state_message text;
begin
  select o.* into ob from worker_onboardings o
  where o.id = mark_worker_joined.onboarding_id
  for update;
  if not found then
    raise exception 'conflict:That onboarding no longer exists.';
  end if;
  if not public.has_org_permission(ob.organization_id, 'workforce.manage') then
    raise exception 'permission:Missing permission "workforce.manage"';
  end if;

  if ob.status <> 'invited' then
    state_message := case ob.status
      when 'cancelled' then 'This invitation was cancelled.'
      when 'expired' then 'This invitation has expired.'
      else 'Only an invitation that hasn''t been accepted can be accepted.'
    end;
    raise exception 'conflict:%', state_message;
  end if;
  if ob.method = 'qr' then
    raise exception 'conflict:This invitation is accepted with its join code.';
  end if;

  perform public.activate_worker_onboarding(ob.id);

  select x.* into w from workers x where x.id = ob.worker_id;
  return to_jsonb(w);
end;
$$;

-- Closes an assignment's history: records when and why it ended, and deactivates the
-- worker's membership on that project. The worker's own status is left alone.
create or replace function public.end_worker_project_assignment(assignment_id uuid, reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  asg worker_project_assignments%rowtype;
  ended_row worker_project_assignments%rowtype;
  worker_user_id uuid;
begin
  select a.* into asg from worker_project_assignments a
  where a.id = end_worker_project_assignment.assignment_id
  for update;
  if not found then
    raise exception 'conflict:That assignment no longer exists.';
  end if;
  if not public.has_permission(asg.project_id, 'workforce.manage') then
    raise exception 'permission:Missing permission "workforce.manage" on project %', asg.project_id;
  end if;
  if asg.ended_at is not null then
    raise exception 'conflict:This assignment has already ended.';
  end if;
  if reason not in ('reassigned', 'left-project', 'removed') then
    raise exception 'conflict:Choose why this assignment ended.';
  end if;

  update worker_project_assignments a
  set ended_at = now(), status = 'inactive', end_reason = reason
  where a.id = asg.id
  returning * into ended_row;

  select x.user_id into worker_user_id from workers x where x.id = asg.worker_id;
  update memberships m
  set status = 'inactive'
  where m.project_id = asg.project_id
    and m.role = 'worker'
    and m.person_id = worker_user_id;

  return to_jsonb(ended_row);
end;
$$;
