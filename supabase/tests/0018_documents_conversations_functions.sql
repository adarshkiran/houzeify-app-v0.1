begin;
select plan(66);

-- Fixtures are inserted as the table owner (bypasses RLS). Each call is made as
-- one signed-in person by setting the JWT claims for the transaction. A few
-- checks (document/thread visibility) go through the real RLS policies by
-- also switching to the `authenticated` role, the same pattern as 0005_rls.sql.

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000018a0', 'org-t18', 'Org T18', 'construction-company');

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000018f1', 'proj-t18', '00000000-0000-0000-0000-0000000018a0', 'Project T18', 'active');

insert into stages (id, legacy_id, project_id, name, sort_order) values
  ('00000000-0000-0000-0000-000000001851', 'stage-t18', null, 'Structure', 1);
insert into trades (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000001861', 'trade-t18', null, 'Masonry');
insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000001881', 'unit-t18-a', '00000000-0000-0000-0000-0000000018f1', 'Unit A');

-- People: pm (every permission used in this batch), site (a worker: project.read
-- + progress.submit + evidence.capture, for direct-pair tests), supervisor (a
-- valid direct-message partner for the worker, and a second internal reader),
-- consultant (project.read only -- staff, but no evidence.capture/customer.publish,
-- for permission-refusal tests), and homeowner.
insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000018d1', 'person-t18-pm', '+6598001801', 'Manager T18', null),
  ('00000000-0000-0000-0000-0000000018d2', 'person-t18-site', '+6598001802', 'Site T18', null),
  ('00000000-0000-0000-0000-0000000018d3', 'person-t18-sup', '+6598001803', 'Supervisor T18', null),
  ('00000000-0000-0000-0000-0000000018d4', 'person-t18-none', '+6598001804', 'Consultant T18', null),
  ('00000000-0000-0000-0000-0000000018d5', 'person-t18-home', '+6598001805', 'Homeowner T18', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000018e1'),
  ('00000000-0000-0000-0000-0000000018e2'),
  ('00000000-0000-0000-0000-0000000018e3'),
  ('00000000-0000-0000-0000-0000000018e4'),
  ('00000000-0000-0000-0000-0000000018e5');
update people set auth_user_id = '00000000-0000-0000-0000-0000000018e1' where id = '00000000-0000-0000-0000-0000000018d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000018e2' where id = '00000000-0000-0000-0000-0000000018d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000018e3' where id = '00000000-0000-0000-0000-0000000018d3';
update people set auth_user_id = '00000000-0000-0000-0000-0000000018e4' where id = '00000000-0000-0000-0000-0000000018d4';
update people set auth_user_id = '00000000-0000-0000-0000-0000000018e5' where id = '00000000-0000-0000-0000-0000000018d5';

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope, status) values
  ('00000000-0000-0000-0000-000000001891', 'm-t18-pm', '00000000-0000-0000-0000-0000000018d1', '00000000-0000-0000-0000-0000000018a0',
    '00000000-0000-0000-0000-0000000018f1', 'project-manager',
    array['project.read','project.manage','task.manage','progress.submit','progress.review','customer.publish','evidence.capture','issue.manage'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000001892', 'm-t18-site', '00000000-0000-0000-0000-0000000018d2', '00000000-0000-0000-0000-0000000018a0',
    '00000000-0000-0000-0000-0000000018f1', 'worker',
    array['project.read','progress.submit','evidence.capture'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000001893', 'm-t18-sup', '00000000-0000-0000-0000-0000000018d3', '00000000-0000-0000-0000-0000000018a0',
    '00000000-0000-0000-0000-0000000018f1', 'supervisor',
    array['project.read','task.manage','progress.submit','progress.review','customer.publish','evidence.capture','issue.manage'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000001894', 'm-t18-none', '00000000-0000-0000-0000-0000000018d4', '00000000-0000-0000-0000-0000000018a0',
    '00000000-0000-0000-0000-0000000018f1', 'consultant',
    array['project.read'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000001895', 'm-t18-home', '00000000-0000-0000-0000-0000000018d5', '00000000-0000-0000-0000-0000000018a0',
    '00000000-0000-0000-0000-0000000018f1', 'homeowner',
    array['project.read'],
    '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active');

-- ── Structural checks ────────────────────────────────────────────────────────
select has_function('public', 'upload_document', array['uuid','text','text','text'], 'upload_document exists');
select has_function('public', 'publish_document', array['uuid','boolean'], 'publish_document exists');
select has_function('public', 'post_message',
  array['uuid','uuid','text','uuid','text','text','integer','text'], 'post_message exists');
select has_function('public', 'open_direct_thread', array['uuid','uuid'], 'open_direct_thread exists');
select has_function('public', 'mark_thread_read', array['uuid'], 'mark_thread_read exists');
select has_function('public', 'mark_thread_unread', array['uuid'], 'mark_thread_unread exists');
select has_function('public', 'log_call', array['uuid','text','timestamptz','integer','text'], 'log_call exists');
select is_definer('public', 'post_message',
  array['uuid','uuid','text','uuid','text','text','integer','text'], 'post_message is security definer');
select is_definer('public', 'open_direct_thread', array['uuid','uuid'], 'open_direct_thread is security definer');

-- ── uploadDocument ───────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e4"}', true);
select throws_ok(
  $$select public.upload_document('00000000-0000-0000-0000-0000000018f1', 'Site plan', 'drawing', 'https://example.com/d.pdf')$$,
  'P0001', 'permission:Missing permission "evidence.capture" on project 00000000-0000-0000-0000-0000000018f1',
  'a session without evidence.capture cannot upload a document');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e1"}', true);
select throws_ok(
  $$select public.upload_document('00000000-0000-0000-0000-0000000018f1', '   ', 'drawing', 'https://example.com/d.pdf')$$,
  'P0001', 'conflict:Give the document a title.',
  'a blank title is refused');
select lives_ok(
  $$select public.upload_document('00000000-0000-0000-0000-0000000018f1', 'Site plan', 'drawing', 'https://example.com/d.pdf')$$,
  'the pm uploads a document');
select is(
  (select shared_with_homeowner from documents where title = 'Site plan'), false,
  'a new document starts private (not shared with the homeowner)');
select is(
  (select uploaded_by_membership_id from documents where title = 'Site plan'),
  '00000000-0000-0000-0000-000000001891'::uuid, 'the document is attributed to the uploading membership');

-- ── publishDocument ──────────────────────────────────────────────────────────

select throws_ok(
  format('select public.publish_document(%L, true)', '00000000-0000-0000-0000-000000019999'),
  'P0001', 'permission:Missing permission "customer.publish"',
  'publishing an unknown document is refused as a permission error');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e2"}', true);
select throws_ok(
  format('select public.publish_document(%L, true)', (select id from documents where title = 'Site plan')),
  'P0001', 'permission:Missing permission "customer.publish" on project 00000000-0000-0000-0000-0000000018f1',
  'a session without customer.publish cannot publish a document');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e1"}', true);
select lives_ok(
  format('select public.publish_document(%L, true)', (select id from documents where title = 'Site plan')),
  'the pm shares the document with the homeowner');
select is((select shared_with_homeowner from documents where title = 'Site plan'), true, 'the document is now shared');
select lives_ok(
  format('select public.publish_document(%L, true)', (select id from documents where title = 'Site plan')),
  'sharing an already-shared document again is a no-op, not an error');

-- A second, never-shared document, to prove a homeowner cannot see an unshared one.
select lives_ok(
  $$select public.upload_document('00000000-0000-0000-0000-0000000018f1', 'Private contract', 'contract', 'https://example.com/c.pdf')$$,
  'the pm uploads a second, unshared document');

-- RLS: documents_select_scoped_or_homeowner (0005) gates on shared_with_homeowner.
create temp table rls_probe_t18 (name text primary key, n bigint);
grant all on rls_probe_t18 to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000018e5"}';
insert into rls_probe_t18 select 'home_sees_shared', count(*) from documents where title = 'Site plan';
insert into rls_probe_t18 select 'home_sees_private', count(*) from documents where title = 'Private contract';
reset role;

select is((select n from rls_probe_t18 where name = 'home_sees_shared'), 1::bigint,
  'a homeowner reads a document shared with them');
select is((select n from rls_probe_t18 where name = 'home_sees_private'), 0::bigint,
  'a homeowner cannot read a document that was never shared with them');

-- ── postMessage: a new internal ("project") thread, then reuse ──────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e1"}', true);
select throws_ok(
  format('select public.post_message(%L, null, null, null, %L, null, null, null)',
    '00000000-0000-0000-0000-000000019999', 'Hi'),
  'P0001', 'permission:Missing permission "project.read"',
  'posting into an unknown thread id is refused');

select lives_ok(
  $$select public.post_message(null, '00000000-0000-0000-0000-0000000018f1', 'project', null, 'Kickoff notes', null, null, null)$$,
  'the pm posts the first message, creating the project thread');
select is((select audience from threads where project_id = '00000000-0000-0000-0000-0000000018f1' and subject = 'project'),
  'internal', 'the new project thread has internal audience');
select is((select count(*)::int from threads where project_id = '00000000-0000-0000-0000-0000000018f1' and subject = 'project'),
  1, 'exactly one project thread exists');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e2"}', true);
select lives_ok(
  $$select public.post_message(null, '00000000-0000-0000-0000-0000000018f1', 'project', null, 'Second message', null, null, null)$$,
  'the worker posts into the same project thread (reused, not duplicated)');
select is((select count(*)::int from threads where project_id = '00000000-0000-0000-0000-0000000018f1' and subject = 'project'),
  1, 'the project thread is still exactly one row');
select is((select count(*)::int from messages m join threads t on t.id = m.thread_id
  where t.project_id = '00000000-0000-0000-0000-0000000018f1' and t.subject = 'project'),
  2, 'both messages are stored against the one thread');

select throws_ok(
  $$select public.post_message(null, '00000000-0000-0000-0000-0000000018f1', 'project', null, '   ', null, null, null)$$,
  'P0001', 'conflict:Write a message or record a voice note.',
  'an empty message with no voice note is refused');
select throws_ok(
  format('select public.post_message(null, %L, %L, null, %L, null, null, null)',
    '00000000-0000-0000-0000-0000000018f1', 'project', repeat('x', 2001)),
  'P0001', 'conflict:Messages can be up to 2,000 characters.',
  'a message over 2000 characters is refused');
select lives_ok(
  $$select public.post_message(null, '00000000-0000-0000-0000-0000000018f1', 'project', null, null, 'https://example.com/v.m4a', 12, 'hello there')$$,
  'a voice-only message (no body) is accepted');

-- A consultant (staff, project.read, but not in HOMEOWNER_CHANNEL_ROLES and no
-- customer.publish) cannot post into the homeowner channel.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e4"}', true);
select throws_ok(
  $$select public.post_message(null, '00000000-0000-0000-0000-0000000018f1', 'homeowner', null, 'Hi homeowner', null, null, null)$$,
  'P0001', 'permission:Missing permission "project.read" on project 00000000-0000-0000-0000-0000000018f1',
  'a plain staff member cannot post into the homeowner channel');

-- The pm (a HOMEOWNER_CHANNEL_ROLES role) and the homeowner can both post there.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e1"}', true);
select lives_ok(
  $$select public.post_message(null, '00000000-0000-0000-0000-0000000018f1', 'homeowner', null, 'Welcome!', null, null, null)$$,
  'the pm posts into the new homeowner channel');
select is((select audience from threads where project_id = '00000000-0000-0000-0000-0000000018f1' and subject = 'homeowner'),
  'homeowner', 'the homeowner thread has homeowner audience');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e5"}', true);
select lives_ok(
  $$select public.post_message(null, '00000000-0000-0000-0000-0000000018f1', 'homeowner', null, 'Thanks!', null, null, null)$$,
  'the homeowner posts into their own channel');

-- RLS: a homeowner session cannot later read the internal ("project") thread
-- or its messages, even though they are an active project member.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000018e5"}';
insert into rls_probe_t18 select 'home_internal_thread', count(*) from threads
  where project_id = '00000000-0000-0000-0000-0000000018f1' and subject = 'project';
insert into rls_probe_t18 select 'home_internal_messages', count(*) from messages m
  join threads t on t.id = m.thread_id
  where t.project_id = '00000000-0000-0000-0000-0000000018f1' and t.subject = 'project';
insert into rls_probe_t18 select 'home_homeowner_thread', count(*) from threads
  where project_id = '00000000-0000-0000-0000-0000000018f1' and subject = 'homeowner';
reset role;

select is((select n from rls_probe_t18 where name = 'home_internal_thread'), 0::bigint,
  'a homeowner session cannot see the internal thread at all');
select is((select n from rls_probe_t18 where name = 'home_internal_messages'), 0::bigint,
  'a homeowner session cannot read messages posted into the internal thread');
select is((select n from rls_probe_t18 where name = 'home_homeowner_thread'), 1::bigint,
  'a homeowner session can see their own homeowner-channel thread');

-- ── openDirectThread: create or reuse, never duplicate ──────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e2"}', true);
select throws_ok(
  format('select public.open_direct_thread(%L, %L)',
    '00000000-0000-0000-0000-0000000018f1', '00000000-0000-0000-0000-000000001892'),
  'P0001', 'conflict:You can''t message this person directly. Use the task or project conversation.',
  'a person cannot open a direct thread with themselves');

select lives_ok(
  format('select public.open_direct_thread(%L, %L)',
    '00000000-0000-0000-0000-0000000018f1', '00000000-0000-0000-0000-000000001893'),
  'the worker opens a direct thread with the supervisor (a valid pair)');
select is(
  (select count(*)::int from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1'),
  1, 'exactly one direct thread now exists between them');

-- Calling it again (from either side) must reuse the same thread, not create another.
select lives_ok(
  format('select public.open_direct_thread(%L, %L)',
    '00000000-0000-0000-0000-0000000018f1', '00000000-0000-0000-0000-000000001893'),
  'opening the same direct thread again (same side) succeeds');
select is(
  (select count(*)::int from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1'),
  1, 'still exactly one direct thread -- not duplicated');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e3"}', true);
select lives_ok(
  format('select public.open_direct_thread(%L, %L)',
    '00000000-0000-0000-0000-0000000018f1', '00000000-0000-0000-0000-000000001892'),
  'opening the same direct thread from the other side also succeeds');
select is(
  (select count(*)::int from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1'),
  1, 'still exactly one direct thread after both sides opened it');
select throws_ok(
  format('select public.open_direct_thread(%L, %L)',
    '00000000-0000-0000-0000-0000000018f1', '00000000-0000-0000-0000-000000001894'),
  'P0001', 'conflict:You can''t message this person directly. Use the task or project conversation.',
  'a consultant is not a valid direct-message pair for a worker');

select throws_ok(
  format('select public.open_direct_thread(%L, %L)',
    '00000000-0000-0000-0000-0000000018f1', '00000000-0000-0000-0000-000000019999'),
  'P0001', 'Membership 00000000-0000-0000-0000-000000019999 is not active on 00000000-0000-0000-0000-0000000018f1',
  'opening a direct thread with an unknown membership is refused');

-- ── markThreadRead / markThreadUnread: only the caller's own read-state ─────

-- Before any message exists in the direct thread, neither side has anyone
-- else's message to mark unread.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e3"}', true);
select throws_ok(
  format('select public.mark_thread_unread(%L)',
    (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1')),
  'P0001', 'conflict:There''s no message from someone else to mark unread.',
  'marking unread in a direct thread with no messages at all is refused');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e2"}', true);
select lives_ok(
  format('select public.post_message(%L, null, null, null, %L, null, null, null)',
    (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1'),
    'Worker direct message one'),
  'the worker posts into the direct thread');

-- The worker's own message doesn't count as "someone else's" for the worker.
select throws_ok(
  format('select public.mark_thread_unread(%L)',
    (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1')),
  'P0001', 'conflict:There''s no message from someone else to mark unread.',
  'a participant cannot mark a thread unread against only their own message');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e3"}', true);
select lives_ok(
  format('select public.mark_thread_read(%L)',
    (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1')),
  'the supervisor marks the direct thread read');
select isnt(
  (select last_read_at from thread_reads
    where thread_id = (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1')
      and membership_id = '00000000-0000-0000-0000-000000001893'),
  null, 'the supervisor''s own read marker was set');

-- Marking read must not touch the worker's own read marker: each participant
-- has their own row in thread_reads (its primary key is thread_id+membership_id),
-- so the worker's marker (set when they posted) and the supervisor's marker
-- (just set above) are two distinct rows, not one shared row.
select is(
  (select count(*)::int from thread_reads
    where thread_id = (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1')
      and membership_id in ('00000000-0000-0000-0000-000000001892', '00000000-0000-0000-0000-000000001893')),
  2, 'the worker''s and supervisor''s read markers are independent rows');

-- The worker's message counts as "someone else's" from the supervisor's side.
select lives_ok(
  format('select public.mark_thread_unread(%L)',
    (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1')),
  'the supervisor marks the thread unread against the worker''s message');
select is(
  (select last_read_at < (select created_at from messages where body = 'Worker direct message one') from thread_reads
    where thread_id = (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1')
      and membership_id = '00000000-0000-0000-0000-000000001893'),
  true, 'the supervisor''s read marker now sits just before the worker''s message');
select is(
  (select last_read_at from thread_reads
    where thread_id = (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1')
      and membership_id = '00000000-0000-0000-0000-000000001892') is not null,
  true, 'marking the thread unread for the supervisor left the worker''s own read marker untouched');

select throws_ok(
  format('select public.mark_thread_read(%L)', '00000000-0000-0000-0000-000000019999'),
  'P0001', 'permission:Missing permission "project.read"',
  'marking an unknown thread read is refused');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e4"}', true);
select throws_ok(
  format('select public.mark_thread_read(%L)',
    (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1')),
  'P0001', 'permission:Missing permission "project.read" on project 00000000-0000-0000-0000-0000000018f1',
  'a non-participant cannot mark a direct thread they are not part of');

-- ── logCall ──────────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000018e2"}', true);
select throws_ok(
  format('select public.log_call(%L, %L, now(), 5, null)',
    (select id from threads where project_id = '00000000-0000-0000-0000-0000000018f1' and subject = 'project'), 'voice'),
  'P0001', format('Thread %s is not a direct thread',
    (select id from threads where project_id = '00000000-0000-0000-0000-0000000018f1' and subject = 'project')),
  'logging a call on a non-direct thread is refused');

select throws_ok(
  format('select public.log_call(%L, %L, now(), -1, null)',
    (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1'), 'voice'),
  'P0001', 'conflict:Enter how long the call lasted.',
  'a negative call duration is refused');

select throws_ok(
  format('select public.log_call(%L, %L, %L, 5, null)',
    (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1'), 'voice',
    (now() + interval '1 day')::text),
  'P0001', 'conflict:That doesn''t look like a valid date, or it hasn''t happened yet.',
  'a call logged in the future is refused');

select lives_ok(
  format('select public.log_call(%L, %L, now(), 7, %L)',
    (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1'), 'voice', 'quick sync'),
  'the worker logs a call on the direct thread');
select is(
  (select logged_by_membership_id from call_logs
    where thread_id = (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1')),
  '00000000-0000-0000-0000-000000001892'::uuid, 'the call is attributed to the membership that logged it');
select is(
  (select other_membership_id from call_logs
    where thread_id = (select id from threads where subject = 'direct' and project_id = '00000000-0000-0000-0000-0000000018f1')),
  '00000000-0000-0000-0000-000000001893'::uuid, 'the other participant is recorded as the other side of the call');

select throws_ok(
  format('select public.log_call(%L, %L, now(), 5, null)', '00000000-0000-0000-0000-000000019999', 'voice'),
  'P0001', 'permission:Missing permission "project.read"',
  'logging a call on an unknown thread is refused');

select * from finish();
rollback;
