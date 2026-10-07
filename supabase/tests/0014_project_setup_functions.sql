begin;
select plan(44);

-- Fixtures are inserted as the table owner (bypasses RLS). Each call is made as
-- one signed-in person by setting the JWT claims for the transaction.

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000014a0', 'org-t14', 'Org T14', 'construction-company');

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000014f1', 'proj-t14', '00000000-0000-0000-0000-0000000014a0', 'Project T14', 'active');

-- Stages on the project: RCC (weighted) and an unweighted stage, used by
-- set_stage_baselines / calculate_project_progress.
insert into stages (id, legacy_id, project_id, name, sort_order, code) values
  ('00000000-0000-0000-0000-000000001451', 'stage-t14-rcc', '00000000-0000-0000-0000-0000000014f1', 'RCC', 1, 'RCC'),
  ('00000000-0000-0000-0000-000000001452', 'stage-t14-other', '00000000-0000-0000-0000-0000000014f1', 'Other', 2, null);

-- A stage belonging to a different project, used to prove cross-project stages are refused.
insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000014f2', 'proj-t14-other', '00000000-0000-0000-0000-0000000014a0', 'Other Project T14', 'active');
insert into stages (id, legacy_id, project_id, name, sort_order) values
  ('00000000-0000-0000-0000-000000001453', 'stage-t14-foreign', '00000000-0000-0000-0000-0000000014f2', 'Foreign', 1);

-- A task on the RCC stage, half its planned quantity complete, for the progress calc.
insert into tasks (id, legacy_id, project_id, stage_id, title, status, planned_quantity, planned_quantity_unit,
  completed_quantity, completed_quantity_unit) values
  ('00000000-0000-0000-0000-000000001461', 'task-t14-1', '00000000-0000-0000-0000-0000000014f1',
   '00000000-0000-0000-0000-000000001451', 'Pour slab', 'in-progress', 100, 'm3', 50, 'm3');

-- People: a project manager (pm, project.manage on the T14 project), a worker (wk) with
-- no management permission, and someone with no membership at all (op).
insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000014d1', 'person-t14-pm', '+6598001401', 'Manager T14', null),
  ('00000000-0000-0000-0000-0000000014d2', 'person-t14-wk', '+6598001402', 'Worker T14', null),
  ('00000000-0000-0000-0000-0000000014d3', 'person-t14-op', '+6598001403', 'Other T14', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000014e1'),
  ('00000000-0000-0000-0000-0000000014e2'),
  ('00000000-0000-0000-0000-0000000014e3');
update people set auth_user_id = '00000000-0000-0000-0000-0000000014e1' where id = '00000000-0000-0000-0000-0000000014d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000014e2' where id = '00000000-0000-0000-0000-0000000014d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000014e3' where id = '00000000-0000-0000-0000-0000000014d3';

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, status) values
  ('00000000-0000-0000-0000-000000001471', 'm-t14-pm', '00000000-0000-0000-0000-0000000014d1', '00000000-0000-0000-0000-0000000014a0',
    '00000000-0000-0000-0000-0000000014f1', 'project-manager', array['project.read','project.manage'], 'active'),
  ('00000000-0000-0000-0000-000000001472', 'm-t14-wk', '00000000-0000-0000-0000-0000000014d2', '00000000-0000-0000-0000-0000000014a0',
    '00000000-0000-0000-0000-0000000014f1', 'worker', array['progress.submit'], 'active'),
  ('00000000-0000-0000-0000-000000001473', 'm-t14-orgmgr', '00000000-0000-0000-0000-0000000014d1', '00000000-0000-0000-0000-0000000014a0',
    null, 'business-owner', array['project.manage'], 'active');

-- Structural checks
select has_function('public', 'update_organization_profile', array['uuid','text','text','text','text','text'], 'update_organization_profile exists');
select has_function('public', 'create_project', array['uuid','text','text','text','text'], 'create_project exists');
select has_function('public', 'set_stage_baselines', array['uuid','jsonb'], 'set_stage_baselines exists');
select has_function('public', 'add_library_stage', array['text','text'], 'add_library_stage exists');
select has_function('public', 'add_library_trade', array['text','text'], 'add_library_trade exists');
select has_function('public', 'add_library_work_type', array['text','uuid','uuid','text','text','text'], 'add_library_work_type exists');
select is_definer('public', 'create_project', array['uuid','text','text','text','text'], 'create_project is security definer');
select is_definer('public', 'set_stage_baselines', array['uuid','jsonb'], 'set_stage_baselines is security definer');

-- update_organization_profile: requires an active org-level (project_id is null)
-- membership with project.manage in this organization (migration 0020 closed the
-- "deliberately unauthorized" gap -- it let anyone rewrite any organization).
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000014e3"}', true);
select throws_ok(
  $$select public.update_organization_profile('00000000-0000-0000-0000-0000000014a0', 'BuildRight Co', 'contractor', 'Hyderabad', '+919000000001', '6-10')$$,
  'P0001', 'permission:Missing permission "project.manage"', 'an unrelated session cannot fill the organization profile');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000014e1"}', true);
select lives_ok(
  $$select public.update_organization_profile('00000000-0000-0000-0000-0000000014a0', 'BuildRight Co', 'contractor', 'Hyderabad', '+919000000001', '6-10')$$,
  'a session with org-level project.manage fills the organization profile');
select is((select name from organizations where id = '00000000-0000-0000-0000-0000000014a0'), 'BuildRight Co', 'the name is set');
select is((select kind from organizations where id = '00000000-0000-0000-0000-0000000014a0'), 'contractor', 'the kind is set');
select is((select city from organizations where id = '00000000-0000-0000-0000-0000000014a0'), 'Hyderabad', 'the city is set');

-- create_project: a worker session (no project.manage anywhere in the org) is refused
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000014e2"}', true);
select throws_ok(
  $$select public.create_project('00000000-0000-0000-0000-0000000014a0', 'New Build', 'individual-house', 'planning', 'Chennai')$$,
  'P0001', 'permission:Missing permission "project.manage"', 'a worker cannot create a project');

-- create_project: the project manager creates a project, gets a root unit and a membership
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000014e1"}', true);
select lives_ok(
  $$select public.create_project('00000000-0000-0000-0000-0000000014a0', 'New Build', 'individual-house', 'planning', 'Chennai')$$,
  'the project manager creates a project');
select is((select count(*)::int from projects where organization_id = '00000000-0000-0000-0000-0000000014a0' and name = 'New Build'), 1, 'the project row is created');
select is((select location from projects where name = 'New Build'), 'Chennai', 'location is stored');
select is((select kind from projects where name = 'New Build'), 'individual-house', 'kind is stored');
select is((select count(*)::int from project_units u join projects p on p.id = u.project_id where p.name = 'New Build'), 1, 'an individual-house project gets a root unit');
select is((select u.name from project_units u join projects p on p.id = u.project_id where p.name = 'New Build'), 'Main House', 'the root unit is named Main House');
select is(
  (select count(*)::int from memberships m join projects p on p.id = m.project_id
   where p.name = 'New Build' and m.person_id = '00000000-0000-0000-0000-0000000014d1' and m.role = 'project-manager' and m.status = 'active'),
  1, 'the creator gets an active project-manager membership');

-- create_project: an apartment project gets no root unit
select lives_ok(
  $$select public.create_project('00000000-0000-0000-0000-0000000014a0', 'Tower', 'apartment', 'planning', 'Pune')$$,
  'the manager creates an apartment project');
select is((select count(*)::int from project_units u join projects p on p.id = u.project_id where p.name = 'Tower'), 0, 'an apartment project gets no root unit');

-- set_stage_baselines: a worker (no project.manage) is refused
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000014e2"}', true);
select throws_ok(
  $$select public.set_stage_baselines('00000000-0000-0000-0000-0000000014f1', '{"00000000-0000-0000-0000-000000001451": 50}'::jsonb)$$,
  'P0001', format('permission:Missing permission "project.manage" on project %s', '00000000-0000-0000-0000-0000000014f1'),
  'a worker cannot set stage baselines');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000014e1"}', true);

-- set_stage_baselines: a stage from another project is refused and changes nothing
select throws_ok(
  $$select public.set_stage_baselines('00000000-0000-0000-0000-0000000014f1', '{"00000000-0000-0000-0000-000000001453": 50}'::jsonb)$$,
  'P0001', 'Unknown stage 00000000-0000-0000-0000-000000001453', 'a stage from another project is refused');
select is((select stage_baselines from projects where id = '00000000-0000-0000-0000-0000000014f1'), '{}'::jsonb, 'a refused call changes nothing');

-- set_stage_baselines: an out-of-range value is refused
select throws_ok(
  $$select public.set_stage_baselines('00000000-0000-0000-0000-0000000014f1', '{"00000000-0000-0000-0000-000000001451": 150}'::jsonb)$$,
  'P0001', 'conflict:Stage baselines must be between 0 and 100.', 'an out-of-range baseline is refused');

-- set_stage_baselines: a valid call stores the baselines and recalculates progress.
-- RCC (weight 25) has baseline 40 and one task at 50% complete: 40 + 60*0.5 = 70% of
-- the stage, weighted 25 -> 17.5. Other (weight 0, unknown code) contributes nothing.
select lives_ok(
  $$select public.set_stage_baselines('00000000-0000-0000-0000-0000000014f1',
    '{"00000000-0000-0000-0000-000000001451": 40, "00000000-0000-0000-0000-000000001452": 20}'::jsonb)$$,
  'the manager sets stage baselines');
select is((select progress::int from projects where id = '00000000-0000-0000-0000-0000000014f1'), 18, 'progress is recalculated from stage weights and task completion');
select is(
  (select stage_baselines from projects where id = '00000000-0000-0000-0000-0000000014f1'),
  '{"00000000-0000-0000-0000-000000001451": 40, "00000000-0000-0000-0000-000000001452": 20}'::jsonb,
  'the baselines are stored verbatim, replacing any previous value');

-- add_library_stage / add_library_trade / add_library_work_type: a worker-only session is refused
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000014e2"}', true);
select throws_ok(
  $$select public.add_library_stage('Site Preparation', null)$$,
  'P0001', 'permission:Missing permission "project.manage"', 'a worker cannot add a library stage');

-- add_library_stage: a project manager (business-side staff) can add one, and a repeat add returns the same row
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000014e1"}', true);
select lives_ok($$select public.add_library_stage('Site Preparation', null)$$, 'the manager adds a library stage');
select is((select count(*)::int from stages where name = 'Site Preparation' and project_id is null), 1, 'the stage is added to the library, not a project');
select lives_ok($$select public.add_library_stage('Site Preparation', null)$$, 'adding the same stage name again does not fail');
select is((select count(*)::int from stages where name = 'Site Preparation' and project_id is null), 1, 'a repeat add does not duplicate the stage');

-- add_library_trade
select lives_ok($$select public.add_library_trade('Civil Work', null)$$, 'the manager adds a library trade');
select is((select count(*)::int from trades where name = 'Civil Work' and project_id is null), 1, 'the trade is added to the library');

-- add_library_work_type: creating a new stage and trade inline
select lives_ok(
  $$select public.add_library_work_type('Foundation Digging', null, null, 'Earthwork', 'Excavation', 'm3')$$,
  'the manager adds a work type with a new stage and trade');
select is((select count(*)::int from stages where name = 'Earthwork' and project_id is null), 1, 'the new stage is added to the library');
select is((select count(*)::int from trades where name = 'Excavation' and project_id is null), 1, 'the new trade is added to the library');
select is(
  (select count(*)::int from work_types w join stages s on s.id = w.stage_id join trades t on t.id = w.trade_id
   where w.name = 'Foundation Digging' and s.name = 'Earthwork' and t.name = 'Excavation' and w.default_unit = 'm3'),
  1, 'the work type links the new stage and trade');
select is(
  (select count(*)::int from task_templates tt join work_types w on w.id = tt.work_type_id where w.name = 'Foundation Digging'),
  1, 'a standard task template is created for the work type');

-- add_library_work_type: an unknown stage/trade id passed directly writes nothing
-- (mirrors the domain's "no partial library entries" early return)
select is(
  (select (public.add_library_work_type('Bad Work Type', gen_random_uuid(), gen_random_uuid(), null, null, 'nos') -> 'workType' ->> 'name')),
  'Bad Work Type', 'the unsaved result still names the attempted work type');
select is((select count(*)::int from work_types where name = 'Bad Work Type'), 0, 'no work type row is written for an unknown stage/trade');

select * from finish();
rollback;
