-- Attendance and progress publication functions (spec B4). Each function is security
-- definer, reads the caller through current_person_id(), performs every check before
-- any write, and refuses with P0001 and 'conflict:<text>' (state) or
-- 'permission:<text>' (who may act). Dates and times come from the database: the
-- attendance day is the Asia/Kolkata calendar day of now() (spec A5, R8).
-- Message texts match src/domain/attendanceCommands.ts and
-- src/domain/constructionCommands.ts.

-- (a) Assignments can be invited (the activation path in 0007 starts them).
alter table worker_project_assignments
  drop constraint worker_project_assignments_status_check;
alter table worker_project_assignments
  add constraint worker_project_assignments_status_check
  check (status in ('invited', 'active', 'inactive'));

-- (b) Only set_attendance_policy changes projects.require_checkout. Clients keep
-- every other column they could update before: the table-level update grant is
-- replaced by a column-level grant that leaves require_checkout out. The
-- project.manage update policy in 0005 still governs which rows may change.
revoke update on public.projects from anon, authenticated;
grant update (legacy_id, organization_id, name, status, created_at) on public.projects to authenticated;

-- Worker check-in for today. The worker is the signed-in person, matched to a worker
-- of the project's organization. Refuses a second check-in the same day (A6).
create or replace function public.check_in_worker(project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proj projects%rowtype;
  w workers%rowtype;
  asg worker_project_assignments%rowtype;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  existing worker_attendance%rowtype;
  existed boolean;
  new_row worker_attendance%rowtype;
begin
  select p.* into proj from projects p where p.id = check_in_worker.project_id;
  if not found then
    raise exception 'conflict:That worker or project no longer exists.';
  end if;

  select x.* into w from workers x
  where x.user_id = public.current_person_id() and x.organization_id = proj.organization_id;
  if not found then
    raise exception 'conflict:You can only check in or out for yourself.';
  end if;
  if w.status <> 'active' then
    raise exception 'conflict:Your account isn''t active yet.';
  end if;

  select a.* into asg from worker_project_assignments a
  where a.worker_id = w.id and a.project_id = proj.id
    and a.status = 'active' and a.ended_at is null;
  if not found then
    raise exception 'conflict:You''re not assigned to this project.';
  end if;

  select r.* into existing from worker_attendance r
  where r.worker_id = w.id and r.project_id = proj.id and r.date = today;
  existed := found;
  if existed and existing.check_in_at is not null then
    raise exception 'conflict:You''ve already checked in today.';
  end if;

  if existed then
    update worker_attendance r
    set check_in_at = now(),
        status = coalesce(r.status, 'present'),
        recorded_by = 'worker',
        updated_at = now()
    where r.id = existing.id
    returning r.* into new_row;
  else
    insert into worker_attendance (
      worker_id, project_id, assignment_id, date, status, check_in_at, recorded_by, created_at, updated_at
    ) values (
      w.id, proj.id, asg.id, today, 'present', now(), 'worker', now(), now()
    )
    returning * into new_row;
  end if;

  return to_jsonb(new_row);
end;
$$;

-- Worker check-out for today. Needs a check-in for the same day. Allowed after the
-- assignment has ended, so a worker can close a day they opened (A8).
create or replace function public.check_out_worker(project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proj projects%rowtype;
  w workers%rowtype;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  existing worker_attendance%rowtype;
  new_row worker_attendance%rowtype;
begin
  select p.* into proj from projects p where p.id = check_out_worker.project_id;
  if not found then
    raise exception 'conflict:That worker or project no longer exists.';
  end if;

  -- No active-status check here: a worker can close a day they opened after deactivation (A8, R5).
  select x.* into w from workers x
  where x.user_id = public.current_person_id() and x.organization_id = proj.organization_id;
  if not found then
    raise exception 'conflict:You can only check in or out for yourself.';
  end if;

  select r.* into existing from worker_attendance r
  where r.worker_id = w.id and r.project_id = proj.id and r.date = today;
  if not found or existing.check_in_at is null then
    raise exception 'conflict:Check in before you check out.';
  end if;
  if existing.check_out_at is not null then
    raise exception 'conflict:You''ve already checked out today.';
  end if;

  update worker_attendance r
  set check_out_at = now(),
      recorded_by = 'worker',
      updated_at = now()
  where r.id = existing.id
  returning r.* into new_row;

  return to_jsonb(new_row);
end;
$$;

-- Supervisor entry or correction for one worker, project and day (workforce.manage).
-- Upserts on (worker, project, date). The covering assignment is the open one when
-- several cover the day (A9); a fully ended covering assignment is refused (R9).
create or replace function public.record_attendance(
  project_id uuid,
  worker_id uuid,
  day date,
  status text,
  check_in_at timestamptz,
  check_out_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proj projects%rowtype;
  w workers%rowtype;
  membership_id uuid;
  existing worker_attendance%rowtype;
  existed boolean;
  asg worker_project_assignments%rowtype;
  in_at timestamptz;
  out_at timestamptz;
  new_row worker_attendance%rowtype;
begin
  if not public.has_permission(record_attendance.project_id, 'workforce.manage') then
    raise exception 'permission:Missing permission "workforce.manage"';
  end if;

  select p.* into proj from projects p where p.id = record_attendance.project_id;
  if not found then
    raise exception 'conflict:That worker or project no longer exists.';
  end if;

  select x.* into w from workers x
  where x.id = record_attendance.worker_id and x.organization_id = proj.organization_id;
  if not found then
    raise exception 'conflict:That worker or project no longer exists.';
  end if;

  if record_attendance.status not in ('present', 'absent', 'half-day') then
    raise exception 'conflict:Choose present, absent or half-day for the day.';
  end if;

  select m.id into membership_id from memberships m
  where m.person_id = public.current_person_id()
    and m.project_id = proj.id
    and m.status = 'active'
    and 'workforce.manage' = any (m.permissions)
  limit 1;

  select r.* into existing from worker_attendance r
  where r.worker_id = w.id and r.project_id = proj.id and r.date = record_attendance.day;
  existed := found;

  in_at := coalesce(record_attendance.check_in_at, existing.check_in_at);
  out_at := coalesce(record_attendance.check_out_at, existing.check_out_at);
  if out_at is not null then
    if in_at is null then
      raise exception 'conflict:Check in before you check out.';
    end if;
    if out_at < in_at then
      raise exception 'conflict:Check-out can''t be earlier than check-in.';
    end if;
  end if;

  -- Assignments that started by the day and had not ended before it (A9). The open one wins.
  select a.* into asg from worker_project_assignments a
  where a.worker_id = w.id and a.project_id = proj.id
    and a.status <> 'invited'
    and (coalesce(a.started_at, a.created_at) at time zone 'Asia/Kolkata')::date <= record_attendance.day
    and (a.ended_at is null or (a.ended_at at time zone 'Asia/Kolkata')::date >= record_attendance.day)
  order by (a.ended_at is null) desc, a.started_at desc nulls last
  limit 1;
  if not found then
    if exists (
      select 1 from worker_project_assignments a
      where a.worker_id = w.id and a.project_id = proj.id
        and a.status <> 'invited'
        and (coalesce(a.started_at, a.created_at) at time zone 'Asia/Kolkata')::date <= record_attendance.day
    ) then
      raise exception 'conflict:This assignment has ended, so attendance can''t be changed.';
    end if;
    raise exception 'conflict:This worker wasn''t assigned to the project on that date.';
  end if;
  -- R9: a supervisor cannot write to a day whose owning assignment has ended.
  if asg.ended_at is not null then
    raise exception 'conflict:This assignment has ended, so attendance can''t be changed.';
  end if;

  if existed then
    update worker_attendance r
    set status = record_attendance.status,
        check_in_at = in_at,
        check_out_at = out_at,
        recorded_by = 'supervisor',
        recorded_by_membership_id = membership_id,
        updated_at = now()
    where r.id = existing.id
    returning r.* into new_row;
  else
    insert into worker_attendance (
      worker_id, project_id, assignment_id, date, status, check_in_at, check_out_at,
      recorded_by, recorded_by_membership_id, created_at, updated_at
    ) values (
      w.id, proj.id, asg.id, record_attendance.day, record_attendance.status, in_at, out_at,
      'supervisor', membership_id, now(), now()
    )
    returning * into new_row;
  end if;

  return to_jsonb(new_row);
end;
$$;

-- Sets whether a worker's day is incomplete until checked out (A4). The only path
-- that changes projects.require_checkout (project.manage).
create or replace function public.set_attendance_policy(project_id uuid, require_checkout boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.has_permission(set_attendance_policy.project_id, 'project.manage') then
    raise exception 'permission:Missing permission "project.manage"';
  end if;

  update projects p
  set require_checkout = set_attendance_policy.require_checkout
  where p.id = set_attendance_policy.project_id;

  select to_jsonb(p) into result from projects p where p.id = set_attendance_policy.project_id;
  return result;
end;
$$;

-- Progress review and publication. decision is 'approve', 'request-changes' or 'reject'
-- (progress.review; a note is required for the last two), or 'publish' (customer.publish;
-- only an approved update can be published). A repeat review is a no-op (domain rule).
create or replace function public.publish_daily_progress(progress_id uuid, decision text, note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  dp daily_progress%rowtype;
  required_perm text;
  membership_id uuid;
  trimmed text := nullif(btrim(publish_daily_progress.note), '');
  next_status text;
begin
  if publish_daily_progress.decision not in ('approve', 'request-changes', 'reject', 'publish') then
    raise exception 'conflict:Choose what to do with this update.';
  end if;

  required_perm := case when publish_daily_progress.decision = 'publish'
    then 'customer.publish' else 'progress.review' end;

  select d.* into dp from daily_progress d where d.id = publish_daily_progress.progress_id;
  if not found
    or not public.has_permission(dp.project_id, required_perm)
    or not public.in_scope(dp.project_id, dp.project_unit_id, dp.stage_id, dp.trade_id)
  then
    raise exception 'permission:Missing permission "%"', required_perm;
  end if;

  select m.id into membership_id from memberships m
  where m.person_id = public.current_person_id()
    and m.project_id = dp.project_id
    and m.status = 'active'
    and required_perm = any (m.permissions)
  limit 1;

  if publish_daily_progress.decision = 'publish' then
    if dp.publication_status = 'published' then
      return to_jsonb(dp);
    end if;
    if dp.review_status <> 'approved' then
      raise exception 'conflict:Only approved updates can be published.';
    end if;

    insert into progress_publications (daily_progress_id, published_by_membership_id, published_at)
    values (dp.id, membership_id, now());

    update daily_progress d
    set publication_status = 'published'
    where d.id = dp.id
    returning d.* into dp;

    return to_jsonb(dp);
  end if;

  -- Review: only a waiting update can be reviewed; a repeat review is a no-op.
  if dp.review_status <> 'submitted' then
    return to_jsonb(dp);
  end if;
  if publish_daily_progress.decision = 'request-changes' and trimmed is null then
    raise exception 'conflict:Add a note so the worker knows what to fix.';
  end if;
  if publish_daily_progress.decision = 'reject' and trimmed is null then
    raise exception 'conflict:Add a note saying why this update is rejected.';
  end if;

  next_status := case publish_daily_progress.decision
    when 'approve' then 'approved'
    when 'reject' then 'rejected'
    else 'changes-requested'
  end;

  insert into progress_reviews (daily_progress_id, decision, note, reviewer_membership_id, reviewed_at)
  values (dp.id, publish_daily_progress.decision, trimmed, membership_id, now());

  update daily_progress d
  set review_status = next_status
  where d.id = dp.id
  returning d.* into dp;

  return to_jsonb(dp);
end;
$$;
