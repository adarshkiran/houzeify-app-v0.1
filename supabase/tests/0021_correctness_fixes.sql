begin;
select plan(17);

-- Task 28: reproduce and then confirm the fix for C1-C4 from the final
-- whole-branch SQL-layer review (progress.md "FINAL SQL-LAYER REVIEW").

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000021a0', 'org-t21', 'Org T21', 'construction-company');

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000021f1', 'proj-t21', '00000000-0000-0000-0000-0000000021a0', 'Project T21', 'active');

insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000002181', 'unit-t21', '00000000-0000-0000-0000-0000000021f1', 'Unit T21');

-- A weighted, project-scoped stage (RCC, weight 25) for the C1/C2 fixtures, and
-- an unweighted second stage used only to move a second task without changing
-- the project's weighted total (so the C2 consistency check isn't confounded
-- by an unrelated task's percent changing).
insert into stages (id, legacy_id, project_id, name, sort_order, code) values
  ('00000000-0000-0000-0000-000000002151', 'stage-t21-rcc', '00000000-0000-0000-0000-0000000021f1', 'RCC', 1, 'RCC'),
  ('00000000-0000-0000-0000-000000002152', 'stage-t21-plain', '00000000-0000-0000-0000-0000000021f1', 'Plain', 2, null);

insert into trades (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000002161', 'trade-t21', null, 'Masonry');

-- daily_progress.work_type_id is not-null; one shared work type covers every
-- fixture row below (the raw inserts here bypass submit_daily_progress, so
-- nothing enforces it must match a row's own stage/trade).
insert into work_types (id, legacy_id, project_id, name, stage_id, trade_id, default_unit) values
  ('00000000-0000-0000-0000-000000002179', 'wt-t21-shared', null, 'Shared Work Type',
    '00000000-0000-0000-0000-000000002152', '00000000-0000-0000-0000-000000002161', 'nos');

insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000021d1', 'person-t21-rev', '+6598002101', 'Reviewer T21', null);

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000021e1');
update people set auth_user_id = '00000000-0000-0000-0000-0000000021e1' where id = '00000000-0000-0000-0000-0000000021d1';

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope, status) values
  ('00000000-0000-0000-0000-000000002191', 'm-t21-rev', '00000000-0000-0000-0000-0000000021d1', '00000000-0000-0000-0000-0000000021a0',
    '00000000-0000-0000-0000-0000000021f1', 'project-manager',
    array['project.read', 'project.manage', 'task.manage', 'progress.review'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000021e1"}', true);

-- ── C1: review_daily_progress must move the linked task's status ───────────
-- Three tasks, each starting 'submitted' (as a worker's submission leaves
-- them), one per decision. Per src/domain/taskTransitions.ts: approve walks
-- submitted -> review -> approved; reject moves submitted -> reopened;
-- request-changes moves submitted -> reopened -> in-progress.
insert into tasks (id, legacy_id, project_id, project_unit_id, stage_id, trade_id, title, status) values
  ('00000000-0000-0000-0000-000000002171', 'task-t21-approve', '00000000-0000-0000-0000-0000000021f1',
    '00000000-0000-0000-0000-000000002181', '00000000-0000-0000-0000-000000002152', '00000000-0000-0000-0000-000000002161',
    'Approve case task', 'submitted'),
  ('00000000-0000-0000-0000-000000002172', 'task-t21-reject', '00000000-0000-0000-0000-0000000021f1',
    '00000000-0000-0000-0000-000000002181', '00000000-0000-0000-0000-000000002152', '00000000-0000-0000-0000-000000002161',
    'Reject case task', 'submitted'),
  ('00000000-0000-0000-0000-000000002173', 'task-t21-changes', '00000000-0000-0000-0000-0000000021f1',
    '00000000-0000-0000-0000-000000002181', '00000000-0000-0000-0000-000000002152', '00000000-0000-0000-0000-000000002161',
    'Request-changes case task', 'submitted');

insert into daily_progress (id, legacy_id, project_id, project_unit_id, task_id, stage_id, trade_id, work_type_id, date,
  today_summary, tomorrow_plan, submitted_by_membership_id, review_status, publication_status) values
  ('00000000-0000-0000-0000-000000002101', 'dp-t21-approve', '00000000-0000-0000-0000-0000000021f1', '00000000-0000-0000-0000-000000002181',
    '00000000-0000-0000-0000-000000002171', '00000000-0000-0000-0000-000000002152', '00000000-0000-0000-0000-000000002161',
    '00000000-0000-0000-0000-000000002179', current_date, 'Approve me', 'plan', '00000000-0000-0000-0000-000000002191', 'submitted', 'private'),
  ('00000000-0000-0000-0000-000000002102', 'dp-t21-reject', '00000000-0000-0000-0000-0000000021f1', '00000000-0000-0000-0000-000000002181',
    '00000000-0000-0000-0000-000000002172', '00000000-0000-0000-0000-000000002152', '00000000-0000-0000-0000-000000002161',
    '00000000-0000-0000-0000-000000002179', current_date, 'Reject me', 'plan', '00000000-0000-0000-0000-000000002191', 'submitted', 'private'),
  ('00000000-0000-0000-0000-000000002103', 'dp-t21-changes', '00000000-0000-0000-0000-0000000021f1', '00000000-0000-0000-0000-000000002181',
    '00000000-0000-0000-0000-000000002173', '00000000-0000-0000-0000-000000002152', '00000000-0000-0000-0000-000000002161',
    '00000000-0000-0000-0000-000000002179', current_date, 'Send me back', 'plan', '00000000-0000-0000-0000-000000002191', 'submitted', 'private');

select lives_ok(
  $$select public.review_daily_progress('00000000-0000-0000-0000-000000002101', 'approve', null)$$,
  'the reviewer approves the first update');
select is(
  (select status from tasks where id = '00000000-0000-0000-0000-000000002171'),
  'approved', 'C1: approving moves the linked task from submitted to approved');

select lives_ok(
  $$select public.review_daily_progress('00000000-0000-0000-0000-000000002102', 'reject', 'Wrong quantity')$$,
  'the reviewer rejects the second update');
select is(
  (select status from tasks where id = '00000000-0000-0000-0000-000000002172'),
  'reopened', 'C1: rejecting moves the linked task from submitted to reopened');

select lives_ok(
  $$select public.review_daily_progress('00000000-0000-0000-0000-000000002103', 'request-changes', 'Add a photo')$$,
  'the reviewer requests changes on the third update');
select is(
  (select status from tasks where id = '00000000-0000-0000-0000-000000002173'),
  'in-progress', 'C1: request-changes moves the linked task from submitted to in-progress (via reopened)');

-- ── C2: progress must be computed by the SAME function everywhere, so it
-- cannot depend on whether a progress-review call or a task-engine call ran
-- last. recalculate_project_progress (the unweighted, duplicate function) must
-- also be gone entirely.
select hasnt_function('public', 'recalculate_project_progress', array['uuid'],
  'the duplicate unweighted recalculate_project_progress function no longer exists');

-- A fourth task on the weighted RCC stage, planned 10 sqft: approving a
-- submitted update for 4 sqft should bring it to 40% task-complete, which with
-- RCC's weight (25) and a zero baseline is a stage-weighted project progress of
-- round(25 * (0 + 100*40/100) / 100) = 10 -- NOT the unweighted 40 that the
-- now-deleted recalculate_project_progress produced for this exact shape (see
-- supabase/tests/0011_progress_publication_effects.sql, updated alongside this
-- fix for the same reason).
insert into tasks (id, legacy_id, project_id, project_unit_id, stage_id, trade_id, title, status,
  planned_quantity, planned_quantity_unit) values
  ('00000000-0000-0000-0000-000000002174', 'task-t21-weighted', '00000000-0000-0000-0000-0000000021f1',
    '00000000-0000-0000-0000-000000002181', '00000000-0000-0000-0000-000000002151', '00000000-0000-0000-0000-000000002161',
    'Weighted case task', 'submitted', 10, 'sqft');
insert into daily_progress (id, legacy_id, project_id, project_unit_id, task_id, stage_id, trade_id, work_type_id, date,
  completed_quantity, completed_quantity_unit, today_summary, tomorrow_plan, submitted_by_membership_id,
  review_status, publication_status) values
  ('00000000-0000-0000-0000-000000002104', 'dp-t21-weighted', '00000000-0000-0000-0000-0000000021f1', '00000000-0000-0000-0000-000000002181',
    '00000000-0000-0000-0000-000000002174', '00000000-0000-0000-0000-000000002151', '00000000-0000-0000-0000-000000002161',
    '00000000-0000-0000-0000-000000002179', current_date, 4, 'sqft', 'Weighted update', 'plan', '00000000-0000-0000-0000-000000002191', 'submitted', 'private');

select lives_ok(
  $$select public.review_daily_progress('00000000-0000-0000-0000-000000002104', 'approve', null)$$,
  'the reviewer approves the weighted-stage update');
select is(
  (select progress from projects where id = '00000000-0000-0000-0000-0000000021f1'),
  10::numeric, 'C2: review_daily_progress now stores the stage-weighted figure (25 * 40% = 10), not the unweighted 40');

-- A task-engine command on an unrelated, unweighted-stage task (so it cannot
-- change the weighted total by coincidence) recalculates progress too. It must
-- land on the exact same figure as the review path just did -- proving a
-- single source of truth rather than "whichever function ran last".
insert into tasks (id, legacy_id, project_id, project_unit_id, stage_id, trade_id, title, status) values
  ('00000000-0000-0000-0000-000000002175', 'task-t21-engine', '00000000-0000-0000-0000-0000000021f1',
    '00000000-0000-0000-0000-000000002181', '00000000-0000-0000-0000-000000002152', '00000000-0000-0000-0000-000000002161',
    'Task-engine case task', 'draft');
select lives_ok(
  $$select public.transition_task('00000000-0000-0000-0000-000000002175', 'assigned')$$,
  'a task-engine command (transition_task) runs on an unrelated, unweighted task');
select is(
  (select progress from projects where id = '00000000-0000-0000-0000-0000000021f1'),
  10::numeric, 'C2: the task-engine path recalculates to the exact same figure the review path just stored');

-- ── C3: calculate_project_progress / set_stage_baselines must recognize
-- library-wide stages (project_id null), the real production shape ─────────
insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000021f2', 'proj-t21-lib', '00000000-0000-0000-0000-0000000021a0', 'Project T21 Library', 'active');

-- A library-wide stage (project_id null), as add_library_stage and the domain's
-- addLibraryStage actually create -- not the project-scoped fixture 0014/0015's
-- own tests used.
insert into stages (id, legacy_id, project_id, name, sort_order, code) values
  ('00000000-0000-0000-0000-000000002153', 'stage-t21-lib-rcc', null, 'RCC Library', 1, 'RCC');

insert into tasks (id, legacy_id, project_id, stage_id, title, status, planned_quantity, planned_quantity_unit,
  completed_quantity, completed_quantity_unit) values
  ('00000000-0000-0000-0000-000000002176', 'task-t21-lib', '00000000-0000-0000-0000-0000000021f2',
    '00000000-0000-0000-0000-000000002153', 'Library-stage task', 'in-progress', 10, 'm3', 5, 'm3');

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope, status) values
  ('00000000-0000-0000-0000-000000002192', 'm-t21-lib', '00000000-0000-0000-0000-0000000021d1', '00000000-0000-0000-0000-0000000021a0',
    '00000000-0000-0000-0000-0000000021f2', 'project-manager', array['project.read', 'project.manage'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active');

-- Before any baseline is set: a library stage with one 50%-complete task and
-- weight 25 gives round(25 * (0 + 100*50/100) / 100) = 13. Not 0 -- the bug
-- this reproduces made this always 0 because the old filter never matched a
-- stage whose project_id is null.
select is(
  public.calculate_project_progress('00000000-0000-0000-0000-0000000021f2'),
  13, 'C3: calculate_project_progress recognizes a library-wide stage and returns a non-zero weighted value');

select lives_ok(
  $$select public.set_stage_baselines('00000000-0000-0000-0000-0000000021f2', '{"00000000-0000-0000-0000-000000002153": 30}'::jsonb)$$,
  'C3: set_stage_baselines succeeds against a library-wide stage instead of refusing "Unknown stage"');
-- base 30, task avg 50: 30 + 70*50/100 = 65; weighted 25*65/100 = 16.25 -> 16.
select is(
  (select progress from projects where id = '00000000-0000-0000-0000-0000000021f2'),
  16::numeric, 'C3: progress after set_stage_baselines reflects the library stage''s baseline and weight');

-- ── C4: create_task must accept a real task_templates id (CreateTaskModal.tsx
-- passes state.taskTemplates.find(...).id -- a task_templates row, never a
-- work_plan_items row) ──────────────────────────────────────────────────────
insert into work_types (id, legacy_id, project_id, name, stage_id, trade_id, default_unit) values
  ('00000000-0000-0000-0000-000000002177', 'wt-t21', null, 'Library Work Type',
    '00000000-0000-0000-0000-000000002151', '00000000-0000-0000-0000-000000002161', 'nos');
insert into task_templates (id, legacy_id, project_id, work_type_id, name) values
  ('00000000-0000-0000-0000-000000002178', 'tmpl-t21', null, '00000000-0000-0000-0000-000000002177', 'Library Template');

select is(
  (select count(*)::int from work_plan_items where id = '00000000-0000-0000-0000-000000002178'),
  0, 'the template id used below is genuinely not a work_plan_items row (the exact shape that used to 23503)');

select lives_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000021f1', '00000000-0000-0000-0000-000000002181',
      '00000000-0000-0000-0000-000000002151', '00000000-0000-0000-0000-000000002161', '00000000-0000-0000-0000-000000002177',
      '00000000-0000-0000-0000-000000002178', 'Templated task', null, null, null, null)$$,
  'C4: create_task succeeds with a real task_templates id instead of raising a foreign key violation');
select is(
  (select work_plan_item_id from tasks where title = 'Templated task'),
  '00000000-0000-0000-0000-000000002178'::uuid, 'C4: the task''s template reference is set to the task_templates row');

select * from finish();
rollback;
