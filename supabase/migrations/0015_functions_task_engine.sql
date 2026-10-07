-- Task engine functions (spec B4), batch 22: createTask, assignTask,
-- acceptTaskAssignment, startTask, transitionTask, addWorkPlanItem. Message texts
-- match src/domain/constructionCommands.ts; the transition table matches
-- src/domain/taskTransitions.ts TASK_TRANSITIONS exactly (task_transition_allowed
-- below), and the in-progress path matches src/domain/workerTasks.ts
-- pathToInProgress.
--
-- Schema notes carried over from earlier batches (not introduced here):
--  - stages/trades/work_types are a shared library keyed by id only (migration
--    0014); the domain's ConstructionStage/Trade/WorkType types have no
--    projectId field either, so stage/trade matching here never filters by
--    project_id, exactly like src/domain/constructionCommands.ts
--    assertWorkTypeMatches.
--  - tasks has no updated_at, priority, work_type_id or planned_start/due_date
--    column (only what 0002/0011 added: project/unit/stage/trade links, title,
--    status, planned/completed quantity). Those input fields are accepted by
--    the TS types but silently dropped, same class of gap as task-15/17/20/21's
--    documented omissions. templateId round-trips through the existing
--    work_plan_item_id column (already how taskFromRow reads it back).
--  - work_plan_items has no plannedQuantity/templateId-bearing columns and no
--    domain-level title at all; title is filled from the work type's name so
--    the not-null column has a sensible value (the domain's WorkPlanItem type
--    has no title field to draw from).
--  - task_assignments has no assignee_type/status column -- every row is a
--    worker assignment (rows.ts taskAssignmentFromRow already documents this).
--    assign_task below implements the worker path only; a membership/
--    organization assignee is refused with a clear, undocumented-by-the-domain
--    message rather than silently doing nothing, since the table cannot store
--    it at all.
--  - assertSourceMessage's full readerMembership scope check (conversations.ts)
--    is approximated here as a plain project.read permission check, since
--    conversation commands are not wired in this batch (batch 25) and the
--    precise per-membership scope rule has no SQL port yet.

-- ── Task status state machine (src/domain/taskTransitions.ts) ─────────────────

create or replace function public.task_transition_allowed(from_status text, to_status text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select to_status = any(case from_status
    when 'draft' then array['assigned', 'cancelled']
    when 'assigned' then array['accepted', 'blocked', 'cancelled']
    when 'accepted' then array['ready', 'blocked', 'delayed', 'cancelled']
    when 'ready' then array['in-progress', 'blocked', 'delayed', 'cancelled']
    when 'in-progress' then array['submitted', 'blocked', 'delayed', 'cancelled']
    when 'submitted' then array['review', 'reopened']
    when 'review' then array['approved', 'reopened']
    when 'approved' then array['completed', 'reopened']
    when 'completed' then array['reopened']
    when 'blocked' then array['ready', 'in-progress', 'cancelled']
    when 'delayed' then array['ready', 'in-progress', 'cancelled']
    when 'reopened' then array['ready', 'in-progress', 'cancelled']
    when 'cancelled' then array['reopened']
    else array[]::text[]
  end)
$$;

-- src/domain/taskTransitions.ts SITE_TASK_STATUSES: the moves a progress.submit
-- (not task.manage) member may make.
create or replace function public.is_site_task_status(status text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select status = any(array['accepted', 'ready', 'in-progress', 'blocked'])
$$;

-- src/domain/workerTasks.ts pathToInProgress: in-progress is reachable, directly
-- or via ready, i.e. startTask only fails when neither move is legal.
create or replace function public.path_to_in_progress_ok(status text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select public.task_transition_allowed(status, 'in-progress')
    or public.task_transition_allowed(status, 'ready')
$$;

-- src/domain/constructionCommands.ts authorizeTaskMove: a task.manage member (in
-- scope) may make any legal move; a progress.submit member (in scope) may only
-- make a site move. Raises the same permission text the domain throws either way.
create or replace function public.authorize_task_move(
  project_id uuid, unit_id uuid, stage_id uuid, trade_id uuid, next_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_permission(authorize_task_move.project_id, 'task.manage')
    and public.in_scope(authorize_task_move.project_id, authorize_task_move.unit_id,
      authorize_task_move.stage_id, authorize_task_move.trade_id) then
    return;
  end if;

  if public.has_permission(authorize_task_move.project_id, 'progress.submit')
    and public.in_scope(authorize_task_move.project_id, authorize_task_move.unit_id,
      authorize_task_move.stage_id, authorize_task_move.trade_id) then
    if public.is_site_task_status(authorize_task_move.next_status) then
      return;
    end if;
    raise exception 'permission:Missing permission "task.manage" on project %', authorize_task_move.project_id;
  end if;

  raise exception 'permission:Missing permission "progress.submit" on project %', authorize_task_move.project_id;
end;
$$;

-- The signed-in worker for an organization, or a null-id row when the caller
-- isn't linked to a worker there (mirrors ctx.actor.accountType === "worker").
create or replace function public.worker_for_session(organization_id uuid)
returns workers
language sql
stable
security definer
set search_path = public
as $$
  select w.* from workers w
  where w.user_id = public.current_person_id() and w.organization_id = worker_for_session.organization_id
  limit 1
$$;

-- src/domain/constructionCommands.ts assertUnitInProject.
create or replace function public.assert_unit_in_project(project_id uuid, unit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if assert_unit_in_project.unit_id is null then
    return;
  end if;
  if not exists (
    select 1 from project_units u
    where u.id = assert_unit_in_project.unit_id and u.project_id = assert_unit_in_project.project_id
  ) then
    raise exception 'Unit % does not belong to project %', assert_unit_in_project.unit_id, assert_unit_in_project.project_id;
  end if;
end;
$$;

-- src/domain/constructionCommands.ts assertWorkTypeMatches.
create or replace function public.assert_work_type_matches(work_type_id uuid, stage_id uuid, trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from work_types w
    where w.id = assert_work_type_matches.work_type_id
      and w.stage_id = assert_work_type_matches.stage_id
      and w.trade_id = assert_work_type_matches.trade_id
  ) then
    raise exception 'Work type % does not match stage % / trade %',
      assert_work_type_matches.work_type_id, assert_work_type_matches.stage_id, assert_work_type_matches.trade_id;
  end if;
end;
$$;

-- src/domain/constructionCommands.ts assertSourceMessage, approximated (see
-- migration header: readerMembership's scope rule has no SQL port yet, so this
-- checks project.read instead of the exact per-membership scope match).
create or replace function public.assert_source_message(project_id uuid, thread_id uuid, message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  th threads%rowtype;
  msg messages%rowtype;
begin
  if assert_source_message.thread_id is null and assert_source_message.message_id is null then
    return;
  end if;

  select * into th from threads where id = assert_source_message.thread_id;
  select * into msg from messages where id = assert_source_message.message_id;
  if th.id is null or msg.id is null or msg.thread_id <> th.id then
    raise exception 'The conversation message for this record wasn''t found.';
  end if;
  if th.project_id <> assert_source_message.project_id then
    raise exception 'Message % is not in project %', assert_source_message.message_id, assert_source_message.project_id;
  end if;
  if not public.has_permission(assert_source_message.project_id, 'project.read') then
    raise exception 'permission:Missing permission "project.read" on project %', assert_source_message.project_id;
  end if;
end;
$$;

-- Adds a work plan item (task.manage, scoped to the item's own unit/stage/trade).
create or replace function public.add_work_plan_item(
  project_id uuid,
  project_unit_id uuid,
  stage_id uuid,
  trade_id uuid,
  work_type_id uuid,
  planned_start date,
  due_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row work_plan_items%rowtype;
  wt_name text;
begin
  if not (
    public.has_permission(add_work_plan_item.project_id, 'task.manage')
    and public.in_scope(add_work_plan_item.project_id, add_work_plan_item.project_unit_id,
      add_work_plan_item.stage_id, add_work_plan_item.trade_id)
  ) then
    raise exception 'permission:Missing permission "task.manage" on project %', add_work_plan_item.project_id;
  end if;

  perform public.assert_unit_in_project(add_work_plan_item.project_id, add_work_plan_item.project_unit_id);
  perform public.assert_work_type_matches(add_work_plan_item.work_type_id, add_work_plan_item.stage_id, add_work_plan_item.trade_id);

  select name into wt_name from work_types where id = add_work_plan_item.work_type_id;

  insert into work_plan_items (
    project_id, project_unit_id, stage_id, trade_id, work_type_id, title, planned_start, planned_end
  ) values (
    add_work_plan_item.project_id, add_work_plan_item.project_unit_id, add_work_plan_item.stage_id,
    add_work_plan_item.trade_id, add_work_plan_item.work_type_id, coalesce(wt_name, 'Work plan item'),
    add_work_plan_item.planned_start, add_work_plan_item.due_date
  )
  returning * into result_row;

  return to_jsonb(result_row);
end;
$$;

-- Creates a task (task.manage, scoped to the task's own unit/stage/trade).
create or replace function public.create_task(
  project_id uuid,
  project_unit_id uuid,
  stage_id uuid,
  trade_id uuid,
  work_type_id uuid,
  template_id uuid,
  title text,
  planned_quantity numeric,
  planned_quantity_unit text,
  source_thread_id uuid,
  source_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row tasks%rowtype;
begin
  if not (
    public.has_permission(create_task.project_id, 'task.manage')
    and public.in_scope(create_task.project_id, create_task.project_unit_id,
      create_task.stage_id, create_task.trade_id)
  ) then
    raise exception 'permission:Missing permission "task.manage" on project %', create_task.project_id;
  end if;

  perform public.assert_unit_in_project(create_task.project_id, create_task.project_unit_id);
  perform public.assert_work_type_matches(create_task.work_type_id, create_task.stage_id, create_task.trade_id);
  perform public.assert_source_message(create_task.project_id, create_task.source_thread_id, create_task.source_message_id);

  insert into tasks (
    project_id, work_plan_item_id, project_unit_id, stage_id, trade_id, title, status,
    planned_quantity, planned_quantity_unit, created_at
  ) values (
    create_task.project_id, create_task.template_id, create_task.project_unit_id, create_task.stage_id,
    create_task.trade_id, create_task.title, 'draft',
    create_task.planned_quantity, create_task.planned_quantity_unit, now()
  )
  returning * into result_row;

  update projects set progress = public.calculate_project_progress(create_task.project_id)
  where id = create_task.project_id;

  return to_jsonb(result_row);
end;
$$;

-- Assigns a task to a worker (task.manage, scoped to the task's own unit/stage/
-- trade). See migration header: only the worker assignee path is supported;
-- the table has no column to store a membership/organization assignee.
create or replace function public.assign_task(task_id uuid, assignee_type text, assignee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t tasks%rowtype;
  proj projects%rowtype;
  w workers%rowtype;
  existing task_assignments%rowtype;
  result_row task_assignments%rowtype;
begin
  select * into t from tasks where id = assign_task.task_id;
  if t.id is null then
    raise exception 'permission:Missing permission "task.manage"';
  end if;

  if not (
    public.has_permission(t.project_id, 'task.manage')
    and public.in_scope(t.project_id, t.project_unit_id, t.stage_id, t.trade_id)
  ) then
    raise exception 'permission:Missing permission "task.manage" on project %', t.project_id;
  end if;

  if assign_task.assignee_type <> 'worker' then
    raise exception 'Assignee type % is not supported for tasks yet', assign_task.assignee_type;
  end if;

  select * into proj from projects where id = t.project_id;

  select * into w from workers where id = assign_task.assignee_id;
  if w.id is null or w.organization_id <> proj.organization_id then
    raise exception 'Worker % is not in this organization', assign_task.assignee_id;
  end if;

  if not exists (
    select 1 from worker_project_assignments a
    where a.worker_id = assign_task.assignee_id and a.project_id = t.project_id and a.status = 'active'
  ) then
    raise exception 'Worker % is not assigned to project %', assign_task.assignee_id, t.project_id;
  end if;

  select * into existing from task_assignments ta
  where ta.task_id = assign_task.task_id and ta.worker_id = assign_task.assignee_id;
  if existing.id is not null then
    return to_jsonb(existing);
  end if;

  insert into task_assignments (project_id, task_id, worker_id, assigned_at)
  values (t.project_id, assign_task.task_id, assign_task.assignee_id, now())
  returning * into result_row;

  update tasks set status = 'assigned' where id = assign_task.task_id and status = 'draft';
  update projects set progress = public.calculate_project_progress(t.project_id) where id = t.project_id;

  return to_jsonb(result_row);
end;
$$;

-- A worker accepts an assignment on their own task (progress.submit, scoped).
-- See migration header: task_assignments has no status column, so every row is
-- already "assigned" -- the domain's `assignment.status !== "assigned"` early
-- return can never trigger here, which is the correct behaviour for this schema.
create or replace function public.accept_task_assignment(task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t tasks%rowtype;
  proj projects%rowtype;
  w workers%rowtype;
  asg task_assignments%rowtype;
begin
  select * into t from tasks where id = accept_task_assignment.task_id;
  if t.id is null then
    raise exception 'permission:Missing permission "progress.submit"';
  end if;

  select * into proj from projects where id = t.project_id;
  w := public.worker_for_session(proj.organization_id);
  if w.id is null then
    raise exception 'permission:Missing permission "progress.submit" on project %', t.project_id;
  end if;

  select * into asg from task_assignments ta where ta.task_id = t.id and ta.worker_id = w.id;
  if asg.id is null then
    raise exception 'conflict:This task isn''t assigned to you.';
  end if;

  if not (
    public.has_permission(t.project_id, 'progress.submit')
    and public.in_scope(t.project_id, t.project_unit_id, t.stage_id, t.trade_id)
  ) then
    raise exception 'permission:Missing permission "progress.submit" on project %', t.project_id;
  end if;

  if public.task_transition_allowed(t.status, 'accepted') then
    update tasks set status = 'accepted' where id = t.id;
    update projects set progress = public.calculate_project_progress(t.project_id) where id = t.project_id;
  end if;
end;
$$;

-- A worker (or a task/site manager) starts work on site: walks the legal path
-- to in-progress (src/domain/workerTasks.ts pathToInProgress).
create or replace function public.start_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t tasks%rowtype;
  proj projects%rowtype;
  w workers%rowtype;
  asg task_assignments%rowtype;
begin
  select * into t from tasks where id = start_task.task_id;
  if t.id is null then
    raise exception 'permission:Missing permission "progress.submit"';
  end if;

  perform public.authorize_task_move(t.project_id, t.project_unit_id, t.stage_id, t.trade_id, 'in-progress');

  select * into proj from projects where id = t.project_id;
  w := public.worker_for_session(proj.organization_id);
  if w.id is not null then
    select * into asg from task_assignments ta where ta.task_id = t.id and ta.worker_id = w.id;
    if asg.id is not null and t.status = 'assigned' then
      raise exception 'conflict:Accept the task before starting it.';
    end if;
  end if;

  if not public.path_to_in_progress_ok(t.status) then
    raise exception 'conflict:This task can''t be started while it is %.', t.status;
  end if;

  update tasks set status = 'in-progress' where id = t.id;
  update projects set progress = public.calculate_project_progress(t.project_id) where id = t.project_id;
end;
$$;

-- Moves a task to any legal next status (src/domain/constructionCommands.ts
-- transitionTask). The refusal text for an illegal move matches the Phase 3 fix
-- exactly: "A task can't move from X to Y."
create or replace function public.transition_task(task_id uuid, next_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t tasks%rowtype;
begin
  select * into t from tasks where id = transition_task.task_id;
  if t.id is null then
    raise exception 'permission:Missing permission "task.manage"';
  end if;

  perform public.authorize_task_move(t.project_id, t.project_unit_id, t.stage_id, t.trade_id, transition_task.next_status);

  if not public.task_transition_allowed(t.status, transition_task.next_status) then
    raise exception 'conflict:A task can''t move from % to %.', t.status, transition_task.next_status;
  end if;

  update tasks set status = transition_task.next_status where id = t.id;
  update projects set progress = public.calculate_project_progress(t.project_id) where id = t.project_id;
end;
$$;
