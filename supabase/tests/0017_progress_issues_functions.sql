begin;
select plan(99);

-- Fixtures are inserted as the table owner (bypasses RLS). Each call is made as
-- one signed-in person by setting the JWT claims for the transaction.

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000017a0', 'org-t17', 'Org T17', 'construction-company');

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000017f1', 'proj-t17', '00000000-0000-0000-0000-0000000017a0', 'Project T17', 'active'),
  ('00000000-0000-0000-0000-0000000017f2', 'proj-t17-other', '00000000-0000-0000-0000-0000000017a0', 'Other Project T17', 'active');

insert into stages (id, legacy_id, project_id, name, sort_order) values
  ('00000000-0000-0000-0000-000000001751', 'stage-t17', null, 'Structure', 1);

insert into trades (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000001761', 'trade-t17', null, 'Masonry');

insert into work_types (id, legacy_id, project_id, name, stage_id, trade_id, default_unit) values
  ('00000000-0000-0000-0000-000000001771', 'work-t17', null, 'Brickwork',
    '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761', 'nos');

insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000001781', 'unit-t17-a', '00000000-0000-0000-0000-0000000017f1', 'Unit A');
insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000001783', 'unit-t17-foreign', '00000000-0000-0000-0000-0000000017f2', 'Foreign Unit');

-- People: pm (every permission used in this batch), site (progress.submit +
-- evidence.capture, and the worker for task-scoped submit tests), issue-only
-- (issue.manage but not progress.submit, for ISSUE_REPORT_PERMISSIONS' OR),
-- and none (project.read only, for permission-refusal tests).
insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000017d1', 'person-t17-pm', '+6598001701', 'Manager T17', null),
  ('00000000-0000-0000-0000-0000000017d2', 'person-t17-site', '+6598001702', 'Site T17', null),
  ('00000000-0000-0000-0000-0000000017d3', 'person-t17-issue', '+6598001703', 'Issue Manager T17', null),
  ('00000000-0000-0000-0000-0000000017d4', 'person-t17-none', '+6598001704', 'No Perms T17', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000017e1'),
  ('00000000-0000-0000-0000-0000000017e2'),
  ('00000000-0000-0000-0000-0000000017e3'),
  ('00000000-0000-0000-0000-0000000017e4');
update people set auth_user_id = '00000000-0000-0000-0000-0000000017e1' where id = '00000000-0000-0000-0000-0000000017d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000017e2' where id = '00000000-0000-0000-0000-0000000017d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000017e3' where id = '00000000-0000-0000-0000-0000000017d3';
update people set auth_user_id = '00000000-0000-0000-0000-0000000017e4' where id = '00000000-0000-0000-0000-0000000017d4';

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope, status) values
  ('00000000-0000-0000-0000-000000001791', 'm-t17-pm', '00000000-0000-0000-0000-0000000017d1', '00000000-0000-0000-0000-0000000017a0',
    '00000000-0000-0000-0000-0000000017f1', 'project-manager',
    array['project.read','project.manage','task.manage','progress.submit','progress.review','customer.publish','evidence.capture','issue.manage'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000001792', 'm-t17-site', '00000000-0000-0000-0000-0000000017d2', '00000000-0000-0000-0000-0000000017a0',
    '00000000-0000-0000-0000-0000000017f1', 'worker',
    array['progress.submit','evidence.capture'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000001793', 'm-t17-issue', '00000000-0000-0000-0000-0000000017d3', '00000000-0000-0000-0000-0000000017a0',
    '00000000-0000-0000-0000-0000000017f1', 'supervisor',
    array['issue.manage'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000001794', 'm-t17-none', '00000000-0000-0000-0000-0000000017d4', '00000000-0000-0000-0000-0000000017a0',
    '00000000-0000-0000-0000-0000000017f1', 'homeowner',
    array['project.read'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active');

-- Worker: linked to the site person, assigned (active) to Unit A.
insert into workers (id, legacy_id, organization_id, user_id, phone, name, status) values
  ('00000000-0000-0000-0000-0000000017c1', 'worker-t17-1', '00000000-0000-0000-0000-0000000017a0',
    '00000000-0000-0000-0000-0000000017d2', '+6598002701', 'Worker One T17', 'active');
insert into worker_project_assignments (id, legacy_id, project_id, worker_id, project_unit_ids, status) values
  ('00000000-0000-0000-0000-0000000017b1', 'wpa-t17-1', '00000000-0000-0000-0000-0000000017f1',
    '00000000-0000-0000-0000-0000000017c1', array['00000000-0000-0000-0000-000000001781']::uuid[], 'active');

-- Tasks: one in-progress and assigned to worker one (for the worker-submit
-- path), one unassigned (for the "not assigned to you" refusal), one in the
-- other project (for the cross-project integrity refusal).
insert into tasks (id, legacy_id, project_id, project_unit_id, stage_id, trade_id, title, status) values
  ('00000000-0000-0000-0000-000000001701', 'task-t17-assigned', '00000000-0000-0000-0000-0000000017f1',
    '00000000-0000-0000-0000-000000001781', '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
    'Assigned Task T17', 'in-progress'),
  ('00000000-0000-0000-0000-000000001702', 'task-t17-unassigned', '00000000-0000-0000-0000-0000000017f1',
    '00000000-0000-0000-0000-000000001781', '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
    'Unassigned Task T17', 'in-progress'),
  ('00000000-0000-0000-0000-000000001703', 'task-t17-foreign', '00000000-0000-0000-0000-0000000017f2',
    '00000000-0000-0000-0000-000000001783', '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
    'Foreign Task T17', 'draft');
insert into task_assignments (id, legacy_id, project_id, task_id, worker_id, assigned_at) values
  ('00000000-0000-0000-0000-000000001710', 'ta-t17-1', '00000000-0000-0000-0000-0000000017f1',
    '00000000-0000-0000-0000-000000001701', '00000000-0000-0000-0000-0000000017c1', now());

-- ── Structural checks ────────────────────────────────────────────────────────
select has_function('public', 'submit_daily_progress',
  array['uuid','uuid','uuid','uuid','uuid','uuid','integer','numeric','numeric','text','text','text','text','text','jsonb'],
  'submit_daily_progress exists');
select has_function('public', 'resubmit_daily_progress',
  array['uuid','integer','numeric','numeric','text','text','text','text','text','uuid[]','jsonb'],
  'resubmit_daily_progress exists');
select has_function('public', 'review_daily_progress', array['uuid','text','text'], 'review_daily_progress exists');
select has_function('public', 'publish_daily_progress_evidence', array['uuid','uuid[]'], 'publish_daily_progress_evidence exists');
select has_function('public', 'add_evidence',
  array['uuid','uuid','uuid','uuid','text','text','text','text','uuid','text'], 'add_evidence exists');
select has_function('public', 'report_issue',
  array['uuid','uuid','uuid','uuid','text','text','text','jsonb','uuid','uuid'], 'report_issue exists');
select has_function('public', 'assign_issue', array['uuid','uuid'], 'assign_issue exists');
select has_function('public', 'transition_issue', array['uuid','text','text'], 'transition_issue exists');
select has_function('public', 'add_issue_evidence', array['uuid','jsonb'], 'add_issue_evidence exists');
select has_function('public', 'publish_issue', array['uuid','boolean'], 'publish_issue exists');
select is_definer('public', 'submit_daily_progress',
  array['uuid','uuid','uuid','uuid','uuid','uuid','integer','numeric','numeric','text','text','text','text','text','jsonb'],
  'submit_daily_progress is security definer');
select is_definer('public', 'transition_issue', array['uuid','text','text'], 'transition_issue is security definer');

-- ── submitDailyProgress ──────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e4"}', true);
select throws_ok(
  $$select public.submit_daily_progress('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      null, '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
      '00000000-0000-0000-0000-000000001771', 4, null, null, null, 'Day 1', 'Day 2 plan', null, null, '[]'::jsonb)$$,
  'P0001', 'permission:Missing permission "progress.submit" on project 00000000-0000-0000-0000-0000000017f1',
  'a session with neither progress.submit nor progress.review cannot submit progress');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e1"}', true);
select lives_ok(
  $$select public.submit_daily_progress('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      null, '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
      '00000000-0000-0000-0000-000000001771', 4, null, null, null, 'PM Day 1 summary', 'Start lintels', null, null, '[]'::jsonb)$$,
  'the pm submits progress with no linked task');
select is(
  (select review_status from daily_progress where today_summary = 'PM Day 1 summary'),
  'submitted', 'the new update starts submitted');
select is(
  (select version from daily_progress where today_summary = 'PM Day 1 summary'), 1, 'the first submission is version 1');

select throws_ok(
  $$select public.submit_daily_progress('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      '00000000-0000-0000-0000-000000001703', '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
      '00000000-0000-0000-0000-000000001771', 4, null, null, null, 'Cross project', 'plan', null, null, '[]'::jsonb)$$,
  'P0001', 'Task 00000000-0000-0000-0000-000000001703 does not belong to project 00000000-0000-0000-0000-0000000017f1',
  'a task from another project is refused');

select throws_ok(
  $$select public.submit_daily_progress('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      null, '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
      '00000000-0000-0000-0000-000000001771', 4, null, -5, 'nos', 'Negative qty', 'plan', null, null, '[]'::jsonb)$$,
  'P0001', 'conflict:Enter the quantity completed today as a number, 0 or more.',
  'a negative completed quantity is refused');

-- Worker submission: worker one is assigned to the "assigned" task.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e2"}', true);
select throws_ok(
  $$select public.submit_daily_progress('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      null, '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
      '00000000-0000-0000-0000-000000001771', 1, null, null, null, 'No task chosen', 'plan', null, null, '[]'::jsonb)$$,
  'P0001', 'conflict:Choose the task this update is for.',
  'a worker must choose the task this update is for');
select throws_ok(
  $$select public.submit_daily_progress('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      '00000000-0000-0000-0000-000000001702', '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
      '00000000-0000-0000-0000-000000001771', 1, null, null, null, 'Not my task', 'plan', null, null, '[]'::jsonb)$$,
  'P0001', 'conflict:This task isn''t assigned to you.',
  'a worker cannot submit against a task that is not assigned to them');
select lives_ok(
  $$select public.submit_daily_progress('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      '00000000-0000-0000-0000-000000001701', '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
      '00000000-0000-0000-0000-000000001771', 1, null, 3, 'nos', 'Worker Day 1 summary', 'plan', null, null,
      '[{"type":"photo","url":"https://example.com/a.jpg"},{"type":"audio","url":"https://example.com/a.m4a"}]'::jsonb)$$,
  'worker one submits progress on their assigned task');
select is(
  (select status from tasks where id = '00000000-0000-0000-0000-000000001701'),
  'submitted', 'the assigned task moves from in-progress to submitted after the update');
select is(
  (select count(*)::int from evidence where daily_progress_id = (select id from daily_progress where today_summary = 'Worker Day 1 summary')),
  2, 'both evidence items are stored against the new update');
select is(
  (select customer_visibility from evidence where daily_progress_id = (select id from daily_progress where today_summary = 'Worker Day 1 summary') and type = 'audio'),
  'private', 'a voice note is private on submission');
select is(
  (select customer_visibility from evidence where daily_progress_id = (select id from daily_progress where today_summary = 'Worker Day 1 summary') and type = 'photo'),
  'review-required', 'a photo waits for review on submission');
select is(
  (select captured_by_worker_id from evidence where daily_progress_id = (select id from daily_progress where today_summary = 'Worker Day 1 summary') and type = 'photo'),
  '00000000-0000-0000-0000-0000000017c1'::uuid, 'evidence is attributed to the submitting worker');

-- ── reviewDailyProgress: decision transitions (approve / request-changes / reject) ──

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e1"}', true);
select lives_ok(
  $$select public.submit_daily_progress('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      null, '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
      '00000000-0000-0000-0000-000000001771', 2, null, null, null, 'Review Approve Case', 'plan', null, null, '[]'::jsonb)$$,
  'a fresh update is submitted for the approve case');
select throws_ok(
  $$select public.review_daily_progress((select id from daily_progress where today_summary = 'Review Approve Case'), 'publish', null)$$,
  'P0001', 'conflict:Choose what to do with this update.',
  'reviewDailyProgress refuses the publish decision (that is a separate command)');
select lives_ok(
  $$select public.review_daily_progress((select id from daily_progress where today_summary = 'Review Approve Case'), 'approve', null)$$,
  'the pm approves the update');
select is(
  (select review_status from daily_progress where today_summary = 'Review Approve Case'), 'approved',
  'decision=approve moves review_status to approved');
select lives_ok(
  $$select public.review_daily_progress((select id from daily_progress where today_summary = 'Review Approve Case'), 'approve', null)$$,
  'reviewing an already-reviewed update is a no-op, not an error');
select is(
  (select review_status from daily_progress where today_summary = 'Review Approve Case'), 'approved',
  'the no-op review leaves the status unchanged');

select lives_ok(
  $$select public.submit_daily_progress('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      null, '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
      '00000000-0000-0000-0000-000000001771', 2, null, null, null, 'Review RequestChanges Case', 'plan', null, null, '[]'::jsonb)$$,
  'a fresh update is submitted for the request-changes case');
select throws_ok(
  $$select public.review_daily_progress((select id from daily_progress where today_summary = 'Review RequestChanges Case'), 'request-changes', null)$$,
  'P0001', 'conflict:Add a note so the worker knows what to fix.',
  'request-changes needs a note');
select lives_ok(
  $$select public.review_daily_progress((select id from daily_progress where today_summary = 'Review RequestChanges Case'), 'request-changes', 'Add the second photo')$$,
  'the pm sends the update back for changes');
select is(
  (select review_status from daily_progress where today_summary = 'Review RequestChanges Case'), 'changes-requested',
  'decision=request-changes moves review_status to changes-requested');

select lives_ok(
  $$select public.submit_daily_progress('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      null, '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
      '00000000-0000-0000-0000-000000001771', 2, null, null, null, 'Review Reject Case', 'plan', null, null, '[]'::jsonb)$$,
  'a fresh update is submitted for the reject case');
select throws_ok(
  $$select public.review_daily_progress((select id from daily_progress where today_summary = 'Review Reject Case'), 'reject', '   ')$$,
  'P0001', 'conflict:Add a note saying why this update is rejected.',
  'reject needs a non-blank note');
select lives_ok(
  $$select public.review_daily_progress((select id from daily_progress where today_summary = 'Review Reject Case'), 'reject', 'Wrong unit entirely')$$,
  'the pm rejects the update');
select is(
  (select review_status from daily_progress where today_summary = 'Review Reject Case'), 'rejected',
  'decision=reject moves review_status to rejected');

-- ── resubmitDailyProgress: a correction is a new version, not an edit ───────

select lives_ok(
  $$select public.resubmit_daily_progress((select id from daily_progress where today_summary = 'Review RequestChanges Case'),
      2, null, null, null, 'Resubmitted with second photo', 'plan', null, null, '{}'::uuid[], '[]'::jsonb)$$,
  'the pm resubmits the update sent back for changes');
select isnt(
  (select id from daily_progress where today_summary = 'Resubmitted with second photo'),
  (select id from daily_progress where today_summary = 'Review RequestChanges Case'),
  'the resubmission is a new row, not the same row edited in place');
select is(
  (select version from daily_progress where today_summary = 'Resubmitted with second photo'), 2,
  'the resubmission is version 2');
select is(
  (select supersedes_id from daily_progress where today_summary = 'Resubmitted with second photo'),
  (select id from daily_progress where today_summary = 'Review RequestChanges Case'),
  'the resubmission supersedes the original version');
select is(
  (select review_status from daily_progress where today_summary = 'Review RequestChanges Case'), 'superseded',
  'the original version is marked superseded, not deleted or edited');
select is(
  (select superseded_by_id from daily_progress where today_summary = 'Review RequestChanges Case'),
  (select id from daily_progress where today_summary = 'Resubmitted with second photo'),
  'the original version links forward to its successor');
select is(
  (select today_summary from daily_progress where id = (select id from daily_progress where today_summary = 'Review RequestChanges Case')),
  'Review RequestChanges Case', 'the original version''s content is untouched');

select throws_ok(
  $$select public.resubmit_daily_progress((select id from daily_progress where today_summary = 'Review Approve Case'),
      2, null, null, null, 'Resubmit an approved update', 'plan', null, null, '{}'::uuid[], '[]'::jsonb)$$,
  'P0001', 'conflict:Only an update sent back for changes can be resubmitted.',
  'an update that was not sent back for changes cannot be resubmitted');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e2"}', true);
select throws_ok(
  $$select public.resubmit_daily_progress((select id from daily_progress where today_summary = 'Resubmitted with second photo'),
      2, null, null, null, 'Resubmit by someone else', 'plan', null, null, '{}'::uuid[], '[]'::jsonb)$$,
  'P0001', 'permission:Missing permission "progress.submit" on project 00000000-0000-0000-0000-0000000017f1',
  'only the original submitter may resubmit');

-- ── publishDailyProgress(progressId, evidenceIds): sets evidence customer-visible ──

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e1"}', true);
select lives_ok(
  $$select public.submit_daily_progress('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      null, '00000000-0000-0000-0000-000000001751', '00000000-0000-0000-0000-000000001761',
      '00000000-0000-0000-0000-000000001771', 2, null, null, null, 'Publish Case', 'plan', null, null,
      '[{"type":"photo","url":"https://example.com/p.jpg"},{"type":"audio","url":"https://example.com/p.m4a"}]'::jsonb)$$,
  'a fresh update with a photo and a voice note is submitted for the publish case');

select throws_ok(
  format('select public.publish_daily_progress_evidence(%L, array[%L]::uuid[])',
    (select id from daily_progress where today_summary = 'Publish Case'),
    (select id from evidence where daily_progress_id = (select id from daily_progress where today_summary = 'Publish Case') and type = 'photo')),
  'P0001', 'conflict:Only approved updates can be published.',
  'an update that has not been approved cannot be published');

select lives_ok(
  $$select public.review_daily_progress((select id from daily_progress where today_summary = 'Publish Case'), 'approve', null)$$,
  'the publish case update is approved');

select throws_ok(
  format('select public.publish_daily_progress_evidence(%L, array[%L]::uuid[])',
    (select id from daily_progress where today_summary = 'Publish Case'),
    (select id from evidence where daily_progress_id = (select id from daily_progress where today_summary = 'Publish Case') and type = 'audio')),
  'P0001', 'conflict:Voice notes can''t be shared with the homeowner.',
  'a voice note cannot be published');
-- A real evidence id, but one that belongs to a different update entirely.
select throws_ok(
  format('select public.publish_daily_progress_evidence(%L, array[%L]::uuid[])',
    (select id from daily_progress where today_summary = 'Publish Case'),
    (select id from evidence where daily_progress_id = (select id from daily_progress where today_summary = 'Worker Day 1 summary') and type = 'photo')),
  'P0001',
  format('Evidence %s is not on update %s',
    (select id from evidence where daily_progress_id = (select id from daily_progress where today_summary = 'Worker Day 1 summary') and type = 'photo'),
    (select id from daily_progress where today_summary = 'Publish Case')),
  'publishing an evidence id that is not on this update is refused');

select lives_ok(
  format('select public.publish_daily_progress_evidence(%L, array[%L]::uuid[])',
    (select id from daily_progress where today_summary = 'Publish Case'),
    (select id from evidence where daily_progress_id = (select id from daily_progress where today_summary = 'Publish Case') and type = 'photo')),
  'the pm publishes the photo only');
select is(
  (select publication_status from daily_progress where today_summary = 'Publish Case'), 'published',
  'the update is now published');
select is(
  (select customer_visibility from evidence where daily_progress_id = (select id from daily_progress where today_summary = 'Publish Case') and type = 'photo'),
  'customer-visible', 'the published photo is now customer-visible');
select is(
  (select customer_visibility from evidence where daily_progress_id = (select id from daily_progress where today_summary = 'Publish Case') and type = 'audio'),
  'private', 'the voice note was never made customer-visible');
select lives_ok(
  format('select public.publish_daily_progress_evidence(%L, array[%L]::uuid[])',
    (select id from daily_progress where today_summary = 'Publish Case'),
    (select id from evidence where daily_progress_id = (select id from daily_progress where today_summary = 'Publish Case') and type = 'photo')),
  'publishing an already-published update again is a no-op, not an error');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e2"}', true);
select throws_ok(
  format('select public.publish_daily_progress_evidence(%L, %L::uuid[])',
    (select id from daily_progress where today_summary = 'Review Reject Case'), '{}'),
  'P0001', 'permission:Missing permission "customer.publish" on project 00000000-0000-0000-0000-0000000017f1',
  'a session without customer.publish cannot publish');

-- ── addEvidence ──────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e4"}', true);
select throws_ok(
  $$select public.add_evidence('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      null, null, 'photo', 'https://example.com/e.jpg', null, null, null, null)$$,
  'P0001', 'permission:Missing permission "evidence.capture" on project 00000000-0000-0000-0000-0000000017f1',
  'a session without evidence.capture cannot add evidence');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e1"}', true);
select lives_ok(
  $$select public.add_evidence('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      '00000000-0000-0000-0000-000000001701', null, 'video', 'https://example.com/e.mp4', null, 'site progress', null, null)$$,
  'the pm adds standalone evidence against a task');
select is(
  (select type from evidence where url = 'https://example.com/e.mp4'), 'video', 'the evidence row is stored with the given type');
select is(
  (select customer_visibility from evidence where url = 'https://example.com/e.mp4'), 'review-required',
  'standalone evidence defaults to review-required');

-- ── reportIssue: ISSUE_REPORT_PERMISSIONS (progress.submit OR issue.manage) ──

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e4"}', true);
select throws_ok(
  $$select public.report_issue('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      null, null, 'Leak in bathroom', 'Water leaking from the ceiling', 'high', '[]'::jsonb, null, null)$$,
  'P0001', 'permission:Missing permission "progress.submit" on project 00000000-0000-0000-0000-0000000017f1',
  'a session with neither progress.submit nor issue.manage cannot report an issue');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e2"}', true);
select lives_ok(
  $$select public.report_issue('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      null, null, 'Leak in bathroom', 'Water leaking from the ceiling', 'high',
      '[{"type":"photo","url":"https://example.com/leak.jpg"}]'::jsonb, null, null)$$,
  'a progress.submit-only session (worker) can report an issue');
select is((select status from issues where title = 'Leak in bathroom'), 'open', 'the new issue starts open');
select is((select customer_visible from issues where title = 'Leak in bathroom'), false, 'the new issue starts private');
select is(
  (select count(*)::int from evidence where issue_id = (select id from issues where title = 'Leak in bathroom')),
  1, 'the issue''s own evidence is stored and linked by issue_id');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e3"}', true);
select lives_ok(
  $$select public.report_issue('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      null, null, 'Cracked tile', 'A tile cracked in the hallway', 'low', '[]'::jsonb, null, null)$$,
  'an issue.manage-only session can also report an issue');

select throws_ok(
  $$select public.report_issue('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-000000001781',
      null, null, '   ', 'description', 'low', '[]'::jsonb, null, null)$$,
  'P0001', 'Give the issue a title.',
  'a blank title is refused');

-- ── assignIssue ──────────────────────────────────────────────────────────────

select throws_ok(
  format('select public.assign_issue(%L, %L)',
    (select id from issues where title = 'Leak in bathroom'), '00000000-0000-0000-0000-000000019999'),
  'P0001', 'Membership 00000000-0000-0000-0000-000000019999 cannot take issues on this project',
  'assigning to an unknown membership is refused');
select lives_ok(
  format('select public.assign_issue(%L, %L)',
    (select id from issues where title = 'Leak in bathroom'), '00000000-0000-0000-0000-000000001791'),
  'the issue manager assigns the leak issue to the pm');
select is(
  (select assigned_membership_id from issues where title = 'Leak in bathroom'),
  '00000000-0000-0000-0000-000000001791'::uuid, 'the issue is now assigned to the pm');
select lives_ok(
  format('select public.assign_issue(%L, null)', (select id from issues where title = 'Leak in bathroom')),
  'passing no membership unassigns the issue');
select is(
  (select assigned_membership_id from issues where title = 'Leak in bathroom'), null, 'the issue is now unassigned');

-- ── transitionIssue: matches src/domain/issueTransitions.ts exactly ─────────

select lives_ok(
  format('select public.transition_issue(%L, %L, null)', (select id from issues where title = 'Leak in bathroom'), 'in-progress'),
  'valid transition: open -> in-progress');
select is((select status from issues where title = 'Leak in bathroom'), 'in-progress', 'the issue is now in-progress');

select lives_ok(
  format('select public.transition_issue(%L, %L, %L)', (select id from issues where title = 'Leak in bathroom'), 'resolved', 'Replaced the seal'),
  'valid transition: in-progress -> resolved');
select is((select status from issues where title = 'Leak in bathroom'), 'resolved', 'the issue is now resolved');
select isnt((select resolved_at from issues where title = 'Leak in bathroom'), null, 'resolved_at is set on resolving');

select throws_ok(
  format('select public.transition_issue(%L, %L, null)', (select id from issues where title = 'Leak in bathroom'), 'in-progress'),
  'P0001', 'conflict:An issue can''t move from resolved to in-progress.',
  'invalid transition: resolved -> in-progress is refused');

select lives_ok(
  format('select public.transition_issue(%L, %L, null)', (select id from issues where title = 'Leak in bathroom'), 'closed'),
  'valid transition: resolved -> closed');
select is((select status from issues where title = 'Leak in bathroom'), 'closed', 'the issue is now closed');

-- A closed issue cannot be assigned or get new evidence until reopened.
select throws_ok(
  format('select public.assign_issue(%L, %L)', (select id from issues where title = 'Leak in bathroom'), '00000000-0000-0000-0000-000000001791'),
  'P0001', 'conflict:Reopen this issue before assigning it.',
  'a closed issue cannot be assigned');
select throws_ok(
  format('select public.add_issue_evidence(%L, %L)', (select id from issues where title = 'Leak in bathroom'), '[{"type":"photo","url":"https://example.com/x.jpg"}]'::jsonb),
  'P0001', 'conflict:Reopen this issue before adding evidence.',
  'a closed issue cannot get new evidence');

select lives_ok(
  format('select public.transition_issue(%L, %L, null)', (select id from issues where title = 'Leak in bathroom'), 'open'),
  'valid transition: closed -> open');
select is((select status from issues where title = 'Leak in bathroom'), 'open', 'the issue is open again');
select is((select resolved_at from issues where title = 'Leak in bathroom'), null, 'reopening clears resolved_at');
select is((select closed_at from issues where title = 'Leak in bathroom'), null, 'reopening clears closed_at');
select is((select resolution_note from issues where title = 'Leak in bathroom'), null, 'reopening clears resolution_note');

-- ── addIssueEvidence ─────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e2"}', true);
select lives_ok(
  format('select public.add_issue_evidence(%L, %L)', (select id from issues where title = 'Leak in bathroom'),
    '[{"type":"photo","url":"https://example.com/followup.jpg"}]'::jsonb),
  'a progress.submit session adds follow-up evidence to the reopened issue');
select is(
  (select count(*)::int from evidence where issue_id = (select id from issues where title = 'Leak in bathroom')),
  2, 'the issue now has two evidence rows');

-- ── publishIssue ─────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e2"}', true);
select throws_ok(
  format('select public.publish_issue(%L, true)', (select id from issues where title = 'Leak in bathroom')),
  'P0001', 'permission:Missing permission "customer.publish" on project 00000000-0000-0000-0000-0000000017f1',
  'a session without customer.publish cannot publish an issue');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000017e1"}', true);
select lives_ok(
  format('select public.publish_issue(%L, true)', (select id from issues where title = 'Leak in bathroom')),
  'the pm shares the issue with the homeowner');
select is((select customer_visible from issues where title = 'Leak in bathroom'), true, 'the issue is now customer-visible');
select lives_ok(
  format('select public.publish_issue(%L, true)', (select id from issues where title = 'Leak in bathroom')),
  'sharing an already-shared issue again is a no-op, not an error');
select lives_ok(
  format('select public.publish_issue(%L, false)', (select id from issues where title = 'Leak in bathroom')),
  'the pm hides the issue again');
select is((select customer_visible from issues where title = 'Leak in bathroom'), false, 'the issue is private again');

select * from finish();
rollback;
