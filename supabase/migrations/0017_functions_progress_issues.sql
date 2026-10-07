-- Progress and issues functions (spec B4), batch 24: submitDailyProgress,
-- resubmitDailyProgress, reviewDailyProgress, publishDailyProgress, addEvidence,
-- reportIssue, addIssueEvidence, assignIssue, transitionIssue, publishIssue.
-- Message texts match src/domain/constructionCommands.ts exactly; the issue
-- state machine matches src/domain/issueTransitions.ts canTransitionIssue.
--
-- ── The publishDailyProgress / reviewDailyProgress surface mismatch ────────────
-- Migration 0008 (extended by 0011) created one SQL function,
-- publish_daily_progress(progress_id, decision, note), covering four decisions:
-- 'approve' | 'request-changes' | 'reject' | 'publish'. But the DOMAIN
-- (src/domain/constructionCommands.ts) and this app's command surface
-- (src/mock/commandSurface.ts) split that into two separate commands:
--   reviewDailyProgress(progressId, decision, note)   -- approve/request-changes/reject
--   publishDailyProgress(progressId, evidenceIds)     -- explicit evidence selection
-- This migration resolves the mismatch by matching the domain's two-command
-- shape, without discarding the existing function (0008/0011's pgTAP tests and
-- src/data/parityCheck.test.ts call it directly by its original signature, and
-- nothing requires breaking that):
--   - review_daily_progress(progress_id, decision, note) is a new, thin
--     function that REUSES publish_daily_progress's review branch by simply
--     delegating to it (no duplicated logic), after refusing the 'publish'
--     decision so review can never be used to sneak a publish through on the
--     progress.review permission.
--   - publish_daily_progress_evidence(progress_id, evidence_ids) is new and
--     DOES duplicate the publish branch's shape rather than its content: the
--     domain's publishDailyProgress takes an explicit evidence_ids array
--     (reject audio, reject an id not on this update) where the old
--     'publish' decision instead published every non-audio evidence row
--     unconditionally (documented simplification in 0011). The two are
--     genuinely different behaviour, so this is a new function, not a
--     renamed one; it is given a distinct name (rather than overloading
--     publish_daily_progress by argument types) so PostgREST's RPC dispatch
--     is never ambiguous about which overload a client meant.
-- src/data/adapter.ts's existing `publishDailyProgress` wrapper (which calls
-- the 0008 three-argument function) is kept as-is for its existing callers;
-- new wrappers `reviewDailyProgress` and `publishDailyProgress` (replacing the
-- old exported name, since commandSurface.ts's domain-shaped command now owns
-- that name) are added calling the two functions above.
-- src/data/parityCheck.test.ts step (g) is updated to call the new
-- reviewDailyProgress/publishDailyProgress wrappers instead of the old
-- combined one, so the parity check now exercises the real command surface.

-- ── Evidence gains a link to the issue it documents ────────────────────────────
-- Schema gap noted in src/data/adapter.ts's loadState comment ("issues. There
-- is no backing column for evidenceIds; it loads as []"): evidence had no way
-- to record which issue it was attached to at all (daily_progress_id exists,
-- issue_id did not). Without it, addIssueEvidence and reportIssue's own
-- evidence could be inserted but never read back against the issue. Added here
-- since this batch is the first to actually write issue evidence.
alter table evidence add column issue_id uuid references issues (id) on delete set null;

-- Evidence captured for an issue is governed by the same scope as the issue
-- (project_unit_id/task_id come from the issue, not a separate input), so no
-- RLS change is needed beyond the column: evidence_insert_capturer (0005)
-- already covers 'progress.submit' (reportIssue/addIssueEvidence's other
-- permission, issue.manage, is a project.manage-adjacent role in the seed
-- matrix and goes through these security-definer functions regardless).

-- ── Task helper (matches assertTaskInProject in src/domain/constructionCommands.ts) ──
create or replace function public.assert_task_in_project(project_id uuid, task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if assert_task_in_project.task_id is null then
    return;
  end if;
  if not exists (
    select 1 from tasks t
    where t.id = assert_task_in_project.task_id and t.project_id = assert_task_in_project.project_id
  ) then
    raise exception 'Task % does not belong to project %', assert_task_in_project.task_id, assert_task_in_project.project_id;
  end if;
end;
$$;

-- ── Issue status state machine (src/domain/issueTransitions.ts) ───────────────
create or replace function public.issue_transition_allowed(from_status text, to_status text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select to_status = any(case from_status
    when 'open' then array['in-progress', 'resolved']
    when 'in-progress' then array['open', 'resolved']
    when 'resolved' then array['closed', 'open']
    when 'closed' then array['open']
    else array[]::text[]
  end)
$$;

-- ── insert_daily_progress_row: the shared insert path for submit and resubmit ──
-- Internal helper (not meant to be called directly by clients -- the permission
-- check and every assertion live in the public wrappers below, same convention
-- as add_library_stage_row in migration 0014). Exists so resubmit_daily_progress
-- can insert its new version with version/supersedes_id set correctly from the
-- start: the daily_progress_freeze trigger (migration 0003) only allows
-- review_status/publication_status/superseded_by_id to change after insert, so
-- version and supersedes_id cannot be patched in afterward.
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

  perform public.recalculate_project_progress(insert_daily_progress_row.project_id);

  return dp;
end;
$$;

-- src/domain/taskTransitions.ts statusAfterProgressSubmit/Approval/Rejection and
-- statusAfterChangesRequested, built on task_transition_allowed (migration 0015).
create or replace function public.status_after_progress_submit(status text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when public.task_transition_allowed(status, 'review') then 'review'
    when public.task_transition_allowed(status, 'submitted') then 'submitted'
    else null
  end
$$;

create or replace function public.status_after_progress_approval(status text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  current text := status;
begin
  if public.task_transition_allowed(current, 'review') then
    current := 'review';
  end if;
  if public.task_transition_allowed(current, 'approved') then
    current := 'approved';
  end if;
  return current;
end;
$$;

create or replace function public.status_after_progress_rejection(status text)
returns text
language sql
stable
set search_path = public
as $$
  select case when public.task_transition_allowed(status, 'reopened') then 'reopened' else null end
$$;

create or replace function public.status_after_changes_requested(status text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  current text := status;
begin
  if public.task_transition_allowed(current, 'reopened') then
    current := 'reopened';
  end if;
  if public.task_transition_allowed(current, 'in-progress') then
    current := 'in-progress';
  end if;
  return case when current = status then null else current end;
end;
$$;

-- ── submitDailyProgress ────────────────────────────────────────────────────────
create or replace function public.submit_daily_progress(
  project_id uuid,
  project_unit_id uuid,
  task_id uuid,
  stage_id uuid,
  trade_id uuid,
  work_type_id uuid,
  workers_present integer,
  progress_after numeric,
  completed_quantity numeric,
  completed_quantity_unit text,
  today_summary text,
  tomorrow_plan text,
  yesterday_summary text,
  blocker_summary text,
  evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  submitter_membership_id uuid;
  proj projects%rowtype;
  t tasks%rowtype;
  w workers%rowtype;
  dp daily_progress%rowtype;
begin
  if not (
    public.has_permission(submit_daily_progress.project_id, 'progress.submit')
    and public.in_scope(submit_daily_progress.project_id, submit_daily_progress.project_unit_id,
      submit_daily_progress.stage_id, submit_daily_progress.trade_id)
  ) then
    raise exception 'permission:Missing permission "progress.submit" on project %', submit_daily_progress.project_id;
  end if;

  select p.* into proj from projects p where p.id = submit_daily_progress.project_id;
  if not found then
    raise exception 'Unknown project %', submit_daily_progress.project_id;
  end if;

  select m.id into submitter_membership_id from memberships m
  where m.person_id = public.current_person_id()
    and m.project_id = submit_daily_progress.project_id
    and m.status = 'active'
    and 'progress.submit' = any (m.permissions)
  limit 1;

  perform public.assert_unit_in_project(submit_daily_progress.project_id, submit_daily_progress.project_unit_id);
  perform public.assert_task_in_project(submit_daily_progress.project_id, submit_daily_progress.task_id);
  perform public.assert_work_type_matches(submit_daily_progress.work_type_id, submit_daily_progress.stage_id, submit_daily_progress.trade_id);

  if submit_daily_progress.task_id is not null then
    select * into t from tasks where id = submit_daily_progress.task_id;
    if t.project_unit_id is distinct from submit_daily_progress.project_unit_id then
      raise exception 'Task % is not at unit %', submit_daily_progress.task_id, submit_daily_progress.project_unit_id;
    end if;
  end if;

  -- Workers log progress only on tasks assigned to them, and their evidence is
  -- always attributed to them (src/domain/constructionCommands.ts, workerOnTask).
  w := public.worker_for_session(proj.organization_id);
  if w.id is not null then
    if submit_daily_progress.task_id is null then
      raise exception 'conflict:Choose the task this update is for.';
    end if;
    if not exists (
      select 1 from task_assignments ta
      where ta.task_id = submit_daily_progress.task_id and ta.worker_id = w.id
    ) then
      raise exception 'conflict:This task isn''t assigned to you.';
    end if;
  end if;

  if submit_daily_progress.completed_quantity is not null and submit_daily_progress.completed_quantity < 0 then
    raise exception 'conflict:Enter the quantity completed today as a number, 0 or more.';
  end if;

  dp := public.insert_daily_progress_row(
    submit_daily_progress.project_id, submit_daily_progress.project_unit_id, submit_daily_progress.task_id,
    submit_daily_progress.stage_id, submit_daily_progress.trade_id, submit_daily_progress.work_type_id,
    submitter_membership_id, w.id, submit_daily_progress.workers_present, submit_daily_progress.progress_after,
    submit_daily_progress.completed_quantity, submit_daily_progress.completed_quantity_unit,
    submit_daily_progress.today_summary, submit_daily_progress.tomorrow_plan,
    submit_daily_progress.yesterday_summary, submit_daily_progress.blocker_summary,
    submit_daily_progress.evidence, 1, null
  );

  return to_jsonb(dp);
end;
$$;

-- ── resubmitDailyProgress ──────────────────────────────────────────────────────
-- Builds the new version through the same insert path as submit (so the task
-- move and evidence handling match exactly), then links the two: the earlier
-- version is kept as it was, marked superseded (src/domain/constructionCommands.ts).
create or replace function public.resubmit_daily_progress(
  previous_id uuid,
  workers_present integer,
  progress_after numeric,
  completed_quantity numeric,
  completed_quantity_unit text,
  today_summary text,
  tomorrow_plan text,
  yesterday_summary text,
  blocker_summary text,
  keep_evidence_ids uuid[],
  evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  previous daily_progress%rowtype;
  proj projects%rowtype;
  submitter_membership_id uuid;
  keep_id uuid;
  w workers%rowtype;
  dp daily_progress%rowtype;
begin
  select * into previous from daily_progress where id = resubmit_daily_progress.previous_id;
  if not found then
    raise exception 'permission:Missing permission "progress.submit"';
  end if;

  if not (
    public.has_permission(previous.project_id, 'progress.submit')
    and public.in_scope(previous.project_id, previous.project_unit_id, previous.stage_id, previous.trade_id)
  ) then
    raise exception 'permission:Missing permission "progress.submit" on project %', previous.project_id;
  end if;

  select m.id into submitter_membership_id from memberships m
  where m.person_id = public.current_person_id()
    and m.project_id = previous.project_id
    and m.status = 'active'
    and 'progress.submit' = any (m.permissions)
  limit 1;

  if submitter_membership_id is distinct from previous.submitted_by_membership_id then
    raise exception 'permission:Missing permission "progress.submit" on project %', previous.project_id;
  end if;

  if previous.review_status <> 'changes-requested' then
    raise exception 'conflict:Only an update sent back for changes can be resubmitted.';
  end if;

  if resubmit_daily_progress.keep_evidence_ids is not null then
    foreach keep_id in array resubmit_daily_progress.keep_evidence_ids loop
      if not exists (select 1 from evidence e where e.id = keep_id and e.daily_progress_id = previous.id) then
        raise exception 'Evidence % is not on update %', keep_id, previous.id;
      end if;
    end loop;
  end if;

  -- Same worker/task-assignment check submitDailyProgress makes (reused here
  -- since resubmitDailyProgress builds its new version through submitDailyProgress
  -- in the domain). The task is fixed to the previous version's, never user-supplied.
  select * into proj from projects where id = previous.project_id;
  w := public.worker_for_session(proj.organization_id);
  if w.id is not null then
    if previous.task_id is null then
      raise exception 'conflict:Choose the task this update is for.';
    end if;
    if not exists (
      select 1 from task_assignments ta where ta.task_id = previous.task_id and ta.worker_id = w.id
    ) then
      raise exception 'conflict:This task isn''t assigned to you.';
    end if;
  end if;

  if resubmit_daily_progress.completed_quantity is not null and resubmit_daily_progress.completed_quantity < 0 then
    raise exception 'conflict:Enter the quantity completed today as a number, 0 or more.';
  end if;

  dp := public.insert_daily_progress_row(
    previous.project_id, previous.project_unit_id, previous.task_id, previous.stage_id,
    previous.trade_id, previous.work_type_id, submitter_membership_id, w.id,
    resubmit_daily_progress.workers_present, resubmit_daily_progress.progress_after,
    resubmit_daily_progress.completed_quantity, resubmit_daily_progress.completed_quantity_unit,
    resubmit_daily_progress.today_summary, resubmit_daily_progress.tomorrow_plan,
    resubmit_daily_progress.yesterday_summary, resubmit_daily_progress.blocker_summary,
    resubmit_daily_progress.evidence, previous.version + 1, previous.id
  );

  -- Evidence carried over from the previous version now belongs to the new one.
  if resubmit_daily_progress.keep_evidence_ids is not null then
    update evidence set daily_progress_id = dp.id where id = any(resubmit_daily_progress.keep_evidence_ids);
  end if;

  update daily_progress
  set review_status = 'superseded', superseded_by_id = dp.id
  where id = previous.id;

  return to_jsonb(dp);
end;
$$;

-- ── reviewDailyProgress ────────────────────────────────────────────────────────
-- Delegates to publish_daily_progress's review branch (0008/0011): same checks,
-- same effects (task move, quantity roll-up, project progress recalculation).
-- See the migration header for why this function exists alongside the old one.
-- src/domain/constructionCommands.ts reviewDailyProgress returns void (Command<void>);
-- the effects (review row, task move, quantity roll-up, project recalculation)
-- all happen inside the delegated call.
create or replace function public.review_daily_progress(progress_id uuid, decision text, note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if review_daily_progress.decision = 'publish' then
    raise exception 'conflict:Choose what to do with this update.';
  end if;
  perform public.publish_daily_progress(review_daily_progress.progress_id, review_daily_progress.decision, review_daily_progress.note);
end;
$$;

-- ── publishDailyProgress(progressId, evidenceIds) ──────────────────────────────
-- Shares an approved update with the homeowner. Only the chosen evidence becomes
-- customer-visible; voice notes and review notes never do (matches
-- src/domain/constructionCommands.ts publishDailyProgress exactly, including its
-- explicit evidence_ids selection -- unlike the old publish_daily_progress's
-- 'publish' decision, which shares every non-audio evidence row unconditionally).
-- src/domain/constructionCommands.ts publishDailyProgress returns void (Command<void>).
create or replace function public.publish_daily_progress_evidence(progress_id uuid, evidence_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dp daily_progress%rowtype;
  membership_id uuid;
  chosen uuid[];
  ev evidence%rowtype;
  ev_id uuid;
begin
  select d.* into dp from daily_progress d where d.id = publish_daily_progress_evidence.progress_id;
  if not found then
    raise exception 'permission:Missing permission "customer.publish"';
  end if;
  if not (
    public.has_permission(dp.project_id, 'customer.publish')
    and public.in_scope(dp.project_id, dp.project_unit_id, dp.stage_id, dp.trade_id)
  ) then
    raise exception 'permission:Missing permission "customer.publish" on project %', dp.project_id;
  end if;

  if dp.publication_status = 'published' then
    return;
  end if;
  if dp.review_status <> 'approved' then
    raise exception 'conflict:Only approved updates can be published.';
  end if;

  select coalesce(array_agg(distinct x), '{}'::uuid[]) into chosen
  from unnest(coalesce(publish_daily_progress_evidence.evidence_ids, '{}'::uuid[])) as x;

  foreach ev_id in array chosen loop
    select * into ev from evidence where id = ev_id;
    if ev.id is null or ev.daily_progress_id is distinct from dp.id then
      raise exception 'Evidence % is not on update %', ev_id, dp.id;
    end if;
    if ev.type = 'audio' then
      raise exception 'conflict:Voice notes can''t be shared with the homeowner.';
    end if;
  end loop;

  select m.id into membership_id from memberships m
  where m.person_id = public.current_person_id()
    and m.project_id = dp.project_id
    and m.status = 'active'
    and 'customer.publish' = any (m.permissions)
  limit 1;

  insert into progress_publications (daily_progress_id, published_by_membership_id, published_at)
  values (dp.id, membership_id, now());

  if array_length(chosen, 1) > 0 then
    update evidence e set customer_visibility = 'customer-visible' where e.id = any(chosen);
  end if;

  update daily_progress d
  set publication_status = 'published'
  where d.id = dp.id;
end;
$$;

-- ── addEvidence ────────────────────────────────────────────────────────────────
create or replace function public.add_evidence(
  project_id uuid,
  project_unit_id uuid,
  task_id uuid,
  daily_progress_id uuid,
  type text,
  url text,
  thumbnail_url text,
  caption text,
  captured_by_worker_id uuid,
  customer_visibility text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t tasks%rowtype;
  target_unit uuid;
  target_stage uuid;
  target_trade uuid;
  author_membership_id uuid;
  row_result evidence%rowtype;
begin
  -- Evidence takes the scope of the task it is attached to, else its unit
  -- (src/domain/constructionCommands.ts addEvidence, taskTarget).
  if add_evidence.task_id is not null then
    select * into t from tasks where id = add_evidence.task_id;
    target_unit := t.project_unit_id;
    target_stage := t.stage_id;
    target_trade := t.trade_id;
  else
    target_unit := add_evidence.project_unit_id;
  end if;

  if not (
    public.has_permission(add_evidence.project_id, 'evidence.capture')
    and public.in_scope(add_evidence.project_id, target_unit, target_stage, target_trade)
  ) then
    raise exception 'permission:Missing permission "evidence.capture" on project %', add_evidence.project_id;
  end if;

  perform public.assert_unit_in_project(add_evidence.project_id, add_evidence.project_unit_id);
  perform public.assert_task_in_project(add_evidence.project_id, add_evidence.task_id);

  select m.id into author_membership_id from memberships m
  where m.person_id = public.current_person_id()
    and m.project_id = add_evidence.project_id
    and m.status = 'active'
    and 'evidence.capture' = any (m.permissions)
  limit 1;

  insert into evidence (
    project_id, project_unit_id, task_id, daily_progress_id, type, url, thumbnail_url, caption,
    captured_by_membership_id, captured_by_worker_id, captured_at, customer_visibility
  ) values (
    add_evidence.project_id, add_evidence.project_unit_id, add_evidence.task_id, add_evidence.daily_progress_id,
    add_evidence.type, add_evidence.url, add_evidence.thumbnail_url, add_evidence.caption,
    author_membership_id, add_evidence.captured_by_worker_id, now(),
    coalesce(add_evidence.customer_visibility, 'review-required')
  )
  returning * into row_result;

  return to_jsonb(row_result);
end;
$$;

-- ── reportIssue ────────────────────────────────────────────────────────────────
-- Reporting needs progress.submit OR issue.manage on the issue's location
-- (src/domain/permissions.ts ISSUE_REPORT_PERMISSIONS). The location comes from
-- the linked task, else the linked progress record, else the input.
create or replace function public.report_issue(
  project_id uuid,
  project_unit_id uuid,
  task_id uuid,
  daily_progress_id uuid,
  title text,
  description text,
  severity text,
  evidence jsonb,
  source_thread_id uuid,
  source_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t tasks%rowtype;
  dp daily_progress%rowtype;
  target_unit uuid;
  target_stage uuid;
  target_trade uuid;
  reporter_membership_id uuid;
  trimmed_title text;
  issue_row issues%rowtype;
  item jsonb;
begin
  if report_issue.task_id is not null then
    select * into t from tasks where id = report_issue.task_id;
  end if;
  if report_issue.daily_progress_id is not null then
    select * into dp from daily_progress where id = report_issue.daily_progress_id;
  end if;

  target_unit := coalesce(report_issue.project_unit_id, t.project_unit_id, dp.project_unit_id);
  target_stage := coalesce(t.stage_id, dp.stage_id);
  target_trade := coalesce(t.trade_id, dp.trade_id);

  if not (
    (public.has_permission(report_issue.project_id, 'progress.submit')
      or public.has_permission(report_issue.project_id, 'issue.manage'))
    and public.in_scope(report_issue.project_id, target_unit, target_stage, target_trade)
  ) then
    raise exception 'permission:Missing permission "progress.submit" on project %', report_issue.project_id;
  end if;

  trimmed_title := nullif(btrim(report_issue.title), '');
  if trimmed_title is null then
    raise exception 'Give the issue a title.';
  end if;

  perform public.assert_task_in_project(report_issue.project_id, report_issue.task_id);
  if report_issue.daily_progress_id is not null and (dp.id is null or dp.project_id <> report_issue.project_id) then
    raise exception 'Progress record % does not belong to project %', report_issue.daily_progress_id, report_issue.project_id;
  end if;
  perform public.assert_unit_in_project(report_issue.project_id, target_unit);
  if t.id is not null and report_issue.project_unit_id is not null and report_issue.project_unit_id <> t.project_unit_id then
    raise exception 'Task % is not at unit %', t.id, report_issue.project_unit_id;
  end if;
  perform public.assert_source_message(report_issue.project_id, report_issue.source_thread_id, report_issue.source_message_id);

  select m.id into reporter_membership_id from memberships m
  where m.person_id = public.current_person_id()
    and m.project_id = report_issue.project_id
    and m.status = 'active'
    and (
      'progress.submit' = any (m.permissions) or 'issue.manage' = any (m.permissions)
    )
  limit 1;

  insert into issues (
    project_id, project_unit_id, stage_id, trade_id, task_id, daily_progress_id,
    title, description, severity, status, customer_visible, created_by_membership_id, created_at
  ) values (
    report_issue.project_id, target_unit, target_stage, target_trade, report_issue.task_id,
    report_issue.daily_progress_id, trimmed_title, trim(both from coalesce(report_issue.description, '')),
    report_issue.severity, 'open', false, reporter_membership_id, now()
  )
  returning * into issue_row;

  -- Issue photos stay private and are not tied to the daily-progress record, so
  -- approving that record cannot publish them to the customer.
  if report_issue.evidence is not null then
    for item in select * from jsonb_array_elements(report_issue.evidence) loop
      insert into evidence (
        project_id, project_unit_id, task_id, issue_id, type, url, thumbnail_url, caption,
        captured_by_membership_id, captured_at, customer_visibility
      ) values (
        report_issue.project_id, target_unit, report_issue.task_id, issue_row.id,
        item ->> 'type', item ->> 'url', item ->> 'thumbnailUrl', item ->> 'caption',
        reporter_membership_id, now(), 'private'
      );
    end loop;
  end if;

  return to_jsonb(issue_row);
end;
$$;

-- ── assignIssue ────────────────────────────────────────────────────────────────
-- src/domain/constructionCommands.ts assignIssue returns void (Command<void>).
create or replace function public.assign_issue(issue_id uuid, membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  issue_row issues%rowtype;
  assignee memberships%rowtype;
begin
  select * into issue_row from issues where id = assign_issue.issue_id;
  if not found then
    raise exception 'permission:Missing permission "issue.manage"';
  end if;

  if not (
    public.has_permission(issue_row.project_id, 'issue.manage')
    and public.in_scope(issue_row.project_id, issue_row.project_unit_id, issue_row.stage_id, issue_row.trade_id)
  ) then
    raise exception 'permission:Missing permission "issue.manage" on project %', issue_row.project_id;
  end if;

  if issue_row.status = 'closed' then
    raise exception 'conflict:Reopen this issue before assigning it.';
  end if;

  if assign_issue.membership_id is not null then
    select * into assignee from memberships where id = assign_issue.membership_id;
    if assignee.id is null or assignee.project_id <> issue_row.project_id or assignee.status <> 'active' then
      raise exception 'Membership % cannot take issues on this project', assign_issue.membership_id;
    end if;
  end if;

  update issues
  set assigned_membership_id = assign_issue.membership_id, updated_at = now()
  where id = assign_issue.issue_id;
end;
$$;

-- ── transitionIssue ────────────────────────────────────────────────────────────
-- src/domain/constructionCommands.ts transitionIssue returns void (Command<void>).
create or replace function public.transition_issue(issue_id uuid, next_status text, resolution_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  issue_row issues%rowtype;
begin
  select * into issue_row from issues where id = transition_issue.issue_id;
  if not found then
    raise exception 'permission:Missing permission "issue.manage"';
  end if;

  if not (
    public.has_permission(issue_row.project_id, 'issue.manage')
    and public.in_scope(issue_row.project_id, issue_row.project_unit_id, issue_row.stage_id, issue_row.trade_id)
  ) then
    raise exception 'permission:Missing permission "issue.manage" on project %', issue_row.project_id;
  end if;

  if not public.issue_transition_allowed(issue_row.status, transition_issue.next_status) then
    raise exception 'conflict:An issue can''t move from % to %.', issue_row.status, transition_issue.next_status;
  end if;

  update issues as i
  set status = transition_issue.next_status,
      updated_at = now(),
      resolved_at = case
        when transition_issue.next_status = 'resolved' then now()
        when transition_issue.next_status = 'open' then null
        else i.resolved_at end,
      resolution_note = case
        when transition_issue.next_status = 'resolved' then nullif(btrim(transition_issue.resolution_note), '')
        when transition_issue.next_status = 'open' then null
        else i.resolution_note end,
      closed_at = case
        when transition_issue.next_status = 'closed' then now()
        when transition_issue.next_status = 'open' then null
        else i.closed_at end
  where i.id = transition_issue.issue_id;
end;
$$;

-- ── addIssueEvidence ───────────────────────────────────────────────────────────
-- Anyone who can report may add (ISSUE_REPORT_PERMISSIONS: progress.submit OR
-- issue.manage), scoped to the issue's own location.
create or replace function public.add_issue_evidence(issue_id uuid, items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  issue_row issues%rowtype;
  author_membership_id uuid;
  item jsonb;
  inserted jsonb := '[]'::jsonb;
  row_result evidence%rowtype;
begin
  select * into issue_row from issues where id = add_issue_evidence.issue_id;
  if not found then
    raise exception 'permission:Missing permission "progress.submit"';
  end if;

  if not (
    (public.has_permission(issue_row.project_id, 'progress.submit')
      or public.has_permission(issue_row.project_id, 'issue.manage'))
    and public.in_scope(issue_row.project_id, issue_row.project_unit_id, issue_row.stage_id, issue_row.trade_id)
  ) then
    raise exception 'permission:Missing permission "progress.submit" on project %', issue_row.project_id;
  end if;

  if issue_row.status = 'closed' then
    raise exception 'conflict:Reopen this issue before adding evidence.';
  end if;

  select m.id into author_membership_id from memberships m
  where m.person_id = public.current_person_id()
    and m.project_id = issue_row.project_id
    and m.status = 'active'
    and ('progress.submit' = any (m.permissions) or 'issue.manage' = any (m.permissions))
  limit 1;

  for item in select * from jsonb_array_elements(coalesce(add_issue_evidence.items, '[]'::jsonb)) loop
    insert into evidence (
      project_id, project_unit_id, task_id, issue_id, type, url, thumbnail_url, caption,
      captured_by_membership_id, captured_at, customer_visibility
    ) values (
      issue_row.project_id, issue_row.project_unit_id, issue_row.task_id, issue_row.id,
      item ->> 'type', item ->> 'url', item ->> 'thumbnailUrl', item ->> 'caption',
      author_membership_id, now(), 'private'
    )
    returning * into row_result;
    inserted := inserted || to_jsonb(row_result);
  end loop;

  update issues set updated_at = now() where id = add_issue_evidence.issue_id;

  return inserted;
end;
$$;

-- ── publishIssue ───────────────────────────────────────────────────────────────
-- Shares (or hides) one issue with the homeowner. Independent of status.
create or replace function public.publish_issue(issue_id uuid, visible boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  issue_row issues%rowtype;
begin
  select * into issue_row from issues where id = publish_issue.issue_id;
  if not found then
    raise exception 'permission:Missing permission "customer.publish"';
  end if;

  if not (
    public.has_permission(issue_row.project_id, 'customer.publish')
    and public.in_scope(issue_row.project_id, issue_row.project_unit_id, issue_row.stage_id, issue_row.trade_id)
  ) then
    raise exception 'permission:Missing permission "customer.publish" on project %', issue_row.project_id;
  end if;

  if issue_row.customer_visible = publish_issue.visible then
    return to_jsonb(issue_row);
  end if;

  update issues
  set customer_visible = publish_issue.visible, updated_at = now()
  where id = publish_issue.issue_id
  returning * into issue_row;

  return to_jsonb(issue_row);
end;
$$;
