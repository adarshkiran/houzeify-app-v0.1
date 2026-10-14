-- Demo scenario for the local stack (same records as src/mock/seed.ts).
-- Auth users are created by scripts/seed-supabase.ts, which sets people.auth_user_id.
-- Phone numbers here are Supabase test numbers: local and staging only.

insert into organizations (legacy_id, name)
values ('org-buildright', 'BuildRight Construction')
on conflict (legacy_id) do nothing;

insert into people (legacy_id, phone, full_name)
values
  ('person-arjun', '+919000011101', 'Arjun Mehta'),
  ('person-demo-homeowner', '+919000011103', 'Demo Homeowner'),
  ('person-ravi', '+919000011122', 'Ravi Naik')
on conflict (legacy_id) do nothing;

insert into projects (legacy_id, organization_id, name, status, require_checkout, created_at)
select v.legacy_id, o.id, v.name, v.status, false, v.created_at::timestamptz
from (values
  ('project-sharma', 'Sharma Residence', 'active', '2026-05-22T09:00:00+05:30'),
  ('project-reddy', 'Reddy Villa', 'active', '2026-04-02T10:00:00+05:30'),
  ('project-tech-park', 'Tech Park Block C', 'active', '2026-01-08T11:00:00+05:30'),
  ('project-krishna', 'Krishna Apartments', 'planning', '2026-08-28T09:30:00+05:30'),
  ('project-lakeside', 'Lakeside Villa Development', 'planning', '2026-09-01T10:00:00+05:30')
) as v(legacy_id, name, status, created_at)
cross join organizations o
where o.legacy_id = 'org-buildright'
on conflict (legacy_id) do nothing;

-- Units: parent_id references the parent unit by legacy id.
insert into project_units (legacy_id, project_id, parent_id, name, created_at)
select v.legacy_id, p.id, null, v.name, now()
from (values
  ('unit-sharma-house', 'project-sharma', 'Main House'),
  ('unit-reddy-villa', 'project-reddy', 'Villa'),
  ('unit-tech-block-c', 'project-tech-park', 'Block C'),
  ('unit-krishna-block-a', 'project-krishna', 'Block A'),
  ('unit-krishna-block-b', 'project-krishna', 'Block B'),
  ('unit-lakeside-phase-1', 'project-lakeside', 'Phase 1')
) as v(legacy_id, project_legacy_id, name)
join projects p on p.legacy_id = v.project_legacy_id
on conflict (legacy_id) do nothing;

-- Child units, one level at a time so each parent exists before its children.
insert into project_units (legacy_id, project_id, parent_id, name, created_at)
select v.legacy_id, p.id, parent.id, v.name, now()
from (values
  ('unit-tech-level-3', 'project-tech-park', 'unit-tech-block-c', 'Level 3'),
  ('unit-lakeside-block-a', 'project-lakeside', 'unit-lakeside-phase-1', 'Block A')
) as v(legacy_id, project_legacy_id, parent_legacy_id, name)
join projects p on p.legacy_id = v.project_legacy_id
join project_units parent on parent.legacy_id = v.parent_legacy_id
on conflict (legacy_id) do nothing;

insert into project_units (legacy_id, project_id, parent_id, name, created_at)
select v.legacy_id, p.id, parent.id, v.name, now()
from (values
  ('unit-lakeside-v001', 'project-lakeside', 'unit-lakeside-block-a', 'Villa 1'),
  ('unit-lakeside-v002', 'project-lakeside', 'unit-lakeside-block-a', 'Villa 2'),
  ('unit-lakeside-v003', 'project-lakeside', 'unit-lakeside-block-a', 'Villa 3')
) as v(legacy_id, project_legacy_id, parent_legacy_id, name)
join projects p on p.legacy_id = v.project_legacy_id
join project_units parent on parent.legacy_id = v.parent_legacy_id
on conflict (legacy_id) do nothing;

-- Memberships. Arjun manages every project; the homeowner reads Sharma;
-- Ravi is a civil worker on Sharma, scoped to the house unit.
insert into memberships (legacy_id, person_id, organization_id, project_id, role, permissions, scope, status)
select
  'membership-manager-' || row_number() over (order by p.legacy_id),
  person.id,
  o.id,
  p.id,
  'project-manager',
  array['project.read','project.manage','task.manage','progress.submit','progress.review','customer.publish','workforce.manage','evidence.capture','issue.manage'],
  '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb,
  'active'
from projects p
cross join organizations o
cross join people person
where o.legacy_id = 'org-buildright'
  and person.legacy_id = 'person-arjun'
on conflict (legacy_id) do nothing;

insert into memberships (legacy_id, person_id, organization_id, project_id, role, permissions, scope, status)
select 'membership-homeowner-sharma', person.id, o.id, p.id, 'homeowner',
  array['project.read'],
  '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb,
  'active'
from projects p
cross join organizations o
cross join people person
where o.legacy_id = 'org-buildright'
  and p.legacy_id = 'project-sharma'
  and person.legacy_id = 'person-demo-homeowner'
on conflict (legacy_id) do nothing;

insert into memberships (legacy_id, person_id, organization_id, project_id, role, permissions, scope, status)
select 'membership-worker-ravi-sharma', person.id, o.id, p.id, 'worker',
  array['project.read','progress.submit','evidence.capture'],
  jsonb_build_object(
    'projectUnitIds', jsonb_build_array(unit.id),
    'stageIds', '[]'::jsonb,
    'tradeIds', '["trade-civil"]'::jsonb
  ),
  'active'
from projects p
cross join organizations o
cross join people person
join project_units unit on unit.legacy_id = 'unit-sharma-house' and unit.project_id = p.id
where o.legacy_id = 'org-buildright'
  and p.legacy_id = 'project-sharma'
  and person.legacy_id = 'person-ravi'
on conflict (legacy_id) do nothing;

-- Workers. worker-2 is Ravi Naik, the demo worker who signs in with the test phone.
insert into workers (legacy_id, organization_id, user_id, phone, name, trade_ids, languages, onboarding_method, status)
select 'worker-2', o.id, person.id, '+919000011122', 'Ravi Naik',
  array['trade-civil'], array['hi','en'], 'otp', 'active'
from organizations o
join people person on person.legacy_id = 'person-ravi'
where o.legacy_id = 'org-buildright'
on conflict (legacy_id) do nothing;

-- The other 41 workers, generated in the same pattern as src/mock/seed.ts.
insert into workers (legacy_id, organization_id, phone, name, trade_ids, languages, onboarding_method, status)
select
  'worker-' || g,
  o.id,
  '+91 91000 ' || lpad(g::text, 5, '0'),
  (array['Suresh Kumar','Ravi Naik','Imran Khan','Mahesh Yadav','Vijay Rao','Ramesh Patel','Santosh Das','Ajay Singh','Naveen Reddy','Kiran Kumar','Rahul Verma','Salim Sheikh','Prakash Jha','Deepak Sahu'])[((g - 1) % 14) + 1],
  array[(array['trade-survey','trade-civil','trade-reinforcement','trade-formwork','trade-masonry','trade-waterproofing','trade-plumbing','trade-electrical','trade-flooring','trade-painting'])[((g - 1) % 10) + 1]],
  case when (g - 1) % 3 = 0 then array['te','en'] when (g - 1) % 3 = 1 then array['hi','en'] else array['en'] end,
  case when g <= 12 then 'manual' else 'supervisor-assisted' end,
  'active'
from generate_series(1, 42) as g
cross join organizations o
where o.legacy_id = 'org-buildright'
  and g <> 2
on conflict (legacy_id) do nothing;

-- Worker assignments (the three in src/mock/seed.ts).
insert into worker_project_assignments (legacy_id, project_id, worker_id, project_unit_ids, started_at, status)
select v.legacy_id, p.id, w.id,
  array(select pu.id from project_units pu where pu.legacy_id = v.unit_legacy_id),
  v.started_at::timestamptz, 'active'
from (values
  ('wpa-1', 'worker-1', 'project-tech-park', 'unit-tech-level-3', '2026-09-10T09:00:00+05:30'),
  ('wpa-2', 'worker-2', 'project-sharma', 'unit-sharma-house', '2026-09-12T10:00:00+05:30'),
  ('wpa-3', 'worker-3', 'project-reddy', 'unit-reddy-villa', '2026-09-14T11:00:00+05:30')
) as v(legacy_id, worker_legacy_id, project_legacy_id, unit_legacy_id, started_at)
join workers w on w.legacy_id = v.worker_legacy_id
join projects p on p.legacy_id = v.project_legacy_id
on conflict (legacy_id) do nothing;

-- Plan catalogue and the demo org's subscription/wallet (src/mock/seed.ts: plans,
-- subscriptions, wallets, creditTransactions). Credit the 30 granted credits as a
-- transaction so the wallet balance equals the sum of its transactions.
insert into plans (legacy_id, name, price_label, entitlements, monthly_credits)
values
  ('plan-contractor-starter', 'Contractor Starter', '₹999 / month', array['marketplace.unlock', 'marketplace.propose'], 30),
  ('plan-contractor-pro', 'Contractor Pro', '₹2,499 / month', array['marketplace.unlock', 'marketplace.propose', 'team.members.unlimited'], 100)
on conflict (legacy_id) do nothing;

insert into subscriptions (legacy_id, organization_id, plan_id, status, started_at)
select 'subscription-buildright', o.id, p.id, 'active', '2026-01-10T09:00:00+05:30'::timestamptz
from organizations o
cross join plans p
where o.legacy_id = 'org-buildright'
  and p.legacy_id = 'plan-contractor-starter'
on conflict (legacy_id) do nothing;

insert into credit_wallets (organization_id, balance)
select o.id, 30
from organizations o
where o.legacy_id = 'org-buildright'
on conflict (organization_id) do nothing;

insert into credit_transactions (legacy_id, organization_id, kind, amount, balance_after, created_at)
select 'credit-grant-buildright', o.id, 'grant', 30, 30, '2026-01-10T09:00:00+05:30'::timestamptz
from organizations o
where o.legacy_id = 'org-buildright'
on conflict (legacy_id) do nothing;
