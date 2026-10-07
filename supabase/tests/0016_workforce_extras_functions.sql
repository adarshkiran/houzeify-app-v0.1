begin;
select plan(47);

-- Fixtures are inserted as the table owner (bypasses RLS). Each call is made as
-- one signed-in person by setting the JWT claims for the transaction.

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000016a0', 'org-t16', 'Org T16', 'construction-company'),
  ('00000000-0000-0000-0000-0000000016a9', 'org-t16-other', 'Org T16 Other', 'construction-company');

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000016f1', 'proj-t16', '00000000-0000-0000-0000-0000000016a0', 'Project T16', 'active'),
  ('00000000-0000-0000-0000-0000000016f2', 'proj-t16-foreign', '00000000-0000-0000-0000-0000000016a9', 'Foreign Project T16', 'active');

insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000001681', 'unit-t16-a', '00000000-0000-0000-0000-0000000016f1', 'Unit A'),
  ('00000000-0000-0000-0000-000000001682', 'unit-t16-b', '00000000-0000-0000-0000-0000000016f1', 'Unit B');
insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000001683', 'unit-t16-foreign', '00000000-0000-0000-0000-0000000016f2', 'Foreign Unit');

-- People: pm (unscoped, project.manage + workforce.manage), scoped-pm (workforce.manage
-- scoped to Unit A only), site (progress.submit only, no workforce.manage), worker-person
-- (linked to the invited worker c2, already has an invited team membership).
insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000016d1', 'person-t16-pm', '+6598101601', 'Manager T16', null),
  ('00000000-0000-0000-0000-0000000016d2', 'person-t16-scoped', '+6598101602', 'Scoped PM T16', null),
  ('00000000-0000-0000-0000-0000000016d3', 'person-t16-site', '+6598101603', 'Site T16', null),
  ('00000000-0000-0000-0000-0000000016d4', 'person-t16-worker', '+6598101604', 'Worker Person T16', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000016e1'),
  ('00000000-0000-0000-0000-0000000016e2'),
  ('00000000-0000-0000-0000-0000000016e3'),
  ('00000000-0000-0000-0000-0000000016e4');
update people set auth_user_id = '00000000-0000-0000-0000-0000000016e1' where id = '00000000-0000-0000-0000-0000000016d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000016e2' where id = '00000000-0000-0000-0000-0000000016d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000016e3' where id = '00000000-0000-0000-0000-0000000016d3';
update people set auth_user_id = '00000000-0000-0000-0000-0000000016e4' where id = '00000000-0000-0000-0000-0000000016d4';

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope, status) values
  ('00000000-0000-0000-0000-000000001691', 'm-t16-pm', '00000000-0000-0000-0000-0000000016d1', '00000000-0000-0000-0000-0000000016a0',
    '00000000-0000-0000-0000-0000000016f1', 'project-manager',
    array['project.read','project.manage','task.manage','progress.submit','workforce.manage'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000001692', 'm-t16-scoped', '00000000-0000-0000-0000-0000000016d2', '00000000-0000-0000-0000-0000000016a0',
    '00000000-0000-0000-0000-0000000016f1', 'project-manager',
    array['project.read','workforce.manage'],
    '{"projectUnitIds": ["00000000-0000-0000-0000-000000001681"], "stageIds": [], "tradeIds": []}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000001693', 'm-t16-site', '00000000-0000-0000-0000-0000000016d3', '00000000-0000-0000-0000-0000000016a0',
    '00000000-0000-0000-0000-0000000016f1', 'worker',
    array['progress.submit'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000001694', 'm-t16-worker-invited', '00000000-0000-0000-0000-0000000016d4', '00000000-0000-0000-0000-0000000016a0',
    '00000000-0000-0000-0000-0000000016f1', 'worker',
    array['project.read','progress.submit','evidence.capture'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'invited');

-- Workers: c1 existing active worker (phone collision target); c2 invited worker
-- linked to person d4, no assignment yet; c3 belongs to a different organization.
insert into workers (id, legacy_id, organization_id, user_id, phone, name, status) values
  ('00000000-0000-0000-0000-0000000016c1', 'worker-t16-1', '00000000-0000-0000-0000-0000000016a0',
    null, '+6598102601', 'Worker One', 'active'),
  ('00000000-0000-0000-0000-0000000016c2', 'worker-t16-2', '00000000-0000-0000-0000-0000000016a0',
    '00000000-0000-0000-0000-0000000016d4', '+6598102602', 'Worker Two', 'invited'),
  ('00000000-0000-0000-0000-0000000016c3', 'worker-t16-3', '00000000-0000-0000-0000-0000000016a9',
    null, '+6598102603', 'Worker Three', 'active');

-- Onboardings for cancel tests: ob1 invited (c4), ob2 already accepted (c5).
insert into workers (id, legacy_id, organization_id, user_id, phone, name, status) values
  ('00000000-0000-0000-0000-0000000016c4', 'worker-t16-4', '00000000-0000-0000-0000-0000000016a0',
    null, '+6598102604', 'Worker Four', 'invited'),
  ('00000000-0000-0000-0000-0000000016c5', 'worker-t16-5', '00000000-0000-0000-0000-0000000016a0',
    null, '+6598102605', 'Worker Five', 'active');
insert into worker_onboardings (id, legacy_id, worker_id, organization_id, method, status, invited_at) values
  ('00000000-0000-0000-0000-000000001601', 'ob-t16-invited', '00000000-0000-0000-0000-0000000016c4',
    '00000000-0000-0000-0000-0000000016a0', 'manual', 'invited', now()),
  ('00000000-0000-0000-0000-000000001602', 'ob-t16-accepted', '00000000-0000-0000-0000-0000000016c5',
    '00000000-0000-0000-0000-0000000016a0', 'manual', 'accepted', now());

-- Structural checks

select has_function('public', 'add_worker', array['uuid','text','text','uuid[]','text[]','uuid','uuid[]'], 'add_worker exists');
select has_function('public', 'invite_project_member', array['uuid','text','text','text','uuid[]'], 'invite_project_member exists');
select has_function('public', 'assign_worker_to_project', array['uuid','uuid','uuid[]','uuid[]'], 'assign_worker_to_project exists');
select has_function('public', 'cancel_worker_onboarding', array['uuid'], 'cancel_worker_onboarding exists');
select is_definer('public', 'add_worker', array['uuid','text','text','uuid[]','text[]','uuid','uuid[]'], 'add_worker is security definer');
select is_definer('public', 'assign_worker_to_project', array['uuid','uuid','uuid[]','uuid[]'], 'assign_worker_to_project is security definer');

-- ── add_worker: permission and duplicate-phone checks (shared with invite_project_member) ──

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000016e3"}', true);
select throws_ok(
  $$select public.add_worker('00000000-0000-0000-0000-0000000016a0', 'New Worker', '+6598109001', '{}', array['en'], null, null)$$,
  'P0001', 'permission:Missing permission "workforce.manage"',
  'a progress.submit-only session cannot add a worker'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000016e1"}', true);
select throws_ok(
  $$select public.add_worker('00000000-0000-0000-0000-0000000016a0', 'Dup Worker', '+6598102601', '{}', array['en'], null, null)$$,
  'P0001', 'conflict:A worker with this phone number already exists in your organization.',
  'add_worker refuses a phone already used by another worker in the organization (shared assert_phone_free)'
);
select is(
  (select count(*)::int from workers where organization_id = '00000000-0000-0000-0000-0000000016a0' and phone = '+6598102601'),
  1, 'the duplicate add_worker call inserted no new row'
);

select lives_ok(
  $$select public.add_worker('00000000-0000-0000-0000-0000000016a0', 'Brand New Worker', '+6598109002', '{}', array['en'], null, null)$$,
  'the pm adds a worker with no phone collision and no project'
);
select is(
  (select status from workers where organization_id = '00000000-0000-0000-0000-0000000016a0' and phone = '+6598109002'),
  'invited', 'the new worker starts invited'
);
select is(
  (select method from worker_onboardings where worker_id = (select id from workers where phone = '+6598109002')),
  'manual', 'the new worker gets a manual onboarding'
);

-- addWorker with a project: scoped pm can only add inside Unit A
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000016e2"}', true);
select throws_ok(
  $$select public.add_worker('00000000-0000-0000-0000-0000000016a0', 'Scoped Add', '+6598109003', '{}', array['en'],
      '00000000-0000-0000-0000-0000000016f1', array['00000000-0000-0000-0000-000000001682']::uuid[])$$,
  'P0001', 'permission:Missing permission "workforce.manage" on project 00000000-0000-0000-0000-0000000016f1',
  'a scoped pm cannot add a worker assigned outside their scope (Unit B)'
);
select lives_ok(
  $$select public.add_worker('00000000-0000-0000-0000-0000000016a0', 'Scoped Add Ok', '+6598109004', '{}', array['en'],
      '00000000-0000-0000-0000-0000000016f1', array['00000000-0000-0000-0000-000000001681']::uuid[])$$,
  'a scoped pm adds a worker assigned inside their scope (Unit A), creating an invited assignment'
);
select is(
  (select status from worker_project_assignments
    where worker_id = (select id from workers where phone = '+6598109004') and project_id = '00000000-0000-0000-0000-0000000016f1'),
  'invited', 'addWorker''s auto-assignment for a freshly invited worker starts invited'
);

-- ── invite_project_member ───────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000016e3"}', true);
select throws_ok(
  $$select public.invite_project_member('00000000-0000-0000-0000-0000000016f1', 'Nobody', null, 'worker', null)$$,
  'P0001', 'permission:Missing permission "project.manage" on project 00000000-0000-0000-0000-0000000016f1',
  'a progress.submit-only session cannot invite a project member'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000016e1"}', true);
select throws_ok(
  $$select public.invite_project_member('00000000-0000-0000-0000-0000000016f1', 'Team Dup', '+6598101603', 'contractor', null)$$,
  'P0001', 'conflict:Someone with this phone number is already on the project team.',
  'invite_project_member refuses a phone already on the project team'
);

select throws_ok(
  $$select public.invite_project_member('00000000-0000-0000-0000-0000000016f1', 'Worker Dup', '+6598102601', 'worker', null)$$,
  'P0001', 'conflict:A worker with this phone number already exists in your organization.',
  'invite_project_member''s worker role refuses a phone already used by an organization worker (shared assert_phone_free)'
);
select is(
  (select count(*)::int from people where phone = '+6598102601'),
  0, 'the refused worker-role invite created no person row'
);

select lives_ok(
  $$select public.invite_project_member('00000000-0000-0000-0000-0000000016f1', 'New Contractor', '+6598109010', 'contractor', null)$$,
  'the unscoped pm invites a non-worker project member'
);
select is(
  (select role from memberships where person_id = (select id from people where phone = '+6598109010')),
  'contractor', 'the new membership has the invited role'
);
select is(
  (select status from memberships where person_id = (select id from people where phone = '+6598109010')),
  'invited', 'the new membership starts invited'
);
select is(
  (select count(*)::int from workers where user_id = (select id from people where phone = '+6598109010')),
  0, 'a non-worker invite creates no worker record'
);

select lives_ok(
  $$select public.invite_project_member('00000000-0000-0000-0000-0000000016f1', 'New Team Worker', '+6598109011', 'worker', null)$$,
  'the unscoped pm invites a worker-role project member'
);
select is(
  (select status from workers where user_id = (select id from people where phone = '+6598109011')),
  'invited', 'the worker-role invite creates a worker record, starting invited'
);
select is(
  (select method from worker_onboardings where worker_id = (select id from workers where phone = '+6598109011')),
  'manual', 'the worker-role invite creates a manual onboarding'
);

-- ── assign_worker_to_project ─────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000016e3"}', true);
select throws_ok(
  $$select public.assign_worker_to_project('00000000-0000-0000-0000-0000000016c1', '00000000-0000-0000-0000-0000000016f1', null, null)$$,
  'P0001', 'permission:Missing permission "workforce.manage" on project 00000000-0000-0000-0000-0000000016f1',
  'a progress.submit-only session cannot assign a worker to a project'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000016e1"}', true);
select throws_ok(
  $$select public.assign_worker_to_project('00000000-0000-0000-0000-0000000016c3', '00000000-0000-0000-0000-0000000016f1', null, null)$$,
  'P0001', 'Worker 00000000-0000-0000-0000-0000000016c3 is not in the organization that owns project 00000000-0000-0000-0000-0000000016f1',
  'a worker from a different organization is refused (plain integrity error, not a conflict/permission refusal)'
);

-- An invited worker's assignment starts invited, with no active membership created
-- (the existing invited team membership for the same person stays as the only one).
select lives_ok(
  $$select public.assign_worker_to_project('00000000-0000-0000-0000-0000000016c2', '00000000-0000-0000-0000-0000000016f1', null, null)$$,
  'the pm assigns an invited worker to the project'
);
select is(
  (select status from worker_project_assignments
    where worker_id = '00000000-0000-0000-0000-0000000016c2' and project_id = '00000000-0000-0000-0000-0000000016f1'),
  'invited', 'an invited worker''s assignment starts invited, not active (R12)'
);
select is(
  (select started_at from worker_project_assignments
    where worker_id = '00000000-0000-0000-0000-0000000016c2' and project_id = '00000000-0000-0000-0000-0000000016f1'),
  null, 'an invited assignment has no started_at'
);
select is(
  (select count(*)::int from memberships
    where person_id = '00000000-0000-0000-0000-0000000016d4' and project_id = '00000000-0000-0000-0000-0000000016f1' and role = 'worker'),
  1, 'no new active membership is created for an invited worker -- the existing invited team membership is the only one'
);
select is(
  (select status from memberships where id = '00000000-0000-0000-0000-000000001694'),
  'invited', 'the pre-existing team membership for the invited worker is left invited, not activated'
);

-- Re-assigning the same invited worker to the same project is refused.
select throws_ok(
  $$select public.assign_worker_to_project('00000000-0000-0000-0000-0000000016c2', '00000000-0000-0000-0000-0000000016f1', null, null)$$,
  'P0001', 'conflict:This worker is already assigned to this project.',
  'an already-invited assignment on the same project is refused'
);

-- An active worker's assignment starts active immediately.
select lives_ok(
  $$select public.assign_worker_to_project('00000000-0000-0000-0000-0000000016c1', '00000000-0000-0000-0000-0000000016f1', null, null)$$,
  'the pm assigns an active worker to the project'
);
select is(
  (select status from worker_project_assignments
    where worker_id = '00000000-0000-0000-0000-0000000016c1' and project_id = '00000000-0000-0000-0000-0000000016f1'),
  'active', 'an active worker''s assignment starts active'
);
select isnt(
  (select started_at from worker_project_assignments
    where worker_id = '00000000-0000-0000-0000-0000000016c1' and project_id = '00000000-0000-0000-0000-0000000016f1'),
  null, 'an active assignment has a started_at'
);

-- Re-assigning an already-active worker returns the existing row rather than erroring.
select lives_ok(
  $$select public.assign_worker_to_project('00000000-0000-0000-0000-0000000016c1', '00000000-0000-0000-0000-0000000016f1', null, null)$$,
  're-assigning an already-active worker lives (returns the existing assignment)'
);
select is(
  (select count(*)::int from worker_project_assignments
    where worker_id = '00000000-0000-0000-0000-0000000016c1' and project_id = '00000000-0000-0000-0000-0000000016f1'),
  1, 're-assigning an already-active worker creates no second row'
);

-- A unit outside the project is refused.
select throws_ok(
  $$select public.assign_worker_to_project('00000000-0000-0000-0000-0000000016c5', '00000000-0000-0000-0000-0000000016f1',
      array['00000000-0000-0000-0000-000000001683']::uuid[], null)$$,
  'P0001', 'Unit 00000000-0000-0000-0000-000000001683 does not belong to project 00000000-0000-0000-0000-0000000016f1',
  'a unit from another project is refused'
);

-- ── cancel_worker_onboarding ─────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000016e3"}', true);
select throws_ok(
  $$select public.cancel_worker_onboarding('00000000-0000-0000-0000-000000001601')$$,
  'P0001', 'permission:Missing permission "workforce.manage"',
  'a progress.submit-only session cannot cancel an onboarding'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000016e1"}', true);
select throws_ok(
  $$select public.cancel_worker_onboarding('00000000-0000-0000-0000-000000000000')$$,
  'P0001', 'conflict:That onboarding no longer exists.',
  'cancelling an unknown onboarding is refused'
);

select throws_ok(
  $$select public.cancel_worker_onboarding('00000000-0000-0000-0000-000000001602')$$,
  'P0001', 'conflict:Only an invitation that hasn''t been accepted can be cancelled.',
  'cancelling an already-accepted onboarding is refused'
);
select is(
  (select status from worker_onboardings where id = '00000000-0000-0000-0000-000000001602'),
  'accepted', 'the already-accepted onboarding is left unchanged'
);

select lives_ok(
  $$select public.cancel_worker_onboarding('00000000-0000-0000-0000-000000001601')$$,
  'cancelling an invited onboarding lives'
);
select is(
  (select status from worker_onboardings where id = '00000000-0000-0000-0000-000000001601'),
  'cancelled', 'the invited onboarding becomes cancelled'
);
select is(
  (select status from workers where id = '00000000-0000-0000-0000-0000000016c4'),
  'invited', 'the worker record itself is left unchanged by cancellation'
);

select * from finish();
rollback;
