begin;
select plan(54);

-- Fixtures are inserted as the table owner (bypasses RLS). Each call is made as
-- one signed-in person by setting the JWT claims for the transaction.

insert into organizations (id, legacy_id, name) values
  ('00000000-0000-0000-0000-0000000008a0', 'org-t9', 'Org T9');

insert into projects (id, legacy_id, organization_id, name, require_checkout) values
  ('00000000-0000-0000-0000-0000000008f1', 'proj-t9', '00000000-0000-0000-0000-0000000008a0', 'Project T9', false);

insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000000881', 'unit-t9', '00000000-0000-0000-0000-0000000008f1', 'Unit T9');
insert into stages (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000000882', 'stage-t9', '00000000-0000-0000-0000-0000000008f1', 'Stage T9');
insert into trades (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000000883', 'trade-t9', '00000000-0000-0000-0000-0000000008f1', 'Trade T9');
insert into work_types (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000000884', 'wt-t9', '00000000-0000-0000-0000-0000000008f1', 'Work type T9');

-- People: sup (supervisor with every T9 permission), wk1 and wk2 and wk3 (linked workers),
-- rev (progress.review only).
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000008e1'),
  ('00000000-0000-0000-0000-0000000008e2'),
  ('00000000-0000-0000-0000-0000000008e3'),
  ('00000000-0000-0000-0000-0000000008e4'),
  ('00000000-0000-0000-0000-0000000008e5');

insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000008d1', 'person-t9-sup', '+6598000911', 'Supervisor T9', '00000000-0000-0000-0000-0000000008e1'),
  ('00000000-0000-0000-0000-0000000008d2', 'person-t9-wk1', '+6598000912', 'Worker one T9', '00000000-0000-0000-0000-0000000008e2'),
  ('00000000-0000-0000-0000-0000000008d3', 'person-t9-rev', '+6598000913', 'Reviewer T9', '00000000-0000-0000-0000-0000000008e3'),
  ('00000000-0000-0000-0000-0000000008d4', 'person-t9-wk2', '+6598000914', 'Worker two T9', '00000000-0000-0000-0000-0000000008e4'),
  ('00000000-0000-0000-0000-0000000008d5', 'person-t9-wk3', '+6598000915', 'Worker three T9', '00000000-0000-0000-0000-0000000008e5');

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, status) values
  ('00000000-0000-0000-0000-0000000008b1', 'm-t9-sup', '00000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000008a0', '00000000-0000-0000-0000-0000000008f1', 'supervisor', array['project.read', 'project.manage', 'workforce.manage', 'progress.review', 'customer.publish'], 'active'),
  ('00000000-0000-0000-0000-0000000008b2', 'm-t9-wk1', '00000000-0000-0000-0000-0000000008d2', '00000000-0000-0000-0000-0000000008a0', '00000000-0000-0000-0000-0000000008f1', 'worker', array['progress.submit'], 'active'),
  ('00000000-0000-0000-0000-0000000008b3', 'm-t9-rev', '00000000-0000-0000-0000-0000000008d3', '00000000-0000-0000-0000-0000000008a0', '00000000-0000-0000-0000-0000000008f1', 'supervisor', array['progress.review'], 'active'),
  ('00000000-0000-0000-0000-0000000008b4', 'm-t9-wk2', '00000000-0000-0000-0000-0000000008d4', '00000000-0000-0000-0000-0000000008a0', '00000000-0000-0000-0000-0000000008f1', 'worker', array['progress.submit'], 'active'),
  ('00000000-0000-0000-0000-0000000008b5', 'm-t9-wk3', '00000000-0000-0000-0000-0000000008d5', '00000000-0000-0000-0000-0000000008a0', '00000000-0000-0000-0000-0000000008f1', 'worker', array['progress.submit'], 'active');

insert into workers (id, legacy_id, organization_id, user_id, phone, name, status) values
  ('00000000-0000-0000-0000-0000000008c1', 'wk-t9-1', '00000000-0000-0000-0000-0000000008a0', '00000000-0000-0000-0000-0000000008d2', '+6598000921', 'Worker One T9', 'active'),
  ('00000000-0000-0000-0000-0000000008c2', 'wk-t9-2', '00000000-0000-0000-0000-0000000008a0', '00000000-0000-0000-0000-0000000008d4', '+6598000922', 'Worker Two T9', 'active'),
  ('00000000-0000-0000-0000-0000000008c3', 'wk-t9-3', '00000000-0000-0000-0000-0000000008a0', '00000000-0000-0000-0000-0000000008d5', '+6598000923', 'Worker Three T9', 'active');

-- a1: worker one, open. a2: worker two, ended a day ago. a3old + a3new: worker three,
-- an ended assignment and an open one that both cover a day two days back (A9).
insert into worker_project_assignments (id, legacy_id, project_id, worker_id, started_at, ended_at, end_reason, status) values
  ('00000000-0000-0000-0000-0000000008a1', 'asg-t9-1', '00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008c1', now() - interval '2 days', null, null, 'active'),
  ('00000000-0000-0000-0000-0000000008a2', 'asg-t9-2', '00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008c2', now() - interval '10 days', now() - interval '1 day', 'removed', 'inactive'),
  ('00000000-0000-0000-0000-0000000008a3', 'asg-t9-3old', '00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008c3', now() - interval '10 days', now() - interval '1 day', 'reassigned', 'inactive'),
  ('00000000-0000-0000-0000-0000000008a4', 'asg-t9-3new', '00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008c3', now() - interval '3 days', null, null, 'active');

-- Daily progress: dp1 and dp2 are waiting for review, submitted by worker one.
insert into daily_progress (id, legacy_id, project_id, project_unit_id, stage_id, trade_id, work_type_id, date, today_summary, tomorrow_plan, submitted_by_membership_id, review_status, publication_status) values
  ('00000000-0000-0000-0000-000000000871', 'dp-t9-1', '00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-000000000883', '00000000-0000-0000-0000-000000000884', current_date, 'Laid blocks', 'Plaster', '00000000-0000-0000-0000-0000000008b2', 'submitted', 'private'),
  ('00000000-0000-0000-0000-000000000872', 'dp-t9-2', '00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-000000000881', '00000000-0000-0000-0000-000000000882', '00000000-0000-0000-0000-000000000883', '00000000-0000-0000-0000-000000000884', current_date, 'Wired points', 'Test', '00000000-0000-0000-0000-0000000008b2', 'submitted', 'private');

-- Structural checks
select has_function('public', 'check_in_worker', array['uuid'], 'check_in_worker takes only the project');
select has_function('public', 'check_out_worker', array['uuid'], 'check_out_worker takes only the project');
select has_function('public', 'record_attendance', array['uuid', 'uuid', 'date', 'text', 'timestamptz', 'timestamptz'], 'record_attendance exists');
select has_function('public', 'set_attendance_policy', array['uuid', 'boolean'], 'set_attendance_policy exists');
select has_function('public', 'publish_daily_progress', array['uuid', 'text', 'text'], 'publish_daily_progress exists');
select is_definer('public', 'check_in_worker', array['uuid'], 'check_in_worker is security definer');
select is_definer('public', 'check_out_worker', array['uuid'], 'check_out_worker is security definer');
select is_definer('public', 'record_attendance', array['uuid', 'uuid', 'date', 'text', 'timestamptz', 'timestamptz'], 'record_attendance is security definer');
select is_definer('public', 'set_attendance_policy', array['uuid', 'boolean'], 'set_attendance_policy is security definer');
select is_definer('public', 'publish_daily_progress', array['uuid', 'text', 'text'], 'publish_daily_progress is security definer');
select is((select pronargs::int from pg_proc where proname = 'check_in_worker' and pronamespace = 'public'::regnamespace), 1, 'check_in_worker has no time argument');

-- The assignment status check allows 'invited' (the activation path sets it).
select lives_ok(
  $$insert into worker_project_assignments (legacy_id, project_id, worker_id, status) values ('asg-t9-invited', '00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008c3', 'invited')$$,
  'an assignment may be invited');
select throws_ok(
  $$insert into worker_project_assignments (legacy_id, project_id, worker_id, status) values ('asg-t9-bad', '00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008c3', 'pending')$$,
  '23514', null, 'an unknown assignment status is still refused');

-- Check-in and check-out as worker one. Check-out needs a check-in first.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000008e2"}', true);
select throws_ok(
  $$select public.check_out_worker('00000000-0000-0000-0000-0000000008f1')$$,
  'P0001', 'conflict:Check in before you check out.', 'check-out without a check-in is refused');
select lives_ok(
  $$select public.check_in_worker('00000000-0000-0000-0000-0000000008f1')$$,
  'worker one checks in');
select is((select check_in_at is not null from worker_attendance where worker_id = '00000000-0000-0000-0000-0000000008c1' and project_id = '00000000-0000-0000-0000-0000000008f1' and date = (now() at time zone 'Asia/Kolkata')::date), true, 'the check-in is recorded for today');
select is((select status from worker_attendance where worker_id = '00000000-0000-0000-0000-0000000008c1'), 'present', 'a check-in sets the status to present');
select is((select recorded_by from worker_attendance where worker_id = '00000000-0000-0000-0000-0000000008c1'), 'worker', 'a check-in is recorded by the worker');
select is((select assignment_id from worker_attendance where worker_id = '00000000-0000-0000-0000-0000000008c1'), '00000000-0000-0000-0000-0000000008a1'::uuid, 'the check-in is tied to the open assignment');
select is(
  (select date from worker_attendance where worker_id = '00000000-0000-0000-0000-0000000008c1'),
  (now() at time zone 'Asia/Kolkata')::date,
  'the attendance date is the Asia/Kolkata calendar day, not the UTC day');
select throws_ok(
  $$select public.check_in_worker('00000000-0000-0000-0000-0000000008f1')$$,
  'P0001', 'conflict:You''ve already checked in today.', 'a second check-in the same day is refused');

-- A session that is not a worker cannot check in for anyone.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000008e1"}', true);
select throws_ok(
  $$select public.check_in_worker('00000000-0000-0000-0000-0000000008f1')$$,
  'P0001', 'conflict:You can only check in or out for yourself.', 'a supervisor session cannot check in');

-- Check-out is allowed after the assignment has ended (A8).
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000008e2"}', true);
update worker_project_assignments set ended_at = now(), status = 'inactive', end_reason = 'left-project'
  where id = '00000000-0000-0000-0000-0000000008a1';
select lives_ok(
  $$select public.check_out_worker('00000000-0000-0000-0000-0000000008f1')$$,
  'worker one checks out after the assignment ended');
select isnt((select check_out_at from worker_attendance where worker_id = '00000000-0000-0000-0000-0000000008c1'), null, 'the check-out time is recorded');
select throws_ok(
  $$select public.check_out_worker('00000000-0000-0000-0000-0000000008f1')$$,
  'P0001', 'conflict:You''ve already checked out today.', 'a second check-out the same day is refused');

-- record_attendance: a worker session cannot record attendance.
select throws_ok(
  $$select public.record_attendance('00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008c3', (now() at time zone 'Asia/Kolkata')::date - 2, 'present', null, null)$$,
  'P0001', 'permission:Missing permission "workforce.manage"', 'a worker session cannot record attendance');

-- record_attendance: a fully ended covering assignment is refused (R9, A9).
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000008e1"}', true);
select throws_ok(
  $$select public.record_attendance('00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008c2', (now() at time zone 'Asia/Kolkata')::date - 2, 'present', null, null)$$,
  'P0001', 'conflict:This assignment has ended, so attendance can''t be changed.', 'a supervisor cannot record a day covered only by an ended assignment');
select is((select count(*)::int from worker_attendance where worker_id = '00000000-0000-0000-0000-0000000008c2'), 0, 'a refused record writes no row');

-- record_attendance: with an open covering assignment the open one wins (A9).
select lives_ok(
  $$select public.record_attendance('00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008c3', (now() at time zone 'Asia/Kolkata')::date - 2, 'present', null, null)$$,
  'a supervisor can record a day covered by an open assignment');
select is(
  (select assignment_id from worker_attendance where worker_id = '00000000-0000-0000-0000-0000000008c3'),
  '00000000-0000-0000-0000-0000000008a4'::uuid,
  'the record is tied to the open assignment, not the ended one');
select lives_ok(
  $$select public.record_attendance('00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008c3', (now() at time zone 'Asia/Kolkata')::date - 2, 'absent', null, null)$$,
  'a supervisor can correct the same day');
select is((select count(*)::int from worker_attendance where worker_id = '00000000-0000-0000-0000-0000000008c3'), 1, 'a correction updates the one row for the day');
select is((select status from worker_attendance where worker_id = '00000000-0000-0000-0000-0000000008c3'), 'absent', 'the correction is kept');

-- set_attendance_policy: a worker cannot change it; a project.manage holder can.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000008e2"}', true);
select throws_ok(
  $$select public.set_attendance_policy('00000000-0000-0000-0000-0000000008f1', true)$$,
  'P0001', 'permission:Missing permission "project.manage"', 'a worker cannot set the checkout policy');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000008e1"}', true);
select lives_ok(
  $$select public.set_attendance_policy('00000000-0000-0000-0000-0000000008f1', true)$$,
  'a project manager sets the checkout policy');
select is((select require_checkout from projects where id = '00000000-0000-0000-0000-0000000008f1'), true, 'the policy is stored on the project');

-- Projects: a direct update of require_checkout is refused, other columns still update.
set local role authenticated;
select throws_ok(
  $$update public.projects set require_checkout = false where id = '00000000-0000-0000-0000-0000000008f1'$$,
  '42501', null, 'a direct update of require_checkout is refused');
select lives_ok(
  $$update public.projects set name = 'Renamed T9' where id = '00000000-0000-0000-0000-0000000008f1'$$,
  'a direct update of the project name still works');
reset role;
select is((select name from projects where id = '00000000-0000-0000-0000-0000000008f1'), 'Renamed T9', 'the renamed project is stored');
select is((select require_checkout from projects where id = '00000000-0000-0000-0000-0000000008f1'), true, 'the refused direct update left the policy unchanged');

-- publish_daily_progress: review needs progress.review.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000008e2"}', true);
select throws_ok(
  $$select public.publish_daily_progress('00000000-0000-0000-0000-000000000871', 'approve', null)$$,
  'P0001', 'permission:Missing permission "progress.review"', 'a worker cannot review an update');

-- Publication needs customer.publish, which the reviewer does not hold.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000008e3"}', true);
select throws_ok(
  $$select public.publish_daily_progress('00000000-0000-0000-0000-000000000871', 'publish', null)$$,
  'P0001', 'permission:Missing permission "customer.publish"', 'a reviewer without customer.publish cannot publish');
select lives_ok(
  $$select public.publish_daily_progress('00000000-0000-0000-0000-000000000871', 'approve', null)$$,
  'a reviewer approves an update');
select is((select review_status from daily_progress where id = '00000000-0000-0000-0000-000000000871'), 'approved', 'approval sets the review status');
select is((select count(*)::int from progress_reviews where daily_progress_id = '00000000-0000-0000-0000-000000000871'), 1, 'approval writes one review');

-- Only an approved update can be published; request-changes needs a note.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000008e1"}', true);
select throws_ok(
  $$select public.publish_daily_progress('00000000-0000-0000-0000-000000000872', 'publish', null)$$,
  'P0001', 'conflict:Only approved updates can be published.', 'an unapproved update cannot be published');
select throws_ok(
  $$select public.publish_daily_progress('00000000-0000-0000-0000-000000000872', 'request-changes', '  ')$$,
  'P0001', 'conflict:Add a note so the worker knows what to fix.', 'request-changes needs a note');
select lives_ok(
  $$select public.publish_daily_progress('00000000-0000-0000-0000-000000000872', 'request-changes', 'Add the wiring photo')$$,
  'the supervisor requests changes with a note');
select is((select review_status from daily_progress where id = '00000000-0000-0000-0000-000000000872'), 'changes-requested', 'request-changes sets the review status');

-- Publishing an approved update makes it customer-visible; publishing again is a no-op.
select lives_ok(
  $$select public.publish_daily_progress('00000000-0000-0000-0000-000000000871', 'publish', null)$$,
  'the supervisor publishes an approved update');
select is((select publication_status from daily_progress where id = '00000000-0000-0000-0000-000000000871'), 'published', 'publishing sets the publication status');
select is((select count(*)::int from progress_publications where daily_progress_id = '00000000-0000-0000-0000-000000000871'), 1, 'publishing writes one publication');
select lives_ok(
  $$select public.publish_daily_progress('00000000-0000-0000-0000-000000000871', 'publish', null)$$,
  'publishing an already published update is a no-op');
select is((select count(*)::int from progress_publications where daily_progress_id = '00000000-0000-0000-0000-000000000871'), 1, 'a repeat publish writes no second publication');

select * from finish();
rollback;
