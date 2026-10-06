create table projects (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  status text not null default 'active',
  require_checkout boolean not null default false,
  created_at timestamptz not null default now()
);

alter table memberships
  add constraint memberships_project_id_fkey
  foreign key (project_id) references projects (id) on delete cascade;

create table project_units (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  parent_id uuid references project_units (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table stages (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table trades (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table work_types (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table task_templates (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  work_type_id uuid references work_types (id) on delete set null,
  name text not null,
  created_at timestamptz not null default now()
);

create table work_plan_items (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  project_unit_id uuid references project_units (id) on delete set null,
  stage_id uuid references stages (id) on delete set null,
  trade_id uuid references trades (id) on delete set null,
  work_type_id uuid references work_types (id) on delete set null,
  title text not null,
  planned_start date,
  planned_end date,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  work_plan_item_id uuid references work_plan_items (id) on delete set null,
  project_unit_id uuid references project_units (id) on delete set null,
  stage_id uuid references stages (id) on delete set null,
  trade_id uuid references trades (id) on delete set null,
  title text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table task_assignments (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  task_id uuid not null references tasks (id) on delete cascade,
  worker_id uuid not null references workers (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  constraint task_assignments_task_id_worker_id_key unique (task_id, worker_id)
);

create table worker_project_assignments (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  worker_id uuid not null references workers (id) on delete cascade,
  project_unit_ids uuid[] not null default '{}',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint worker_project_assignments_status_check
    check (status in ('active', 'inactive'))
);

alter table worker_onboardings
  add constraint worker_onboardings_status_check
  check (status in ('invited', 'accepted', 'expired', 'cancelled'));

alter table workers
  add constraint workers_status_check
  check (status in ('invited', 'active', 'inactive'));

-- Permission helper. True when the caller has an active membership on the
-- project whose permissions include the given text value.
create or replace function public.has_permission(project uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from memberships m
    where m.person_id = public.current_person_id()
      and m.project_id = project
      and m.status = 'active'
      and perm = any (m.permissions)
  )
$$;

-- Scope helper, matching src/domain/readScope.ts: an empty scope array is
-- unrestricted; a non-empty array is a filter. A unit in the array covers its
-- descendant units.
create or replace function public.in_scope(project uuid, unit uuid, stage uuid, trade uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from memberships m
    where m.person_id = public.current_person_id()
      and m.project_id = project
      and m.status = 'active'
      and (
        coalesce(jsonb_array_length(m.scope -> 'projectUnitIds'), 0) = 0
        or exists (
          with recursive chain as (
            select u.id, u.parent_id
            from project_units u
            where u.id = in_scope.unit
            union all
            select p.id, p.parent_id
            from project_units p
            join chain c on p.id = c.parent_id
          )
          select 1
          from chain c
          where c.id::text in (select jsonb_array_elements_text(m.scope -> 'projectUnitIds'))
        )
      )
      and (
        coalesce(jsonb_array_length(m.scope -> 'stageIds'), 0) = 0
        or in_scope.stage::text in (select jsonb_array_elements_text(m.scope -> 'stageIds'))
      )
      and (
        coalesce(jsonb_array_length(m.scope -> 'tradeIds'), 0) = 0
        or in_scope.trade::text in (select jsonb_array_elements_text(m.scope -> 'tradeIds'))
      )
  )
$$;
