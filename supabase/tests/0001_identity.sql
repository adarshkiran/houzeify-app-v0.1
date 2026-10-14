begin;
select plan(13);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'people', 'people table exists');
select has_table('public', 'memberships', 'memberships table exists');
select has_table('public', 'workers', 'workers table exists');
select has_table('public', 'worker_onboardings', 'worker_onboardings table exists');
select has_function('public', 'current_person_id', array[]::text[], 'current_person_id() exists');
select is(public.current_person_id(), null::uuid, 'current_person_id() is null with no JWT');
select has_index('public', 'worker_onboardings', 'worker_onboardings_one_open_idx', 'open onboarding partial unique index exists');

insert into organizations (id, legacy_id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-org-a', 'Org A'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-org-b', 'Org B');

insert into people (id, legacy_id, phone, full_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'test-person-1', '+6598000001', 'Worker One');

insert into workers (id, legacy_id, organization_id, user_id, phone, name) values
  ('00000000-0000-0000-0000-0000000000c1', 'test-worker-1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '+6598000001', 'Worker One');

select lives_ok(
  $$insert into worker_onboardings (id, worker_id, organization_id, method, status)
    values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'join_code', 'invited')$$,
  'first open onboarding for a worker is allowed'
);

select throws_ok(
  $$insert into worker_onboardings (id, worker_id, organization_id, method, status)
    values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'join_code', 'accepted')$$,
  '23505',
  'duplicate key value violates unique constraint "worker_onboardings_one_open_idx"',
  'second open onboarding for the same worker is refused'
);

select lives_ok(
  $$insert into worker_onboardings (id, worker_id, organization_id, method, status)
    values ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'join_code', 'expired')$$,
  'a closed onboarding does not count toward the open limit'
);

select lives_ok(
  $$insert into workers (id, legacy_id, organization_id, phone, name) values
    ('00000000-0000-0000-0000-0000000000c2', 'test-worker-2', '00000000-0000-0000-0000-0000000000a2', '+6598000001', 'Worker One in Org B')$$,
  'the same phone can be a worker in another organization'
);

select throws_ok(
  $$insert into workers (id, legacy_id, organization_id, phone, name) values
    ('00000000-0000-0000-0000-0000000000c3', 'test-worker-3', '00000000-0000-0000-0000-0000000000a1', '+6598000001', 'Duplicate')$$,
  '23505',
  'duplicate key value violates unique constraint "workers_organization_id_phone_key"',
  'workers are unique per organization and phone'
);

select * from finish();
rollback;
