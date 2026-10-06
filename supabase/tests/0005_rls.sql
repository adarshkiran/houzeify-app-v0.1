begin;
select plan(28);

-- Fixtures are inserted as the table owner (bypasses RLS). Each check then acts
-- as one authenticated user; counts are recorded in rls_probe while the role is
-- authenticated and asserted after the role is reset.

create temp table rls_probe (name text primary key, n bigint);
grant all on rls_probe to authenticated;

-- Organizations
insert into organizations (id, legacy_id, name) values
  ('10000000-0000-0000-0000-000000000001', 'rls-org-a', 'RLS Org A'),
  ('10000000-0000-0000-0000-000000000002', 'rls-org-b', 'RLS Org B'),
  ('10000000-0000-0000-0000-000000000003', 'rls-org-c', 'RLS Partner Co');

-- Auth users and people
insert into auth.users (id) values
  ('10000000-0000-0000-0000-000000000201'),
  ('10000000-0000-0000-0000-000000000202'),
  ('10000000-0000-0000-0000-000000000203'),
  ('10000000-0000-0000-0000-000000000204'),
  ('10000000-0000-0000-0000-000000000205'),
  ('10000000-0000-0000-0000-000000000206');

insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('10000000-0000-0000-0000-000000000101', 'rls-p-worker', '+6598000601', 'Worker One', '10000000-0000-0000-0000-000000000201'),
  ('10000000-0000-0000-0000-000000000102', 'rls-p-home', '+6598000602', 'Homeowner', '10000000-0000-0000-0000-000000000202'),
  ('10000000-0000-0000-0000-000000000103', 'rls-p-sup', '+6598000603', 'Scoped Supervisor', '10000000-0000-0000-0000-000000000203'),
  ('10000000-0000-0000-0000-000000000104', 'rls-p-other', '+6598000604', 'Other Org User', '10000000-0000-0000-0000-000000000204'),
  ('10000000-0000-0000-0000-000000000105', 'rls-p-partner', '+6598000605', 'Partner', '10000000-0000-0000-0000-000000000205'),
  ('10000000-0000-0000-0000-000000000106', 'rls-p-owner', '+6598000606', 'Requirement Owner', '10000000-0000-0000-0000-000000000206');

-- Projects, units, stages, trades, work types
insert into projects (id, legacy_id, organization_id, name) values
  ('10000000-0000-0000-0000-000000000301', 'rls-proj-1', '10000000-0000-0000-0000-000000000001', 'RLS Project One'),
  ('10000000-0000-0000-0000-000000000302', 'rls-proj-2', '10000000-0000-0000-0000-000000000002', 'RLS Project Two');

insert into project_units (id, legacy_id, project_id, name) values
  ('10000000-0000-0000-0000-000000000401', 'rls-unit-1', '10000000-0000-0000-0000-000000000301', 'Block 1');

insert into stages (id, legacy_id, project_id, name, sort_order) values
  ('10000000-0000-0000-0000-000000000402', 'rls-stage-a', '10000000-0000-0000-0000-000000000301', 'Structure', 1),
  ('10000000-0000-0000-0000-000000000403', 'rls-stage-b', '10000000-0000-0000-0000-000000000301', 'Finishing', 2);

insert into trades (id, legacy_id, project_id, name) values
  ('10000000-0000-0000-0000-000000000404', 'rls-trade-1', '10000000-0000-0000-0000-000000000301', 'Masonry');

insert into work_types (id, legacy_id, project_id, name) values
  ('10000000-0000-0000-0000-000000000405', 'rls-wt-1', '10000000-0000-0000-0000-000000000301', 'Brickwork');

-- Memberships
-- worker (unscoped), homeowner, supervisor scoped to stage A, cross-org supervisor, partner org member
insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope) values
  ('10000000-0000-0000-0000-000000000501', 'rls-m-worker', '10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000301', 'worker', array['project.read'], '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000502', 'rls-m-home', '10000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000301', 'homeowner', array['project.read'], '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000503', 'rls-m-sup', '10000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000301', 'supervisor', array['project.read', 'task.manage', 'progress.review'],
   '{"stageIds": ["10000000-0000-0000-0000-000000000402"]}'::jsonb),
  ('10000000-0000-0000-0000-000000000504', 'rls-m-other', '10000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000302', 'supervisor', array['project.read'], '{}'::jsonb),
  ('10000000-0000-0000-0000-000000000505', 'rls-m-partner', '10000000-0000-0000-0000-000000000105', '10000000-0000-0000-0000-000000000003',
   null, 'partner', array[]::text[], '{}'::jsonb);

-- Workers, assignments, tasks, attendance
insert into workers (id, legacy_id, organization_id, user_id, phone, name) values
  ('10000000-0000-0000-0000-000000000601', 'rls-w1', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000101', '+6598000601', 'Worker One'),
  ('10000000-0000-0000-0000-000000000602', 'rls-w2', '10000000-0000-0000-0000-000000000001', null, '+6598000607', 'Worker Two');

insert into worker_project_assignments (id, legacy_id, project_id, worker_id) values
  ('10000000-0000-0000-0000-000000000701', 'rls-a1', '10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000601'),
  ('10000000-0000-0000-0000-000000000702', 'rls-a2', '10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000602');

insert into tasks (id, legacy_id, project_id, project_unit_id, stage_id, trade_id, title) values
  ('10000000-0000-0000-0000-000000000801', 'rls-task-in', '10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000401',
   '10000000-0000-0000-0000-000000000402', '10000000-0000-0000-0000-000000000404', 'Stage A task'),
  ('10000000-0000-0000-0000-000000000802', 'rls-task-out', '10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000401',
   '10000000-0000-0000-0000-000000000403', '10000000-0000-0000-0000-000000000404', 'Stage B task');

insert into worker_attendance (id, legacy_id, worker_id, project_id, assignment_id, date, status, check_in_at, recorded_by) values
  ('10000000-0000-0000-0000-000000000901', 'rls-att-1', '10000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000301',
   '10000000-0000-0000-0000-000000000701', '2026-10-06', 'present', '2026-10-06 03:30+00', 'worker'),
  ('10000000-0000-0000-0000-000000000902', 'rls-att-2', '10000000-0000-0000-0000-000000000602', '10000000-0000-0000-0000-000000000301',
   '10000000-0000-0000-0000-000000000702', '2026-10-06', 'present', '2026-10-06 03:40+00', 'supervisor');

-- Daily progress: one published version (with a review note), one private draft
insert into daily_progress (id, legacy_id, project_id, project_unit_id, stage_id, trade_id, work_type_id, date,
  workers_present, today_summary, tomorrow_plan, submitted_by_membership_id, review_status, publication_status, version)
values
  ('10000000-0000-0000-0000-000000000a01', 'rls-dp-pub', '10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000401',
   '10000000-0000-0000-0000-000000000402', '10000000-0000-0000-0000-000000000404', '10000000-0000-0000-0000-000000000405',
   '2026-10-06', 4, 'Laid bricks', 'Lintels', '10000000-0000-0000-0000-000000000503', 'approved', 'published', 1),
  ('10000000-0000-0000-0000-000000000a02', 'rls-dp-draft', '10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000401',
   '10000000-0000-0000-0000-000000000402', '10000000-0000-0000-0000-000000000404', '10000000-0000-0000-0000-000000000405',
   '2026-10-07', 3, 'Draft summary', 'Draft plan', '10000000-0000-0000-0000-000000000503', 'submitted', 'private', 1);

insert into progress_reviews (id, legacy_id, daily_progress_id, decision, note, reviewer_membership_id) values
  ('10000000-0000-0000-0000-000000000b01', 'rls-rev-1', '10000000-0000-0000-0000-000000000a01', 'approve',
   'internal review note', '10000000-0000-0000-0000-000000000503');

insert into progress_publications (id, legacy_id, daily_progress_id, published_by_membership_id) values
  ('10000000-0000-0000-0000-000000000c01', 'rls-pub-1', '10000000-0000-0000-0000-000000000a01', '10000000-0000-0000-0000-000000000503');

-- Evidence and documents
insert into evidence (id, legacy_id, project_id, type, url, customer_visibility, captured_by_membership_id) values
  ('10000000-0000-0000-0000-000000000d01', 'rls-ev-pub', '10000000-0000-0000-0000-000000000301', 'photo', 'https://example.test/pub.jpg',
   'customer-visible', '10000000-0000-0000-0000-000000000503'),
  ('10000000-0000-0000-0000-000000000d02', 'rls-ev-priv', '10000000-0000-0000-0000-000000000301', 'photo', 'https://example.test/priv.jpg',
   'private', '10000000-0000-0000-0000-000000000503');

insert into documents (id, legacy_id, project_id, title, category, url, shared_with_homeowner) values
  ('10000000-0000-0000-0000-000000000d03', 'rls-doc-shared', '10000000-0000-0000-0000-000000000301', 'Approval', 'approval', 'https://example.test/a.pdf', true),
  ('10000000-0000-0000-0000-000000000d04', 'rls-doc-internal', '10000000-0000-0000-0000-000000000301', 'Internal', 'other', 'https://example.test/i.pdf', false);

-- Issues
insert into issues (id, legacy_id, project_id, title, created_by_membership_id, customer_visible) values
  ('10000000-0000-0000-0000-000000000f01', 'rls-iss-pub', '10000000-0000-0000-0000-000000000301', 'Visible issue', '10000000-0000-0000-0000-000000000503', true),
  ('10000000-0000-0000-0000-000000000f02', 'rls-iss-priv', '10000000-0000-0000-0000-000000000301', 'Internal issue', '10000000-0000-0000-0000-000000000503', false);

-- Threads and messages: one internal thread (staff), one homeowner thread
insert into threads (id, legacy_id, project_id, subject, audience, participant_membership_ids) values
  ('10000000-0000-0000-0000-000000000e01', 'rls-th-int', '10000000-0000-0000-0000-000000000301', 'project', 'internal',
   array['10000000-0000-0000-0000-000000000503']::uuid[]),
  ('10000000-0000-0000-0000-000000000e02', 'rls-th-home', '10000000-0000-0000-0000-000000000301', 'homeowner', 'homeowner',
   array['10000000-0000-0000-0000-000000000502']::uuid[]);

insert into messages (id, legacy_id, thread_id, author_membership_id, body) values
  ('10000000-0000-0000-0000-000000000e11', 'rls-msg-int', '10000000-0000-0000-0000-000000000e01',
   '10000000-0000-0000-0000-000000000503', 'internal chatter');

-- Marketplace: owner's estimate and two posted requirements; partner unlocks only the second
insert into estimates (id, legacy_id, homeowner_person_id, project_name, property_type, location, built_up_area_sqft,
  construction_level, total_low, total_high) values
  ('10000000-0000-0000-0000-000000000f31', 'rls-est-1', '10000000-0000-0000-0000-000000000106', 'Owner Home', 'house', 'Bengaluru',
   1200, 'standard', 1000000, 1500000);

insert into marketplace_requirements (id, legacy_id, estimate_id, homeowner_person_id, project_name, location,
  built_up_area_sqft, construction_level, property_type, estimate_total_low, estimate_total_high, status) values
  ('10000000-0000-0000-0000-000000000f11', 'rls-req-1', '10000000-0000-0000-0000-000000000f31', '10000000-0000-0000-0000-000000000106',
   'Owner Home', 'Bengaluru', 1200, 'standard', 'house', 1000000, 1500000, 'posted'),
  ('10000000-0000-0000-0000-000000000f12', 'rls-req-2', '10000000-0000-0000-0000-000000000f31', '10000000-0000-0000-0000-000000000106',
   'Owner Home Two', 'Bengaluru', 1200, 'standard', 'house', 1000000, 1500000, 'posted');

insert into credit_wallets (organization_id, balance) values ('10000000-0000-0000-0000-000000000003', 0);

insert into credit_transactions (id, legacy_id, organization_id, kind, amount, balance_after, requirement_id) values
  ('10000000-0000-0000-0000-000000000f21', 'rls-ct-1', '10000000-0000-0000-0000-000000000003', 'unlock', -10, 0,
   '10000000-0000-0000-0000-000000000f12');

insert into marketplace_unlocks (id, legacy_id, requirement_id, partner_organization_id, credit_transaction_id) values
  ('10000000-0000-0000-0000-000000000f22', 'rls-unl-1', '10000000-0000-0000-0000-000000000f12',
   '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000f21');

-- Schema-wide checks

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'every public table has row-level security enabled');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)),
  0,
  'every public table has at least one policy');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and tablename in ('credit_wallets', 'credit_transactions', 'marketplace_unlocks', 'proposals',
                        'progress_reviews', 'progress_publications', 'worker_onboardings', 'worker_attendance')
      and cmd <> 'SELECT'),
  0,
  'B4-governed tables have no direct insert, update or delete policy');

-- Worker: own attendance, own worker row, staff-level task reads, no direct attendance write
set local role authenticated;
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000201"}';
insert into rls_probe select 'worker_own_attendance', count(*) from worker_attendance where id = '10000000-0000-0000-0000-000000000901';
insert into rls_probe select 'worker_other_attendance', count(*) from worker_attendance where id = '10000000-0000-0000-0000-000000000902';
insert into rls_probe select 'worker_own_row', count(*) from workers where id = '10000000-0000-0000-0000-000000000601';
insert into rls_probe select 'worker_other_row', count(*) from workers where id = '10000000-0000-0000-0000-000000000602';
insert into rls_probe select 'worker_tasks', count(*) from tasks where project_id = '10000000-0000-0000-0000-000000000301';
do $$
begin
  begin
    insert into worker_attendance (worker_id, project_id, assignment_id, date, recorded_by)
    values ('10000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000301',
            '10000000-0000-0000-0000-000000000701', '2026-10-07', 'worker');
    insert into rls_probe values ('worker_attendance_write_refused', 0);
  exception when others then
    insert into rls_probe values ('worker_attendance_write_refused', 1);
  end;
end $$;
reset role;

-- Scoped supervisor (stage A only)
set local role authenticated;
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000203"}';
insert into rls_probe select 'scoped_task_in_stage', count(*) from tasks where id = '10000000-0000-0000-0000-000000000801';
insert into rls_probe select 'scoped_task_outside_stage', count(*) from tasks where id = '10000000-0000-0000-0000-000000000802';
insert into rls_probe select 'supervisor_attendance', count(*) from worker_attendance where project_id = '10000000-0000-0000-0000-000000000301';
reset role;

-- Homeowner: customer-visible rows only
set local role authenticated;
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000202"}';
insert into rls_probe select 'home_unpublished_evidence', count(*) from evidence where id = '10000000-0000-0000-0000-000000000d02';
insert into rls_probe select 'home_visible_evidence', count(*) from evidence where id = '10000000-0000-0000-0000-000000000d01';
insert into rls_probe select 'home_review_note', count(*) from progress_reviews;
insert into rls_probe select 'home_published_progress', count(*) from daily_progress where id = '10000000-0000-0000-0000-000000000a01';
insert into rls_probe select 'home_draft_progress', count(*) from daily_progress where id = '10000000-0000-0000-0000-000000000a02';
insert into rls_probe select 'home_internal_thread', count(*) from threads where id = '10000000-0000-0000-0000-000000000e01';
insert into rls_probe select 'home_own_thread', count(*) from threads where id = '10000000-0000-0000-0000-000000000e02';
insert into rls_probe select 'home_tasks', count(*) from tasks;
insert into rls_probe select 'home_visible_issues', count(*) from issues;
insert into rls_probe select 'home_private_document', count(*) from documents where id = '10000000-0000-0000-0000-000000000d04';
reset role;

-- Cross-organization user
set local role authenticated;
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000204"}';
insert into rls_probe select 'other_org_project_one', (select count(*) from projects where id = '10000000-0000-0000-0000-000000000301')
  + (select count(*) from tasks) + (select count(*) from evidence) + (select count(*) from workers) + (select count(*) from daily_progress);
insert into rls_probe select 'other_org_own_project', count(*) from projects where id = '10000000-0000-0000-0000-000000000302';
reset role;

-- Partner: requirement full columns only with an unlock row
set local role authenticated;
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000205"}';
insert into rls_probe select 'partner_locked_requirement', count(*) from marketplace_requirements where id = '10000000-0000-0000-0000-000000000f11';
insert into rls_probe select 'partner_unlocked_requirement', count(*) from marketplace_requirements where id = '10000000-0000-0000-0000-000000000f12';
insert into rls_probe select 'partner_estimate', count(*) from estimates;
reset role;

-- Requirement owner: sees own requirements
set local role authenticated;
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000206"}';
insert into rls_probe select 'owner_requirements', count(*) from marketplace_requirements;
reset role;

select is((select n from rls_probe where name = 'worker_own_attendance'), 1::bigint, 'a worker reads their own attendance row');
select is((select n from rls_probe where name = 'worker_other_attendance'), 0::bigint, 'a worker cannot read another worker attendance row');
select is((select n from rls_probe where name = 'worker_own_row'), 1::bigint, 'a worker reads their own worker row');
select is((select n from rls_probe where name = 'worker_other_row'), 0::bigint, 'a worker cannot read another worker row');
select is((select n from rls_probe where name = 'worker_tasks'), 2::bigint, 'a worker reads unscoped project tasks');
select is((select n from rls_probe where name = 'worker_attendance_write_refused'), 1::bigint, 'a worker cannot write attendance directly');

select is((select n from rls_probe where name = 'scoped_task_in_stage'), 1::bigint, 'a stage-scoped supervisor reads a task in their stage');
select is((select n from rls_probe where name = 'scoped_task_outside_stage'), 0::bigint, 'a stage-scoped supervisor cannot read a task outside their stage');
select is((select n from rls_probe where name = 'supervisor_attendance'), 2::bigint, 'a supervisor reads attendance for the project');

select is((select n from rls_probe where name = 'home_unpublished_evidence'), 0::bigint, 'a homeowner cannot read unpublished evidence');
select is((select n from rls_probe where name = 'home_visible_evidence'), 1::bigint, 'a homeowner reads customer-visible evidence');
select is((select n from rls_probe where name = 'home_review_note'), 0::bigint, 'a homeowner cannot read progress review notes');
select is((select n from rls_probe where name = 'home_published_progress'), 1::bigint, 'a homeowner reads the published daily progress');
select is((select n from rls_probe where name = 'home_draft_progress'), 0::bigint, 'a homeowner cannot read a private daily progress draft');
select is((select n from rls_probe where name = 'home_internal_thread'), 0::bigint, 'a homeowner cannot read an internal thread');
select is((select n from rls_probe where name = 'home_own_thread'), 1::bigint, 'a homeowner reads their own homeowner thread');
select is((select n from rls_probe where name = 'home_tasks'), 0::bigint, 'a homeowner cannot read internal tasks');
select is((select n from rls_probe where name = 'home_visible_issues'), 1::bigint, 'a homeowner reads only customer-visible issues');
select is((select n from rls_probe where name = 'home_private_document'), 0::bigint, 'a homeowner cannot read a document not shared with them');

select is((select n from rls_probe where name = 'other_org_project_one'), 0::bigint, 'a user from another organization reads nothing in the project');
select is((select n from rls_probe where name = 'other_org_own_project'), 1::bigint, 'a user reads their own organization project');

select is((select n from rls_probe where name = 'partner_locked_requirement'), 0::bigint, 'a partner cannot read a requirement without an unlock row');
select is((select n from rls_probe where name = 'partner_unlocked_requirement'), 1::bigint, 'a partner reads a requirement with an unlock row');
select is((select n from rls_probe where name = 'partner_estimate'), 0::bigint, 'a partner cannot read a homeowner estimate');

select is((select n from rls_probe where name = 'owner_requirements'), 2::bigint, 'a homeowner reads their own requirements');

select * from finish();
rollback;
