begin;
select plan(31);

-- Fixtures are inserted as the table owner (bypasses RLS). Each function call
-- is made as one signed-in person by setting the JWT claims for the transaction.

insert into organizations (id, legacy_id, name, kind) values
  ('00000000-0000-0000-0000-0000000019b1', 'org-t19-a', 'Partner T19 A', 'contractor'),
  ('00000000-0000-0000-0000-0000000019b2', 'org-t19-b', 'Partner T19 B', 'contractor');

-- People: two homeowners (no organization), one business user per organization.
insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-0000000019d0', 'person-t19-home', '+6598001901', 'Homeowner T19', null),
  ('00000000-0000-0000-0000-0000000019d1', 'person-t19-other-home', '+6598001902', 'Other Homeowner T19', null),
  ('00000000-0000-0000-0000-0000000019d2', 'person-t19-a', '+6598001903', 'Partner A user T19', null),
  ('00000000-0000-0000-0000-0000000019d3', 'person-t19-b', '+6598001904', 'Partner B user T19', null);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000019e0'),
  ('00000000-0000-0000-0000-0000000019e1'),
  ('00000000-0000-0000-0000-0000000019e2'),
  ('00000000-0000-0000-0000-0000000019e3');
update people set auth_user_id = '00000000-0000-0000-0000-0000000019e0' where id = '00000000-0000-0000-0000-0000000019d0';
update people set auth_user_id = '00000000-0000-0000-0000-0000000019e1' where id = '00000000-0000-0000-0000-0000000019d1';
update people set auth_user_id = '00000000-0000-0000-0000-0000000019e2' where id = '00000000-0000-0000-0000-0000000019d2';
update people set auth_user_id = '00000000-0000-0000-0000-0000000019e3' where id = '00000000-0000-0000-0000-0000000019d3';

-- Business memberships are organization-level (no project).
insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions) values
  ('00000000-0000-0000-0000-0000000019f1', 'm-t19-a', '00000000-0000-0000-0000-0000000019d2', '00000000-0000-0000-0000-0000000019b1', null, 'owner', array[]::text[]),
  ('00000000-0000-0000-0000-0000000019f2', 'm-t19-b', '00000000-0000-0000-0000-0000000019d3', '00000000-0000-0000-0000-0000000019b2', null, 'owner', array[]::text[]);

insert into credit_wallets (organization_id, balance) values
  ('00000000-0000-0000-0000-0000000019b1', 20);

-- An existing confirmed estimate and estimate-less requirement for refusal paths.
insert into estimates (id, legacy_id, homeowner_person_id, project_name, property_type, location, built_up_area_sqft,
  floors, construction_level, total_low, total_high, review_status) values
  ('00000000-0000-0000-0000-0000000019a1', 'est-t19-confirmed', '00000000-0000-0000-0000-0000000019d0', 'Villa T19',
   'independent', 'Plot 1, Road 2, Hyderabad, Telangana', 1000, 2, 'basic', 1000, 1000, 'confirmed'),
  ('00000000-0000-0000-0000-0000000019a2', 'est-t19-draft', '00000000-0000-0000-0000-0000000019d0', 'Draft T19',
   'independent', 'Plot 3, Road 4, Chennai, Tamil Nadu', 900, 1, 'standard', 900, 900, 'draft');

-- ── Structural checks ────────────────────────────────────────────────────────
select has_function('public', 'generate_estimate', array['text', 'text', 'text', 'integer', 'integer', 'text'], 'generate_estimate exists');
select has_function('public', 'confirm_estimate', array['uuid'], 'confirm_estimate exists');
select has_function('public', 'post_requirement', array['uuid'], 'post_requirement exists');
select has_function('public', 'purchase_credits', array['uuid', 'integer'], 'purchase_credits exists');
select is_definer('public', 'generate_estimate', array['text', 'text', 'text', 'integer', 'integer', 'text'], 'generate_estimate is security definer');
select is_definer('public', 'confirm_estimate', array['uuid'], 'confirm_estimate is security definer');
select is_definer('public', 'post_requirement', array['uuid'], 'post_requirement is security definer');
select is_definer('public', 'purchase_credits', array['uuid', 'integer'], 'purchase_credits is security definer');

-- ── generateEstimate: rate-card parity ──────────────────────────────────────
-- generate_estimate must reuse public.catalog_estimate_lines (0006/0012) for
-- its line items rather than re-pricing independently: the breakdown and the
-- total range it writes must derive exactly from that function's own output.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000019e0"}', true);
select lives_ok(
  $$select public.generate_estimate('Parity House', 'independent', 'Plot 5, Road 6, Hyderabad, Telangana', 1000, 2, 'standard')$$,
  'generateEstimate succeeds for a homeowner'
);

select results_eq(
  $$
  select
    (breakdown ->> 'materials')::numeric,
    (breakdown ->> 'labour')::numeric,
    (breakdown ->> 'finishing')::numeric,
    (breakdown ->> 'contingency')::numeric,
    round(total_low, 6),
    round(total_high, 6)
  from estimates
  where project_name = 'Parity House'
  $$,
  $$
  select
    (select coalesce(sum((x.line ->> 'amount')::numeric), 0) from jsonb_array_elements(public.catalog_estimate_lines(1000, 'standard')) x(line) where x.line ->> 'category' = 'materials'),
    (select coalesce(sum((x.line ->> 'amount')::numeric), 0) from jsonb_array_elements(public.catalog_estimate_lines(1000, 'standard')) x(line) where x.line ->> 'category' = 'labour'),
    (select coalesce(sum((x.line ->> 'amount')::numeric), 0) from jsonb_array_elements(public.catalog_estimate_lines(1000, 'standard')) x(line) where x.line ->> 'category' = 'finishing'),
    (select coalesce(sum((x.line ->> 'amount')::numeric), 0) from jsonb_array_elements(public.catalog_estimate_lines(1000, 'standard')) x(line) where x.line ->> 'category' = 'contingency'),
    round((select coalesce(sum((x.line ->> 'amount')::numeric), 0) from jsonb_array_elements(public.catalog_estimate_lines(1000, 'standard')) x(line)) * 0.92, 6),
    round((select coalesce(sum((x.line ->> 'amount')::numeric), 0) from jsonb_array_elements(public.catalog_estimate_lines(1000, 'standard')) x(line)) * 1.08, 6)
  $$,
  'generateEstimate breakdown and total range match catalog_estimate_lines exactly'
);

-- ── generateEstimate: validation and permission refusals ────────────────────
select throws_ok(
  $$select public.generate_estimate('  ', 'independent', 'Loc', 1000, 1, 'standard')$$,
  'P0001', 'conflict:Give the project a name.', 'an empty project name is refused');
select throws_ok(
  $$select public.generate_estimate('Name', 'independent', '  ', 1000, 1, 'standard')$$,
  'P0001', 'conflict:Add a location.', 'an empty location is refused');
select throws_ok(
  $$select public.generate_estimate('Name', 'independent', 'Loc', 0, 1, 'standard')$$,
  'P0001', 'conflict:Enter a built-up area greater than zero.', 'a zero built-up area is refused');
select throws_ok(
  $$select public.generate_estimate('Name', 'independent', 'Loc', 1000, 0, 'standard')$$,
  'P0001', 'conflict:Enter at least 1 floor.', 'zero floors is refused');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000019e2"}', true);
select throws_ok(
  $$select public.generate_estimate('Name', 'independent', 'Loc', 1000, 1, 'standard')$$,
  'P0001', 'permission:Only homeowners can generate an estimate.', 'a business account cannot generate an estimate');

-- ── confirmEstimate ──────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000019e2"}', true);
select throws_ok(
  $$select public.confirm_estimate('00000000-0000-0000-0000-0000000019a2')$$,
  'P0001', 'permission:Only homeowners can confirm an estimate.', 'a business account cannot confirm an estimate');

-- A non-owner homeowner cannot confirm someone else's estimate.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000019e1"}', true);
select throws_ok(
  $$select public.confirm_estimate('00000000-0000-0000-0000-0000000019a2')$$,
  'P0001', 'conflict:You can only confirm your own estimate.', 'confirmEstimate refuses a non-owner');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000019e0"}', true);
select lives_ok(
  $$select public.confirm_estimate('00000000-0000-0000-0000-0000000019a2')$$,
  'the owning homeowner confirms their draft estimate');
select is((select review_status from estimates where id = '00000000-0000-0000-0000-0000000019a2'), 'confirmed', 'confirming sets review_status to confirmed');
select throws_ok(
  $$select public.confirm_estimate('00000000-0000-0000-0000-0000000019a2')$$,
  'P0001', 'conflict:This estimate is already confirmed.', 'confirming twice is refused');
select throws_ok(
  $$select public.confirm_estimate('00000000-0000-0000-0000-0000000019a9')$$,
  'P0001', 'conflict:That estimate no longer exists.', 'confirming a missing estimate is refused');

-- ── postRequirement ──────────────────────────────────────────────────────────
-- postRequirement refuses an unconfirmed estimate.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000019e0"}', true);
insert into estimates (id, legacy_id, homeowner_person_id, project_name, property_type, location, built_up_area_sqft,
  floors, construction_level, total_low, total_high, review_status) values
  ('00000000-0000-0000-0000-0000000019a3', 'est-t19-unconfirmed', '00000000-0000-0000-0000-0000000019d0', 'Unconfirmed T19',
   'independent', 'Plot 7, Road 8, Pune, Maharashtra', 800, 1, 'basic', 800, 800, 'draft');
select throws_ok(
  $$select public.post_requirement('00000000-0000-0000-0000-0000000019a3')$$,
  'P0001', 'conflict:Confirm the estimate before posting it.', 'postRequirement refuses an unconfirmed estimate');

select lives_ok(
  $$select public.post_requirement('00000000-0000-0000-0000-0000000019a1')$$,
  'postRequirement posts a confirmed estimate owned by the caller');
select is((select status from marketplace_requirements where estimate_id = '00000000-0000-0000-0000-0000000019a1'), 'posted', 'the posted requirement has status posted');
select throws_ok(
  $$select public.post_requirement('00000000-0000-0000-0000-0000000019a1')$$,
  'P0001', 'conflict:This estimate has already been posted.', 'posting the same estimate twice is refused');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000019e1"}', true);
select throws_ok(
  $$select public.post_requirement('00000000-0000-0000-0000-0000000019a3')$$,
  'P0001', 'conflict:You can only post your own estimate.', 'a different homeowner cannot post another''s estimate');

-- ── purchaseCredits ──────────────────────────────────────────────────────────
-- purchaseCredits refuses a pack size outside {50, 150, 500}.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000019e2"}', true);
select throws_ok(
  $$select public.purchase_credits('00000000-0000-0000-0000-0000000019b1', 75)$$,
  'P0001', 'conflict:Choose a 50, 150, or 500 credit pack.', 'purchaseCredits refuses an off-menu pack size');

-- purchaseCredits refuses a caller from a different organization.
select throws_ok(
  $$select public.purchase_credits('00000000-0000-0000-0000-0000000019b2', 50)$$,
  'P0001', 'conflict:Only this organization''s team can buy credits.', 'purchaseCredits refuses a caller from a different organization');

select lives_ok(
  $$select public.purchase_credits('00000000-0000-0000-0000-0000000019b1', 150)$$,
  'purchaseCredits tops up the caller''s own organization');
select is((select balance from credit_wallets where organization_id = '00000000-0000-0000-0000-0000000019b1'), 170, 'the wallet balance increases by the pack size');
select is((select count(*)::int from credit_transactions where organization_id = '00000000-0000-0000-0000-0000000019b1' and kind = 'purchase'), 1, 'a purchase transaction is recorded');

select * from finish();
rollback;
