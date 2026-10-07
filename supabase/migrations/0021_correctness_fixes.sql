-- Task 28: fix round for the four CORRECTNESS findings (C1-C4) from the final
-- whole-branch SQL-layer review (progress.md "FINAL SQL-LAYER REVIEW").
--
-- C1: review_daily_progress (via publish_daily_progress's review branch, 0011)
-- never moved the linked task's status on approve/reject/request-changes. The
-- ported helpers status_after_progress_approval / status_after_progress_rejection
-- / status_after_changes_requested (migration 0017) existed but were never
-- called. A reviewed task stayed in 'review'/'submitted' forever in supabase
-- mode. Fixed by wiring the three helpers into publish_daily_progress's review
-- branch, exactly as src/domain/constructionCommands.ts reviewDailyProgress
-- does (statusAfterProgressApproval/Rejection/ChangesRequested).
--
-- C2: project progress was computed two different ways -- recalculate_project_progress
-- (0011, unweighted average of task percent, called by submit/publish/review)
-- and calculate_project_progress (0014, stage-weighted with baselines, called by
-- every task-engine function). projects.progress therefore depended on whichever
-- function last ran, not on actual project state. Fixed by deleting
-- recalculate_project_progress (and its single-arg task_percent(tasks) helper,
-- which nothing else used) and routing publish_daily_progress and
-- insert_daily_progress_row through calculate_project_progress instead, the same
-- function every task-engine command already uses. Also: src/domain/constructionCommands.ts
-- reviewDailyProgress recalculates progress after EVERY decision ("every decision
-- can change a task ... so the official figure is recalculated each time"), not
-- only approve -- publish_daily_progress's review branch now matches that too.
--
-- C3: calculate_project_progress and set_stage_baselines (0014) only matched
-- stages with s.project_id = pid. But migration 0014 itself turned stages into a
-- shared library (project_id nullable), and the domain's addLibraryStage /
-- add_library_stage create stages with no project at all -- the real production
-- shape. In real use, every stage is library-wide (project_id null), so the old
-- filter matched zero stages: calculate_project_progress always returned 0, and
-- set_stage_baselines always refused with "Unknown stage". The 0014/0015 pgTAP
-- tests didn't catch this because their fixtures used project-scoped stages (the
-- pre-correction shape). Fixed by matching "library or this project" everywhere
-- a stage is looked up by these two functions: s.project_id is null or
-- s.project_id = pid (no existing in_scope()-style helper covers stages
-- specifically, so this is inlined exactly like that pattern).
--
-- C4: create_task (0015) wrote its template_id argument into tasks.work_plan_item_id,
-- a foreign key to work_plan_items. But src/domain/models.ts's Task.templateId
-- references a TaskTemplate (task_templates table), a different concept entirely
-- from a WorkPlanItem -- CreateTaskModal.tsx:85 passes
-- state.taskTemplates.find(...).id, a task_templates row id. Since library task
-- templates are never rows in work_plan_items, every real call 23503'd. The
-- 0015 pgTAP tests only ever passed template_id = null, so this never
-- surfaced. Fixed at the column level: work_plan_item_id's foreign key is
-- retargeted from work_plan_items(id) to task_templates(id), matching what the
-- column has actually stored since 0015 (nothing else reads this column as a
-- real work_plan_items reference -- grep confirms the only join against it is
-- taskFromRow's templateId mapping in src/data/rows.ts, which already treats it
-- as a template id). This needs no TypeScript change: the adapter already sends
-- a task_templates id through the existing `template_id` RPC argument name.

-- ── C4: retarget the FK ─────────────────────────────────────────────────────
alter table tasks drop constraint tasks_work_plan_item_id_fkey;
alter table tasks add constraint tasks_work_plan_item_id_fkey
  foreign key (work_plan_item_id) references task_templates (id) on delete set null;

-- ── C2: delete the duplicate, unweighted progress function ─────────────────
drop function if exists public.recalculate_project_progress(uuid);
drop function if exists public.task_percent(tasks);

-- ── C3: stages are a shared library (project_id null) or project-scoped ────
create or replace function public.calculate_project_progress(project_id uuid)
returns integer language plpgsql stable set search_path = public
as $$
declare
  baselines jsonb;
  total numeric := 0;
  stage record;
  weight integer;
  task_count integer;
  task_avg numeric;
  base numeric;
  percent numeric;
begin
  select p.stage_baselines into baselines from projects p where p.id = calculate_project_progress.project_id;
  if baselines is null then baselines := '{}'::jsonb; end if;

  for stage in
    select s.id, s.code from stages s
    where s.project_id is null or s.project_id = calculate_project_progress.project_id
  loop
    weight := public.stage_weight(stage.code);
    if weight = 0 then
      continue;
    end if;

    select count(*), coalesce(avg(public.task_percent(
        t.planned_quantity, t.planned_quantity_unit, t.completed_quantity, t.completed_quantity_unit, t.status)), 0)
      into task_count, task_avg
      from tasks t
      where t.project_id = calculate_project_progress.project_id
        and t.stage_id = stage.id
        and t.status <> 'cancelled';

    base := least(100, greatest(0, coalesce((baselines ->> stage.id::text)::numeric, 0)));
    if task_count = 0 then
      percent := base;
    else
      percent := base + (100 - base) * task_avg / 100;
    end if;
    total := total + (weight * percent) / 100;
  end loop;

  return round(least(100, greatest(0, total)));
end;
$$;

create or replace function public.set_stage_baselines(project_id uuid, baselines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proj projects%rowtype;
  entry record;
begin
  if not public.has_permission(set_stage_baselines.project_id, 'project.manage') then
    raise exception 'permission:Missing permission "project.manage" on project %', set_stage_baselines.project_id;
  end if;

  select p.* into proj from projects p where p.id = set_stage_baselines.project_id;
  if not found then
    raise exception 'Unknown project %', set_stage_baselines.project_id;
  end if;

  for entry in select e.k as key, e.v as val from jsonb_each_text(set_stage_baselines.baselines) as e(k, v) loop
    if not exists (
      select 1 from stages s
      where s.id = entry.key::uuid
        and (s.project_id is null or s.project_id = set_stage_baselines.project_id)
    ) then
      raise exception 'Unknown stage %', entry.key;
    end if;
    if entry.val::numeric < 0 or entry.val::numeric > 100 then
      raise exception 'conflict:Stage baselines must be between 0 and 100.';
    end if;
  end loop;

  update projects p
  set stage_baselines = set_stage_baselines.baselines
  where p.id = set_stage_baselines.project_id;

  update projects p
  set progress = public.calculate_project_progress(set_stage_baselines.project_id)
  where p.id = set_stage_baselines.project_id
  returning p.* into proj;

  return to_jsonb(proj);
end;
$$;

-- ── C1 + C2: review_daily_progress now moves the task status, and always
-- recalculates progress through the single stage-weighted function ─────────
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

  -- C1: move the linked task's status, matching
  -- src/domain/taskTransitions.ts statusAfterProgressApproval /
  -- statusAfterProgressRejection / statusAfterChangesRequested exactly (ported
  -- as status_after_progress_approval / status_after_progress_rejection /
  -- status_after_changes_requested in migration 0017, but never called from
  -- here before this fix).
  if dp.task_id is not null then
    if publish_daily_progress.decision = 'approve' then
      update tasks set status = public.status_after_progress_approval(status) where id = dp.task_id;
    elsif publish_daily_progress.decision = 'reject' then
      update tasks set status = coalesce(public.status_after_progress_rejection(status), status) where id = dp.task_id;
    else
      update tasks set status = coalesce(public.status_after_changes_requested(status), status) where id = dp.task_id;
    end if;
  end if;

  -- Approval adds the reported quantity onto the linked task's completed
  -- quantity (src/domain/constructionCommands.ts addQuantity: take the new
  -- quantity as-is if the task has none yet; add when units match; leave the
  -- task unchanged if units mismatch).
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

  -- C2: every review decision can move a task (approve completes it,
  -- reject/request-changes reopen it), so the official progress figure is
  -- recalculated after each one (src/domain/constructionCommands.ts
  -- reviewDailyProgress: "Every decision can change a task ... so the official
  -- figure is recalculated each time"), through the SAME stage-weighted
  -- calculate_project_progress (0014) every task-engine function already uses
  -- -- not the deleted, unweighted recalculate_project_progress.
  update projects set progress = public.calculate_project_progress(dp.project_id) where id = dp.project_id;

  return to_jsonb(dp);
end;
$$;

-- ── C2: submit/resubmit also route through the single progress function ────
create or replace function public.insert_daily_progress_row(
  project_id uuid,
  project_unit_id uuid,
  task_id uuid,
  stage_id uuid,
  trade_id uuid,
  work_type_id uuid,
  submitted_by_membership_id uuid,
  worker_id uuid,
  workers_present integer,
  progress_after numeric,
  completed_quantity numeric,
  completed_quantity_unit text,
  today_summary text,
  tomorrow_plan text,
  yesterday_summary text,
  blocker_summary text,
  evidence jsonb,
  version integer,
  supersedes_id uuid
)
returns daily_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  proj projects%rowtype;
  t tasks%rowtype;
  dp daily_progress%rowtype;
  item jsonb;
  ev_type text;
  progress_before numeric;
  next_status text;
begin
  select * into proj from projects where id = insert_daily_progress_row.project_id;

  if insert_daily_progress_row.task_id is not null then
    select * into t from tasks where id = insert_daily_progress_row.task_id;
  end if;

  -- Only a submitter who reports project % records a before/after (matches
  -- src/domain/constructionCommands.ts submitDailyProgress).
  if insert_daily_progress_row.progress_after is not null then
    progress_before := proj.progress;
  end if;

  insert into daily_progress (
    project_id, project_unit_id, task_id, stage_id, trade_id, work_type_id, date,
    workers_present, planned_quantity, planned_quantity_unit, completed_quantity,
    completed_quantity_unit, progress_before, progress_after, yesterday_summary,
    today_summary, tomorrow_plan, blocker_summary, submitted_by_membership_id,
    submitted_at, review_status, publication_status, version, supersedes_id, created_at
  ) values (
    insert_daily_progress_row.project_id, insert_daily_progress_row.project_unit_id,
    insert_daily_progress_row.task_id, insert_daily_progress_row.stage_id,
    insert_daily_progress_row.trade_id, insert_daily_progress_row.work_type_id,
    (now() at time zone 'Asia/Kolkata')::date,
    insert_daily_progress_row.workers_present, t.planned_quantity, t.planned_quantity_unit,
    insert_daily_progress_row.completed_quantity, insert_daily_progress_row.completed_quantity_unit,
    progress_before, insert_daily_progress_row.progress_after, insert_daily_progress_row.yesterday_summary,
    insert_daily_progress_row.today_summary, insert_daily_progress_row.tomorrow_plan,
    insert_daily_progress_row.blocker_summary, insert_daily_progress_row.submitted_by_membership_id,
    now(), 'submitted', 'private', insert_daily_progress_row.version, insert_daily_progress_row.supersedes_id, now()
  )
  returning * into dp;

  if insert_daily_progress_row.evidence is not null then
    for item in select * from jsonb_array_elements(insert_daily_progress_row.evidence) loop
      ev_type := item ->> 'type';
      insert into evidence (
        project_id, project_unit_id, task_id, daily_progress_id, type, url, thumbnail_url,
        caption, captured_by_membership_id, captured_by_worker_id, captured_at, customer_visibility
      ) values (
        insert_daily_progress_row.project_id, insert_daily_progress_row.project_unit_id,
        insert_daily_progress_row.task_id, dp.id, ev_type, item ->> 'url', item ->> 'thumbnailUrl',
        item ->> 'caption', insert_daily_progress_row.submitted_by_membership_id,
        coalesce((item ->> 'capturedByWorkerId')::uuid, insert_daily_progress_row.worker_id),
        now(),
        -- Voice notes are internal site communication; they never go to the
        -- customer. Photos, video and documents wait for review.
        case when ev_type = 'audio' then 'private' else 'review-required' end
      );
    end loop;
  end if;

  if insert_daily_progress_row.task_id is not null then
    next_status := public.status_after_progress_submit(t.status);
    if next_status is not null then
      update tasks set status = next_status where id = t.id;
    end if;
  end if;

  update projects set progress = public.calculate_project_progress(insert_daily_progress_row.project_id)
  where id = insert_daily_progress_row.project_id;

  return dp;
end;
$$;
