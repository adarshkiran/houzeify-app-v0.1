begin;
select plan(4);

-- F4: a worker can correct their own contact fields; they cannot touch another
-- worker's row, and cannot use this path to move themselves to another
-- organization.

insert into organizations (id, legacy_id, name) values
  ('00000000-0000-0000-0000-00000000c0a0', 'org-t17', 'Org T17'),
  ('00000000-0000-0000-0000-00000000c0a1', 'org-t17-other', 'Org T17 Other');

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000c0e1'),
  ('00000000-0000-0000-0000-00000000c0e2');

insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('00000000-0000-0000-0000-00000000c0d1', 'person-t17-wk1', '+6598001701', 'Worker One T17', '00000000-0000-0000-0000-00000000c0e1'),
  ('00000000-0000-0000-0000-00000000c0d2', 'person-t17-wk2', '+6598001702', 'Worker Two T17', '00000000-0000-0000-0000-00000000c0e2');

insert into workers (id, legacy_id, organization_id, user_id, phone, name, status) values
  ('00000000-0000-0000-0000-00000000c0c1', 'wk-t17-1', '00000000-0000-0000-0000-00000000c0a0', '00000000-0000-0000-0000-00000000c0d1', '+6598001711', 'Worker One T17', 'active'),
  ('00000000-0000-0000-0000-00000000c0c2', 'wk-t17-2', '00000000-0000-0000-0000-00000000c0a0', '00000000-0000-0000-0000-00000000c0d2', '+6598001712', 'Worker Two T17', 'active');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000c0e1"}', true);
set local role authenticated;

-- A worker can update their own contact fields.
select lives_ok(
  $$update workers set phone = '+6598001799', name = 'Worker One Updated' where id = '00000000-0000-0000-0000-00000000c0c1'$$,
  'a worker can update their own phone and name');
select is(
  (select phone from workers where id = '00000000-0000-0000-0000-00000000c0c1'),
  '+6598001799', 'the phone was actually updated');

-- A worker cannot touch another worker's row: RLS filters it out of the
-- update, so the row is unaffected (checked below as the table owner, since
-- worker one can't even select worker two's row to see it was left alone).
update workers set phone = '+6598001799' where id = '00000000-0000-0000-0000-00000000c0c2';

reset role;
select is(
  (select phone from workers where id = '00000000-0000-0000-0000-00000000c0c2'),
  '+6598001712', 'another worker''s row is left untouched (checked as the table owner)');

-- A worker cannot use this path to move organizations: the column grant only
-- covers name, phone and languages, so this must fail outright.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000c0e1"}', true);
set local role authenticated;
select throws_ok(
  $$update workers set organization_id = '00000000-0000-0000-0000-00000000c0a1' where id = '00000000-0000-0000-0000-00000000c0c1'$$,
  '42501', null, 'a worker cannot update organization_id through this path');
reset role;

select * from finish();
rollback;
