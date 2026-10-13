begin;
select plan(27);

-- Fixtures are inserted as the table owner (bypasses RLS). Each check then acts
-- as one signed-in person by switching role and setting the JWT claims for the
-- transaction. See 0020_security_fixes.sql for the same convention.

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-000000002201', 'org-t22-a', 'Org T22 A', 'construction-company'),
  ('00000000-0000-0000-0000-000000002202', 'org-t22-b', 'Org T22 B', 'construction-company');

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-000000002211', 'proj-t22-a', '00000000-0000-0000-0000-000000002201', 'Project T22 A', 'active'),
  ('00000000-0000-0000-0000-000000002212', 'proj-t22-b', '00000000-0000-0000-0000-000000002201', 'Project T22 B', 'active');

-- People: projPm (project.manage scoped to project A only, no org-level
-- membership -- the M1 attacker), orgMgr (org-level project.manage in org A --
-- the legitimate business user), taskMgr (task.manage + project.manage scoped
-- to project B -- runs the M2/M4 checks), homeowner (estimates/marketplace
-- owner), existingPerson (an unrelated person who already has a people row
-- under the phone taskMgr will invite with in M4).
insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-000000002221', 'person-t22-projpm', '+6598102201', 'ProjPM T22', null),
  ('00000000-0000-0000-0000-000000002222', 'person-t22-orgmgr', '+6598102202', 'OrgMgr T22', null),
  ('00000000-0000-0000-0000-000000002223', 'person-t22-taskmgr', '+6598102203', 'TaskMgr T22', null),
  ('00000000-0000-0000-0000-000000002224', 'person-t22-homeowner', '+6598102204', 'Homeowner T22', null),
  ('00000000-0000-0000-0000-000000002225', 'person-t22-existing', '+6598102205', 'Existing Person T22', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000002231'),
  ('00000000-0000-0000-0000-000000002232'),
  ('00000000-0000-0000-0000-000000002233'),
  ('00000000-0000-0000-0000-000000002234');
update people set auth_user_id = '00000000-0000-0000-0000-000000002231' where id = '00000000-0000-0000-0000-000000002221';
update people set auth_user_id = '00000000-0000-0000-0000-000000002232' where id = '00000000-0000-0000-0000-000000002222';
update people set auth_user_id = '00000000-0000-0000-0000-000000002233' where id = '00000000-0000-0000-0000-000000002223';
update people set auth_user_id = '00000000-0000-0000-0000-000000002234' where id = '00000000-0000-0000-0000-000000002224';
-- existingPerson (2225) deliberately has no auth_user_id: they're a person
-- record only (e.g. invited elsewhere before), not someone who has signed in.

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope, status) values
  ('00000000-0000-0000-0000-000000002241', 'm-t22-projpm', '00000000-0000-0000-0000-000000002221', '00000000-0000-0000-0000-000000002201',
    '00000000-0000-0000-0000-000000002211', 'project-manager',
    array['project.read','project.manage','task.manage'], '{}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000002242', 'm-t22-orgmgr', '00000000-0000-0000-0000-000000002222', '00000000-0000-0000-0000-000000002201',
    null, 'business-owner', array['project.manage'], '{}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000002243', 'm-t22-taskmgr', '00000000-0000-0000-0000-000000002223', '00000000-0000-0000-0000-000000002201',
    '00000000-0000-0000-0000-000000002212', 'project-manager',
    array['project.read','project.manage','task.manage'], '{}'::jsonb, 'active');

-- Workers: validWorker belongs to org A and is actively assigned to project B
-- (the legitimate assign_task target); foreignWorker belongs to org B instead,
-- so neither in-org-nor-assigned condition holds for project B.
insert into workers (id, legacy_id, organization_id, phone, name, status) values
  ('00000000-0000-0000-0000-000000002251', 'worker-t22-valid', '00000000-0000-0000-0000-000000002201', '+6598102251', 'Valid Worker T22', 'active'),
  ('00000000-0000-0000-0000-000000002252', 'worker-t22-foreign', '00000000-0000-0000-0000-000000002202', '+6598102252', 'Foreign Worker T22', 'active');

insert into worker_project_assignments (id, legacy_id, project_id, worker_id, project_unit_ids, status) values
  ('00000000-0000-0000-0000-000000002261', 'wpa-t22-valid', '00000000-0000-0000-0000-000000002212', '00000000-0000-0000-0000-000000002251', '{}', 'active');

-- A task on project B, status 'assigned', for the M2 direct-update/transition_task checks.
insert into tasks (id, legacy_id, project_id, title, status) values
  ('00000000-0000-0000-0000-000000002271', 'task-t22', '00000000-0000-0000-0000-000000002212', 'Pour slab', 'assigned');

-- ── M1: create_project requires project.manage somewhere in the org (project-scoped or org-level) ──
-- Migration 0022 originally required an org-level (project_id is null)
-- membership specifically, on the theory that authorizeOrganization's
-- `permission` argument meant project.manage had to be held at the
-- organization level. Task 30's scoped re-review verified the actual domain
-- code (src/domain/constructionCommands.ts authorizeOrganization) and found
-- that reading was wrong -- it does not check project_id scoping at all, only
-- accountType and organizationId -- and that the stricter rule was a live
-- regression (seeded business users like Arjun, who only hold project-scoped
-- project-manager memberships, could no longer create a project at all).
-- Migration 0023's R1 fix corrects this: project.manage on any project in the
-- org is sufficient, same as a project-scoped member granting a membership
-- (see 0023's R2 test for why that is still safe). A worker with no
-- project.manage anywhere in the org is still refused, same as 0014.

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002231"}'; -- projPm: project.manage scoped to project A only
select lives_ok(
  $$select public.create_project('00000000-0000-0000-0000-000000002201', 'Sneaky Project', 'individual-house', 'active', 'Hyderabad')$$,
  'm1: a project-scoped project.manage holder can create a project too (0023 R1)');
reset role;
select is(
  (select count(*)::int from projects where organization_id = '00000000-0000-0000-0000-000000002201' and name = 'Sneaky Project'),
  1, 'm1: the project-scoped member''s project was created');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002232"}'; -- orgMgr: org-level project.manage in org A
select lives_ok(
  $$select public.create_project('00000000-0000-0000-0000-000000002201', 'Legit Project', 'individual-house', 'active', 'Hyderabad')$$,
  'm1: an org-level project.manage holder can create a project');
reset role;
select is(
  (select count(*)::int from projects where organization_id = '00000000-0000-0000-0000-000000002201' and name = 'Legit Project'),
  1, 'm1: the project was created');

-- ── M2a: tasks.status can no longer be changed by a direct update; transition_task still works ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002233"}'; -- taskMgr: task.manage on project B
select throws_ok(
  $$update tasks set status = 'completed' where id = '00000000-0000-0000-0000-000000002271'$$,
  '42501', null, 'm2a: a direct update of tasks.status is refused');
reset role;
select is(
  (select status from tasks where id = '00000000-0000-0000-0000-000000002271'),
  'assigned', 'm2a: the task''s status is unchanged after the refused direct update');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002233"}';
select lives_ok(
  $$select public.transition_task('00000000-0000-0000-0000-000000002271', 'accepted')$$,
  'm2a: transition_task still changes the status through the state machine');
reset role;
select is(
  (select status from tasks where id = '00000000-0000-0000-0000-000000002271'),
  'accepted', 'm2a: the task''s status advanced via transition_task');

-- ── M2b: task_assignments can no longer be inserted directly; assign_task still works ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002233"}'; -- taskMgr: task.manage on project B
select throws_ok(
  $$insert into task_assignments (project_id, task_id, worker_id)
    values ('00000000-0000-0000-0000-000000002212', '00000000-0000-0000-0000-000000002271', '00000000-0000-0000-0000-000000002252')$$,
  '42501', null, 'm2b: a direct insert of a task_assignment is refused, even for a worker outside the organization');
reset role;
select is(
  (select count(*)::int from task_assignments where task_id = '00000000-0000-0000-0000-000000002271'),
  0, 'm2b: no task_assignment row was created by the refused direct insert');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002233"}';
select lives_ok(
  $$select public.assign_task('00000000-0000-0000-0000-000000002271', 'worker', '00000000-0000-0000-0000-000000002251')$$,
  'm2b: assign_task still assigns a worker who is in the organization and assigned to the project');
reset role;
select is(
  (select count(*)::int from task_assignments where task_id = '00000000-0000-0000-0000-000000002271' and worker_id = '00000000-0000-0000-0000-000000002251'),
  1, 'm2b: the task_assignment row was created through assign_task');

-- ── M3: estimates/marketplace_requirements can no longer be written to directly ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002234"}'; -- homeowner
select throws_ok(
  $$insert into estimates (homeowner_person_id, project_name, property_type, location, built_up_area_sqft, construction_level, total_low, total_high)
    values ('00000000-0000-0000-0000-000000002224', 'Forged Estimate', 'villa', 'Hyderabad', 1500, 'premium', 1, 99999999)$$,
  '42501', null, 'm3: a homeowner cannot insert an estimate directly');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002234"}';
select lives_ok(
  $$select public.generate_estimate('My House', 'villa', 'Hyderabad', 1500, 2, 'premium')$$,
  'm3: generate_estimate still works');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002234"}';
select lives_ok(
  $$update estimates set review_status = 'confirmed' where homeowner_person_id = '00000000-0000-0000-0000-000000002224'$$,
  'm3: a direct update of an estimate''s reviewStatus does not error (RLS silently refuses the row, no update policy matched)');
reset role;
select is(
  (select review_status from estimates where homeowner_person_id = '00000000-0000-0000-0000-000000002224' order by created_at desc limit 1),
  'draft', 'm3: the estimate''s reviewStatus is unchanged after the refused direct update');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002234"}';
select lives_ok(
  $$select public.confirm_estimate((select id from estimates where homeowner_person_id = '00000000-0000-0000-0000-000000002224' order by created_at desc limit 1))$$,
  'm3: confirm_estimate still works');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002234"}';
select throws_ok(
  $$insert into marketplace_requirements (estimate_id, homeowner_person_id, project_name, location, built_up_area_sqft, construction_level, property_type, estimate_total_low, estimate_total_high, status, awarded_proposal_id)
    values ((select id from estimates where homeowner_person_id = '00000000-0000-0000-0000-000000002224' order by created_at desc limit 1),
      '00000000-0000-0000-0000-000000002224', 'Forged Req', 'Hyderabad', 1500, 'premium', 'villa', 1, 99999999, 'awarded', gen_random_uuid())$$,
  '42501', null, 'm3: a homeowner cannot insert a marketplace_requirement directly');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002234"}';
select lives_ok(
  $$select public.post_requirement((select id from estimates where homeowner_person_id = '00000000-0000-0000-0000-000000002224' order by created_at desc limit 1))$$,
  'm3: post_requirement still works');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002234"}';
select lives_ok(
  $$update marketplace_requirements set status = 'awarded', awarded_proposal_id = gen_random_uuid()
    where homeowner_person_id = '00000000-0000-0000-0000-000000002224'$$,
  'm3: a direct update of a requirement''s status/awardedProposalId does not error (RLS silently refuses the row)');
reset role;
select is(
  (select status from marketplace_requirements where homeowner_person_id = '00000000-0000-0000-0000-000000002224'),
  'posted', 'm3: the requirement''s status is unchanged after the refused direct update');

-- ── M4: invite_project_member links an existing person by phone instead of duplicating ──

select is(
  (select count(*)::int from people where public.normalize_phone(phone) = public.normalize_phone('+6598102205')),
  1, 'm4: exactly one people row exists for the phone before inviting');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002233"}'; -- taskMgr: project.manage on project B
select lives_ok(
  $$select public.invite_project_member('00000000-0000-0000-0000-000000002212', 'Existing Person T22', '+6598102205', 'supervisor', '{}')$$,
  'm4: inviting a phone that already has a people row succeeds');
reset role;
select is(
  (select count(*)::int from people where public.normalize_phone(phone) = public.normalize_phone('+6598102205')),
  1, 'm4: no duplicate people row was created for that phone');
select is(
  (select person_id from memberships where project_id = '00000000-0000-0000-0000-000000002212' and role = 'supervisor'),
  '00000000-0000-0000-0000-000000002225', 'm4: the new membership links to the existing person');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000002233"}';
select lives_ok(
  $$select public.invite_project_member('00000000-0000-0000-0000-000000002212', 'Brand New Person T22', '+6598102299', 'supervisor', '{}')$$,
  'm4: inviting a genuinely new phone still succeeds');
reset role;
select is(
  (select count(*)::int from people where public.normalize_phone(phone) = public.normalize_phone('+6598102299')),
  1, 'm4: a new people row was created for the genuinely new phone');

select * from finish();
rollback;
