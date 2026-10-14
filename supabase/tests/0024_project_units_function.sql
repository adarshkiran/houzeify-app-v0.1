begin;
select plan(11);

-- Task 31 / T2: addProjectUnit(s) in src/data/adapter.ts were the only direct
-- table writes in the whole adapter -- everything else routes through a
-- security-definer rpc. The project_units RLS policy only checked
-- has_permission(project_id, 'project.manage'), ignoring the caller's
-- membership scope (src/domain/constructionCommands.ts addProjectUnits calls
-- authorizeProject with target { projectUnitId: input.parentUnitId }, so a
-- unit-scoped manager may only add beneath their own scoped unit) and never
-- validating that parent_id belongs to the same project_id at all. CONFIRMED
-- LIVE: a project-manager with project.manage on project A could insert a
-- unit into project A whose parent_id is a unit from project B.
--
-- Fix (migration 0024): a new public.add_project_units(units jsonb) function
-- checks has_permission, in_scope (mirroring authorizingMembership/scopeCovers
-- in src/domain/session.ts and public.in_scope in 0002_projects.sql) and that
-- each parent_id belongs to the same project, refusing with a conflict: when
-- it does not. The direct-table RLS policies on project_units are hardened
-- the same way, closing the raw-table path too (src/data/adapter.ts no longer
-- uses it, but the policy must not stay weaker than the function it was
-- replaced by).

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000024a1', 'org-t24', 'Org T24', 'construction-company');

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000024f1', 'proj-t24-a', '00000000-0000-0000-0000-0000000024a1', 'Project T24 A', 'active'),
  ('00000000-0000-0000-0000-0000000024f2', 'proj-t24-b', '00000000-0000-0000-0000-0000000024a1', 'Project T24 B', 'active');

insert into project_units (id, legacy_id, project_id, parent_id, name) values
  ('00000000-0000-0000-0000-0000000024c1', 'unit-t24-a-root', '00000000-0000-0000-0000-0000000024f1', null, 'Project A Root'),
  ('00000000-0000-0000-0000-0000000024c2', 'unit-t24-b-root', '00000000-0000-0000-0000-0000000024f2', null, 'Project B Root');

-- People: unscopedPm (project.manage, unrestricted scope, on project A -- the
-- exploit attacker, matching seeded Arjun's shape), scopedPm (project.manage,
-- scope restricted to unit A-root, on project A), noManage (project.read
-- only, on project A).
insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000024d1', 'person-t24-unscoped-pm', '+6598024001', 'Unscoped PM T24', null),
  ('00000000-0000-0000-0000-0000000024d2', 'person-t24-scoped-pm', '+6598024002', 'Scoped PM T24', null),
  ('00000000-0000-0000-0000-0000000024d3', 'person-t24-no-manage', '+6598024003', 'No Manage T24', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000024e1'),
  ('00000000-0000-0000-0000-0000000024e2'),
  ('00000000-0000-0000-0000-0000000024e3');
update people set auth_user_id = '00000000-0000-0000-0000-0000000024e1' where id = '00000000-0000-0000-0000-0000000024d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000024e2' where id = '00000000-0000-0000-0000-0000000024d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000024e3' where id = '00000000-0000-0000-0000-0000000024d3';

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope, status) values
  ('00000000-0000-0000-0000-0000000024b1', 'm-t24-unscoped-pm', '00000000-0000-0000-0000-0000000024d1', '00000000-0000-0000-0000-0000000024a1',
    '00000000-0000-0000-0000-0000000024f1', 'project-manager',
    array['project.read','project.manage','task.manage','progress.submit','progress.review','customer.publish','workforce.manage','evidence.capture','issue.manage'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-0000000024b2', 'm-t24-scoped-pm', '00000000-0000-0000-0000-0000000024d2', '00000000-0000-0000-0000-0000000024a1',
    '00000000-0000-0000-0000-0000000024f1', 'site-engineer',
    array['project.read','project.manage'],
    jsonb_build_object('projectUnitIds', jsonb_build_array('00000000-0000-0000-0000-0000000024c1'), 'stageIds', '[]'::jsonb, 'tradeIds', '[]'::jsonb),
    'active'),
  ('00000000-0000-0000-0000-0000000024b3', 'm-t24-no-manage', '00000000-0000-0000-0000-0000000024d3', '00000000-0000-0000-0000-0000000024a1',
    '00000000-0000-0000-0000-0000000024f1', 'worker',
    array['project.read'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active');

-- ── Raw-table path: RLS hardened to match the function ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000024e1"}'; -- unscopedPm: project.manage on project A
select throws_ok(
  $$insert into project_units (project_id, parent_id, name)
    values ('00000000-0000-0000-0000-0000000024f1', '00000000-0000-0000-0000-0000000024c2', 'Exploit Unit Raw')$$,
  '42501', null,
  't2: a direct insert whose parent_id belongs to a different project is refused');
reset role;
select is(
  (select count(*)::int from project_units where project_id = '00000000-0000-0000-0000-0000000024f1' and name = 'Exploit Unit Raw'),
  0, 't2: no cross-project exploit unit was created directly');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000024e1"}';
select lives_ok(
  $$insert into project_units (project_id, parent_id, name)
    values ('00000000-0000-0000-0000-0000000024f1', '00000000-0000-0000-0000-0000000024c1', 'Legit Unit Raw')$$,
  't2: a direct insert whose parent_id belongs to the same project still works');
reset role;

-- ── Function path: public.add_project_units ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000024e1"}'; -- unscopedPm
select throws_ok(
  $$select public.add_project_units(jsonb_build_array(jsonb_build_object(
      'projectId', '00000000-0000-0000-0000-0000000024f1',
      'parentId', '00000000-0000-0000-0000-0000000024c2',
      'name', 'Exploit Unit Fn')))$$,
  'P0001', null,
  't2: add_project_units refuses a parent_id from a different project (the exploit, reproduced through the function)');
reset role;
select is(
  (select count(*)::int from project_units where project_id = '00000000-0000-0000-0000-0000000024f1' and name = 'Exploit Unit Fn'),
  0, 't2: no cross-project exploit unit was created through the function');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000024e3"}'; -- noManage: no project.manage
select throws_ok(
  $$select public.add_project_units(jsonb_build_array(jsonb_build_object(
      'projectId', '00000000-0000-0000-0000-0000000024f1',
      'parentId', null,
      'name', 'No Permission Unit')))$$,
  'P0001', null,
  't2: add_project_units refuses a caller without project.manage');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000024e2"}'; -- scopedPm: scope restricted to unit A-root
select throws_ok(
  $$select public.add_project_units(jsonb_build_array(jsonb_build_object(
      'projectId', '00000000-0000-0000-0000-0000000024f1',
      'parentId', null,
      'name', 'Out Of Scope Root Unit')))$$,
  'P0001', null,
  't2: add_project_units refuses a whole-project (root) unit from a manager scoped to one unit');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000024e2"}'; -- scopedPm, now within their own scope
select lives_ok(
  $$select public.add_project_units(jsonb_build_array(jsonb_build_object(
      'projectId', '00000000-0000-0000-0000-0000000024f1',
      'parentId', '00000000-0000-0000-0000-0000000024c1',
      'name', 'In Scope Child Unit')))$$,
  't2: add_project_units lets a scoped manager add beneath their own scoped unit');
reset role;
select is(
  (select count(*)::int from project_units where project_id = '00000000-0000-0000-0000-0000000024f1'
    and parent_id = '00000000-0000-0000-0000-0000000024c1' and name = 'In Scope Child Unit'),
  1, 't2: the in-scope child unit was created');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000024e1"}'; -- unscopedPm, legitimate bulk insert
select lives_ok(
  $$select public.add_project_units(jsonb_build_array(
      jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000024f1', 'parentId', '00000000-0000-0000-0000-0000000024c1', 'name', 'Bulk Unit 1'),
      jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000024f1', 'parentId', '00000000-0000-0000-0000-0000000024c1', 'name', 'Bulk Unit 2')))$$,
  't2: a legitimate same-project bulk insert still succeeds');
reset role;
select is(
  (select count(*)::int from project_units where project_id = '00000000-0000-0000-0000-0000000024f1' and name in ('Bulk Unit 1', 'Bulk Unit 2')),
  2, 't2: both bulk units were created');

select * from finish();
rollback;
