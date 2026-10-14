begin;
select plan(39);

select has_table('public', 'projects', 'projects table exists');
select has_table('public', 'project_units', 'project_units table exists');
select has_table('public', 'stages', 'stages table exists');
select has_table('public', 'trades', 'trades table exists');
select has_table('public', 'work_types', 'work_types table exists');
select has_table('public', 'task_templates', 'task_templates table exists');
select has_table('public', 'work_plan_items', 'work_plan_items table exists');
select has_table('public', 'tasks', 'tasks table exists');
select has_table('public', 'task_assignments', 'task_assignments table exists');
select has_table('public', 'worker_project_assignments', 'worker_project_assignments table exists');

select has_column('public', 'projects', 'require_checkout', 'projects.require_checkout exists');
select col_not_null('public', 'projects', 'require_checkout', 'projects.require_checkout is not null');
select is((select column_default from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'require_checkout'), 'false', 'projects.require_checkout defaults to false');
select has_column('public', 'worker_project_assignments', 'started_at', 'assignments have started_at');
select has_column('public', 'worker_project_assignments', 'ended_at', 'assignments have ended_at');
select has_column('public', 'worker_project_assignments', 'end_reason', 'assignments have end_reason');
select has_column('public', 'worker_project_assignments', 'status', 'assignments have status');

select has_function('public', 'has_permission', array['uuid', 'text'], 'has_permission(uuid, text) exists');
select has_function('public', 'in_scope', array['uuid', 'uuid', 'uuid', 'uuid'], 'in_scope(uuid, uuid, uuid, uuid) exists');

insert into organizations (id, legacy_id, name) values
  ('00000000-0000-0000-0000-0000000001a1', 'org-p', 'Org P');

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000001e1');

insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000001b1', 'person-p', '+6598000101', 'Supervisor', '00000000-0000-0000-0000-0000000001e1');

insert into projects (id, legacy_id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000001f1', 'proj-1', '00000000-0000-0000-0000-0000000001a1', 'Project One'),
  ('00000000-0000-0000-0000-0000000001f2', 'proj-2', '00000000-0000-0000-0000-0000000001a1', 'Project Two'),
  ('00000000-0000-0000-0000-0000000001f3', 'proj-3', '00000000-0000-0000-0000-0000000001a1', 'Project Three');

insert into project_units (id, legacy_id, project_id, name, parent_id) values
  ('00000000-0000-0000-0000-00000000ab01', 'unit-block-a', '00000000-0000-0000-0000-0000000001f2', 'Block A', null),
  ('00000000-0000-0000-0000-00000000ab02', 'unit-flat-a1', '00000000-0000-0000-0000-0000000001f2', 'Flat A1', '00000000-0000-0000-0000-00000000ab01'),
  ('00000000-0000-0000-0000-00000000ab03', 'unit-block-b', '00000000-0000-0000-0000-0000000001f2', 'Block B', null);

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope) values
  ('00000000-0000-0000-0000-00000000ae01', 'mem-1', '00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-0000000001a1',
   '00000000-0000-0000-0000-0000000001f1', 'supervisor', array['project.read'], '{}'::jsonb),
  ('00000000-0000-0000-0000-00000000ae02', 'mem-2', '00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-0000000001a1',
   '00000000-0000-0000-0000-0000000001f2', 'supervisor', array['task.manage'], '{"projectUnitIds": ["00000000-0000-0000-0000-00000000ab01"]}'::jsonb);

-- No JWT: the caller has no person, so nothing is granted.
select is(public.has_permission('00000000-0000-0000-0000-0000000001f1', 'project.read'), false,
  'has_permission is false with no caller');
select is(public.in_scope('00000000-0000-0000-0000-0000000001f1', null, null, null), false,
  'in_scope is false with no caller');

-- Signed in as the supervisor.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000001e1", "role": "authenticated"}', true);

select is(public.current_person_id(), '00000000-0000-0000-0000-0000000001b1'::uuid,
  'current_person_id resolves the signed-in person');

select is(public.has_permission('00000000-0000-0000-0000-0000000001f1', 'project.read'), true,
  'has_permission is true for a granted permission on the membership project');
select is(public.has_permission('00000000-0000-0000-0000-0000000001f1', 'task.manage'), false,
  'has_permission is false for a permission the membership lacks');
select is(public.has_permission('00000000-0000-0000-0000-0000000001f3', 'project.read'), false,
  'has_permission is false on a project with no membership');
select is(public.has_permission('00000000-0000-0000-0000-0000000001f2', 'task.manage'), true,
  'has_permission is true for task.manage on the scoped membership project');
select is(public.has_permission('00000000-0000-0000-0000-0000000001f2', 'project.read'), false,
  'has_permission does not borrow a permission from another project');

update memberships set status = 'inactive' where id = '00000000-0000-0000-0000-00000000ae01';
select is(public.has_permission('00000000-0000-0000-0000-0000000001f1', 'project.read'), false,
  'has_permission is false for an inactive membership');
update memberships set status = 'active' where id = '00000000-0000-0000-0000-00000000ae01';

-- in_scope: an empty scope array is unrestricted.
select is(public.in_scope('00000000-0000-0000-0000-0000000001f1', null, null, null), true,
  'in_scope is true for an unrestricted membership with no targets');
select is(public.in_scope('00000000-0000-0000-0000-0000000001f1', '00000000-0000-0000-0000-00000000ab03', '00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-00000000ad01'), true,
  'in_scope is true for any unit, stage and trade when the scope arrays are empty');

-- in_scope: a non-empty unit array filters, and covers descendant units.
select is(public.in_scope('00000000-0000-0000-0000-0000000001f2', '00000000-0000-0000-0000-00000000ab01', null, null), true,
  'in_scope is true for the scoped unit itself');
select is(public.in_scope('00000000-0000-0000-0000-0000000001f2', '00000000-0000-0000-0000-00000000ab02', null, null), true,
  'in_scope is true for a descendant of the scoped unit');
select is(public.in_scope('00000000-0000-0000-0000-0000000001f2', '00000000-0000-0000-0000-00000000ab03', null, null), false,
  'in_scope is false for a unit outside the scoped array');
select is(public.in_scope('00000000-0000-0000-0000-0000000001f2', null, null, null), false,
  'in_scope is false with no unit when the unit array is non-empty');
select is(public.in_scope('00000000-0000-0000-0000-0000000001f3', null, null, null), false,
  'in_scope is false on a project with no membership');

-- Status check constraints.
insert into workers (id, legacy_id, organization_id, phone, name) values
  ('00000000-0000-0000-0000-0000000001c1', 'worker-p', '00000000-0000-0000-0000-0000000001a1', '+6598000111', 'Worker P');

select throws_ok(
  $$insert into worker_onboardings (id, worker_id, organization_id, method, status)
    values ('00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001a1', 'join_code', 'completed')$$,
  '23514',
  'new row for relation "worker_onboardings" violates check constraint "worker_onboardings_status_check"',
  'worker_onboardings refuses a status outside the allowed set'
);

select throws_ok(
  $$insert into workers (id, legacy_id, organization_id, phone, name, status) values
    ('00000000-0000-0000-0000-0000000001c2', 'worker-q', '00000000-0000-0000-0000-0000000001a1', '+6598000112', 'Worker Q', 'deleted')$$,
  '23514',
  'new row for relation "workers" violates check constraint "workers_status_check"',
  'workers refuses a status outside the allowed set'
);

select lives_ok(
  $$insert into worker_onboardings (id, worker_id, organization_id, method, status)
    values ('00000000-0000-0000-0000-0000000001d2', '00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001a1', 'join_code', 'expired')$$,
  'worker_onboardings accepts an allowed status'
);

-- Foreign key from memberships to projects.
select throws_ok(
  $$insert into memberships (person_id, organization_id, project_id, role)
    values ('00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000009ff', 'supervisor')$$,
  '23503',
  'insert or update on table "memberships" violates foreign key constraint "memberships_project_id_fkey"',
  'memberships refuse a project_id that does not exist'
);

select * from finish();
rollback;
