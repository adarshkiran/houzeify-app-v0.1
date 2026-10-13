begin;
select plan(41);

-- Fixtures are inserted as the table owner (bypasses RLS). Each check then acts
-- as one signed-in person (or a bare role) by switching role and/or setting the
-- JWT claims for the transaction. See supabase/tests/0020_security_fixes.sql
-- for the same pattern.

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000023a1', 'org-t23-a', 'Org T23 A', 'construction-company'),
  ('00000000-0000-0000-0000-0000000023a2', 'org-t23-b', 'Org T23 B', 'construction-company');

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000023f1', 'proj-t23-a1', '00000000-0000-0000-0000-0000000023a1', 'Project T23 A1', 'active'),
  ('00000000-0000-0000-0000-0000000023f2', 'proj-t23-a2', '00000000-0000-0000-0000-0000000023a1', 'Project T23 A2', 'active');

insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-0000000023c1', 'unit-t23-a1', '00000000-0000-0000-0000-0000000023f1', 'Unit T23 A1');

-- Global library stage/trade/work-type combo for the daily_progress insert.
insert into stages (id, legacy_id, project_id, name, sort_order) values
  ('00000000-0000-0000-0000-0000000023e5', 'stage-t23', null, 'Structure', 1);
insert into trades (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-0000000023e6', 'trade-t23', null, 'Masonry');
insert into work_types (id, legacy_id, project_id, name, stage_id, trade_id, default_unit) values
  ('00000000-0000-0000-0000-0000000023e7', 'work-t23', null, 'Brickwork',
    '00000000-0000-0000-0000-0000000023e5', '00000000-0000-0000-0000-0000000023e6', 'nos');

-- People: pmA (project-scoped project-manager on project A1 only, no org-level
-- membership -- the regressed S3/M1 business user and the R2 self-escalation
-- attacker), personOther (no membership anywhere yet -- the legitimate grant
-- target), outsider (org-level membership in org B only -- the cross-org
-- attacker), submitter (progress.submit + evidence.capture + issue.manage on
-- project A1 -- the R3 attacker).
insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000023d1', 'person-t23-pm', '+6598023001', 'PM T23 A', null),
  ('00000000-0000-0000-0000-0000000023d2', 'person-t23-other', '+6598023002', 'Other T23', null),
  ('00000000-0000-0000-0000-0000000023d3', 'person-t23-outsider', '+6598023003', 'Outsider T23', null),
  ('00000000-0000-0000-0000-0000000023d4', 'person-t23-submitter', '+6598023004', 'Submitter T23', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000023e1'),
  ('00000000-0000-0000-0000-0000000023e2'),
  ('00000000-0000-0000-0000-0000000023e3'),
  ('00000000-0000-0000-0000-0000000023e4');
update people set auth_user_id = '00000000-0000-0000-0000-0000000023e1' where id = '00000000-0000-0000-0000-0000000023d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000023e2' where id = '00000000-0000-0000-0000-0000000023d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000023e3' where id = '00000000-0000-0000-0000-0000000023d3';
update people set auth_user_id = '00000000-0000-0000-0000-0000000023e4' where id = '00000000-0000-0000-0000-0000000023d4';

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope, status) values
  ('00000000-0000-0000-0000-0000000023b1', 'm-t23-pm', '00000000-0000-0000-0000-0000000023d1', '00000000-0000-0000-0000-0000000023a1',
    '00000000-0000-0000-0000-0000000023f1', 'project-manager',
    array['project.read','project.manage','task.manage','progress.submit','progress.review','customer.publish','workforce.manage','evidence.capture','issue.manage'],
    '{}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-0000000023b2', 'm-t23-outsider', '00000000-0000-0000-0000-0000000023d3', '00000000-0000-0000-0000-0000000023a2',
    null, 'business-owner', array['project.manage'], '{}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-0000000023b3', 'm-t23-submitter', '00000000-0000-0000-0000-0000000023d4', '00000000-0000-0000-0000-0000000023a1',
    '00000000-0000-0000-0000-0000000023f1', 'worker',
    array['project.read','progress.submit','evidence.capture','issue.manage'], '{}'::jsonb, 'active');

-- ── R1: create_project / update_organization_profile accept ANY active membership ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e1"}'; -- pmA: project-scoped only, no org-level membership
select lives_ok(
  $$select public.create_project('00000000-0000-0000-0000-0000000023a1', 'New T23 Project', 'individual-house', 'planning', 'Bengaluru')$$,
  'r1: a project-scoped business user (pmA) can create a project again (the regression)');
reset role;
select is(
  (select organization_id from projects where legacy_id is null and name = 'New T23 Project'),
  '00000000-0000-0000-0000-0000000023a1'::uuid,
  'r1: the new project belongs to org A');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e1"}';
select lives_ok(
  $$select public.update_organization_profile('00000000-0000-0000-0000-0000000023a1', 'T23 Co', 'contractor', 'Bengaluru', '+919000000002', '6-10')$$,
  'r1: pmA can update org A''s profile again (the regression)');
reset role;
select is((select name from organizations where id = '00000000-0000-0000-0000-0000000023a1'), 'T23 Co', 'r1: the name is set');

set local role anon;
set local request.jwt.claims = '{}';
select throws_ok(
  $$select public.create_project('00000000-0000-0000-0000-0000000023a1', 'Anon Project', 'individual-house', 'planning', 'Bengaluru')$$,
  'P0001', null, 'r1: anon still cannot create a project in org A');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e3"}'; -- outsider: org B only
select throws_ok(
  $$select public.create_project('00000000-0000-0000-0000-0000000023a1', 'Cross Org Project', 'individual-house', 'planning', 'Bengaluru')$$,
  'P0001', null, 'r1: a person from org B still cannot create a project in org A');
reset role;

set local role anon;
set local request.jwt.claims = '{}';
select throws_ok(
  $$select public.update_organization_profile('00000000-0000-0000-0000-0000000023a1', 'Hijacked', 'contractor', 'Hyderabad', '+919000000003', '1-5')$$,
  'P0001', null, 'r1: anon still cannot update org A''s profile');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e3"}';
select throws_ok(
  $$select public.update_organization_profile('00000000-0000-0000-0000-0000000023a1', 'Hijacked', 'contractor', 'Hyderabad', '+919000000003', '1-5')$$,
  'P0001', null, 'r1: a person from org B still cannot update org A''s profile');
reset role;

-- ── R2: membership_target_allowed closes the self-escalation path ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e1"}'; -- pmA: project.manage on project A1 only
select throws_ok(
  $$insert into memberships (person_id, organization_id, project_id, role, permissions, scope, status)
    values ('00000000-0000-0000-0000-0000000023d1', '00000000-0000-0000-0000-0000000023a1', null,
      'business-owner', array['project.manage','workforce.manage','customer.publish'], '{}'::jsonb, 'active')$$,
  '42501', null, 'r2: pmA cannot grant themselves a new org-level membership (the self-escalation exploit)');
reset role;
select is(
  (select count(*)::int from memberships where person_id = '00000000-0000-0000-0000-0000000023d1' and project_id is null),
  0, 'r2: no org-level membership was created for pmA');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e1"}';
select lives_ok(
  $$insert into memberships (person_id, organization_id, project_id, role, permissions, scope, status)
    values ('00000000-0000-0000-0000-0000000023d2', '00000000-0000-0000-0000-0000000023a1', null,
      'business-owner', array['project.manage'], '{}'::jsonb, 'active')$$,
  'r2: pmA can still grant a new org-level membership to someone else');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e1"}';
select lives_ok(
  $$insert into memberships (id, person_id, organization_id, project_id, role, permissions, scope, status)
    values ('00000000-0000-0000-0000-0000000023b4', '00000000-0000-0000-0000-0000000023d2', '00000000-0000-0000-0000-0000000023a1',
      '00000000-0000-0000-0000-0000000023f1', 'supervisor', array['progress.submit'], '{}'::jsonb, 'active')$$,
  'r2: pmA can still grant a new project-scoped membership to someone else too');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e1"}'; -- pmA, targeting his own existing row
select lives_ok(
  $$update memberships set permissions = array['project.read','project.manage','task.manage','progress.submit',
      'progress.review','customer.publish','workforce.manage','evidence.capture','issue.manage','issue.manage']
    where id = '00000000-0000-0000-0000-0000000023b1'$$,
  'r2: the direct self-update statement does not error (RLS silently refuses the row)');
reset role;
select is(
  (select array_length(permissions, 1) from memberships where id = '00000000-0000-0000-0000-0000000023b1'),
  9, 'r2: pmA''s own membership permissions were not changed');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e1"}'; -- pmA, targeting personOther's membership (b4)
select lives_ok(
  $$update memberships set role = 'site-engineer' where id = '00000000-0000-0000-0000-0000000023b4'$$,
  'r2: pmA can still update someone else''s membership');
reset role;
select is((select role from memberships where id = '00000000-0000-0000-0000-0000000023b4'), 'site-engineer', 'r2: the role change took effect');

-- ── R3: INSERT-side visibility bypass on evidence/documents/issues/daily_progress ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e4"}'; -- submitter
select throws_ok(
  $$insert into evidence (project_id, project_unit_id, type, url, customer_visibility, captured_by_membership_id)
    values ('00000000-0000-0000-0000-0000000023f1', '00000000-0000-0000-0000-0000000023c1', 'photo',
      'https://example.test/exploit.jpg', 'customer-visible', '00000000-0000-0000-0000-0000000023b3')$$,
  '42501', null, 'r3: evidence cannot be inserted already customer-visible');
reset role;
select is(
  (select count(*)::int from evidence where project_id = '00000000-0000-0000-0000-0000000023f1' and customer_visibility = 'customer-visible'),
  0, 'r3: no customer-visible evidence row was created');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e4"}';
select lives_ok(
  $$insert into evidence (id, project_id, project_unit_id, type, url, customer_visibility, captured_by_membership_id)
    values ('00000000-0000-0000-0000-0000000023ea', '00000000-0000-0000-0000-0000000023f1', '00000000-0000-0000-0000-0000000023c1',
      'photo', 'https://example.test/legit.jpg', 'private', '00000000-0000-0000-0000-0000000023b3')$$,
  'r3: a normal private evidence insert still works');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e4"}';
select throws_ok(
  $$insert into documents (project_id, title, category, url, uploaded_by_membership_id, shared_with_homeowner)
    values ('00000000-0000-0000-0000-0000000023f1', 'Exploit Doc', 'contract', 'https://example.test/exploit.pdf',
      '00000000-0000-0000-0000-0000000023b3', true)$$,
  '42501', null, 'r3: a document cannot be inserted already shared with the homeowner');
reset role;
select is(
  (select count(*)::int from documents where project_id = '00000000-0000-0000-0000-0000000023f1' and shared_with_homeowner = true),
  0, 'r3: no shared document row was created');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e4"}';
select lives_ok(
  $$insert into documents (id, project_id, title, category, url, uploaded_by_membership_id, shared_with_homeowner)
    values ('00000000-0000-0000-0000-0000000023eb', '00000000-0000-0000-0000-0000000023f1', 'Legit Doc', 'contract',
      'https://example.test/legit.pdf', '00000000-0000-0000-0000-0000000023b3', false)$$,
  'r3: a normal unshared document insert still works');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e4"}';
select throws_ok(
  $$insert into issues (project_id, title, created_by_membership_id, customer_visible)
    values ('00000000-0000-0000-0000-0000000023f1', 'Exploit Issue', '00000000-0000-0000-0000-0000000023b3', true)$$,
  '42501', null, 'r3: an issue cannot be inserted already customer-visible');
reset role;
select is(
  (select count(*)::int from issues where project_id = '00000000-0000-0000-0000-0000000023f1' and customer_visible = true),
  0, 'r3: no customer-visible issue row was created');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e4"}';
select lives_ok(
  $$insert into issues (id, project_id, title, created_by_membership_id, customer_visible)
    values ('00000000-0000-0000-0000-0000000023ec', '00000000-0000-0000-0000-0000000023f1', 'Legit Issue',
      '00000000-0000-0000-0000-0000000023b3', false)$$,
  'r3: a normal private issue insert still works');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e4"}';
select throws_ok(
  $$insert into daily_progress (project_id, project_unit_id, stage_id, trade_id, work_type_id, date, today_summary,
      tomorrow_plan, submitted_by_membership_id, review_status, publication_status, version)
    values ('00000000-0000-0000-0000-0000000023f1', '00000000-0000-0000-0000-0000000023c1',
      '00000000-0000-0000-0000-0000000023e5', '00000000-0000-0000-0000-0000000023e6', '00000000-0000-0000-0000-0000000023e7',
      current_date, 'exploit summary', 'exploit plan', '00000000-0000-0000-0000-0000000023b3', 'approved', 'published', 1)$$,
  '42501', null, 'r3: a daily progress row cannot be inserted already approved and published');
reset role;
select is(
  (select count(*)::int from daily_progress where project_id = '00000000-0000-0000-0000-0000000023f1'
    and review_status = 'approved' and publication_status = 'published'),
  0, 'r3: no already-approved-and-published daily progress row was created');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e4"}';
select lives_ok(
  $$insert into daily_progress (id, project_id, project_unit_id, stage_id, trade_id, work_type_id, date, today_summary,
      tomorrow_plan, submitted_by_membership_id, review_status, publication_status, version)
    values ('00000000-0000-0000-0000-0000000023ed', '00000000-0000-0000-0000-0000000023f1', '00000000-0000-0000-0000-0000000023c1',
      '00000000-0000-0000-0000-0000000023e5', '00000000-0000-0000-0000-0000000023e6', '00000000-0000-0000-0000-0000000023e7',
      current_date, 'legit summary', 'legit plan', '00000000-0000-0000-0000-0000000023b3', 'submitted', 'private', 1)$$,
  'r3: a normal draft/submitted daily progress insert still works');
reset role;

update evidence set daily_progress_id = '00000000-0000-0000-0000-0000000023ed' where id = '00000000-0000-0000-0000-0000000023ea';

-- The publish_* functions (the only legitimate path to flip visibility) still work.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e1"}'; -- pmA: customer.publish
select lives_ok(
  $$select public.publish_issue('00000000-0000-0000-0000-0000000023ec', true)$$,
  'r3: publish_issue still works');
select lives_ok(
  $$select public.publish_document('00000000-0000-0000-0000-0000000023eb', true)$$,
  'r3: publish_document still works');
select lives_ok(
  $$select public.review_daily_progress('00000000-0000-0000-0000-0000000023ed', 'approve', null)$$,
  'r3: review_daily_progress still works');
select lives_ok(
  $$select public.publish_daily_progress_evidence('00000000-0000-0000-0000-0000000023ed', array['00000000-0000-0000-0000-0000000023ea']::uuid[])$$,
  'r3: publish_daily_progress_evidence still works');
reset role;
select is((select customer_visible from issues where id = '00000000-0000-0000-0000-0000000023ec'), true, 'r3: publish_issue flipped visibility through the function');
select is((select shared_with_homeowner from documents where id = '00000000-0000-0000-0000-0000000023eb'), true, 'r3: publish_document flipped visibility through the function');
select is((select review_status from daily_progress where id = '00000000-0000-0000-0000-0000000023ed'), 'approved', 'r3: review_daily_progress approved the update through the function');
select is((select publication_status from daily_progress where id = '00000000-0000-0000-0000-0000000023ed'), 'published', 'r3: publish_daily_progress_evidence published the update through the function');

-- ── New Issue 4: tasks INSERT pinned to status = 'draft'; task_assignments UPDATE dropped ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e1"}'; -- pmA: task.manage on project A1
select throws_ok(
  $$insert into tasks (project_id, project_unit_id, title, status)
    values ('00000000-0000-0000-0000-0000000023f1', '00000000-0000-0000-0000-0000000023c1', 'Exploit Task', 'approved')$$,
  '42501', null, 'new issue 4: a task cannot be inserted with a status other than draft');
reset role;
select is(
  (select count(*)::int from tasks where project_id = '00000000-0000-0000-0000-0000000023f1' and status = 'approved'),
  0, 'new issue 4: no approved task was created directly');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e1"}';
select lives_ok(
  $$insert into tasks (id, project_id, project_unit_id, title, status)
    values ('00000000-0000-0000-0000-0000000023ee', '00000000-0000-0000-0000-0000000023f1', '00000000-0000-0000-0000-0000000023c1', 'Legit Task', 'draft')$$,
  'new issue 4: inserting a task with status draft still works');
reset role;

insert into workers (id, legacy_id, organization_id, phone, name, trade_ids, languages, onboarding_method, status) values
  ('00000000-0000-0000-0000-000000023001', 'worker-t23-a', '00000000-0000-0000-0000-0000000023a1', '+6598023101', 'Worker T23 A', array[]::text[], array['en'], 'manual', 'active'),
  ('00000000-0000-0000-0000-000000023002', 'worker-t23-b', '00000000-0000-0000-0000-0000000023a2', '+6598023102', 'Worker T23 B', array[]::text[], array['en'], 'manual', 'active');
insert into task_assignments (id, legacy_id, project_id, task_id, worker_id) values
  ('00000000-0000-0000-0000-000000023003', 'assign-t23-a', '00000000-0000-0000-0000-0000000023f1', '00000000-0000-0000-0000-0000000023ee', '00000000-0000-0000-0000-000000023001');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000023e1"}'; -- pmA: task.manage on project A1
select lives_ok(
  $$update task_assignments set worker_id = '00000000-0000-0000-0000-000000023002' where id = '00000000-0000-0000-0000-000000023003'$$,
  'new issue 4: the direct assignment update statement does not error (RLS silently refuses the row)');
reset role;
select is(
  (select worker_id from task_assignments where id = '00000000-0000-0000-0000-000000023003'),
  '00000000-0000-0000-0000-000000023001'::uuid,
  'new issue 4: the assignment still points to the org-A worker');

select * from finish();
rollback;
