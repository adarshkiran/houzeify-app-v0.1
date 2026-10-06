-- Daily progress. A correction is a new row: version + 1, supersedes_id set
-- to the old row. The old row is only ever linked to its successor
-- (superseded_by_id) and its review and publication status may move; its
-- content is frozen once it has a successor.
create table daily_progress (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  project_unit_id uuid not null references project_units (id) on delete cascade,
  task_id uuid references tasks (id) on delete set null,
  stage_id uuid not null references stages (id) on delete cascade,
  trade_id uuid not null references trades (id) on delete cascade,
  work_type_id uuid not null references work_types (id) on delete cascade,
  date date not null,
  workers_present integer not null default 0,
  planned_quantity numeric,
  planned_quantity_unit text,
  completed_quantity numeric,
  completed_quantity_unit text,
  progress_before numeric,
  progress_after numeric,
  yesterday_summary text,
  today_summary text not null,
  tomorrow_plan text not null,
  blocker_summary text,
  submitted_by_membership_id uuid not null references memberships (id) on delete restrict,
  submitted_at timestamptz not null default now(),
  review_status text not null default 'submitted',
  publication_status text not null default 'private',
  version integer not null default 1,
  supersedes_id uuid unique references daily_progress (id) on delete restrict,
  superseded_by_id uuid unique references daily_progress (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint daily_progress_version_check check (version >= 1),
  constraint daily_progress_review_status_check
    check (review_status in ('draft', 'submitted', 'approved', 'changes-requested', 'rejected', 'superseded')),
  constraint daily_progress_publication_status_check
    check (publication_status in ('private', 'published'))
);

create table progress_reviews (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  daily_progress_id uuid not null references daily_progress (id) on delete cascade,
  decision text not null,
  note text,
  reviewer_membership_id uuid not null references memberships (id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  constraint progress_reviews_decision_check check (decision in ('approve', 'request-changes', 'reject'))
);

create table progress_publications (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  daily_progress_id uuid not null references daily_progress (id) on delete cascade,
  published_by_membership_id uuid not null references memberships (id) on delete restrict,
  published_at timestamptz not null default now()
);

create table evidence (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  project_unit_id uuid references project_units (id) on delete set null,
  task_id uuid references tasks (id) on delete set null,
  daily_progress_id uuid references daily_progress (id) on delete set null,
  type text not null,
  url text not null,
  thumbnail_url text,
  caption text,
  captured_by_membership_id uuid references memberships (id) on delete set null,
  captured_by_worker_id uuid references workers (id) on delete set null,
  captured_at timestamptz not null default now(),
  customer_visibility text not null default 'private',
  constraint evidence_type_check check (type in ('photo', 'video', 'audio', 'document')),
  constraint evidence_customer_visibility_check
    check (customer_visibility in ('private', 'review-required', 'customer-visible'))
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  category text not null,
  url text not null,
  uploaded_by_membership_id uuid references memberships (id) on delete set null,
  shared_with_homeowner boolean not null default false,
  created_at timestamptz not null default now(),
  constraint documents_category_check check (category in ('approval', 'contract', 'drawing', 'other'))
);

create table issues (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  project_unit_id uuid references project_units (id) on delete set null,
  stage_id uuid references stages (id) on delete set null,
  trade_id uuid references trades (id) on delete set null,
  task_id uuid references tasks (id) on delete set null,
  daily_progress_id uuid references daily_progress (id) on delete set null,
  title text not null,
  description text not null default '',
  severity text not null default 'medium',
  status text not null default 'open',
  assigned_membership_id uuid references memberships (id) on delete set null,
  customer_visible boolean not null default false,
  created_by_membership_id uuid not null references memberships (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  closed_at timestamptz,
  constraint issues_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint issues_status_check check (status in ('open', 'in-progress', 'resolved', 'closed'))
);

create table threads (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid not null references projects (id) on delete cascade,
  subject text not null,
  target_id uuid,
  audience text not null,
  participant_membership_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  constraint threads_subject_check
    check (subject in ('project', 'unit', 'task', 'issue', 'homeowner', 'direct')),
  constraint threads_audience_check check (audience in ('internal', 'homeowner'))
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  thread_id uuid not null references threads (id) on delete cascade,
  author_membership_id uuid not null references memberships (id) on delete restrict,
  body text,
  voice_url text,
  voice_duration_sec integer,
  voice_transcript text,
  created_at timestamptz not null default now()
);

create table thread_reads (
  thread_id uuid not null references threads (id) on delete cascade,
  membership_id uuid not null references memberships (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, membership_id)
);

create table call_logs (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  thread_id uuid not null references threads (id) on delete cascade,
  logged_by_membership_id uuid not null references memberships (id) on delete restrict,
  other_membership_id uuid references memberships (id) on delete set null,
  type text not null,
  started_at timestamptz not null default now(),
  duration_minutes integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  constraint call_logs_type_check check (type in ('voice', 'video'))
);

-- A correction must be the next version of the row it supersedes.
create or replace function public.daily_progress_check_version()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  previous_version integer;
begin
  if new.supersedes_id is not null then
    select version into previous_version from daily_progress where id = new.supersedes_id;
    if new.version is distinct from previous_version + 1 then
      raise exception 'a correction must be version + 1 of the version it supersedes';
    end if;
  end if;
  return new;
end;
$$;

create trigger daily_progress_version_guard
  before insert on daily_progress
  for each row execute function public.daily_progress_check_version();

-- Content of a daily progress version is frozen. Only its successor link,
-- review status and publication status may change, and only while it has
-- no successor yet.
create or replace function public.daily_progress_freeze()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.superseded_by_id is not null then
    raise exception 'daily progress content is immutable; correct it with a new version';
  end if;
  if (to_jsonb(old) - array['superseded_by_id', 'review_status', 'publication_status'])
     is distinct from (to_jsonb(new) - array['superseded_by_id', 'review_status', 'publication_status']) then
    raise exception 'daily progress content is immutable; correct it with a new version';
  end if;
  return new;
end;
$$;

create trigger daily_progress_freeze_guard
  before update on daily_progress
  for each row execute function public.daily_progress_freeze();
