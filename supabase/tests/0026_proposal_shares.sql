begin;
select plan(24);

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000026a1', 'org-t26-partner', 'Partner T26 Builders', 'contractor'),
  ('00000000-0000-0000-0000-0000000026a2', 'org-t26-other', 'Other T26', 'contractor');

insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000026d1', 'person-t26-staff', '+6598026001', 'Staff T26', null),
  ('00000000-0000-0000-0000-0000000026d2', 'person-t26-other', '+6598026002', 'Other Staff T26', null),
  ('00000000-0000-0000-0000-0000000026d3', 'person-t26-home', '+6598026003', 'Secret Homeowner T26', null);
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000026e1'), ('00000000-0000-0000-0000-0000000026e2'), ('00000000-0000-0000-0000-0000000026e3');
update people set auth_user_id = '00000000-0000-0000-0000-0000000026e1' where id = '00000000-0000-0000-0000-0000000026d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000026e2' where id = '00000000-0000-0000-0000-0000000026d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000026e3' where id = '00000000-0000-0000-0000-0000000026d3';

insert into projects (id, legacy_id, organization_id, name, status) values
  ('00000000-0000-0000-0000-0000000026f1', 'proj-t26-a', '00000000-0000-0000-0000-0000000026a1', 'Staff project A', 'active'),
  ('00000000-0000-0000-0000-0000000026f2', 'proj-t26-b', '00000000-0000-0000-0000-0000000026a2', 'Other project B', 'active');
insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope) values
  ('00000000-0000-0000-0000-0000000026b1', 'm-t26-staff', '00000000-0000-0000-0000-0000000026d1', '00000000-0000-0000-0000-0000000026a1',
   '00000000-0000-0000-0000-0000000026f1', 'project-manager', array['project.read'], '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000026b2', 'm-t26-other', '00000000-0000-0000-0000-0000000026d2', '00000000-0000-0000-0000-0000000026a2',
   '00000000-0000-0000-0000-0000000026f2', 'project-manager', array['project.read'], '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000026b3', 'm-t26-home', '00000000-0000-0000-0000-0000000026d3', '00000000-0000-0000-0000-0000000026a1',
   '00000000-0000-0000-0000-0000000026f1', 'homeowner', array['project.read'], '{}'::jsonb);

insert into estimates (id, legacy_id, homeowner_person_id, project_name, property_type, location, built_up_area_sqft,
  construction_level, total_low, total_high, review_status) values
  ('00000000-0000-0000-0000-0000000026c1', 'est-t26', '00000000-0000-0000-0000-0000000026d3', 'Confidential Villa Name', 'independent',
   'Plot 9, Road 3, Hyderabad, Telangana', 3200, 'premium', 4200000, 5100000, 'confirmed');
insert into marketplace_requirements (id, legacy_id, estimate_id, homeowner_person_id, project_name, location,
  built_up_area_sqft, construction_level, property_type, estimate_total_low, estimate_total_high, status, posted_at) values
  ('00000000-0000-0000-0000-0000000026c2', 'req-t26', '00000000-0000-0000-0000-0000000026c1', '00000000-0000-0000-0000-0000000026d3',
   'Confidential Villa Name', 'Plot 9, Road 3, Hyderabad, Telangana', 3200, 'premium', 'independent', 4200000, 5100000, 'posted', now());

insert into proposals (id, legacy_id, requirement_id, partner_organization_id, submitted_by_person_id, lines, total, assumptions, exclusions, status) values
  ('00000000-0000-0000-0000-0000000026aa', 'prop-t26', '00000000-0000-0000-0000-0000000026c2', '00000000-0000-0000-0000-0000000026a1',
   '00000000-0000-0000-0000-0000000026d1',
   '[{"id": "internal-line-id", "category": "materials", "item": "Cement", "quantity": 100, "unit": "bags", "rate": 400, "amount": 40000, "source": "rate-card", "confidence": "medium"}]'::jsonb,
   40000, array['Soil is firm'], array['Landscaping'], 'submitted'),
  ('00000000-0000-0000-0000-0000000026ab', 'prop-t26-rej', '00000000-0000-0000-0000-0000000026c2', '00000000-0000-0000-0000-0000000026a2',
   '00000000-0000-0000-0000-0000000026d2', '[]'::jsonb, 0, '{}', '{}', 'rejected');

select has_table('public', 'proposal_shares', 'proposal_shares exists');
select has_function('public', 'get_shared_proposal', array['text'], 'get_shared_proposal exists');
select is_definer('public', 'create_proposal_share', array['uuid'], 'create_proposal_share is security definer');

-- Refusals
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000026e2"}', true);
select throws_ok(
  $$select public.create_proposal_share('00000000-0000-0000-0000-0000000026aa')$$,
  'P0001', 'permission:Only this organization''s team can act for it.', 'another organization cannot share the proposal');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000026e3"}', true);
select throws_ok(
  $$select public.create_proposal_share('00000000-0000-0000-0000-0000000026aa')$$,
  'P0001', 'permission:Only this organization''s team can act for it.', 'a homeowner cannot share the proposal');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000026e2"}', true);
select throws_ok(
  $$select public.create_proposal_share('00000000-0000-0000-0000-0000000026ab')$$,
  'P0001', 'conflict:This proposal is no longer open, so it cannot be shared.', 'a rejected proposal cannot be shared');

-- Create
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000026e1"}', true);
create temp table t26_first as select public.create_proposal_share('00000000-0000-0000-0000-0000000026aa') as r;
select is(length((select r->>'token' from t26_first)), 64, 'the link token is 64 hex characters');
select is((select count(*)::int from proposal_shares where token_hash = (select r->>'token' from t26_first)), 0,
  'the raw token is not stored');
select is((select count(*)::int from proposal_shares where token_hash = public.share_token_hash((select r->>'token' from t26_first))), 1,
  'only its hash is stored');
select ok((select expires_at from proposal_shares limit 1) between now() + interval '13 days' and now() + interval '15 days',
  'the link expires in about 14 days');

-- Public read, as anon
select set_config('t26.token', (select r->>'token' from t26_first), true);
set local role anon;
create temp table t26_seen (name text primary key, v jsonb);
grant all on t26_seen to anon;
insert into t26_seen select 'valid', public.get_shared_proposal(current_setting('t26.token'));
insert into t26_seen select 'unknown', coalesce(public.get_shared_proposal('f' || repeat('0', 63)), 'null'::jsonb);
insert into t26_seen select 'short', coalesce(public.get_shared_proposal('abc'), 'null'::jsonb);
reset role;

select is((select v->>'partnerName' from t26_seen where name = 'valid'), 'Partner T26 Builders', 'the recipient sees the contractor name');
select is((select v->>'location' from t26_seen where name = 'valid'), 'Hyderabad', 'location is the city only');
select is((select v->>'areaBand' from t26_seen where name = 'valid'), '3,000–3,500 sq ft', 'area is a band, not the exact figure');
select is(
  (select array_agg(k order by k) from jsonb_object_keys((select v from t26_seen where name = 'valid')) k),
  array['areaBand', 'assumptions', 'exclusions', 'expiresAt', 'lines', 'location', 'partnerName', 'propertyType', 'submittedAt', 'total'],
  'exactly the allowlisted top-level fields are returned');
select is(
  (select array_agg(k order by k) from jsonb_object_keys((select v->'lines'->0 from t26_seen where name = 'valid')) k),
  array['amount', 'category', 'item', 'quantity', 'rate', 'unit'],
  'each line carries only the allowlisted fields');
select ok(position('Confidential Villa Name' in (select v::text from t26_seen where name = 'valid')) = 0
  and position('Secret Homeowner' in (select v::text from t26_seen where name = 'valid')) = 0,
  'neither the project name nor the homeowner appears anywhere in the response');
select is((select v from t26_seen where name = 'unknown'), 'null'::jsonb, 'an unknown token returns null');
select is((select v from t26_seen where name = 'short'), 'null'::jsonb, 'a malformed token returns null');

-- Replace on create, expiry and revoke
create temp table t26_second as select public.create_proposal_share('00000000-0000-0000-0000-0000000026aa') as r;
select is(public.get_shared_proposal((select r->>'token' from t26_first)), null, 'creating a new link revokes the previous one');
select isnt(public.get_shared_proposal((select r->>'token' from t26_second)), null, 'the new link works');

update proposal_shares set expires_at = now() - interval '1 minute'
  where token_hash = public.share_token_hash((select r->>'token' from t26_second));
select is(public.get_shared_proposal((select r->>'token' from t26_second)), null, 'an expired link returns null');

create temp table t26_third as select public.create_proposal_share('00000000-0000-0000-0000-0000000026aa') as r;
select lives_ok($$select public.revoke_proposal_share('00000000-0000-0000-0000-0000000026aa')$$, 'staff revoke the active link');
select is(public.get_shared_proposal((select r->>'token' from t26_third)), null, 'a revoked link returns null');
select throws_ok(
  $$select public.revoke_proposal_share('00000000-0000-0000-0000-0000000026aa')$$,
  'P0001', 'conflict:There is no active link to revoke.', 'revoking with no active link is refused');

select * from finish();
rollback;
