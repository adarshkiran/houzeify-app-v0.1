begin;
select plan(61);

-- Fixtures are inserted as the table owner (bypasses RLS). Each call is made as
-- one signed-in person by setting the JWT claims for the transaction.

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000015a0', 'org-t15', 'Org T15', 'construction-company'),
  ('00000000-0000-0000-0000-0000000015a9', 'org-t15-other', 'Org T15 Other', 'construction-company');

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000015f1', 'proj-t15', '00000000-0000-0000-0000-0000000015a0', 'Project T15', 'active'),
  ('00000000-0000-0000-0000-0000000015f2', 'proj-t15-other', '00000000-0000-0000-0000-0000000015a0', 'Other Project T15', 'active');

-- Stages/trades: a project-scoped RCC stage (weighted, for progress) plus a
-- shared-library trade. The ids match exactly what create_task/add_work_plan_item
-- receive -- src/domain's ConstructionStage/Trade/WorkType have no projectId at
-- all, so matching never filters on it (see migration 0015 header).
insert into stages (id, legacy_id, project_id, name, sort_order, code) values
  ('00000000-0000-0000-0000-000000001551', 'stage-t15-rcc', '00000000-0000-0000-0000-0000000015f1', 'RCC', 1, 'RCC'),
  ('00000000-0000-0000-0000-000000001552', 'stage-t15-other', '00000000-0000-0000-0000-0000000015f1', 'Other', 2, null);
insert into stages (id, legacy_id, project_id, name, sort_order) values
  ('00000000-0000-0000-0000-000000001553', 'stage-t15-foreign', '00000000-0000-0000-0000-0000000015f2', 'Foreign', 1);

insert into trades (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000001561', 'trade-t15-elec', null, 'Electrical');

insert into work_types (id, legacy_id, project_id, name, stage_id, trade_id, default_unit) values
  ('00000000-0000-0000-0000-000000001571', 'work-t15-elec', null, 'Wiring',
    '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561', 'nos');

insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000001581', 'unit-t15-a', '00000000-0000-0000-0000-0000000015f1', 'Unit A'),
  ('00000000-0000-0000-0000-000000001582', 'unit-t15-b', '00000000-0000-0000-0000-0000000015f1', 'Unit B');
insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000001583', 'unit-t15-foreign', '00000000-0000-0000-0000-0000000015f2', 'Foreign Unit');

-- People: an unscoped project manager (pm), a project manager scoped to Unit A
-- only (scoped-pm), and a site member (site) who can only progress.submit and is
-- also the worker who gets assigned tasks.
insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000015d1', 'person-t15-pm', '+6598001501', 'Manager T15', null),
  ('00000000-0000-0000-0000-0000000015d2', 'person-t15-scoped', '+6598001502', 'Scoped PM T15', null),
  ('00000000-0000-0000-0000-0000000015d3', 'person-t15-site', '+6598001503', 'Site T15', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000015e1'),
  ('00000000-0000-0000-0000-0000000015e2'),
  ('00000000-0000-0000-0000-0000000015e3');
update people set auth_user_id = '00000000-0000-0000-0000-0000000015e1' where id = '00000000-0000-0000-0000-0000000015d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000015e2' where id = '00000000-0000-0000-0000-0000000015d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000015e3' where id = '00000000-0000-0000-0000-0000000015d3';

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope, status) values
  ('00000000-0000-0000-0000-000000001591', 'm-t15-pm', '00000000-0000-0000-0000-0000000015d1', '00000000-0000-0000-0000-0000000015a0',
    '00000000-0000-0000-0000-0000000015f1', 'project-manager',
    array['project.read','project.manage','task.manage','progress.submit'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000001592', 'm-t15-scoped', '00000000-0000-0000-0000-0000000015d2', '00000000-0000-0000-0000-0000000015a0',
    '00000000-0000-0000-0000-0000000015f1', 'project-manager',
    array['project.read','task.manage','progress.submit'],
    '{"projectUnitIds": ["00000000-0000-0000-0000-000000001581"], "stageIds": [], "tradeIds": []}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000001593', 'm-t15-site', '00000000-0000-0000-0000-0000000015d3', '00000000-0000-0000-0000-0000000015a0',
    '00000000-0000-0000-0000-0000000015f1', 'worker',
    array['progress.submit'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active');

-- Workers: w1 is linked to the site person and assigned to the project (unit A);
-- w2 exists but has no project assignment; w3 belongs to a different organization.
insert into workers (id, legacy_id, organization_id, user_id, phone, name, status) values
  ('00000000-0000-0000-0000-0000000015c1', 'worker-t15-1', '00000000-0000-0000-0000-0000000015a0',
    '00000000-0000-0000-0000-0000000015d3', '+6598002501', 'Worker One', 'active'),
  ('00000000-0000-0000-0000-0000000015c2', 'worker-t15-2', '00000000-0000-0000-0000-0000000015a0',
    null, '+6598002502', 'Worker Two', 'active'),
  ('00000000-0000-0000-0000-0000000015c3', 'worker-t15-3', '00000000-0000-0000-0000-0000000015a9',
    null, '+6598002503', 'Worker Three', 'active');

insert into worker_project_assignments (id, legacy_id, project_id, worker_id, project_unit_ids, status) values
  ('00000000-0000-0000-0000-0000000015b1', 'wpa-t15-1', '00000000-0000-0000-0000-0000000015f1',
    '00000000-0000-0000-0000-0000000015c1', array['00000000-0000-0000-0000-000000001581']::uuid[], 'active');

-- Structural checks
select has_function('public', 'add_work_plan_item', array['uuid','uuid','uuid','uuid','uuid','date','date'], 'add_work_plan_item exists');
select has_function('public', 'create_task', array['uuid','uuid','uuid','uuid','uuid','uuid','text','numeric','text','uuid','uuid'], 'create_task exists');
select has_function('public', 'assign_task', array['uuid','text','uuid'], 'assign_task exists');
select has_function('public', 'accept_task_assignment', array['uuid'], 'accept_task_assignment exists');
select has_function('public', 'start_task', array['uuid'], 'start_task exists');
select has_function('public', 'transition_task', array['uuid','text'], 'transition_task exists');
select is_definer('public', 'create_task', array['uuid','uuid','uuid','uuid','uuid','uuid','text','numeric','text','uuid','uuid'], 'create_task is security definer');
select is_definer('public', 'transition_task', array['uuid','text'], 'transition_task is security definer');

-- ── add_work_plan_item ──────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e3"}', true);
select throws_ok(
  $$select public.add_work_plan_item('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001581',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, null)$$,
  'P0001', 'permission:Missing permission "task.manage" on project 00000000-0000-0000-0000-0000000015f1',
  'a progress.submit-only session cannot add a work plan item');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e1"}', true);
select lives_ok(
  $$select public.add_work_plan_item('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001581',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, null)$$,
  'the unscoped pm adds a work plan item');
select is(
  (select title from work_plan_items where project_id = '00000000-0000-0000-0000-0000000015f1' and project_unit_id = '00000000-0000-0000-0000-000000001581'),
  'Wiring', 'the title is filled from the work type name');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e2"}', true);
select lives_ok(
  $$select public.add_work_plan_item('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001581',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, null)$$,
  'the scoped pm adds a work plan item inside their scope (Unit A)');
select throws_ok(
  $$select public.add_work_plan_item('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001582',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, null)$$,
  'P0001', 'permission:Missing permission "task.manage" on project 00000000-0000-0000-0000-0000000015f1',
  'a task-scoped session cannot add a work plan item outside its scope (Unit B)');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e1"}', true);
select throws_ok(
  $$select public.add_work_plan_item('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001583',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, null)$$,
  'P0001', 'Unit 00000000-0000-0000-0000-000000001583 does not belong to project 00000000-0000-0000-0000-0000000015f1',
  'a unit from another project is refused');
select throws_ok(
  $$select public.add_work_plan_item('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001581',
      '00000000-0000-0000-0000-000000001552', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, null)$$,
  'P0001', 'Work type 00000000-0000-0000-0000-000000001571 does not match stage 00000000-0000-0000-0000-000000001552 / trade 00000000-0000-0000-0000-000000001561',
  'a stage that does not match the work type is refused');

-- ── create_task ──────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e3"}', true);
select throws_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001581',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, 'Wire first floor', null, null, null, null)$$,
  'P0001', 'permission:Missing permission "task.manage" on project 00000000-0000-0000-0000-0000000015f1',
  'a progress.submit-only session cannot create a task');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e1"}', true);
select lives_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001581',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, 'Wire first floor', 10, 'nos', null, null)$$,
  'the unscoped pm creates a task');
select is((select status from tasks where title = 'Wire first floor'), 'draft', 'the new task starts in draft');
select is((select planned_quantity from tasks where title = 'Wire first floor'), 10::numeric, 'planned quantity is stored');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e2"}', true);
select lives_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001581',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, 'Scoped task', null, null, null, null)$$,
  'the scoped pm creates a task inside their scope (Unit A)');
select throws_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001582',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, 'Out of scope task', null, null, null, null)$$,
  'P0001', 'permission:Missing permission "task.manage" on project 00000000-0000-0000-0000-0000000015f1',
  'a task-scoped session cannot create a task outside its scope (Unit B)');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e1"}', true);
select throws_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001583',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, 'Foreign unit task', null, null, null, null)$$,
  'P0001', 'Unit 00000000-0000-0000-0000-000000001583 does not belong to project 00000000-0000-0000-0000-0000000015f1',
  'a unit from another project is refused for create_task');

-- Main task used for the rest of the suite: created by the pm, unit A / stage RCC.
select lives_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001581',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, 'Main Task T15', null, null, null, null)$$,
  'the pm creates the main task used by assign/accept/start/transition tests');

-- ── assign_task ──────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e3"}', true);
select throws_ok(
  format('select public.assign_task(%L, %L, %L)',
    (select id from tasks where title = 'Main Task T15'), 'worker', '00000000-0000-0000-0000-0000000015c1'),
  'P0001', format('permission:Missing permission "task.manage" on project %s', '00000000-0000-0000-0000-0000000015f1'),
  'a progress.submit-only session cannot assign a task');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e1"}', true);
select throws_ok(
  format('select public.assign_task(%L, %L, %L)',
    (select id from tasks where title = 'Main Task T15'), 'worker', '00000000-0000-0000-0000-0000000015c3'),
  'P0001', 'Worker 00000000-0000-0000-0000-0000000015c3 is not in this organization',
  'a worker from a different organization is refused');
select throws_ok(
  format('select public.assign_task(%L, %L, %L)',
    (select id from tasks where title = 'Main Task T15'), 'worker', '00000000-0000-0000-0000-0000000015c2'),
  'P0001', 'Worker 00000000-0000-0000-0000-0000000015c2 is not assigned to project 00000000-0000-0000-0000-0000000015f1',
  'a worker not assigned to the project is refused');
select lives_ok(
  format('select public.assign_task(%L, %L, %L)',
    (select id from tasks where title = 'Main Task T15'), 'worker', '00000000-0000-0000-0000-0000000015c1'),
  'the pm assigns the task to worker one');
select is((select status from tasks where title = 'Main Task T15'), 'assigned', 'the task moves to assigned');
select is(
  (select count(*)::int from task_assignments where task_id = (select id from tasks where title = 'Main Task T15')),
  1, 'exactly one assignment row exists');
select lives_ok(
  format('select public.assign_task(%L, %L, %L)',
    (select id from tasks where title = 'Main Task T15'), 'worker', '00000000-0000-0000-0000-0000000015c1'),
  'assigning the same worker again does not fail');
select is(
  (select count(*)::int from task_assignments where task_id = (select id from tasks where title = 'Main Task T15')),
  1, 'no duplicate assignment row is created');

-- a task-scoped session cannot assign a task outside its scope (Unit B)
select lives_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001582',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, 'Unit B Task T15', null, null, null, null)$$,
  'the pm creates a task on Unit B (outside the scoped pm''s scope)');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e2"}', true);
select throws_ok(
  format('select public.assign_task(%L, %L, %L)',
    (select id from tasks where title = 'Unit B Task T15'), 'worker', '00000000-0000-0000-0000-0000000015c1'),
  'P0001', format('permission:Missing permission "task.manage" on project %s', '00000000-0000-0000-0000-0000000015f1'),
  'a task-scoped session cannot assign a task outside its scope (Unit B)');

-- ── transition_task: the state machine matches src/domain/taskTransitions.ts ──

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e1"}', true);

-- Valid: draft -> cancelled (via a throwaway task so the main task keeps its state)
select lives_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001581',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, 'Cancel Me T15', null, null, null, null)$$,
  'a throwaway task is created for the cancel transition');
select lives_ok(
  format('select public.transition_task(%L, %L)', (select id from tasks where title = 'Cancel Me T15'), 'cancelled'),
  'valid transition: draft -> cancelled');
select is((select status from tasks where title = 'Cancel Me T15'), 'cancelled', 'the task is now cancelled');

-- Valid: assigned -> accepted (the main task, currently assigned)
select lives_ok(
  format('select public.transition_task(%L, %L)', (select id from tasks where title = 'Main Task T15'), 'accepted'),
  'valid transition: assigned -> accepted');
select is((select status from tasks where title = 'Main Task T15'), 'accepted', 'the main task is now accepted');

-- Valid: accepted -> ready
select lives_ok(
  format('select public.transition_task(%L, %L)', (select id from tasks where title = 'Main Task T15'), 'ready'),
  'valid transition: accepted -> ready');
select is((select status from tasks where title = 'Main Task T15'), 'ready', 'the main task is now ready');

-- Invalid: ready -> completed (not a legal move)
select throws_ok(
  format('select public.transition_task(%L, %L)', (select id from tasks where title = 'Main Task T15'), 'completed'),
  'P0001', 'conflict:A task can''t move from ready to completed.',
  'invalid transition: ready -> completed is refused');
select is((select status from tasks where title = 'Main Task T15'), 'ready', 'the status is unchanged after the refusal');

-- Invalid: cancelled -> ready (only "reopened" is legal from cancelled)
select throws_ok(
  format('select public.transition_task(%L, %L)', (select id from tasks where title = 'Cancel Me T15'), 'ready'),
  'P0001', 'conflict:A task can''t move from cancelled to ready.',
  'invalid transition: cancelled -> ready is refused');

-- A progress.submit member may make a site move (ready -> in-progress on the main task)...
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e3"}', true);
select lives_ok(
  format('select public.transition_task(%L, %L)', (select id from tasks where title = 'Main Task T15'), 'in-progress'),
  'a progress.submit member can make the site move ready -> in-progress');
select is((select status from tasks where title = 'Main Task T15'), 'in-progress', 'the main task is now in-progress');

-- ...but not a review/planning move: in-progress -> submitted is a legal transition
-- yet not a "site" status, so a progress.submit-only member needs task.manage.
select throws_ok(
  format('select public.transition_task(%L, %L)', (select id from tasks where title = 'Main Task T15'), 'submitted'),
  'P0001', format('permission:Missing permission "task.manage" on project %s', '00000000-0000-0000-0000-0000000015f1'),
  'a progress.submit-only member cannot move a task to a non-site status');

-- the pm (task.manage) can make that same move
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e1"}', true);
select lives_ok(
  format('select public.transition_task(%L, %L)', (select id from tasks where title = 'Main Task T15'), 'submitted'),
  'the pm moves the task to submitted');
select lives_ok(
  format('select public.transition_task(%L, %L)', (select id from tasks where title = 'Main Task T15'), 'review'),
  'valid transition: submitted -> review');
select lives_ok(
  format('select public.transition_task(%L, %L)', (select id from tasks where title = 'Main Task T15'), 'approved'),
  'valid transition: review -> approved');
select lives_ok(
  format('select public.transition_task(%L, %L)', (select id from tasks where title = 'Main Task T15'), 'completed'),
  'valid transition: approved -> completed');
select is((select status from tasks where title = 'Main Task T15'), 'completed', 'the main task is now completed');

-- ── accept_task_assignment / start_task ──────────────────────────────────────

-- A fresh task, assigned to worker one, for accept/start.
select lives_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001581',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, 'Accept Start Task T15', null, null, null, null)$$,
  'a task is created for accept/start tests');
select lives_ok(
  format('select public.assign_task(%L, %L, %L)',
    (select id from tasks where title = 'Accept Start Task T15'), 'worker', '00000000-0000-0000-0000-0000000015c1'),
  'the task is assigned to worker one');

-- A non-worker session cannot accept (no linked worker row in this organization)
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e1"}', true);
select throws_ok(
  format('select public.accept_task_assignment(%L)', (select id from tasks where title = 'Accept Start Task T15')),
  'P0001', format('permission:Missing permission "progress.submit" on project %s', '00000000-0000-0000-0000-0000000015f1'),
  'a session with no linked worker cannot accept a task assignment');

-- The worker accepts their own assignment
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e3"}', true);
select lives_ok(
  format('select public.accept_task_assignment(%L)', (select id from tasks where title = 'Accept Start Task T15')),
  'worker one accepts their task assignment');
select is((select status from tasks where title = 'Accept Start Task T15'), 'accepted', 'the task is now accepted');

-- start_task walks accepted -> ready -> in-progress in one call
select lives_ok(
  format('select public.start_task(%L)', (select id from tasks where title = 'Accept Start Task T15')),
  'worker one starts the task');
select is((select status from tasks where title = 'Accept Start Task T15'), 'in-progress', 'the task is now in-progress');

-- start_task refuses a task that cannot reach in-progress (already completed)
select throws_ok(
  format('select public.start_task(%L)', (select id from tasks where title = 'Main Task T15')),
  'P0001', 'conflict:This task can''t be started while it is completed.',
  'start_task refuses a completed task');

-- accept_task_assignment refuses a worker with no assignment on the task
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e1"}', true);
select lives_ok(
  $$select public.create_task('00000000-0000-0000-0000-0000000015f1', '00000000-0000-0000-0000-000000001581',
      '00000000-0000-0000-0000-000000001551', '00000000-0000-0000-0000-000000001561',
      '00000000-0000-0000-0000-000000001571', null, 'Unassigned Task T15', null, null, null, null)$$,
  'an unassigned task is created');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000015e3"}', true);
select throws_ok(
  format('select public.accept_task_assignment(%L)', (select id from tasks where title = 'Unassigned Task T15')),
  'P0001', 'conflict:This task isn''t assigned to you.',
  'a worker cannot accept a task that is not assigned to them');

select * from finish();
rollback;
