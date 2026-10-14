-- F1: publish_daily_progress's approve and publish paths did not match
-- src/domain/constructionCommands.ts:
--  - reviewDailyProgress (decision 'approve') adds the update's completed
--    quantity onto the linked task's completedQuantity (addQuantity: take the
--    new quantity as-is if the task has none yet; add when units match; leave
--    the task unchanged if units mismatch), then recalculates project progress.
--  - publishDailyProgress marks the chosen (non-audio) evidence
--    customer-visible so the homeowner evidence RLS policy (0005) can read it.
--
-- Adaptation (documented per the task brief, since full fidelity would require
-- porting a large amount of schema this SQL layer does not have at all yet --
-- stage codes, per-project stage baselines, and task planned/completed
-- quantity columns are not modeled anywhere in the current schema):
--  - Project progress here is the unweighted average of task completion
--    percent across the project's non-cancelled tasks (task percent =
--    completed/planned*100 when a planned quantity is set, matching units;
--    otherwise 100 for an approved/completed task, else 0). The domain's
--    calculateProjectProgress additionally weights by stage (STAGE_WEIGHTS)
--    and per-project stage baselines; that weighting has no SQL-side schema
--    to port into in this round, so it is intentionally left out.
--  - publish_daily_progress's signature is unchanged (progress_id, decision,
--    note) to avoid breaking its existing pgTAP signature assertions
--    (supabase/tests/0008_functions.sql). Instead of taking an explicit
--    evidence_ids array like the domain command, 'publish' marks every
--    non-audio evidence row linked to that daily_progress customer-visible
--    (voice notes are never shared, matching the domain's hard rule that
--    audio evidence can't be published).

alter table tasks add column planned_quantity numeric;
alter table tasks add column planned_quantity_unit text;
alter table tasks add column completed_quantity numeric;
alter table tasks add column completed_quantity_unit text;

alter table projects add column progress numeric not null default 0;

-- How complete one task is, 0-100. Mirrors src/domain/progress.ts taskPercent,
-- minus the stage-baseline weighting (see migration header).
create or replace function public.task_percent(t tasks)
returns numeric
language sql
immutable
as $$
  select case
    when t.planned_quantity is not null and t.planned_quantity > 0 then
      case
        when t.completed_quantity is null
          or t.completed_quantity_unit is distinct from t.planned_quantity_unit
        then 0
        else least(100, greatest(0, (t.completed_quantity / t.planned_quantity) * 100))
      end
    else
      case when t.status in ('approved', 'completed') then 100 else 0 end
  end
$$;

-- Recalculates and stores a project's progress as the average percent of its
-- non-cancelled tasks (see migration header for the documented simplification
-- versus src/domain/progress.ts calculateProjectProgress).
create or replace function public.recalculate_project_progress(project_id uuid)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  avg_percent numeric;
begin
  select coalesce(avg(public.task_percent(t)), 0) into avg_percent
  from tasks t
  where t.project_id = recalculate_project_progress.project_id
    and t.status <> 'cancelled';

  update projects p set progress = round(avg_percent) where p.id = recalculate_project_progress.project_id;
  return round(avg_percent);
end;
$$;

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
  task_completed numeric;
  task_unit text;
  new_completed numeric;
  new_unit text;
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

    -- Share every non-audio evidence row on this update with the homeowner.
    -- Voice notes are internal site communication and are never shared
    -- (src/domain/constructionCommands.ts publishDailyProgress).
    update evidence e
    set customer_visibility = 'customer-visible'
    where e.daily_progress_id = dp.id and e.type <> 'audio';

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

  -- Approval adds the reported quantity onto the linked task's completed
  -- quantity (src/domain/constructionCommands.ts addQuantity), then the
  -- project's stored progress figure is recalculated.
  if publish_daily_progress.decision = 'approve' and dp.task_id is not null and dp.completed_quantity is not null then
    select t.completed_quantity, t.completed_quantity_unit into task_completed, task_unit
    from tasks t where t.id = dp.task_id;

    if task_completed is null then
      new_completed := dp.completed_quantity;
      new_unit := dp.completed_quantity_unit;
    elsif task_unit is distinct from dp.completed_quantity_unit then
      -- Mismatched units: leave the task's running total unchanged (addQuantity).
      new_completed := task_completed;
      new_unit := task_unit;
    else
      new_completed := task_completed + dp.completed_quantity;
      new_unit := task_unit;
    end if;

    update tasks t
    set completed_quantity = new_completed, completed_quantity_unit = new_unit
    where t.id = dp.task_id;
  end if;

  if publish_daily_progress.decision = 'approve' then
    perform public.recalculate_project_progress(dp.project_id);
  end if;

  return to_jsonb(dp);
end;
$$;
