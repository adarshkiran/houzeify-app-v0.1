begin;
select plan(46);

select has_table('public', 'daily_progress', 'daily_progress table exists');
select has_table('public', 'progress_reviews', 'progress_reviews table exists');
select has_table('public', 'progress_publications', 'progress_publications table exists');
select has_table('public', 'evidence', 'evidence table exists');
select has_table('public', 'documents', 'documents table exists');
select has_table('public', 'issues', 'issues table exists');
select has_table('public', 'threads', 'threads table exists');
select has_table('public', 'messages', 'messages table exists');
select has_table('public', 'thread_reads', 'thread_reads table exists');
select has_table('public', 'call_logs', 'call_logs table exists');

select has_column('public', 'daily_progress', 'version', 'daily_progress.version exists');
select has_column('public', 'daily_progress', 'supersedes_id', 'daily_progress.supersedes_id exists');
select has_column('public', 'daily_progress', 'superseded_by_id', 'daily_progress.superseded_by_id exists');
select has_column('public', 'daily_progress', 'review_status', 'daily_progress.review_status exists');
select has_column('public', 'progress_reviews', 'decision', 'progress_reviews.decision exists');
select has_column('public', 'progress_reviews', 'note', 'progress_reviews.note exists');
select has_column('public', 'progress_reviews', 'reviewer_membership_id', 'progress_reviews.reviewer_membership_id exists');
select has_column('public', 'progress_reviews', 'reviewed_at', 'progress_reviews.reviewed_at exists');
select has_column('public', 'progress_publications', 'published_by_membership_id', 'progress_publications.published_by_membership_id exists');
select has_column('public', 'progress_publications', 'published_at', 'progress_publications.published_at exists');
select has_column('public', 'documents', 'shared_with_homeowner', 'documents.shared_with_homeowner exists');
select col_type_is('public', 'documents', 'shared_with_homeowner', 'boolean', 'documents.shared_with_homeowner is boolean');
select has_column('public', 'issues', 'customer_visible', 'issues.customer_visible exists');
select col_type_is('public', 'issues', 'customer_visible', 'boolean', 'issues.customer_visible is boolean');
select has_column('public', 'threads', 'audience', 'threads.audience exists');
select has_column('public', 'threads', 'participant_membership_ids', 'threads.participant_membership_ids exists');
select col_type_is('public', 'threads', 'participant_membership_ids', 'uuid[]', 'threads.participant_membership_ids is uuid[]');

-- Fixtures: one organization, one project with a unit, stage, trade and work type, one membership.
insert into organizations (id, legacy_id, name) values
  ('00000000-0000-0000-0000-0000000003a1', 'org-t4', 'Org T4');

insert into people (id, legacy_id, phone, full_name) values
  ('00000000-0000-0000-0000-0000000003b1', 'person-t4', '+6598000301', 'Site Lead');

insert into projects (id, legacy_id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000003f1', 'proj-t4', '00000000-0000-0000-0000-0000000003a1', 'Project T4');

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope) values
  ('00000000-0000-0000-0000-0000000003e1', 'mem-t4', '00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-0000000003a1',
   '00000000-0000-0000-0000-0000000003f1', 'supervisor', array['progress.submit'], '{}'::jsonb);

insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-0000000003c1', 'unit-t4', '00000000-0000-0000-0000-0000000003f1', 'Block T4');

insert into stages (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-0000000003d1', 'stage-t4', '00000000-0000-0000-0000-0000000003f1', 'Structure');

insert into trades (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-0000000003d2', 'trade-t4', '00000000-0000-0000-0000-0000000003f1', 'Masonry');

insert into work_types (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-0000000003d3', 'wt-t4', '00000000-0000-0000-0000-0000000003f1', 'Brickwork');

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope) values
  ('00000000-0000-0000-0000-0000000003e2', 'mem-t4-b', '00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-0000000003a1',
   '00000000-0000-0000-0000-0000000003f1', 'worker', array[]::text[], '{}'::jsonb);

-- Version 1, submitted by the membership.
insert into daily_progress (id, legacy_id, project_id, project_unit_id, stage_id, trade_id, work_type_id,
  date, workers_present, today_summary, tomorrow_plan, submitted_by_membership_id, submitted_at,
  review_status, publication_status, version)
values
  ('00000000-0000-0000-0000-0000000003a2', 'dp-t4-v1', '00000000-0000-0000-0000-0000000003f1',
   '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003d1', '00000000-0000-0000-0000-0000000003d2',
   '00000000-0000-0000-0000-0000000003d3', '2026-10-06', 4, 'Laid 120 bricks', 'Start lintels',
   '00000000-0000-0000-0000-0000000003e1', '2026-10-06 12:00+00', 'submitted', 'private', 1);

create temp table v1_before as
  select to_jsonb(d) as content from daily_progress d where d.id = '00000000-0000-0000-0000-0000000003a2';

-- A correction is a new row with version + 1; the old row is not touched by the insert.
insert into daily_progress (id, legacy_id, project_id, project_unit_id, stage_id, trade_id, work_type_id,
  date, workers_present, today_summary, tomorrow_plan, submitted_by_membership_id, submitted_at,
  review_status, publication_status, version, supersedes_id)
values
  ('00000000-0000-0000-0000-0000000003a3', 'dp-t4-v2', '00000000-0000-0000-0000-0000000003f1',
   '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003d1', '00000000-0000-0000-0000-0000000003d2',
   '00000000-0000-0000-0000-0000000003d3', '2026-10-06', 4, 'Laid 140 bricks', 'Start lintels',
   '00000000-0000-0000-0000-0000000003e1', '2026-10-06 18:00+00', 'submitted', 'private', 2,
   '00000000-0000-0000-0000-0000000003a2');

select is((select version from daily_progress where id = '00000000-0000-0000-0000-0000000003a3'), 2,
  'a correction is version 2');
select is((select content from v1_before), (select to_jsonb(d) from daily_progress d where d.id = '00000000-0000-0000-0000-0000000003a2'),
  'inserting the correction leaves the old version content unchanged');

-- Linking the old version to its successor is the one update allowed on it.
update daily_progress set superseded_by_id = '00000000-0000-0000-0000-0000000003a3'
  where id = '00000000-0000-0000-0000-0000000003a2';
select is((select superseded_by_id from daily_progress where id = '00000000-0000-0000-0000-0000000003a2'),
  '00000000-0000-0000-0000-0000000003a3'::uuid, 'the old version links to its successor');
select is((select to_jsonb(d) - 'superseded_by_id' from daily_progress d where d.id = '00000000-0000-0000-0000-0000000003a2'),
  (select content - 'superseded_by_id' from v1_before), 'linking the successor changes no other content on the old version');

select throws_ok(
  $$update daily_progress set today_summary = 'Edited after the fact' where id = '00000000-0000-0000-0000-0000000003a2'$$,
  'P0001', 'daily progress content is immutable; correct it with a new version',
  'a superseded version cannot be edited');
select throws_ok(
  $$update daily_progress set today_summary = 'Edited before linking' where id = '00000000-0000-0000-0000-0000000003a3'$$,
  'P0001', 'daily progress content is immutable; correct it with a new version',
  'an unsuperseded version cannot change its content either');
select throws_ok(
  $$insert into daily_progress (id, project_id, project_unit_id, stage_id, trade_id, work_type_id, date, workers_present,
      today_summary, tomorrow_plan, submitted_by_membership_id, submitted_at, version, supersedes_id)
    values ('00000000-0000-0000-0000-0000000003a4', '00000000-0000-0000-0000-0000000003f1',
      '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003d1', '00000000-0000-0000-0000-0000000003d2',
      '00000000-0000-0000-0000-0000000003d3', '2026-10-06', 4, 'Skipped a version', 'Plan',
      '00000000-0000-0000-0000-0000000003e1', now(), 5, '00000000-0000-0000-0000-0000000003a3')$$,
  'P0001', 'a correction must be version + 1 of the version it supersedes',
  'a correction must step the version by one');

-- Constraints on the vocabularies.
select throws_ok(
  $$insert into daily_progress (project_id, project_unit_id, stage_id, trade_id, work_type_id, date, workers_present,
      today_summary, tomorrow_plan, submitted_by_membership_id, submitted_at, review_status, version)
    values ('00000000-0000-0000-0000-0000000003f1', '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003d1',
      '00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003d3', '2026-10-07', 1, 'x', 'y',
      '00000000-0000-0000-0000-0000000003e1', now(), 'pending', 1)$$,
  '23514', null, 'daily_progress.review_status refuses a value outside the domain vocabulary');

select throws_ok(
  $$insert into progress_reviews (daily_progress_id, decision, reviewer_membership_id, reviewed_at)
    values ('00000000-0000-0000-0000-0000000003a3', 'maybe', '00000000-0000-0000-0000-0000000003e1', now())$$,
  '23514', null, 'progress_reviews.decision refuses an unknown decision');

select throws_ok(
  $$insert into threads (project_id, subject, audience) values ('00000000-0000-0000-0000-0000000003f1', 'project', 'public')$$,
  '23514', null, 'threads.audience refuses a value other than internal or homeowner');

select throws_ok(
  $$insert into issues (project_id, title, description, severity, status, customer_visible, created_by_membership_id, created_at)
    values ('00000000-0000-0000-0000-0000000003f1', 'Crack', 'Hairline crack', 'low', 'waiting', false,
      '00000000-0000-0000-0000-0000000003e1', now())$$,
  '23514', null, 'issues.status refuses a value outside the domain vocabulary');

-- Progress review and publication, evidence, documents, issues.
insert into progress_reviews (daily_progress_id, decision, note, reviewer_membership_id, reviewed_at) values
  ('00000000-0000-0000-0000-0000000003a3', 'request-changes', 'Recount the bricks', '00000000-0000-0000-0000-0000000003e1', now());
select is((select count(*)::int from progress_reviews where daily_progress_id = '00000000-0000-0000-0000-0000000003a3'), 1,
  'a review is recorded against a progress version');

insert into progress_publications (daily_progress_id, published_by_membership_id, published_at) values
  ('00000000-0000-0000-0000-0000000003a3', '00000000-0000-0000-0000-0000000003e1', now());
select is((select count(*)::int from progress_publications where daily_progress_id = '00000000-0000-0000-0000-0000000003a3'), 1,
  'a publication is recorded against a progress version');

insert into evidence (id, project_id, daily_progress_id, type, url, captured_by_membership_id, captured_at, customer_visibility)
values ('00000000-0000-0000-0000-0000000003a5', '00000000-0000-0000-0000-0000000003f1', '00000000-0000-0000-0000-0000000003a3',
  'photo', 'https://example.test/brick.jpg', '00000000-0000-0000-0000-0000000003e1', now(), 'private');
select is((select customer_visibility from evidence where id = '00000000-0000-0000-0000-0000000003a5'), 'private',
  'evidence is recorded with its visibility');

insert into documents (id, project_id, title, category, url, uploaded_by_membership_id, shared_with_homeowner)
values ('00000000-0000-0000-0000-0000000003a6', '00000000-0000-0000-0000-0000000003f1', 'Approval', 'approval',
  'https://example.test/approval.pdf', '00000000-0000-0000-0000-0000000003e1', false);
select is((select shared_with_homeowner from documents where id = '00000000-0000-0000-0000-0000000003a6'), false,
  'a document is not shared with the homeowner until someone shares it');

insert into issues (id, project_id, title, description, severity, status, customer_visible, created_by_membership_id, created_at)
values ('00000000-0000-0000-0000-0000000003a7', '00000000-0000-0000-0000-0000000003f1', 'Crack', 'Hairline crack', 'low',
  'open', false, '00000000-0000-0000-0000-0000000003e1', now());
select is((select customer_visible from issues where id = '00000000-0000-0000-0000-0000000003a7'), false,
  'an issue is not customer visible until someone makes it so');

-- Conversations: a homeowner thread and a direct thread between two memberships.
insert into threads (id, project_id, subject, audience, participant_membership_ids) values
  ('00000000-0000-0000-0000-0000000003a8', '00000000-0000-0000-0000-0000000003f1', 'homeowner', 'homeowner', '{}'),
  ('00000000-0000-0000-0000-0000000003a9', '00000000-0000-0000-0000-0000000003f1', 'direct', 'internal',
    array['00000000-0000-0000-0000-0000000003e1', '00000000-0000-0000-0000-0000000003e2']::uuid[]);
select is((select array_length(participant_membership_ids, 1) from threads where id = '00000000-0000-0000-0000-0000000003a9'), 2,
  'a direct thread stores its two participant memberships');

insert into messages (id, thread_id, author_membership_id, body, created_at) values
  ('00000000-0000-0000-0000-0000000003b8', '00000000-0000-0000-0000-0000000003a9', '00000000-0000-0000-0000-0000000003e1', 'Pour at noon', now());
insert into thread_reads (thread_id, membership_id, last_read_at) values
  ('00000000-0000-0000-0000-0000000003a9', '00000000-0000-0000-0000-0000000003e1', now());
insert into call_logs (id, thread_id, logged_by_membership_id, other_membership_id, type, started_at, duration_minutes) values
  ('00000000-0000-0000-0000-0000000003b9', '00000000-0000-0000-0000-0000000003a9', '00000000-0000-0000-0000-0000000003e1',
   '00000000-0000-0000-0000-0000000003e2', 'voice', now(), 5);
select is((select count(*)::int from messages where thread_id = '00000000-0000-0000-0000-0000000003a9'), 1,
  'a message belongs to a thread');
select is((select count(*)::int from call_logs where thread_id = '00000000-0000-0000-0000-0000000003a9'), 1,
  'a call log belongs to a thread');

select * from finish();
rollback;
