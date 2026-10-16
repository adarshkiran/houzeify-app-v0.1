-- Demo scenario for the local stack (same records as src/mock/seed.ts).
-- Auth users are created by scripts/seed-supabase.ts, which sets people.auth_user_id.
-- Phone numbers here are Supabase test numbers: local and staging only.

insert into organizations (legacy_id, name, kind)
values ('org-buildright', 'BuildRight Construction', 'contractor')
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
insert into plans (legacy_id, name, price_label, entitlements, monthly_credits, limits)
values
  ('plan-contractor-starter', 'Contractor Starter', '₹999 / month', array['marketplace.unlock', 'marketplace.propose', 'ai.narrative'], 30, '{"ai_narratives_per_month": 10}'::jsonb),
  ('plan-contractor-pro', 'Contractor Pro', '₹2,499 / month', array['marketplace.unlock', 'marketplace.propose', 'team.members.unlimited', 'ai.narrative'], 100, '{"ai_narratives_per_month": 50}'::jsonb)
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

-- Construction library (project_id null): the shared catalogue of stages, trades and
-- work types from src/mock/seed.ts. Workers' trade_ids and tasks reference these by
-- legacy id, so without them every trade/work-type name resolves to "Unknown".
-- src/data/seedLibrary.test.ts fails if this block drifts from the mock seed.
insert into stages (legacy_id, project_id, code, name, sort_order)
values
  ('stage-site-prep', null, 'SITE', 'Site Preparation', 1),
  ('stage-foundation', null, 'FND', 'Foundation', 2),
  ('stage-rcc', null, 'RCC', 'RCC Structure', 3),
  ('stage-masonry', null, 'MSN', 'Masonry', 4),
  ('stage-plaster', null, 'PLS', 'Plastering', 5),
  ('stage-waterproofing', null, 'WPF', 'Waterproofing', 6),
  ('stage-services', null, 'SRV', 'Services', 7),
  ('stage-flooring', null, 'FLR', 'Flooring', 8),
  ('stage-finishing', null, 'FIN', 'Finishing', 9)
on conflict (legacy_id) do nothing;

insert into trades (legacy_id, project_id, name)
values
  ('trade-survey', null, 'Survey'),
  ('trade-civil', null, 'Civil'),
  ('trade-reinforcement', null, 'Reinforcement'),
  ('trade-formwork', null, 'Formwork'),
  ('trade-masonry', null, 'Masonry'),
  ('trade-waterproofing', null, 'Waterproofing'),
  ('trade-plumbing', null, 'Plumbing'),
  ('trade-electrical', null, 'Electrical'),
  ('trade-flooring', null, 'Flooring'),
  ('trade-painting', null, 'Painting')
on conflict (legacy_id) do nothing;

insert into work_types (legacy_id, project_id, stage_id, trade_id, name, default_unit)
select v.legacy_id, null, st.id, tr.id, v.name, v.default_unit
from (values
  ('work-site-survey', 'stage-site-prep', 'trade-survey', 'Site Survey', 'm2'),
  ('work-soil-investigation', 'stage-site-prep', 'trade-survey', 'Soil Investigation', 'nos'),
  ('work-site-clearing', 'stage-site-prep', 'trade-civil', 'Site Clearing', 'm2'),
  ('work-demolition', 'stage-site-prep', 'trade-civil', 'Demolition', 'hour'),
  ('work-temporary-fencing-and-hoarding', 'stage-site-prep', 'trade-civil', 'Temporary Fencing and Hoarding', 'm'),
  ('work-grid-setting-out', 'stage-site-prep', 'trade-survey', 'Grid Setting Out', 'nos'),
  ('work-benchmark-establishment', 'stage-site-prep', 'trade-survey', 'Benchmark Establishment', 'nos'),
  ('work-site-excavation', 'stage-site-prep', 'trade-civil', 'Site Excavation', 'm3'),
  ('work-dewatering', 'stage-site-prep', 'trade-civil', 'Dewatering', 'day'),
  ('work-temporary-access-road', 'stage-site-prep', 'trade-civil', 'Temporary Access Road', 'm2'),
  ('work-temporary-power', 'stage-site-prep', 'trade-electrical', 'Temporary Power', 'nos'),
  ('work-temporary-water', 'stage-site-prep', 'trade-plumbing', 'Temporary Water', 'nos'),
  ('work-site-office-setup', 'stage-site-prep', 'trade-civil', 'Site Office Setup', 'nos'),
  ('work-material-storage-setup', 'stage-site-prep', 'trade-civil', 'Material Storage Setup', 'nos'),
  ('work-safety-signage-and-barricading', 'stage-site-prep', 'trade-civil', 'Safety Signage and Barricading', 'nos'),
  ('work-foundation-excavation', 'stage-foundation', 'trade-civil', 'Foundation Excavation', 'm3'),
  ('work-pcc', 'stage-foundation', 'trade-civil', 'PCC', 'm3'),
  ('work-footing', 'stage-foundation', 'trade-civil', 'Footing', 'nos'),
  ('work-footing-reinforcement', 'stage-foundation', 'trade-reinforcement', 'Footing Reinforcement', 'kg'),
  ('work-footing-shuttering', 'stage-foundation', 'trade-formwork', 'Footing Shuttering', 'm2'),
  ('work-footing-concrete', 'stage-foundation', 'trade-civil', 'Footing Concrete', 'm3'),
  ('work-backfilling', 'stage-foundation', 'trade-civil', 'Backfilling', 'm3'),
  ('work-column-reinforcement', 'stage-rcc', 'trade-reinforcement', 'Column Reinforcement', 'kg'),
  ('work-column-shuttering', 'stage-rcc', 'trade-formwork', 'Column Shuttering', 'm2'),
  ('work-column-casting', 'stage-rcc', 'trade-civil', 'Column Casting', 'm3'),
  ('work-beam-reinforcement', 'stage-rcc', 'trade-reinforcement', 'Beam Reinforcement', 'kg'),
  ('work-beam-shuttering', 'stage-rcc', 'trade-formwork', 'Beam Shuttering', 'm2'),
  ('work-beam-casting', 'stage-rcc', 'trade-civil', 'Beam Casting', 'm3'),
  ('work-slab-reinforcement', 'stage-rcc', 'trade-reinforcement', 'Slab Reinforcement', 'kg'),
  ('work-slab-shuttering', 'stage-rcc', 'trade-formwork', 'Slab Shuttering', 'm2'),
  ('work-slab-casting', 'stage-rcc', 'trade-civil', 'Slab Casting', 'm3'),
  ('work-de-shuttering', 'stage-rcc', 'trade-formwork', 'De-shuttering', 'm2'),
  ('work-curing', 'stage-rcc', 'trade-civil', 'Curing', 'day'),
  ('work-brick-masonry', 'stage-masonry', 'trade-masonry', 'Brick Masonry', 'm2'),
  ('work-aac-block-work', 'stage-masonry', 'trade-masonry', 'AAC Block Work', 'm2'),
  ('work-internal-wall', 'stage-masonry', 'trade-masonry', 'Internal Wall', 'm2'),
  ('work-external-wall', 'stage-masonry', 'trade-masonry', 'External Wall', 'm2'),
  ('work-partition-wall', 'stage-masonry', 'trade-masonry', 'Partition Wall', 'm2'),
  ('work-lintel', 'stage-masonry', 'trade-civil', 'Lintel', 'm3'),
  ('work-parapet', 'stage-masonry', 'trade-masonry', 'Parapet', 'm2'),
  ('work-internal-plaster', 'stage-plaster', 'trade-civil', 'Internal Plaster', 'm2'),
  ('work-external-plaster', 'stage-plaster', 'trade-civil', 'External Plaster', 'm2'),
  ('work-ceiling-plaster', 'stage-plaster', 'trade-civil', 'Ceiling Plaster', 'm2'),
  ('work-surface-preparation', 'stage-plaster', 'trade-civil', 'Surface Preparation', 'm2'),
  ('work-foundation-waterproofing', 'stage-waterproofing', 'trade-waterproofing', 'Foundation Waterproofing', 'm2'),
  ('work-basement-waterproofing', 'stage-waterproofing', 'trade-waterproofing', 'Basement Waterproofing', 'm2'),
  ('work-toilet-waterproofing', 'stage-waterproofing', 'trade-waterproofing', 'Toilet Waterproofing', 'm2'),
  ('work-balcony-waterproofing', 'stage-waterproofing', 'trade-waterproofing', 'Balcony Waterproofing', 'm2'),
  ('work-terrace-waterproofing', 'stage-waterproofing', 'trade-waterproofing', 'Terrace Waterproofing', 'm2'),
  ('work-water-tank-waterproofing', 'stage-waterproofing', 'trade-waterproofing', 'Water Tank Waterproofing', 'm2'),
  ('work-water-supply', 'stage-services', 'trade-plumbing', 'Water Supply', 'm'),
  ('work-drainage', 'stage-services', 'trade-plumbing', 'Drainage', 'm'),
  ('work-soil-pipe', 'stage-services', 'trade-plumbing', 'Soil Pipe', 'm'),
  ('work-waste-pipe', 'stage-services', 'trade-plumbing', 'Waste Pipe', 'm'),
  ('work-toilet-plumbing', 'stage-services', 'trade-plumbing', 'Toilet Plumbing', 'nos'),
  ('work-kitchen-plumbing', 'stage-services', 'trade-plumbing', 'Kitchen Plumbing', 'nos'),
  ('work-pressure-testing', 'stage-services', 'trade-plumbing', 'Pressure Testing', 'nos'),
  ('work-leak-testing', 'stage-services', 'trade-plumbing', 'Leak Testing', 'nos'),
  ('work-conduit', 'stage-services', 'trade-electrical', 'Conduit', 'm'),
  ('work-switch-box', 'stage-services', 'trade-electrical', 'Switch Box', 'nos'),
  ('work-wiring', 'stage-services', 'trade-electrical', 'Wiring', 'm'),
  ('work-db-installation', 'stage-services', 'trade-electrical', 'DB Installation', 'nos'),
  ('work-lighting-points', 'stage-services', 'trade-electrical', 'Lighting Points', 'nos'),
  ('work-power-points', 'stage-services', 'trade-electrical', 'Power Points', 'nos'),
  ('work-earthing', 'stage-services', 'trade-electrical', 'Earthing', 'nos'),
  ('work-electrical-testing', 'stage-services', 'trade-electrical', 'Electrical Testing', 'nos'),
  ('work-floor-tiles', 'stage-flooring', 'trade-flooring', 'Floor Tiles', 'm2'),
  ('work-wall-tiles', 'stage-flooring', 'trade-flooring', 'Wall Tiles', 'm2'),
  ('work-marble', 'stage-flooring', 'trade-flooring', 'Marble', 'm2'),
  ('work-granite', 'stage-flooring', 'trade-flooring', 'Granite', 'm2'),
  ('work-skirting', 'stage-flooring', 'trade-flooring', 'Skirting', 'm'),
  ('work-staircase', 'stage-flooring', 'trade-flooring', 'Staircase', 'm2'),
  ('work-grouting', 'stage-flooring', 'trade-flooring', 'Grouting', 'm2'),
  ('work-polishing', 'stage-flooring', 'trade-flooring', 'Polishing', 'm2'),
  ('work-putty', 'stage-finishing', 'trade-painting', 'Putty', 'm2'),
  ('work-primer', 'stage-finishing', 'trade-painting', 'Primer', 'm2'),
  ('work-internal-paint', 'stage-finishing', 'trade-painting', 'Internal Paint', 'm2'),
  ('work-external-paint', 'stage-finishing', 'trade-painting', 'External Paint', 'm2'),
  ('work-texture', 'stage-finishing', 'trade-painting', 'Texture', 'm2'),
  ('work-touch-up', 'stage-finishing', 'trade-painting', 'Touch-up', 'm2')
) as v(legacy_id, stage_legacy_id, trade_legacy_id, name, default_unit)
join stages st on st.legacy_id = v.stage_legacy_id
join trades tr on tr.legacy_id = v.trade_legacy_id
on conflict (legacy_id) do nothing;

-- One open task on Sharma Residence (src/mock/seed.ts task-13), on the library
-- stage/trade/work type above. daily_progress requires all three NOT NULL.
insert into tasks (legacy_id, project_id, project_unit_id, stage_id, trade_id, work_type_id, title, status, created_at)
select 'task-sharma-backfill', p.id, u.id, s.id, t.id, w.id, 'Backfill around footings — Grid A', 'open', '2026-09-25T09:00:00+05:30'::timestamptz
from projects p
join project_units u on u.legacy_id = 'unit-sharma-house' and u.project_id = p.id
join stages s on s.legacy_id = 'stage-foundation'
join trades t on t.legacy_id = 'trade-civil'
join work_types w on w.legacy_id = 'work-backfilling'
where p.legacy_id = 'project-sharma'
on conflict (legacy_id) do nothing;

-- One posted marketplace requirement from a homeowner outside org-buildright's
-- own projects (src/mock/seed.ts's estimates/marketplaceRequirements are both
-- empty, so this has no mock-seed precedent to mirror), so the Opportunities
-- screen has something for a partner organization to unlock.
insert into estimates (legacy_id, homeowner_person_id, project_name, property_type, location,
  built_up_area_sqft, construction_level, total_low, total_high, review_status, created_at)
select 'estimate-rao-farmhouse', person.id, 'Rao Farmhouse', 'farmhouse', 'Shamshabad, Telangana',
  3200, 'premium', 4200000, 5100000, 'confirmed', '2026-09-20T09:00:00+05:30'::timestamptz
from people person
where person.legacy_id = 'person-demo-homeowner'
on conflict (legacy_id) do nothing;

-- No legacy_id here, unlike the rest of this file: post_requirement (the real
-- command) never sets one, and a legacy_id would wrongly give this row a
-- stable domain id even where RLS only grants the raw-uuid-keyed preview (see
-- supabase/migrations/0005_rls.sql's marketplace_requirement_previews and
-- 0025's toDomain-mapping note) -- breaking the unlock flow's held reference
-- the moment unlock grants full visibility and the id would otherwise switch
-- out from under it. Guarded by existence instead of ON CONFLICT (legacy_id).
insert into marketplace_requirements (estimate_id, homeowner_person_id, project_name, location,
  built_up_area_sqft, construction_level, property_type, estimate_total_low, estimate_total_high, status, posted_at, created_at)
select e.id, person.id, e.project_name, e.location,
  e.built_up_area_sqft, e.construction_level, e.property_type, e.total_low, e.total_high,
  'posted', '2026-09-20T09:05:00+05:30'::timestamptz, '2026-09-20T09:05:00+05:30'::timestamptz
from estimates e
join people person on person.id = e.homeowner_person_id
where e.legacy_id = 'estimate-rao-farmhouse'
  and not exists (select 1 from marketplace_requirements r where r.estimate_id = e.id);
