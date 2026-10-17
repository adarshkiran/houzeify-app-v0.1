begin;
select plan(22);

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000031a1', 'org-t31', 'Org T31', 'construction-company'),
  ('00000000-0000-0000-0000-0000000031a2', 'org-t31-free', 'Free Org T31', 'construction-company');

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000031f1', 'proj-t31', '00000000-0000-0000-0000-0000000031a1', 'Project T31', 'active'),
  ('00000000-0000-0000-0000-0000000031f2', 'proj-t31-free', '00000000-0000-0000-0000-0000000031a2', 'Free Project T31', 'active');

insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000031d1', 'person-t31-manager', '+6598031001', 'Manager T31', null),
  ('00000000-0000-0000-0000-0000000031d2', 'person-t31-reader', '+6598031002', 'Reader T31', null),
  ('00000000-0000-0000-0000-0000000031d3', 'person-t31-free-manager', '+6598031003', 'Free Manager T31', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000031e1'), ('00000000-0000-0000-0000-0000000031e2'),
  ('00000000-0000-0000-0000-0000000031e3');
update people set auth_user_id = '00000000-0000-0000-0000-0000000031e1' where id = '00000000-0000-0000-0000-0000000031d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000031e2' where id = '00000000-0000-0000-0000-0000000031d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000031e3' where id = '00000000-0000-0000-0000-0000000031d3';

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope) values
  ('00000000-0000-0000-0000-0000000031b1', 'm-t31-manager', '00000000-0000-0000-0000-0000000031d1', '00000000-0000-0000-0000-0000000031a1',
   '00000000-0000-0000-0000-0000000031f1', 'project-manager', array['project.read', 'project.manage'], '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000031b2', 'm-t31-reader', '00000000-0000-0000-0000-0000000031d2', '00000000-0000-0000-0000-0000000031a1',
   '00000000-0000-0000-0000-0000000031f1', 'supervisor', array['project.read'], '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000031b3', 'm-t31-free', '00000000-0000-0000-0000-0000000031d3', '00000000-0000-0000-0000-0000000031a2',
   '00000000-0000-0000-0000-0000000031f2', 'project-manager', array['project.read', 'project.manage'], '{}'::jsonb);

-- Org 1 has AI with a cap of 2; org 2 has a plan without the entitlement.
insert into plans (id, legacy_id, name, price_label, entitlements, monthly_credits, limits) values
  ('00000000-0000-0000-0000-0000000031c1', 'plan-t31-ai', 'AI Plan T31', '₹1', array['ai.narrative'], 0, '{"ai_narratives_per_month": 2}'::jsonb),
  ('00000000-0000-0000-0000-0000000031c2', 'plan-t31-plain', 'Plain Plan T31', '₹1', array['marketplace.unlock'], 0, '{}'::jsonb);
insert into subscriptions (id, legacy_id, organization_id, plan_id, status, started_at) values
  ('00000000-0000-0000-0000-0000000031c3', 'sub-t31', '00000000-0000-0000-0000-0000000031a1', '00000000-0000-0000-0000-0000000031c1', 'active', now()),
  ('00000000-0000-0000-0000-0000000031c4', 'sub-t31-free', '00000000-0000-0000-0000-0000000031a2', '00000000-0000-0000-0000-0000000031c2', 'active', now());

create temp table t31_tickets (n int primary key, id uuid);
grant all on t31_tickets to authenticated;

select has_table('public', 'ai_usage_events', 'ai_usage_events exists');
select has_column('public', 'plans', 'limits', 'plans.limits exists');
select has_function('public', 'consume_ai_narrative', array['uuid', 'text'], 'consume_ai_narrative exists');
select is_definer('public', 'consume_ai_narrative', array['uuid', 'text'], 'consume_ai_narrative is security definer');
select is_definer('public', 'refund_ai_narrative', array['uuid'], 'refund_ai_narrative is security definer');

-- Refusals
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e2"}', true);
select throws_ok(
  $$select public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f1', 'report')$$,
  'P0001', 'permission:Missing permission "project.manage" on project 00000000-0000-0000-0000-0000000031f1',
  'a member without project.manage cannot consume');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e1"}', true);
select throws_ok(
  $$select public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f2', 'report')$$,
  'P0001', 'permission:Missing permission "project.manage" on project 00000000-0000-0000-0000-0000000031f2',
  'a manager of another organization cannot consume');
select throws_ok(
  $$select public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f1', 'chat')$$,
  'P0001', 'conflict:That summary could not be written.', 'an unknown kind is refused');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e3"}', true);
select throws_ok(
  $$select public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f2', 'report')$$,
  'P0001', 'conflict:AI summaries are not included in your plan.', 'a plan without the entitlement is refused');
select is((select count(*)::int from ai_usage_events), 0, 'refusals wrote nothing');

-- The cap
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e1"}', true);
insert into t31_tickets select 1, public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f1', 'report');
insert into t31_tickets select 2, public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f1', 'weekly-company');
select is((select count(*)::int from ai_usage_events where status = 'consumed'), 2, 'two uses are consumed');
select throws_ok(
  $$select public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f1', 'report')$$,
  'P0001', 'conflict:You have used all AI summaries for this month.', 'the third use is over the cap');

-- Refunds: only the owner, only once, and the unit comes back
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e2"}', true);
select is(public.refund_ai_narrative((select id from t31_tickets where n = 1)), false, 'someone else cannot refund a ticket');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e1"}', true);
select is(public.refund_ai_narrative((select id from t31_tickets where n = 1)), true, 'the owner refunds a ticket');
select is(public.refund_ai_narrative((select id from t31_tickets where n = 1)), false, 'a ticket refunds only once');
select lives_ok(
  $$select public.consume_ai_narrative('00000000-0000-0000-0000-0000000031f1', 'report')$$,
  'a refunded unit can be used again');

-- Usage rows are not readable or writable by clients
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000031e1"}';
create temp table t31_probe (n bigint);
grant all on t31_probe to authenticated;
insert into t31_probe select count(*) from ai_usage_events;
reset role;
select is((select n from t31_probe), 0::bigint, 'a client reads no usage rows directly');

-- approve_project_report validates an embedded narrative
create temp table t31_payload as
select jsonb_build_object(
  'projectId', '00000000-0000-0000-0000-0000000031f1', 'asOf', '2026-10-15', 'status', 'at-risk',
  'summary', jsonb_build_array('At risk.'), 'signals', '[]'::jsonb, 'source', 'ai', 'createdBy', 'ai',
  'engine', 'rules-v1', 'confidence', 'medium', 'assumptions', '[]'::jsonb, 'reviewStatus', 'draft',
  'generatedAt', '2026-10-15T09:00:00.000Z'
) as p;
grant select on t31_payload to authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000031e1"}', true);
select throws_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000031f1', (select p || '{"narrative": {"text": "x", "engine": "gpt-x", "generatedAt": "2026-10-15T09:00:00Z", "factsHash": "0000000000000000000000000000000000000000000000000000000000000000"}}'::jsonb from t31_payload))$$,
  'P0001', 'conflict:That report could not be saved.', 'a narrative from an unknown engine is refused');
select throws_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000031f1', (select p || '{"narrative": {"text": "x", "engine": "claude:claude-opus-5-5", "generatedAt": "2026-10-15T09:00:00Z", "factsHash": "short"}}'::jsonb from t31_payload))$$,
  'P0001', 'conflict:That report could not be saved.', 'a narrative without a valid facts hash is refused');
select lives_ok(
  $$select public.approve_project_report('00000000-0000-0000-0000-0000000031f1', (select p || '{"narrative": {"text": "The project is at risk.", "engine": "claude:claude-opus-5-5", "generatedAt": "2026-10-15T09:00:00Z", "factsHash": "0000000000000000000000000000000000000000000000000000000000000000"}}'::jsonb from t31_payload))$$,
  'a report with a well-formed narrative is approved');
select is(
  (select payload->'narrative'->>'engine' from project_reports where project_id = '00000000-0000-0000-0000-0000000031f1'),
  'claude:claude-opus-5-5', 'the stored snapshot carries the narrative and its engine');
select is(
  (select payload->>'reviewStatus' from project_reports where project_id = '00000000-0000-0000-0000-0000000031f1'),
  'approved', 'and is marked approved');

select * from finish();
rollback;
