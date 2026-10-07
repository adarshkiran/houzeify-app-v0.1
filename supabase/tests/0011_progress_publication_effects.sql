begin;
select plan(9);

-- F1: approving a daily_progress row must add its completed quantity onto the
-- linked task and recalculate the project's stored progress, and publishing it
-- must make its (non-audio) evidence readable to the homeowner under the
-- evidence RLS policy from 0005.

insert into organizations (id, legacy_id, name) values
  ('00000000-0000-0000-0000-00000000b0a0', 'org-t16b', 'Org T16B');

insert into projects (id, legacy_id, organization_id, name, require_checkout) values
  ('00000000-0000-0000-0000-00000000b0f1', 'proj-t16b', '00000000-0000-0000-0000-00000000b0a0', 'Project T16B', false);

insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-00000000b081', 'unit-t16b', '00000000-0000-0000-0000-00000000b0f1', 'Unit T16B');
-- code 'RCC' (weight 25) so the stage-weighted calculate_project_progress
-- (migration 0014, routed through here since Task 28's C2 fix) gives a
-- deterministic non-zero figure instead of the 0 an uncoded/unweighted stage
-- would always contribute.
insert into stages (id, legacy_id, project_id, name, code) values
  ('00000000-0000-0000-0000-00000000b082', 'stage-t16b', '00000000-0000-0000-0000-00000000b0f1', 'Stage T16B', 'RCC');
insert into trades (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-00000000b083', 'trade-t16b', '00000000-0000-0000-0000-00000000b0f1', 'Trade T16B');
insert into work_types (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-00000000b084', 'wt-t16b', '00000000-0000-0000-0000-00000000b0f1', 'Work type T16B');

insert into tasks (id, legacy_id, project_id, project_unit_id, stage_id, trade_id, title, status, planned_quantity, planned_quantity_unit) values
  ('00000000-0000-0000-0000-00000000b085', 'task-t16b', '00000000-0000-0000-0000-00000000b0f1', '00000000-0000-0000-0000-00000000b081',
   '00000000-0000-0000-0000-00000000b082', '00000000-0000-0000-0000-00000000b083', 'Plaster unit', 'in-progress', 10, 'sqft');

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000b0e1'),
  ('00000000-0000-0000-0000-00000000b0e2'),
  ('00000000-0000-0000-0000-00000000b0e3');

insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-00000000b0d1', 'person-t16b-sup', '+6598001611', 'Supervisor T16B', '00000000-0000-0000-0000-00000000b0e1'),
  ('00000000-0000-0000-0000-00000000b0d2', 'person-t16b-wk', '+6598001612', 'Worker T16B', '00000000-0000-0000-0000-00000000b0e2'),
  ('00000000-0000-0000-0000-00000000b0d3', 'person-t16b-home', '+6598001613', 'Homeowner T16B', '00000000-0000-0000-0000-00000000b0e3');

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, status) values
  ('00000000-0000-0000-0000-00000000b0b1', 'm-t16b-sup', '00000000-0000-0000-0000-00000000b0d1', '00000000-0000-0000-0000-00000000b0a0', '00000000-0000-0000-0000-00000000b0f1', 'supervisor', array['project.read', 'progress.review', 'customer.publish'], 'active'),
  ('00000000-0000-0000-0000-00000000b0b2', 'm-t16b-wk', '00000000-0000-0000-0000-00000000b0d2', '00000000-0000-0000-0000-00000000b0a0', '00000000-0000-0000-0000-00000000b0f1', 'worker', array['progress.submit'], 'active'),
  ('00000000-0000-0000-0000-00000000b0b3', 'm-t16b-home', '00000000-0000-0000-0000-00000000b0d3', '00000000-0000-0000-0000-00000000b0a0', '00000000-0000-0000-0000-00000000b0f1', 'homeowner', array['project.read'], 'active');

insert into daily_progress (id, legacy_id, project_id, project_unit_id, task_id, stage_id, trade_id, work_type_id, date,
  completed_quantity, completed_quantity_unit, today_summary, tomorrow_plan, submitted_by_membership_id, review_status, publication_status) values
  ('00000000-0000-0000-0000-00000000b071', 'dp-t16b-1', '00000000-0000-0000-0000-00000000b0f1', '00000000-0000-0000-0000-00000000b081',
   '00000000-0000-0000-0000-00000000b085', '00000000-0000-0000-0000-00000000b082', '00000000-0000-0000-0000-00000000b083', '00000000-0000-0000-0000-00000000b084',
   current_date, 4, 'sqft', 'Plastered part of the wall', 'Finish the rest', '00000000-0000-0000-0000-00000000b0b2', 'submitted', 'private');

insert into evidence (id, legacy_id, project_id, task_id, daily_progress_id, type, url, captured_by_membership_id, customer_visibility) values
  ('00000000-0000-0000-0000-00000000b091', 'ev-t16b-photo', '00000000-0000-0000-0000-00000000b0f1', '00000000-0000-0000-0000-00000000b085',
   '00000000-0000-0000-0000-00000000b071', 'photo', 'https://example.test/photo.jpg', '00000000-0000-0000-0000-00000000b0b2', 'review-required'),
  ('00000000-0000-0000-0000-00000000b092', 'ev-t16b-audio', '00000000-0000-0000-0000-00000000b0f1', '00000000-0000-0000-0000-00000000b085',
   '00000000-0000-0000-0000-00000000b071', 'audio', 'https://example.test/voice.m4a', '00000000-0000-0000-0000-00000000b0b2', 'private');

-- Supervisor approves: the task's completed quantity and the project's stored
-- progress must both move (F1; previously neither did).
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000b0e1"}', true);
select lives_ok(
  $$select public.publish_daily_progress('00000000-0000-0000-0000-00000000b071', 'approve', null)$$,
  'the supervisor approves the update');
select is(
  (select completed_quantity from tasks where id = '00000000-0000-0000-0000-00000000b085'),
  4::numeric, 'approval adds the reported quantity onto the linked task');
select is(
  (select completed_quantity_unit from tasks where id = '00000000-0000-0000-0000-00000000b085'),
  'sqft', 'the task keeps the reported unit');
-- Task 28 (C2): progress is now the SAME stage-weighted figure the task
-- engine computes (migration 0014's calculate_project_progress), not the
-- unweighted recalculate_project_progress this function used to call (which
-- has been deleted): 4 of 10 sqft is 40% task-complete, weighted by RCC's
-- weight of 25 with a zero baseline: round(25 * (0 + 100*40/100) / 100) = 10.
select is(
  (select progress from projects where id = '00000000-0000-0000-0000-00000000b0f1'),
  10::numeric, 'the project progress is recalculated, stage-weighted, from the task percent (4 of 10 sqft)');

-- Publish: the evidence a homeowner may see must turn customer-visible, and
-- voice notes never do.
select lives_ok(
  $$select public.publish_daily_progress('00000000-0000-0000-0000-00000000b071', 'publish', null)$$,
  'the supervisor publishes the update');
select is(
  (select customer_visibility from evidence where id = '00000000-0000-0000-0000-00000000b091'),
  'customer-visible', 'publishing marks the photo evidence customer-visible');
select is(
  (select customer_visibility from evidence where id = '00000000-0000-0000-0000-00000000b092'),
  'private', 'publishing never shares the voice-note evidence');

-- The homeowner reads evidence through the 0005 RLS policy, not through this
-- function: this proves the photo is now actually reachable by them. RLS is
-- only enforced for the `authenticated` role, not the table owner running
-- this script (matching the pattern in supabase/tests/0005_rls.sql).
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000b0e3"}', true);
set local role authenticated;
select is(
  (select count(*)::int from evidence where id = '00000000-0000-0000-0000-00000000b091'),
  1, 'the homeowner can read the published photo evidence under RLS');
select is(
  (select count(*)::int from evidence where id = '00000000-0000-0000-0000-00000000b092'),
  0, 'the homeowner still cannot read the voice-note evidence under RLS');
reset role;

select * from finish();
rollback;
