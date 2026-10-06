create table organizations (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table people (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  phone text unique,
  full_name text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  person_id uuid not null references people (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  project_id uuid,
  role text not null,
  permissions text[] not null default '{}',
  scope jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table workers (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid references people (id) on delete set null,
  phone text not null,
  name text not null,
  trade_ids text[] not null default '{}',
  languages text[] not null default '{}',
  onboarding_method text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint workers_organization_id_phone_key unique (organization_id, phone)
);

create table worker_onboardings (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  worker_id uuid not null references workers (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  method text not null,
  status text not null,
  join_code text,
  invited_by_membership_id uuid references memberships (id) on delete set null,
  invited_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index worker_onboardings_one_open_idx
  on worker_onboardings (worker_id)
  where status in ('invited', 'accepted');

create or replace function public.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from people p
  where p.auth_user_id = auth.uid()
$$;
