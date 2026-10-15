begin;
select plan(19);

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000025a1', 'org-t25', 'Org T25', 'construction-company'),
  ('00000000-0000-0000-0000-0000000025a2', 'org-t25-other', 'Other Org T25', 'construction-company');

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000025f1', 'proj-t25', '00000000-0000-0000-0000-0000000025a1', 'Project T25', 'active'),
  ('00000000-0000-0000-0000-0000000025f2', 'proj-t25-b', '00000000-0000-0000-0000-0000000025a1', 'Project T25 B', 'active');

insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000025d1', 'person-t25-manager', '+6598025001', 'Manager T25', null),
  ('00000000-0000-0000-0000-0000000025d2', 'person-t25-reader', '+6598025002', 'Reader T25', null),
  ('00000000-0000-0000-0000-0000000025d3', 'person-t25-other-org', '+6598025003', 'Other Org T25', null),
  ('00000000-0000-0000-0000-0000000025d4', 'person-t25-home', '+6598025004', 'Homeowner T25', null),
  ('00000000-0000-0000-0000-0000000025d5', 'person-t25-scoped', '+6598025005', 'Scoped Manager T25', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000025e1'), ('00000000-0000-0000-0000-0000000025e2'),
  ('00000000-0000-0000-0000-0000000025e3'), ('00000000-0000-0000-0000-0000000025e4'),
  ('00000000-0000-0000-0000-0000000025e5');
update people set auth_user_id = '00000000-0000-0000-0000-0000000025e1' where id = '00000000-0000-0000-0000-0000000025d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000025e2' where id = '00000000-0000-0000-0000-0000000025d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000025e3' where id = '00000000-0000-0000-0000-0000000025d3';
update people set auth_user_id = '00000000-0000-0000-0000-0000000025e4' where id = '00000000-0000-0000-0000-0000000025d4';
update people set auth_user_id = '00000000-0000-0000-0000-0000000025e5' where id = '00000000-0000-0000-0000-0000000025d5';

insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-0000000025c1', 'unit-t25', '00000000-0000-0000-0000-0000000025f1', 'Unit T25');

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope) values
  ('00000000-0000-0000-0000-0000000025b1', 'm-t25-manager', '00000000-0000-0000-0000-0000000025d1', '00000000-0000-0000-0000-0000000025a1',
   '00000000-0000-0000-0000-0000000025f1', 'project-manager', array['project.read', 'project.manage'], '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000025b2', 'm-t25-reader', '00000000-0000-0000-0000-0000000025d2', '00000000-0000-0000-0000-0000000025a1',
   '00000000-0000-0000-0000-0000000025f1', 'supervisor', array['project.read'], '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000025b3', 'm-t25-other', '00000000-0000-0000-0000-0000000025d3', '00000000-0000-0000-0000-0000000025a2',
   null, 'owner', array['project.read', 'project.manage'], '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000025b4', 'm-t25-home', '00000000-0000-0000-0000-0000000025d4', '00000000-0000-0000-0000-0000000025a1',
   '00000000-0000-0000-0000-0000000025f1', 'homeowner', array['project.read'], '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000025b5', 'm-t25-scoped', '00000000-0000-0000-0000-0000000025d5', '00000000-0000-0000-0000-0000000025a1',
   '00000000-0000-0000-0000-0000000025f1', 'project-manager', array['project.read', 'project.manage'],
   '{"projectUnitIds": ["00000000-0000-0000-0000-0000000025c1"]}'::jsonb);

-- What the domain's analyzeProject produces, as a draft. The id inside is the
-- project's uuid, as the adapter substitutes before sending.
create temp table t25_payload as
select jsonb_build_object(
  'projectId', '00000000-0000-0000-0000-0000000025f1',
  'asOf', '2026-10-15',
  'status', 'at-risk',
  'summary', jsonb_build_array('At risk: overall progress is 20%.'),
  'signals', '[]'::jsonb,
  'source', 'ai',
  'createdBy', 'ai',
  'engine', 'rules-v1',
  'confidence', 'medium',
  'assumptions', '[]'::jsonb,
  'reviewStatus', 'draft',
  'generatedAt', '2026-10-15T09:00:00.000Z'
) as p;
grant select on t25_payload to authenticated;

select has_table('public', 'project_reports', 'project_reports exists');
select has_function('public', 'approve_project_report', array['uuid', 'jsonb'], 'approve_project_report exists');
select is_definer('public', 'approve_project_report', array['uuid', 'jsonb'], 'approve_project_report is security definer');

-- Refusals, before anything is written
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000025e2"}', true);
select throws_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000025f1', (select p from t25_payload))$$,
  'P0001', 'permission:Missing permission "project.manage" on project 00000000-0000-0000-0000-0000000025f1',
  'a member without project.manage cannot approve');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000025e3"}', true);
select throws_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000025f1', (select p from t25_payload))$$,
  'P0001', 'permission:Missing permission "project.manage" on project 00000000-0000-0000-0000-0000000025f1',
  'a manager of another organization cannot approve');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000025e5"}', true);
select throws_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000025f1', (select p from t25_payload))$$,
  'P0001', 'permission:Missing permission "project.manage" on project 00000000-0000-0000-0000-0000000025f1',
  'a unit-scoped manager cannot approve a whole-project report');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000025e1"}', true);
select throws_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000025f2', (select p from t25_payload))$$,
  'P0001', 'permission:Missing permission "project.manage" on project 00000000-0000-0000-0000-0000000025f2',
  'a manager of project A cannot approve against project B');
select throws_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000025f1', (select p || '{"projectId": "00000000-0000-0000-0000-0000000025f2"}'::jsonb from t25_payload))$$,
  'P0001', 'conflict:That report belongs to a different project.', 'a payload for another project is refused');
select throws_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000025f1', (select p || '{"engine": "llm-x"}'::jsonb from t25_payload))$$,
  'P0001', 'conflict:That report was not generated by Hozie.', 'an unexpected engine is refused');
select throws_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000025f1', (select p || '{"reviewStatus": "approved"}'::jsonb from t25_payload))$$,
  'P0001', 'conflict:This report is already approved.', 'an already-approved payload is refused');
select throws_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000025f1', (select p || '{"status": "great"}'::jsonb from t25_payload))$$,
  'P0001', 'conflict:That report could not be saved.', 'an unknown status is refused');
select is((select count(*)::int from project_reports), 0, 'refused approvals wrote nothing');

-- A manager approves
select lives_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000025f1', (select p from t25_payload))$$,
  'a project manager approves a report');
select is(
  (select approved_by from project_reports where project_id = '00000000-0000-0000-0000-0000000025f1'),
  '00000000-0000-0000-0000-0000000025d1'::uuid, 'the approver is the caller, stamped server-side');
select is(
  (select payload->>'reviewStatus' from project_reports where project_id = '00000000-0000-0000-0000-0000000025f1'),
  'approved', 'the stored payload is marked approved');

-- Immutability
select throws_ok(
  $$update project_reports set status = 'behind'$$,
  'P0001', 'project reports are immutable; approve a new report instead', 'a snapshot cannot be edited');
select throws_ok(
  $$delete from project_reports$$,
  'P0001', 'project reports are immutable; approve a new report instead', 'a snapshot cannot be deleted directly');

-- Visibility and no direct writes
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000025e1"}';
create temp table t25_probe (name text primary key, n bigint);
grant all on t25_probe to authenticated;
insert into t25_probe select 'manager', count(*) from project_reports;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000025e2"}';
insert into t25_probe select 'reader', count(*) from project_reports;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000025e4"}';
insert into t25_probe select 'homeowner', count(*) from project_reports;
reset role;
select is((select n from t25_probe where name = 'manager'), 1::bigint, 'the project manager reads the saved report');
select is((select n from t25_probe where name = 'reader' )+ (select n from t25_probe where name = 'homeowner'), 0::bigint,
  'a reader without project.manage and a homeowner read nothing');

select * from finish();
rollback;
