-- Attendance. One row per worker, project and day. The date is derived by the
-- database in Asia/Kolkata (see Task 9 functions); clients never send it.
create table worker_attendance (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  worker_id uuid not null references workers (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  assignment_id uuid not null references worker_project_assignments (id) on delete restrict,
  date date not null,
  status text,
  check_in_at timestamptz,
  check_out_at timestamptz,
  recorded_by text not null,
  recorded_by_membership_id uuid references memberships (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_attendance_worker_project_date_key unique (worker_id, project_id, date),
  constraint worker_attendance_status_check
    check (status is null or status in ('present', 'absent', 'half-day')),
  constraint worker_attendance_recorded_by_check
    check (recorded_by in ('supervisor', 'worker'))
);

-- Estimates are owned by a homeowner person, not an organization.
create table estimates (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  homeowner_person_id uuid not null references people (id) on delete cascade,
  project_name text not null,
  property_type text not null,
  location text not null,
  built_up_area_sqft numeric not null,
  floors integer not null default 1,
  construction_level text not null,
  total_low numeric(12, 2) not null,
  total_high numeric(12, 2) not null,
  breakdown jsonb not null default '{}'::jsonb,
  review_status text not null default 'draft',
  created_at timestamptz not null default now(),
  constraint estimates_review_status_check check (review_status in ('draft', 'confirmed'))
);

create table marketplace_requirements (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  estimate_id uuid not null references estimates (id) on delete cascade,
  homeowner_person_id uuid not null references people (id) on delete cascade,
  project_name text not null,
  location text not null,
  built_up_area_sqft numeric not null,
  construction_level text not null,
  property_type text not null,
  estimate_total_low numeric(12, 2) not null,
  estimate_total_high numeric(12, 2) not null,
  status text not null default 'draft',
  posted_at timestamptz,
  awarded_proposal_id uuid,
  created_at timestamptz not null default now(),
  constraint marketplace_requirements_status_check
    check (status in ('draft', 'posted', 'awarded', 'closed'))
);

-- Plans and subscriptions. Plan entitlements are keys such as marketplace.unlock.
create table plans (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  price_label text not null,
  entitlements text[] not null default '{}',
  monthly_credits integer not null default 0,
  constraint plans_monthly_credits_check check (monthly_credits >= 0)
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  organization_id uuid not null references organizations (id) on delete cascade,
  plan_id uuid not null references plans (id) on delete restrict,
  status text not null,
  started_at timestamptz not null default now(),
  constraint subscriptions_status_check check (status in ('active', 'cancelled'))
);

-- Credits. The balance can never go negative. Money is never stored here.
create table credit_wallets (
  organization_id uuid primary key references organizations (id) on delete cascade,
  balance integer not null default 0,
  constraint credit_wallets_balance_check check (balance >= 0)
);

create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  organization_id uuid not null references organizations (id) on delete cascade,
  kind text not null,
  amount integer not null,
  balance_after integer not null,
  requirement_id uuid references marketplace_requirements (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint credit_transactions_kind_check check (kind in ('grant', 'purchase', 'unlock')),
  constraint credit_transactions_balance_after_check check (balance_after >= 0)
);

-- Marketplace unlocks and proposals. A partner unlocks a requirement once and
-- proposes once. Each unlock links to the debit that paid for it.
create table marketplace_unlocks (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  requirement_id uuid not null references marketplace_requirements (id) on delete cascade,
  partner_organization_id uuid not null references organizations (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  credit_transaction_id uuid not null references credit_transactions (id) on delete restrict,
  constraint marketplace_unlocks_requirement_partner_key unique (requirement_id, partner_organization_id)
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  requirement_id uuid not null references marketplace_requirements (id) on delete cascade,
  partner_organization_id uuid not null references organizations (id) on delete cascade,
  submitted_by_person_id uuid not null references people (id) on delete restrict,
  lines jsonb not null default '[]'::jsonb,
  total numeric(12, 2) not null,
  assumptions text[] not null default '{}',
  exclusions text[] not null default '{}',
  status text not null default 'submitted',
  submitted_at timestamptz not null default now(),
  constraint proposals_requirement_partner_key unique (requirement_id, partner_organization_id),
  constraint proposals_status_check check (status in ('submitted', 'selected', 'rejected'))
);

alter table marketplace_requirements
  add constraint marketplace_requirements_awarded_proposal_fk
  foreign key (awarded_proposal_id) references proposals (id) on delete set null;
