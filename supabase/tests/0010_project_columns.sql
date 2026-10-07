begin;
select plan(9);

-- F2: select_proposal must persist location and kind on the created project,
-- matching src/domain/marketplaceCommands.ts selectProposal (location verbatim,
-- kind from projectKindForPropertyType: Apartment -> apartment,
-- Villa -> villa-development, anything else -> individual-house).

select has_column('public', 'projects', 'location', 'projects has a location column');
select has_column('public', 'projects', 'kind', 'projects has a kind column');

insert into plans (id, legacy_id, name, price_label, entitlements, monthly_credits) values
  ('00000000-0000-0000-0000-00000000a0a0', 'plan-t16-starter', 'Contractor Starter', 'Test',
   array['marketplace.unlock', 'marketplace.propose'], 50);

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-00000000a0b0', 'org-t16', 'Partner T16', 'contractor');

insert into subscriptions (id, legacy_id, organization_id, plan_id, status) values
  ('00000000-0000-0000-0000-00000000a0c0', 'sub-t16', '00000000-0000-0000-0000-00000000a0b0', '00000000-0000-0000-0000-00000000a0a0', 'active');

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000a0e0'),
  ('00000000-0000-0000-0000-00000000a0e1');

insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-00000000a0d0', 'person-t16-home', '+6598001601', 'Homeowner T16', '00000000-0000-0000-0000-00000000a0e0'),
  ('00000000-0000-0000-0000-00000000a0d1', 'person-t16-partner', '+6598001602', 'Partner T16', '00000000-0000-0000-0000-00000000a0e1');

-- Three requirements, one per property type, each already awarded a proposal.
insert into estimates (id, legacy_id, homeowner_person_id, project_name, property_type, location, built_up_area_sqft,
  construction_level, total_low, total_high, review_status) values
  ('00000000-0000-0000-0000-00000000a1a0', 'est-t16-house', '00000000-0000-0000-0000-00000000a0d0', 'House T16', 'independent',
   'Plot 1, Hyderabad, Telangana', 1000, 'standard', 900000, 1000000, 'confirmed'),
  ('00000000-0000-0000-0000-00000000a1a1', 'est-t16-apt', '00000000-0000-0000-0000-00000000a0d0', 'Apartment T16', 'Apartment',
   'Flat 4B, Chennai, Tamil Nadu', 1000, 'standard', 900000, 1000000, 'confirmed'),
  ('00000000-0000-0000-0000-00000000a1a2', 'est-t16-villa', '00000000-0000-0000-0000-00000000a0d0', 'Villa T16', 'Villa',
   'Plot 9, Bengaluru, Karnataka', 1000, 'standard', 900000, 1000000, 'confirmed');

insert into marketplace_requirements (id, legacy_id, estimate_id, homeowner_person_id, project_name, location,
  built_up_area_sqft, construction_level, property_type, estimate_total_low, estimate_total_high, status, posted_at) values
  ('00000000-0000-0000-0000-00000000a2a0', 'req-t16-house', '00000000-0000-0000-0000-00000000a1a0', '00000000-0000-0000-0000-00000000a0d0',
   'House T16', 'Plot 1, Hyderabad, Telangana', 1000, 'standard', 'independent', 900000, 1000000, 'posted', now()),
  ('00000000-0000-0000-0000-00000000a2a1', 'req-t16-apt', '00000000-0000-0000-0000-00000000a1a1', '00000000-0000-0000-0000-00000000a0d0',
   'Apartment T16', 'Flat 4B, Chennai, Tamil Nadu', 1000, 'standard', 'Apartment', 900000, 1000000, 'posted', now()),
  ('00000000-0000-0000-0000-00000000a2a2', 'req-t16-villa', '00000000-0000-0000-0000-00000000a1a2', '00000000-0000-0000-0000-00000000a0d0',
   'Villa T16', 'Plot 9, Bengaluru, Karnataka', 1000, 'standard', 'Villa', 900000, 1000000, 'posted', now());

insert into proposals (id, legacy_id, requirement_id, partner_organization_id, submitted_by_person_id, lines, total) values
  ('00000000-0000-0000-0000-00000000a3a0', 'prop-t16-house', '00000000-0000-0000-0000-00000000a2a0', '00000000-0000-0000-0000-00000000a0b0', '00000000-0000-0000-0000-00000000a0d1', '[]'::jsonb, 950000),
  ('00000000-0000-0000-0000-00000000a3a1', 'prop-t16-apt', '00000000-0000-0000-0000-00000000a2a1', '00000000-0000-0000-0000-00000000a0b0', '00000000-0000-0000-0000-00000000a0d1', '[]'::jsonb, 950000),
  ('00000000-0000-0000-0000-00000000a3a2', 'prop-t16-villa', '00000000-0000-0000-0000-00000000a2a2', '00000000-0000-0000-0000-00000000a0b0', '00000000-0000-0000-0000-00000000a0d1', '[]'::jsonb, 950000);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000a0e0"}', true);

select lives_ok(
  $$select public.select_proposal('00000000-0000-0000-0000-00000000a3a0')$$,
  'homeowner selects the independent-property-type proposal');
select is(
  (select kind from projects where organization_id = '00000000-0000-0000-0000-00000000a0b0' and name = 'House T16'),
  'individual-house', 'an unrecognised property type creates an individual-house project');
select is(
  (select location from projects where organization_id = '00000000-0000-0000-0000-00000000a0b0' and name = 'House T16'),
  'Plot 1, Hyderabad, Telangana', 'the project location is the requirement location verbatim');

select lives_ok(
  $$select public.select_proposal('00000000-0000-0000-0000-00000000a3a1')$$,
  'homeowner selects the Apartment proposal');
select is(
  (select kind from projects where organization_id = '00000000-0000-0000-0000-00000000a0b0' and name = 'Apartment T16'),
  'apartment', 'Apartment maps to the apartment project kind');

select lives_ok(
  $$select public.select_proposal('00000000-0000-0000-0000-00000000a3a2')$$,
  'homeowner selects the Villa proposal');
select is(
  (select kind from projects where organization_id = '00000000-0000-0000-0000-00000000a0b0' and name = 'Villa T16'),
  'villa-development', 'Villa maps to the villa-development project kind');

select * from finish();
rollback;
