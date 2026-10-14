begin;
select plan(36);

-- Attendance
select has_table('public', 'worker_attendance', 'worker_attendance table exists');
select has_column('public', 'worker_attendance', 'worker_id', 'worker_attendance.worker_id exists');
select has_column('public', 'worker_attendance', 'project_id', 'worker_attendance.project_id exists');
select has_column('public', 'worker_attendance', 'date', 'worker_attendance.date exists');
select has_column('public', 'worker_attendance', 'status', 'worker_attendance.status exists');
select has_column('public', 'worker_attendance', 'check_in_at', 'worker_attendance.check_in_at exists');
select has_column('public', 'worker_attendance', 'check_out_at', 'worker_attendance.check_out_at exists');
select has_column('public', 'worker_attendance', 'recorded_by', 'worker_attendance.recorded_by exists');
select has_column('public', 'worker_attendance', 'assignment_id', 'worker_attendance.assignment_id exists');
select col_type_is('public', 'worker_attendance', 'date', 'date', 'worker_attendance.date is date');
select col_is_unique('public', 'worker_attendance', array['worker_id', 'project_id', 'date'], 'one attendance row per worker, project and day');

-- Estimates and marketplace
select has_table('public', 'estimates', 'estimates table exists');
select has_column('public', 'estimates', 'homeowner_person_id', 'estimates.homeowner_person_id exists');
select has_table('public', 'marketplace_requirements', 'marketplace_requirements table exists');
select has_column('public', 'marketplace_requirements', 'homeowner_person_id', 'marketplace_requirements.homeowner_person_id exists');
select has_column('public', 'marketplace_requirements', 'status', 'marketplace_requirements.status exists');
select has_table('public', 'marketplace_unlocks', 'marketplace_unlocks table exists');
select col_is_unique('public', 'marketplace_unlocks', array['requirement_id', 'partner_organization_id'], 'one unlock per requirement and organization');
select has_table('public', 'proposals', 'proposals table exists');
select col_is_unique('public', 'proposals', array['requirement_id', 'partner_organization_id'], 'one proposal per requirement and organization');

-- Billing
select has_table('public', 'plans', 'plans table exists');
select has_table('public', 'subscriptions', 'subscriptions table exists');
select has_table('public', 'credit_wallets', 'credit_wallets table exists');
select col_type_is('public', 'credit_wallets', 'balance', 'integer', 'credit_wallets.balance is integer');
select has_table('public', 'credit_transactions', 'credit_transactions table exists');
select has_column('public', 'credit_transactions', 'kind', 'credit_transactions.kind exists');
select has_column('public', 'credit_transactions', 'balance_after', 'credit_transactions.balance_after exists');
select has_column('public', 'credit_transactions', 'requirement_id', 'credit_transactions.requirement_id exists');

-- Fixtures: one contractor organization, one homeowner, one project, one worker with an assignment,
-- one estimate and requirement.
insert into organizations (id, legacy_id, name) values
  ('00000000-0000-0000-0000-0000000004a1', 'org-t5', 'Org T5');
insert into people (id, legacy_id, phone, full_name) values
  ('00000000-0000-0000-0000-0000000004b1', 'person-t5', '+6598000501', 'Homeowner T5');
insert into projects (id, legacy_id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000004f1', 'proj-t5', '00000000-0000-0000-0000-0000000004a1', 'Project T5');
insert into workers (id, legacy_id, organization_id, phone, name) values
  ('00000000-0000-0000-0000-0000000004c1', 'worker-t5', '00000000-0000-0000-0000-0000000004a1', '+6598000502', 'Worker T5');
insert into worker_project_assignments (id, legacy_id, project_id, worker_id) values
  ('00000000-0000-0000-0000-0000000004c2', 'wpa-t5', '00000000-0000-0000-0000-0000000004f1', '00000000-0000-0000-0000-0000000004c1');

insert into worker_attendance (id, worker_id, project_id, assignment_id, date, status, recorded_by)
values ('00000000-0000-0000-0000-0000000004d1', '00000000-0000-0000-0000-0000000004c1', '00000000-0000-0000-0000-0000000004f1',
  '00000000-0000-0000-0000-0000000004c2', '2026-10-07', 'present', 'supervisor');
select throws_ok(
  $$insert into worker_attendance (worker_id, project_id, assignment_id, date, status, recorded_by)
    values ('00000000-0000-0000-0000-0000000004c1', '00000000-0000-0000-0000-0000000004f1',
    '00000000-0000-0000-0000-0000000004c2', '2026-10-08', 'late', 'supervisor')$$,
  '23514', null, 'an attendance status outside present, absent and half-day is refused');
select lives_ok(
  $$insert into worker_attendance (worker_id, project_id, assignment_id, date, status, recorded_by)
    values ('00000000-0000-0000-0000-0000000004c1', '00000000-0000-0000-0000-0000000004f1',
    '00000000-0000-0000-0000-0000000004c2', '2026-10-09', null, 'worker')$$,
  'an attendance status may be null');
select throws_ok(
  $$insert into worker_attendance (worker_id, project_id, assignment_id, date, status, recorded_by)
    values ('00000000-0000-0000-0000-0000000004c1', '00000000-0000-0000-0000-0000000004f1',
    '00000000-0000-0000-0000-0000000004c2', '2026-10-07', 'present', 'supervisor')$$,
  '23505', null, 'a second attendance row for the same worker, project and day is refused');

insert into estimates (id, homeowner_person_id, project_name, property_type, location, built_up_area_sqft, floors, construction_level, total_low, total_high)
values ('00000000-0000-0000-0000-0000000004e1', '00000000-0000-0000-0000-0000000004b1', 'Villa', 'independent', 'Bengaluru', 1200, 2, 'standard', 1000000, 1200000);
insert into marketplace_requirements (id, estimate_id, homeowner_person_id, project_name, location, built_up_area_sqft, property_type,
  construction_level, estimate_total_low, estimate_total_high, status)
values ('00000000-0000-0000-0000-0000000004e2', '00000000-0000-0000-0000-0000000004e1', '00000000-0000-0000-0000-0000000004b1',
  'Villa', 'Bengaluru', 1200, 'independent', 'standard', 1000000, 1200000, 'posted');

insert into credit_wallets (organization_id, balance) values ('00000000-0000-0000-0000-0000000004a1', 30);
select throws_ok(
  $$update credit_wallets set balance = -1 where organization_id = '00000000-0000-0000-0000-0000000004a1'$$,
  '23514', null, 'a wallet cannot go negative');

insert into credit_transactions (id, organization_id, kind, amount, balance_after, requirement_id)
values ('00000000-0000-0000-0000-0000000004e3', '00000000-0000-0000-0000-0000000004a1', 'unlock', -10, 20,
  '00000000-0000-0000-0000-0000000004e2');
select throws_ok(
  $$insert into credit_transactions (organization_id, kind, amount, balance_after)
    values ('00000000-0000-0000-0000-0000000004a1', 'refund', 5, 25)$$,
  '23514', null, 'a credit transaction kind outside grant, purchase and unlock is refused');

insert into marketplace_unlocks (id, requirement_id, partner_organization_id, credit_transaction_id)
values ('00000000-0000-0000-0000-0000000004e4', '00000000-0000-0000-0000-0000000004e2', '00000000-0000-0000-0000-0000000004a1',
  '00000000-0000-0000-0000-0000000004e3');
select throws_ok(
  $$insert into marketplace_unlocks (requirement_id, partner_organization_id, credit_transaction_id)
    values ('00000000-0000-0000-0000-0000000004e2', '00000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-0000000004e3')$$,
  '23505', null, 'a second unlock for the same requirement and organization is refused');

insert into proposals (id, requirement_id, partner_organization_id, submitted_by_person_id, total, status)
values ('00000000-0000-0000-0000-0000000004e5', '00000000-0000-0000-0000-0000000004e2', '00000000-0000-0000-0000-0000000004a1',
  '00000000-0000-0000-0000-0000000004b1', 1100000, 'submitted');
select throws_ok(
  $$insert into proposals (requirement_id, partner_organization_id, submitted_by_person_id, total, status)
    values ('00000000-0000-0000-0000-0000000004e2', '00000000-0000-0000-0000-0000000004a1',
    '00000000-0000-0000-0000-0000000004b1', 1200000, 'submitted')$$,
  '23505', null, 'a second proposal for the same requirement and organization is refused');
select throws_ok(
  $$insert into marketplace_requirements (estimate_id, homeowner_person_id, project_name, location, built_up_area_sqft, property_type,
    construction_level, estimate_total_low, estimate_total_high, status)
    values ('00000000-0000-0000-0000-0000000004e1', '00000000-0000-0000-0000-0000000004b1', 'Villa', 'Bengaluru', 1200,
    'independent', 'standard', 1000000, 1200000, 'archived')$$,
  '23514', null, 'a requirement status outside draft, posted, awarded and closed is refused');

select * from finish();
rollback;
