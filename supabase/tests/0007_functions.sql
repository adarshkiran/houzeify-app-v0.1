begin;
select plan(33);

-- Fixtures are inserted as the table owner (bypasses RLS). Each call is made as
-- one signed-in person by setting the JWT claims for the transaction.

insert into organizations (id, legacy_id, name) values
  ('00000000-0000-0000-0000-0000000007a0', 'org-t8', 'Org T8');

insert into projects (id, legacy_id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000007f1', 'proj-t8', '00000000-0000-0000-0000-0000000007a0', 'Project T8');

-- People: supervisor (sup), linked worker one (wp1), another person (op), linked worker three (wp3)
insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000007d1', 'person-t8-sup', '+6598000801', 'Supervisor T8', null),
  ('00000000-0000-0000-0000-0000000007d2', 'person-t8-wp1', '+6598000802', 'Worker one T8', null),
  ('00000000-0000-0000-0000-0000000007d3', 'person-t8-op', '+6598000803', 'Other person T8', null),
  ('00000000-0000-0000-0000-0000000007d4', 'person-t8-wp3', '+6598000804', 'Worker three T8', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000007e1'),
  ('00000000-0000-0000-0000-0000000007e2'),
  ('00000000-0000-0000-0000-0000000007e3'),
  ('00000000-0000-0000-0000-0000000007e4');
update people set auth_user_id = '00000000-0000-0000-0000-0000000007e1' where id = '00000000-0000-0000-0000-0000000007d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000007e2' where id = '00000000-0000-0000-0000-0000000007d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000007e3' where id = '00000000-0000-0000-0000-0000000007d3';
update people set auth_user_id = '00000000-0000-0000-0000-0000000007e4' where id = '00000000-0000-0000-0000-0000000007d4';

-- Supervisor: organization-level and project-level workforce.manage. Worker one has an
-- invited worker-role membership on the project; worker three an active one.
insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, status) values
  ('00000000-0000-0000-0000-0000000007b1', 'm-t8-sup-org', '00000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-0000000007a0', null, 'owner', array['workforce.manage'], 'active'),
  ('00000000-0000-0000-0000-0000000007b2', 'm-t8-sup-proj', '00000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-0000000007a0', '00000000-0000-0000-0000-0000000007f1', 'supervisor', array['workforce.manage'], 'active'),
  ('00000000-0000-0000-0000-0000000007b3', 'm-t8-wp1', '00000000-0000-0000-0000-0000000007d2', '00000000-0000-0000-0000-0000000007a0', '00000000-0000-0000-0000-0000000007f1', 'worker', array['progress.submit'], 'invited'),
  ('00000000-0000-0000-0000-0000000007b4', 'm-t8-wp3', '00000000-0000-0000-0000-0000000007d4', '00000000-0000-0000-0000-0000000007a0', '00000000-0000-0000-0000-0000000007f1', 'worker', array['progress.submit'], 'active');

-- Workers. w1 linked and invited; w2 unlinked (qr invitation); w3 active and linked;
-- w4 unlinked (supervisor-assisted); w5 invited with no onboarding yet; w6 unlinked (supervisor-assisted).
insert into workers (id, legacy_id, organization_id, user_id, phone, name, status) values
  ('00000000-0000-0000-0000-0000000007c1', 'wk-t8-1', '00000000-0000-0000-0000-0000000007a0', '00000000-0000-0000-0000-0000000007d2', '+6598000812', 'Worker One', 'invited'),
  ('00000000-0000-0000-0000-0000000007c2', 'wk-t8-2', '00000000-0000-0000-0000-0000000007a0', null, '+6598000813', 'Worker Two', 'invited'),
  ('00000000-0000-0000-0000-0000000007c3', 'wk-t8-3', '00000000-0000-0000-0000-0000000007a0', '00000000-0000-0000-0000-0000000007d4', '+6598000814', 'Worker Three', 'active'),
  ('00000000-0000-0000-0000-0000000007c4', 'wk-t8-4', '00000000-0000-0000-0000-0000000007a0', null, '+6598000815', 'Worker Four', 'invited'),
  ('00000000-0000-0000-0000-0000000007c5', 'wk-t8-5', '00000000-0000-0000-0000-0000000007a0', null, '+6598000816', 'Worker Five', 'invited'),
  ('00000000-0000-0000-0000-0000000007c6', 'wk-t8-6', '00000000-0000-0000-0000-0000000007a0', null, '+6598000817', 'Worker Six', 'invited');

-- Onboardings: ob1 (w1, supervisor-assisted), ob2 (w2, qr with a known code), ob4 (w4, supervisor-assisted), ob6 (w6, supervisor-assisted)
insert into worker_onboardings (id, legacy_id, worker_id, organization_id, method, status, join_code, invited_at) values
  ('00000000-0000-0000-0000-000000000801', 'ob-t8-1', '00000000-0000-0000-0000-0000000007c1', '00000000-0000-0000-0000-0000000007a0', 'supervisor-assisted', 'invited', null, now()),
  ('00000000-0000-0000-0000-000000000802', 'ob-t8-2', '00000000-0000-0000-0000-0000000007c2', '00000000-0000-0000-0000-0000000007a0', 'qr', 'invited', 'QRT8AA', now()),
  ('00000000-0000-0000-0000-000000000804', 'ob-t8-4', '00000000-0000-0000-0000-0000000007c4', '00000000-0000-0000-0000-0000000007a0', 'supervisor-assisted', 'invited', null, now()),
  ('00000000-0000-0000-0000-000000000806', 'ob-t8-6', '00000000-0000-0000-0000-0000000007c6', '00000000-0000-0000-0000-0000000007a0', 'supervisor-assisted', 'invited', null, now());

-- Active assignment of worker three on the project
insert into worker_project_assignments (id, legacy_id, project_id, worker_id, status, started_at) values
  ('00000000-0000-0000-0000-000000000901', 'asg-t8-3', '00000000-0000-0000-0000-0000000007f1', '00000000-0000-0000-0000-0000000007c3', 'active', now());

-- Structural checks
select has_function('public', 'create_worker_onboarding', array['uuid', 'text'], 'create_worker_onboarding exists');
select has_function('public', 'accept_worker_onboarding', array['uuid', 'text'], 'accept_worker_onboarding exists');
select has_function('public', 'accept_own_worker_onboarding', array['uuid'], 'accept_own_worker_onboarding exists');
select has_function('public', 'mark_worker_joined', array['uuid'], 'mark_worker_joined exists');
select has_function('public', 'end_worker_project_assignment', array['uuid', 'text'], 'end_worker_project_assignment exists');
select is_definer('public', 'create_worker_onboarding', array['uuid', 'text'], 'create_worker_onboarding is security definer');
select is_definer('public', 'accept_worker_onboarding', array['uuid', 'text'], 'accept_worker_onboarding is security definer');
select is_definer('public', 'accept_own_worker_onboarding', array['uuid'], 'accept_own_worker_onboarding is security definer');
select is_definer('public', 'mark_worker_joined', array['uuid'], 'mark_worker_joined is security definer');
select is_definer('public', 'end_worker_project_assignment', array['uuid', 'text'], 'end_worker_project_assignment is security definer');

-- create_worker_onboarding: a worker session cannot create an onboarding
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000007e2"}', true);
select throws_ok(
  $$select public.create_worker_onboarding('00000000-0000-0000-0000-0000000007c5', 'qr')$$,
  'P0001', 'permission:Missing permission "workforce.manage"', 'a worker session cannot create an onboarding');

-- create_worker_onboarding: one open onboarding per worker
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000007e1"}', true);
select throws_ok(
  $$select public.create_worker_onboarding('00000000-0000-0000-0000-0000000007c1', 'qr')$$,
  'P0001', 'conflict:This worker already has an open onboarding.', 'a second open onboarding for a worker is refused');
select is((select count(*)::int from worker_onboardings where worker_id = '00000000-0000-0000-0000-0000000007c1'), 1, 'a refused second onboarding writes no row');
select throws_ok(
  $$select public.create_worker_onboarding('00000000-0000-0000-0000-0000000007c3', 'qr')$$,
  'P0001', 'conflict:Only invited workers need a join.', 'an active worker cannot be given an onboarding');

-- create_worker_onboarding: a qr onboarding gets a 6-character join code
select lives_ok(
  $$select public.create_worker_onboarding('00000000-0000-0000-0000-0000000007c5', 'qr')$$,
  'the supervisor creates a qr onboarding for worker five');
select ok(
  (select join_code ~ '^[A-Z0-9]{6}$' from worker_onboardings where worker_id = '00000000-0000-0000-0000-0000000007c5' and status = 'invited'),
  'the qr join code is 6 uppercase letters or digits');

-- accept_worker_onboarding: a wrong join code is refused and changes nothing
select throws_ok(
  $$select public.accept_worker_onboarding('00000000-0000-0000-0000-000000000802', 'WRONG1')$$,
  'P0001', 'conflict:That join code doesn''t match this invitation.', 'a wrong join code is refused');
select is((select status from worker_onboardings where id = '00000000-0000-0000-0000-000000000802'), 'invited', 'a wrong join code leaves the onboarding invited');
select is((select status from workers where id = '00000000-0000-0000-0000-0000000007c2'), 'invited', 'a wrong join code leaves the worker invited');

-- accept_worker_onboarding: refuses an unlinked worker (no user_id)
select throws_ok(
  $$select public.accept_worker_onboarding('00000000-0000-0000-0000-000000000804', null)$$,
  'P0001', 'conflict:This worker isn''t linked to a sign-in yet.', 'accept refuses an unlinked worker');

-- accept_own_worker_onboarding: refuses a session whose person is not the worker
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000007e3"}', true);
select throws_ok(
  $$select public.accept_own_worker_onboarding('00000000-0000-0000-0000-000000000801')$$,
  'P0001', 'conflict:That phone number doesn''t match this invitation.', 'a session that is not the worker cannot accept the invitation');

-- accept_own_worker_onboarding: the worker's own session activates the worker
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000007e2"}', true);
select lives_ok(
  $$select public.accept_own_worker_onboarding('00000000-0000-0000-0000-000000000801')$$,
  'the worker accepts their own invitation');
select is((select status from workers where id = '00000000-0000-0000-0000-0000000007c1'), 'active', 'accepting activates the worker');
select is((select status from worker_onboardings where id = '00000000-0000-0000-0000-000000000801'), 'accepted', 'accepting marks the onboarding accepted');
select is((select status from memberships where id = '00000000-0000-0000-0000-0000000007b3'), 'active', 'accepting activates the invited worker membership');

-- mark_worker_joined: a worker session cannot mark a worker joined
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000007e2"}', true);
select throws_ok(
  $$select public.mark_worker_joined('00000000-0000-0000-0000-000000000806')$$,
  'P0001', 'permission:Missing permission "workforce.manage"', 'a worker session cannot mark a worker joined');

-- mark_worker_joined: a supervisor activates the worker
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000007e1"}', true);
select lives_ok(
  $$select public.mark_worker_joined('00000000-0000-0000-0000-000000000806')$$,
  'the supervisor marks worker six joined');
select is((select status from workers where id = '00000000-0000-0000-0000-0000000007c6'), 'active', 'marking joined activates the worker');

-- end_worker_project_assignment: ends the assignment and its membership, keeps the worker active
select lives_ok(
  $$select public.end_worker_project_assignment('00000000-0000-0000-0000-000000000901', 'removed')$$,
  'the supervisor ends worker three''s assignment');
select isnt((select ended_at from worker_project_assignments where id = '00000000-0000-0000-0000-000000000901'), null, 'ending sets ended_at');
select is((select status from worker_project_assignments where id = '00000000-0000-0000-0000-000000000901'), 'inactive', 'ending sets the assignment inactive');
select is((select status from memberships where id = '00000000-0000-0000-0000-0000000007b4'), 'inactive', 'ending deactivates the worker project membership');
select is((select status from workers where id = '00000000-0000-0000-0000-0000000007c3'), 'active', 'ending an assignment keeps the worker active');

select * from finish();
rollback;
