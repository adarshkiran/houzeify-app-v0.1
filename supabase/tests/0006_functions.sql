begin;
select plan(57);

-- Fixtures are inserted as the table owner (bypasses RLS). Each function call
-- is made as one signed-in person by setting the JWT claims for the transaction.

-- Plans and subscriptions
insert into plans (id, legacy_id, name, price_label, entitlements, monthly_credits) values
  ('00000000-0000-0000-0000-0000000006a0', 'plan-t7-starter', 'Contractor Starter', 'Test',
   array['marketplace.unlock', 'marketplace.propose'], 50),
  ('00000000-0000-0000-0000-0000000006a1', 'plan-t7-free', 'Free', 'Test', array[]::text[], 0);

-- Organizations: three contractors with the starter plan, one contractor without a plan, one homeowner-side org
insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000006b1', 'org-t7-a', 'Partner A', 'contractor'),
  ('00000000-0000-0000-0000-0000000006b2', 'org-t7-b', 'Partner B', 'contractor'),
  ('00000000-0000-0000-0000-0000000006b3', 'org-t7-c', 'Partner C', 'builder'),
  ('00000000-0000-0000-0000-0000000006b4', 'org-t7-d', 'Partner D', 'contractor');

insert into subscriptions (id, legacy_id, organization_id, plan_id, status) values
  ('00000000-0000-0000-0000-0000000006c1', 'sub-t7-a', '00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006a0', 'active'),
  ('00000000-0000-0000-0000-0000000006c2', 'sub-t7-b', '00000000-0000-0000-0000-0000000006b2', '00000000-0000-0000-0000-0000000006a0', 'active'),
  ('00000000-0000-0000-0000-0000000006c3', 'sub-t7-c', '00000000-0000-0000-0000-0000000006b3', '00000000-0000-0000-0000-0000000006a0', 'active'),
  ('00000000-0000-0000-0000-0000000006c4', 'sub-t7-d', '00000000-0000-0000-0000-0000000006b4', '00000000-0000-0000-0000-0000000006a1', 'active');

insert into credit_wallets (organization_id, balance) values
  ('00000000-0000-0000-0000-0000000006b1', 30),
  ('00000000-0000-0000-0000-0000000006b2', 9),
  ('00000000-0000-0000-0000-0000000006b3', 50),
  ('00000000-0000-0000-0000-0000000006b4', 50);

-- People: homeowner (no organization), one business user per partner organization
insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000006d0', 'person-t7-home', '+6598000701', 'Homeowner T7', null),
  ('00000000-0000-0000-0000-0000000006d1', 'person-t7-a', '+6598000702', 'Partner A user', null),
  ('00000000-0000-0000-0000-0000000006d2', 'person-t7-b', '+6598000703', 'Partner B user', null),
  ('00000000-0000-0000-0000-0000000006d3', 'person-t7-c', '+6598000704', 'Partner C user', null),
  ('00000000-0000-0000-0000-0000000006d4', 'person-t7-d', '+6598000705', 'Partner D user', null),
  ('00000000-0000-0000-0000-0000000006d5', 'person-t7-other', '+6598000706', 'Other homeowner', null);

-- Auth users linked to people so current_person_id() resolves
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000006e0'),
  ('00000000-0000-0000-0000-0000000006e1'),
  ('00000000-0000-0000-0000-0000000006e2'),
  ('00000000-0000-0000-0000-0000000006e3'),
  ('00000000-0000-0000-0000-0000000006e4'),
  ('00000000-0000-0000-0000-0000000006e5');
update people set auth_user_id = '00000000-0000-0000-0000-0000000006e0' where id = '00000000-0000-0000-0000-0000000006d0';
update people set auth_user_id = '00000000-0000-0000-0000-0000000006e1' where id = '00000000-0000-0000-0000-0000000006d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000006e2' where id = '00000000-0000-0000-0000-0000000006d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000006e3' where id = '00000000-0000-0000-0000-0000000006d3';
update people set auth_user_id = '00000000-0000-0000-0000-0000000006e4' where id = '00000000-0000-0000-0000-0000000006d4';
update people set auth_user_id = '00000000-0000-0000-0000-0000000006e5' where id = '00000000-0000-0000-0000-0000000006d5';

-- Business memberships are organization-level (no project)
insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions) values
  ('00000000-0000-0000-0000-0000000006f1', 'm-t7-a', '00000000-0000-0000-0000-0000000006d1', '00000000-0000-0000-0000-0000000006b1', null, 'owner', array[]::text[]),
  ('00000000-0000-0000-0000-0000000006f2', 'm-t7-b', '00000000-0000-0000-0000-0000000006d2', '00000000-0000-0000-0000-0000000006b2', null, 'owner', array[]::text[]),
  ('00000000-0000-0000-0000-0000000006f3', 'm-t7-c', '00000000-0000-0000-0000-0000000006d3', '00000000-0000-0000-0000-0000000006b3', null, 'owner', array[]::text[]),
  ('00000000-0000-0000-0000-0000000006f4', 'm-t7-d', '00000000-0000-0000-0000-0000000006d4', '00000000-0000-0000-0000-0000000006b4', null, 'owner', array[]::text[]);

-- Estimates and requirements. Requirement 1 is posted; requirement 2 is a draft.
insert into estimates (id, legacy_id, homeowner_person_id, project_name, property_type, location, built_up_area_sqft,
  construction_level, total_low, total_high, review_status) values
  ('00000000-0000-0000-0000-0000000006a5', 'est-t7-1', '00000000-0000-0000-0000-0000000006d0', 'Villa T7', 'independent',
   'Plot 12, Road 3, Hyderabad, Telangana', 1200, 'standard', 1050000, 1230000, 'confirmed'),
  ('00000000-0000-0000-0000-0000000006a6', 'est-t7-2', '00000000-0000-0000-0000-0000000006d0', 'Draft T7', 'independent',
   'Plot 9, Lane 1, Chennai, Tamil Nadu', 900, 'basic', 500000, 600000, 'confirmed');

insert into marketplace_requirements (id, legacy_id, estimate_id, homeowner_person_id, project_name, location,
  built_up_area_sqft, construction_level, property_type, estimate_total_low, estimate_total_high, status, posted_at) values
  ('00000000-0000-0000-0000-0000000006a7', 'req-t7-1', '00000000-0000-0000-0000-0000000006a5', '00000000-0000-0000-0000-0000000006d0',
   'Villa T7', 'Plot 12, Road 3, Hyderabad, Telangana', 1200, 'standard', 'independent', 1050000, 1230000, 'posted', now()),
  ('00000000-0000-0000-0000-0000000006a8', 'req-t7-2', '00000000-0000-0000-0000-0000000006a6', '00000000-0000-0000-0000-0000000006d0',
   'Draft T7', 'Plot 9, Lane 1, Chennai, Tamil Nadu', 900, 'basic', 'independent', 500000, 600000, 'draft', null);

-- Structural checks
select has_function('public', 'unlock_requirement', array['uuid', 'uuid'], 'unlock_requirement exists');
select has_function('public', 'submit_proposal', array['uuid', 'uuid', 'text[]', 'text[]'], 'submit_proposal exists');
select has_function('public', 'select_proposal', array['uuid'], 'select_proposal exists');
select has_function('public', 'has_entitlement', array['uuid', 'text'], 'has_entitlement exists');
select is_definer('public', 'unlock_requirement', array['uuid', 'uuid'], 'unlock_requirement is security definer');
select is_definer('public', 'submit_proposal', array['uuid', 'uuid', 'text[]', 'text[]'], 'submit_proposal is security definer');
select is_definer('public', 'select_proposal', array['uuid'], 'select_proposal is security definer');
select has_view('public', 'marketplace_requirement_previews', 'partner preview view exists');
select has_column('public', 'marketplace_requirement_previews', 'location', 'preview exposes location');
select has_column('public', 'marketplace_requirement_previews', 'property_type', 'preview exposes property type');
select has_column('public', 'marketplace_requirement_previews', 'area_band', 'preview exposes area band');
select has_column('public', 'marketplace_requirement_previews', 'estimate_total_low', 'preview exposes low estimate');
select has_column('public', 'marketplace_requirement_previews', 'estimate_total_high', 'preview exposes high estimate');
select hasnt_column('public', 'marketplace_requirement_previews', 'project_name', 'preview hides project name');
select hasnt_column('public', 'marketplace_requirement_previews', 'built_up_area_sqft', 'preview hides exact area');
select hasnt_column('public', 'marketplace_requirement_previews', 'construction_level', 'preview hides construction level');
select hasnt_column('public', 'marketplace_requirement_previews', 'homeowner_person_id', 'preview hides homeowner');

-- Entitlement helper
select ok(public.has_entitlement('00000000-0000-0000-0000-0000000006b1', 'marketplace.unlock'), 'a starter plan includes marketplace.unlock');
select ok(not public.has_entitlement('00000000-0000-0000-0000-0000000006b4', 'marketplace.unlock'), 'the free plan does not include marketplace.unlock');

-- Preview view as a partner: posted rows only, rounded range, city and band
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006e1"}', true);
select is((select count(*)::int from marketplace_requirement_previews where id = '00000000-0000-0000-0000-0000000006a8'), 0, 'a draft requirement is not in the partner preview');
select is((select location from marketplace_requirement_previews where id = '00000000-0000-0000-0000-0000000006a7'), 'Hyderabad', 'preview location is the city segment');
select is((select area_band from marketplace_requirement_previews where id = '00000000-0000-0000-0000-0000000006a7'), '1,000–1,500 sq ft', 'preview area is a 500 sq ft band');
select is((select estimate_total_low from marketplace_requirement_previews where id = '00000000-0000-0000-0000-0000000006a7'), 1000000::numeric, 'preview low rounds down to the lakh');
select is((select estimate_total_high from marketplace_requirement_previews where id = '00000000-0000-0000-0000-0000000006a7'), 1300000::numeric, 'preview high rounds up to the lakh');

-- Unlock at 9 credits: refused with the domain message, nothing written
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006e2"}', true);
select throws_ok(
  $$select public.unlock_requirement('00000000-0000-0000-0000-0000000006a7', '00000000-0000-0000-0000-0000000006b2')$$,
  'P0001', 'conflict:You need 10 credits. You have 9.', 'unlock at 9 credits raises the conflict message');
select is((select balance from credit_wallets where organization_id = '00000000-0000-0000-0000-0000000006b2'), 9, 'a refused unlock leaves the balance unchanged');
select is((select count(*)::int from marketplace_unlocks where partner_organization_id = '00000000-0000-0000-0000-0000000006b2'), 0, 'a refused unlock writes no unlock row');
select is((select count(*)::int from credit_transactions where organization_id = '00000000-0000-0000-0000-0000000006b2'), 0, 'a refused unlock writes no credit transaction');

-- Unlock without the entitlement: refused before any debit
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006e4"}', true);
select throws_ok(
  $$select public.unlock_requirement('00000000-0000-0000-0000-0000000006a7', '00000000-0000-0000-0000-0000000006b4')$$,
  'P0001', 'conflict:Your plan doesn''t include marketplace unlocks. Upgrade to Contractor Starter.', 'unlock without the entitlement raises before any debit');
select is((select balance from credit_wallets where organization_id = '00000000-0000-0000-0000-0000000006b4'), 50, 'a refused entitlement check leaves the balance unchanged');

-- Unlock as a user of another organization: refused
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006e2"}', true);
select throws_ok(
  $$select public.unlock_requirement('00000000-0000-0000-0000-0000000006a7', '00000000-0000-0000-0000-0000000006b1')$$,
  'P0001', 'permission:Only this organization''s team can act for it.', 'a user cannot unlock for another organization');

-- Partner A unlocks: exactly 10 credits, one unlock row linked to the debit
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006e1"}', true);
select lives_ok(
  $$select public.unlock_requirement('00000000-0000-0000-0000-0000000006a7', '00000000-0000-0000-0000-0000000006b1')$$,
  'partner A unlocks the posted requirement');
select is((select balance from credit_wallets where organization_id = '00000000-0000-0000-0000-0000000006b1'), 20, 'unlock debits exactly 10 credits');
select is((select count(*)::int from marketplace_unlocks where requirement_id = '00000000-0000-0000-0000-0000000006a7' and partner_organization_id = '00000000-0000-0000-0000-0000000006b1'), 1, 'unlock writes one unlock row');
select is((select count(*)::int from credit_transactions t join marketplace_unlocks u on u.credit_transaction_id = t.id
  where u.partner_organization_id = '00000000-0000-0000-0000-0000000006b1' and t.kind = 'unlock' and t.amount = -10 and t.requirement_id = '00000000-0000-0000-0000-0000000006a7'), 1,
  'the unlock row links to the -10 unlock transaction');
select throws_ok(
  $$select public.unlock_requirement('00000000-0000-0000-0000-0000000006a7', '00000000-0000-0000-0000-0000000006b1')$$,
  'P0001', 'conflict:You have already unlocked this requirement.', 'a second unlock by the same organization is refused');

-- Submit: requires an unlock first
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006e3"}', true);
select throws_ok(
  $$select public.submit_proposal('00000000-0000-0000-0000-0000000006a7', '00000000-0000-0000-0000-0000000006b3', array['Materials supplied'], array[]::text[])$$,
  'P0001', 'conflict:Unlock the requirement before submitting a proposal.', 'submit_proposal requires an unlock');

-- Partner C unlocks (50 -> 40) and submits; Partner A submits
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006e3"}', true);
select lives_ok(
  $$select public.unlock_requirement('00000000-0000-0000-0000-0000000006a7', '00000000-0000-0000-0000-0000000006b3')$$,
  'partner C unlocks the requirement');
select lives_ok(
  $$select public.submit_proposal('00000000-0000-0000-0000-0000000006a7', '00000000-0000-0000-0000-0000000006b3', array['Materials supplied'], array['Soil testing'])$$,
  'partner C submits a proposal after unlocking');
select is((select count(*)::int from proposals where requirement_id = '00000000-0000-0000-0000-0000000006a7' and partner_organization_id = '00000000-0000-0000-0000-0000000006b3' and total > 0), 1, 'the proposal is priced from the rate card');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006e1"}', true);
select lives_ok(
  $$select public.submit_proposal('00000000-0000-0000-0000-0000000006a7', '00000000-0000-0000-0000-0000000006b1', array[]::text[], array[]::text[])$$,
  'partner A submits a proposal');
select throws_ok(
  $$select public.submit_proposal('00000000-0000-0000-0000-0000000006a7', '00000000-0000-0000-0000-0000000006b1', array[]::text[], array[]::text[])$$,
  'P0001', 'conflict:You have already submitted a proposal for this requirement.', 'a second proposal by the same organization is refused');

-- Selection: only the owner selects; a partner cannot
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006e1"}', true);
select throws_ok(
  format($$select public.select_proposal(%L)$$, (select id from proposals where partner_organization_id = '00000000-0000-0000-0000-0000000006b1' and requirement_id = '00000000-0000-0000-0000-0000000006a7')),
  'P0001', 'permission:Only homeowners can select a proposal.', 'a partner cannot select a proposal');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006e5"}', true);
select throws_ok(
  format($$select public.select_proposal(%L)$$, (select id from proposals where partner_organization_id = '00000000-0000-0000-0000-0000000006b1' and requirement_id = '00000000-0000-0000-0000-0000000006a7')),
  'P0001', 'permission:You can only select proposals for your own requirement.', 'another homeowner cannot select the proposal');

-- Homeowner selects Partner A's proposal
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006e0"}', true);
select lives_ok(
  format($$select public.select_proposal(%L)$$, (select id from proposals where partner_organization_id = '00000000-0000-0000-0000-0000000006b1' and requirement_id = '00000000-0000-0000-0000-0000000006a7')),
  'the homeowner selects a proposal');
select is((select count(*)::int from projects where organization_id = '00000000-0000-0000-0000-0000000006b1' and name = 'Villa T7'), 1, 'selection creates the project under the partner organization');
select is((select count(*)::int from memberships m join projects p on p.id = m.project_id
  where p.name = 'Villa T7' and m.person_id = '00000000-0000-0000-0000-0000000006d0' and m.role = 'homeowner'), 1, 'selection creates the homeowner membership');
select is((select count(*)::int from memberships m join projects p on p.id = m.project_id
  where p.name = 'Villa T7' and m.person_id = '00000000-0000-0000-0000-0000000006d1' and m.role = 'project-manager'), 1, 'selection creates the partner project-manager membership');
select is((select status from proposals where partner_organization_id = '00000000-0000-0000-0000-0000000006b1' and requirement_id = '00000000-0000-0000-0000-0000000006a7'), 'selected', 'the chosen proposal is selected');
select is((select status from proposals where partner_organization_id = '00000000-0000-0000-0000-0000000006b3' and requirement_id = '00000000-0000-0000-0000-0000000006a7'), 'rejected', 'the other proposal is rejected');
select is((select status from marketplace_requirements where id = '00000000-0000-0000-0000-0000000006a7'), 'awarded', 'the requirement is awarded');

select throws_ok(
  format($$select public.select_proposal(%L)$$, (select id from proposals where partner_organization_id = '00000000-0000-0000-0000-0000000006b3' and requirement_id = '00000000-0000-0000-0000-0000000006a7')),
  'P0001', 'conflict:This requirement is no longer open.', 'a second selection on the awarded requirement is refused');

-- is_business_member (and therefore unlock_requirement/submit_proposal/purchase_credits)
-- must accept a project-scoped business membership, not only an org-level one.
-- Nothing in seed data or any command ever creates an org-level-only membership
-- for a real business user, so a fixture using only org-level rows (like the
-- rest of this file) would never catch a regression here.
insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000006b5', 'org-t7-e', 'Partner E', 'contractor');
insert into subscriptions (id, legacy_id, organization_id, plan_id, status) values
  ('00000000-0000-0000-0000-0000000006c5', 'sub-t7-e', '00000000-0000-0000-0000-0000000006b5', '00000000-0000-0000-0000-0000000006a0', 'active');
insert into credit_wallets (organization_id, balance) values
  ('00000000-0000-0000-0000-0000000006b5', 30);
insert into projects (id, legacy_id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000006f5', 'proj-t7-e', '00000000-0000-0000-0000-0000000006b5', 'Partner E Internal Project');
insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000006d6', 'person-t7-e', '+6598000707', 'Partner E user', null),
  ('00000000-0000-0000-0000-0000000006d7', 'person-t7-home2', '+6598000708', 'Homeowner T7 Two', null);
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000006e6'),
  ('00000000-0000-0000-0000-0000000006e7');
update people set auth_user_id = '00000000-0000-0000-0000-0000000006e6' where id = '00000000-0000-0000-0000-0000000006d6';
update people set auth_user_id = '00000000-0000-0000-0000-0000000006e7' where id = '00000000-0000-0000-0000-0000000006d7';
insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions) values
  ('00000000-0000-0000-0000-0000000006f6', 'm-t7-e', '00000000-0000-0000-0000-0000000006d6', '00000000-0000-0000-0000-0000000006b5',
   '00000000-0000-0000-0000-0000000006f5', 'project-manager', array[]::text[]);
insert into estimates (id, legacy_id, homeowner_person_id, project_name, property_type, location, built_up_area_sqft,
  construction_level, total_low, total_high, review_status) values
  ('00000000-0000-0000-0000-0000000006a9', 'est-t7-3', '00000000-0000-0000-0000-0000000006d7', 'Villa T7 Two', 'independent',
   'Plot 4, Road 1, Hyderabad, Telangana', 1100, 'standard', 950000, 1150000, 'confirmed');
insert into marketplace_requirements (id, legacy_id, estimate_id, homeowner_person_id, project_name, location,
  built_up_area_sqft, construction_level, property_type, estimate_total_low, estimate_total_high, status, posted_at) values
  ('00000000-0000-0000-0000-0000000006aa', 'req-t7-3', '00000000-0000-0000-0000-0000000006a9', '00000000-0000-0000-0000-0000000006d7',
   'Villa T7 Two', 'Plot 4, Road 1, Hyderabad, Telangana', 1100, 'standard', 'independent', 950000, 1150000, 'posted', now());

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006e6"}', true);
select ok(public.is_business_member('00000000-0000-0000-0000-0000000006b5'), 'a project-scoped business membership counts as is_business_member');
select is((select count(*)::int from marketplace_requirement_previews where id = '00000000-0000-0000-0000-0000000006aa'), 1,
  'a project-scoped business membership sees a posted requirement in the preview view');
select lives_ok(
  $$select public.unlock_requirement('00000000-0000-0000-0000-0000000006aa', '00000000-0000-0000-0000-0000000006b5')$$,
  'a project-scoped business membership can unlock a requirement for its organization');
select is((select balance from credit_wallets where organization_id = '00000000-0000-0000-0000-0000000006b5'), 20, 'the unlock debits 10 credits');
select lives_ok(
  $$select public.submit_proposal('00000000-0000-0000-0000-0000000006aa', '00000000-0000-0000-0000-0000000006b5', array[]::text[], array[]::text[])$$,
  'a project-scoped business membership can submit a proposal after unlocking');

select * from finish();
rollback;
