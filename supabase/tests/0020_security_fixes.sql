begin;
select plan(32);

-- Fixtures are inserted as the table owner (bypasses RLS). Each check then acts
-- as one signed-in person (or a bare role, for the EXECUTE-grant checks) by
-- switching role and/or setting the JWT claims for the transaction.

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000020a1', 'org-t20-a', 'Org T20 A', 'construction-company'),
  ('00000000-0000-0000-0000-0000000020a2', 'org-t20-b', 'Org T20 B', 'construction-company');

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000020f1', 'proj-t20-a', '00000000-0000-0000-0000-0000000020a1', 'Project T20 A', 'active'),
  ('00000000-0000-0000-0000-0000000020f2', 'proj-t20-b', '00000000-0000-0000-0000-0000000020a2', 'Project T20 B', 'active');

-- Global library stage/trade/work-type combo for submit_daily_progress.
insert into stages (id, legacy_id, project_id, name, sort_order) values
  ('00000000-0000-0000-0000-000000002051', 'stage-t20', null, 'Structure', 1);
insert into trades (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000002061', 'trade-t20', null, 'Masonry');
insert into work_types (id, legacy_id, project_id, name, stage_id, trade_id, default_unit) values
  ('00000000-0000-0000-0000-000000002071', 'work-t20', null, 'Brickwork',
    '00000000-0000-0000-0000-000000002051', '00000000-0000-0000-0000-000000002061', 'nos');

insert into project_units (id, legacy_id, project_id, name) values
  ('00000000-0000-0000-0000-000000002081', 'unit-t20-a', '00000000-0000-0000-0000-0000000020f1', 'Unit A');

-- People: pmA (project-scoped project.manage + progress.submit + customer.publish
-- on project A, no org-level membership -- the S4/S5 attacker), orgMgrA/orgMgrB
-- (org-level project.manage in their own org -- the legitimate business users),
-- outsider (no membership anywhere), workerA (progress.submit + issue.manage on
-- project A -- the S6/S7 attacker, same shape the review confirmed exploited).
insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000020d1', 'person-t20-pm', '+6598002001', 'PM T20 A', null),
  ('00000000-0000-0000-0000-0000000020d2', 'person-t20-orgmgr-a', '+6598002002', 'Org Mgr T20 A', null),
  ('00000000-0000-0000-0000-0000000020d3', 'person-t20-orgmgr-b', '+6598002003', 'Org Mgr T20 B', null),
  ('00000000-0000-0000-0000-0000000020d4', 'person-t20-outsider', '+6598002004', 'Outsider T20', null),
  ('00000000-0000-0000-0000-0000000020d5', 'person-t20-worker', '+6598002005', 'Worker T20 A', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000020e1'),
  ('00000000-0000-0000-0000-0000000020e2'),
  ('00000000-0000-0000-0000-0000000020e3'),
  ('00000000-0000-0000-0000-0000000020e4'),
  ('00000000-0000-0000-0000-0000000020e5');
update people set auth_user_id = '00000000-0000-0000-0000-0000000020e1' where id = '00000000-0000-0000-0000-0000000020d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000020e2' where id = '00000000-0000-0000-0000-0000000020d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000020e3' where id = '00000000-0000-0000-0000-0000000020d3';
update people set auth_user_id = '00000000-0000-0000-0000-0000000020e4' where id = '00000000-0000-0000-0000-0000000020d4';
update people set auth_user_id = '00000000-0000-0000-0000-0000000020e5' where id = '00000000-0000-0000-0000-0000000020d5';

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope, status) values
  ('00000000-0000-0000-0000-000000002091', 'm-t20-pm', '00000000-0000-0000-0000-0000000020d1', '00000000-0000-0000-0000-0000000020a1',
    '00000000-0000-0000-0000-0000000020f1', 'project-manager',
    array['project.read','project.manage','progress.submit','customer.publish'], '{}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000002092', 'm-t20-orgmgr-a', '00000000-0000-0000-0000-0000000020d2', '00000000-0000-0000-0000-0000000020a1',
    null, 'business-owner', array['project.manage'], '{}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000002093', 'm-t20-orgmgr-b', '00000000-0000-0000-0000-0000000020d3', '00000000-0000-0000-0000-0000000020a2',
    null, 'business-owner', array['project.manage'], '{}'::jsonb, 'active'),
  ('00000000-0000-0000-0000-000000002094', 'm-t20-worker', '00000000-0000-0000-0000-0000000020d5', '00000000-0000-0000-0000-0000000020a1',
    '00000000-0000-0000-0000-0000000020f1', 'worker',
    array['project.read','progress.submit','issue.manage'], '{}'::jsonb, 'active');

insert into issues (id, legacy_id, project_id, title, created_by_membership_id, customer_visible) values
  ('00000000-0000-0000-0000-0000000020f3', 'iss-t20', '00000000-0000-0000-0000-0000000020f1', 'Leak', '00000000-0000-0000-0000-000000002091', false);

insert into documents (id, legacy_id, project_id, title, category, url, uploaded_by_membership_id, shared_with_homeowner) values
  ('00000000-0000-0000-0000-0000000020f4', 'doc-t20', '00000000-0000-0000-0000-0000000020f1', 'Contract', 'contract',
    'https://example.test/contract.pdf', '00000000-0000-0000-0000-000000002091', false);

insert into evidence (id, legacy_id, project_id, type, url, customer_visibility, captured_by_membership_id) values
  ('00000000-0000-0000-0000-0000000020f5', 'ev-t20', '00000000-0000-0000-0000-0000000020f1', 'photo',
    'https://example.test/photo.jpg', 'private', '00000000-0000-0000-0000-000000002094');

insert into threads (id, legacy_id, project_id, subject, audience, participant_membership_ids) values
  ('00000000-0000-0000-0000-0000000020f6', 'th-t20', '00000000-0000-0000-0000-0000000020f1', 'project', 'internal',
    array['00000000-0000-0000-0000-000000002094']::uuid[]);

-- ── S1: apply_credit_wallet_delta direct EXECUTE is refused; purchase_credits still works ──

set local role authenticated;
select throws_ok(
  $$select public.apply_credit_wallet_delta('00000000-0000-0000-0000-0000000020a1'::uuid, 100, 'purchase')$$,
  '42501', null, 's1: authenticated cannot call apply_credit_wallet_delta directly');
reset role;

set local role anon;
select throws_ok(
  $$select public.apply_credit_wallet_delta('00000000-0000-0000-0000-0000000020a1'::uuid, 100, 'purchase')$$,
  '42501', null, 's1: anon cannot call apply_credit_wallet_delta directly');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000020e2"}';
select lives_ok(
  $$select public.purchase_credits('00000000-0000-0000-0000-0000000020a1'::uuid, 50)$$,
  's1: purchase_credits still works through the internal helper');
reset role;
select is(
  (select balance from credit_wallets where organization_id = '00000000-0000-0000-0000-0000000020a1'),
  50, 's1: the purchase was applied to the wallet');

-- ── S2: insert_daily_progress_row direct EXECUTE is refused; submit_daily_progress still works ──

set local role authenticated;
select throws_ok(
  $$select public.insert_daily_progress_row(
      '00000000-0000-0000-0000-0000000020f1'::uuid, '00000000-0000-0000-0000-000000002081'::uuid, null,
      '00000000-0000-0000-0000-000000002051'::uuid, '00000000-0000-0000-0000-000000002061'::uuid,
      '00000000-0000-0000-0000-000000002071'::uuid, '00000000-0000-0000-0000-000000002091'::uuid, null,
      4, null, null, null, 'forged', 'forged', null, null, '[]'::jsonb, 1, null)$$,
  '42501', null, 's2: authenticated cannot call insert_daily_progress_row directly');
reset role;

set local role anon;
select throws_ok(
  $$select public.insert_daily_progress_row(
      '00000000-0000-0000-0000-0000000020f1'::uuid, '00000000-0000-0000-0000-000000002081'::uuid, null,
      '00000000-0000-0000-0000-000000002051'::uuid, '00000000-0000-0000-0000-000000002061'::uuid,
      '00000000-0000-0000-0000-000000002071'::uuid, '00000000-0000-0000-0000-000000002091'::uuid, null,
      4, null, null, null, 'forged', 'forged', null, null, '[]'::jsonb, 1, null)$$,
  '42501', null, 's2: anon cannot call insert_daily_progress_row directly');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000020e1"}';
select lives_ok(
  $$select public.submit_daily_progress('00000000-0000-0000-0000-0000000020f1', '00000000-0000-0000-0000-000000002081',
      null, '00000000-0000-0000-0000-000000002051', '00000000-0000-0000-0000-000000002061',
      '00000000-0000-0000-0000-000000002071', 4, null, null, null, 'S2 summary', 'S2 plan', null, null, '[]'::jsonb)$$,
  's2: submit_daily_progress still works end to end');
reset role;
select is(
  (select count(*)::int from daily_progress where today_summary = 'S2 summary'),
  1, 's2: the daily progress row was inserted');

-- ── S3: update_organization_profile now requires an org-level project.manage membership ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000020e3"}'; -- orgMgrB: org B, not org A
select throws_ok(
  $$select public.update_organization_profile('00000000-0000-0000-0000-0000000020a1', 'Hijacked Co', 'contractor', 'Hyderabad', '+919000000001', '6-10')$$,
  'P0001', 'permission:Missing permission "project.manage"', 's3: a person from org B cannot update org A''s profile');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000020e2"}'; -- orgMgrA: org-level project.manage in org A
select lives_ok(
  $$select public.update_organization_profile('00000000-0000-0000-0000-0000000020a1', 'BuildRight Co', 'contractor', 'Hyderabad', '+919000000001', '6-10')$$,
  's3: a person with org-level project.manage in org A updates org A''s profile');
reset role;
select is((select name from organizations where id = '00000000-0000-0000-0000-0000000020a1'), 'BuildRight Co', 's3: the name is set');

-- ── S4: memberships insert now requires organization_id to match the project's real org ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000020e1"}'; -- pmA: project.manage on project A (org A) only
select throws_ok(
  $$insert into memberships (person_id, organization_id, project_id, role, permissions, status)
    values ('00000000-0000-0000-0000-0000000020d1', '00000000-0000-0000-0000-0000000020a2',
      '00000000-0000-0000-0000-0000000020f1', 'workforce-manager', array['workforce.manage'], 'active')$$,
  '42501', null, 's4: a project A manager cannot grant themselves org B permissions via project A''s project_id');
reset role;
select is(
  (select count(*)::int from memberships where organization_id = '00000000-0000-0000-0000-0000000020a2' and person_id = '00000000-0000-0000-0000-0000000020d1'),
  0, 's4: no cross-org membership row was created');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000020e1"}';
select lives_ok(
  $$insert into memberships (person_id, organization_id, project_id, role, permissions, status)
    values ('00000000-0000-0000-0000-0000000020d4', '00000000-0000-0000-0000-0000000020a1',
      '00000000-0000-0000-0000-0000000020f1', 'supervisor', array['progress.submit'], 'active')$$,
  's4: a same-org membership insert for project A still works');
reset role;

-- ── S5: projects.organization_id is no longer directly updatable; status still is ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000020e1"}'; -- pmA: project.manage on project A
select throws_ok(
  $$update public.projects set organization_id = '00000000-0000-0000-0000-0000000020a2' where id = '00000000-0000-0000-0000-0000000020f1'$$,
  '42501', null, 's5: a direct update of organization_id is refused');
reset role;
select is((select organization_id from projects where id = '00000000-0000-0000-0000-0000000020f1'), '00000000-0000-0000-0000-0000000020a1', 's5: the project stays in org A');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000020e1"}';
select lives_ok(
  $$update public.projects set status = 'on-hold' where id = '00000000-0000-0000-0000-0000000020f1'$$,
  's5: a direct update of status still works');
reset role;
select is((select status from projects where id = '00000000-0000-0000-0000-0000000020f1'), 'on-hold', 's5: the status change was applied');

-- ── S6: direct UPDATE on evidence/documents/issues can no longer flip visibility ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000020e5"}'; -- workerA: progress.submit + issue.manage
select lives_ok(
  $$update public.issues set customer_visible = true where id = '00000000-0000-0000-0000-0000000020f3'$$,
  's6: the direct update statement does not error (RLS silently refuses the row)');
select lives_ok(
  $$update public.documents set shared_with_homeowner = true where id = '00000000-0000-0000-0000-0000000020f4'$$,
  's6: the direct document update statement does not error either');
select lives_ok(
  $$update public.evidence set customer_visibility = 'customer-visible' where id = '00000000-0000-0000-0000-0000000020f5'$$,
  's6: the direct evidence update statement does not error either');
reset role;
select is((select customer_visible from issues where id = '00000000-0000-0000-0000-0000000020f3'), false, 's6: the issue stayed private (no direct-update policy matched)');
select is((select shared_with_homeowner from documents where id = '00000000-0000-0000-0000-0000000020f4'), false, 's6: the document stayed unshared');
select is((select customer_visibility from evidence where id = '00000000-0000-0000-0000-0000000020f5'), 'private', 's6: the evidence stayed private');

-- publish_issue / publish_document (the only legitimate path) still work.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000020e1"}'; -- pmA: customer.publish
select lives_ok(
  $$select public.publish_issue('00000000-0000-0000-0000-0000000020f3', true)$$,
  's6: publish_issue still works');
select lives_ok(
  $$select public.publish_document('00000000-0000-0000-0000-0000000020f4', true)$$,
  's6: publish_document still works');
reset role;
select is((select customer_visible from issues where id = '00000000-0000-0000-0000-0000000020f3'), true, 's6: publish_issue flipped visibility through the function');
select is((select shared_with_homeowner from documents where id = '00000000-0000-0000-0000-0000000020f4'), true, 's6: publish_document flipped visibility through the function');

-- ── S7: threads_update_participant is dropped; a worker cannot flip the thread's audience ──

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000020e5"}'; -- workerA: participant of thread T20
select lives_ok(
  $$update public.threads set audience = 'homeowner' where id = '00000000-0000-0000-0000-0000000020f6'$$,
  's7: the direct thread update statement does not error (RLS silently refuses the row)');
select lives_ok(
  $$select public.mark_thread_read('00000000-0000-0000-0000-0000000020f6')$$,
  's7: mark_thread_read still works through its function');
reset role;
select is((select audience from threads where id = '00000000-0000-0000-0000-0000000020f6'), 'internal', 's7: the thread stayed internal');
select is(
  (select count(*)::int from thread_reads where thread_id = '00000000-0000-0000-0000-0000000020f6'
    and membership_id = '00000000-0000-0000-0000-000000002094'),
  1, 's7: mark_thread_read recorded a read marker');

select * from finish();
rollback;
