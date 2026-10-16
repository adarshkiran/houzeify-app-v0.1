-- LLM narrative metering (docs/superpowers/specs/2026-10-17-llm-narrative-design.md, §5).
-- Plan entitlements are boolean keys (text[]); numeric caps live in plans.limits.
-- Each use is a ticket row so a refund cannot be forged: only the person who
-- consumed a ticket can refund it, once. Ticket ids are never sent to clients.

alter table plans add column limits jsonb not null default '{}'::jsonb;
alter table plans add constraint plans_limits_object_check check (jsonb_typeof(limits) = 'object');

create table ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  person_id uuid not null references people (id) on delete restrict,
  kind text not null,
  period date not null,
  status text not null default 'consumed',
  created_at timestamptz not null default now(),
  refunded_at timestamptz,
  constraint ai_usage_events_kind_check check (kind in ('report', 'weekly-company')),
  constraint ai_usage_events_status_check check (status in ('consumed', 'refunded'))
);

create index ai_usage_events_org_period_idx on ai_usage_events (organization_id, period, status);

-- Written and read only by the security-definer functions below.
alter table ai_usage_events enable row level security;

-- The repo requires a policy on every public table (0005_rls.sql). This one
-- matches no row, so clients can neither read nor write usage rows.
create policy ai_usage_events_no_client_access on ai_usage_events
  for all to authenticated
  using (false) with check (false);

create or replace function public.consume_ai_narrative(project_id uuid, kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := public.current_person_id();
  org uuid;
  cap integer;
  used integer;
  this_period date := (date_trunc('month', now() at time zone 'Asia/Kolkata'))::date;
  ticket uuid;
begin
  if caller is null
     or not (
       public.has_permission(consume_ai_narrative.project_id, 'project.manage')
       and public.in_scope(consume_ai_narrative.project_id, null, null, null)
     ) then
    raise exception 'permission:Missing permission "project.manage" on project %', consume_ai_narrative.project_id;
  end if;

  if consume_ai_narrative.kind is null or consume_ai_narrative.kind not in ('report', 'weekly-company') then
    raise exception 'conflict:That summary could not be written.';
  end if;

  select p.organization_id into org from projects p where p.id = consume_ai_narrative.project_id;
  if org is null then
    raise exception 'conflict:That project no longer exists.';
  end if;

  if not public.has_entitlement(org, 'ai.narrative') then
    raise exception 'conflict:AI summaries are not included in your plan.';
  end if;

  -- Serialise concurrent uses for one organization so the cap cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended('ai_narrative:' || org::text, 0));

  select coalesce((pl.limits ->> 'ai_narratives_per_month')::integer, 0)
    into cap
  from subscriptions s
  join plans pl on pl.id = s.plan_id
  where s.organization_id = org and s.status = 'active'
  limit 1;

  select count(*)::integer into used
  from ai_usage_events e
  where e.organization_id = org and e.period = this_period and e.status = 'consumed';

  if used >= coalesce(cap, 0) then
    raise exception 'conflict:You have used all AI summaries for this month.';
  end if;

  insert into ai_usage_events (organization_id, project_id, person_id, kind, period)
  values (org, consume_ai_narrative.project_id, caller, consume_ai_narrative.kind, this_period)
  returning id into ticket;

  return ticket;
end;
$$;

-- Gives a unit back after a failed generation. Only the caller's own, still
-- consumed ticket qualifies; anything else is a quiet false.
create or replace function public.refund_ai_narrative(ticket uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update ai_usage_events e
  set status = 'refunded', refunded_at = now()
  where e.id = refund_ai_narrative.ticket
    and e.person_id = public.current_person_id()
    and e.status = 'consumed';
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke execute on function public.consume_ai_narrative(uuid, text) from public, anon;
revoke execute on function public.refund_ai_narrative(uuid) from public, anon;
grant execute on function public.consume_ai_narrative(uuid, text) to authenticated;
grant execute on function public.refund_ai_narrative(uuid) to authenticated;

-- approve_project_report, unchanged except that an embedded AI narrative must
-- be well formed: a claude:* engine, a SHA-256 facts hash and bounded text.
create or replace function public.approve_project_report(project_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := public.current_person_id();
  report_status text;
  report_as_of date;
  report_generated timestamptz;
  stored projects%rowtype;
  result_row project_reports%rowtype;
begin
  if caller is null
     or not (
       public.has_permission(approve_project_report.project_id, 'project.manage')
       and public.in_scope(approve_project_report.project_id, null, null, null)
     ) then
    raise exception 'permission:Missing permission "project.manage" on project %', approve_project_report.project_id;
  end if;

  select p.* into stored from projects p where p.id = approve_project_report.project_id;
  if not found then
    raise exception 'conflict:That project no longer exists.';
  end if;

  if jsonb_typeof(approve_project_report.payload) is distinct from 'object'
     or length(approve_project_report.payload::text) > 200000 then
    raise exception 'conflict:That report could not be saved.';
  end if;
  if approve_project_report.payload->>'projectId' is distinct from approve_project_report.project_id::text then
    raise exception 'conflict:That report belongs to a different project.';
  end if;
  if approve_project_report.payload->>'source' is distinct from 'ai'
     or approve_project_report.payload->>'createdBy' is distinct from 'ai'
     or approve_project_report.payload->>'engine' is distinct from 'rules-v1' then
    raise exception 'conflict:That report was not generated by Hozie.';
  end if;
  if approve_project_report.payload->>'reviewStatus' is distinct from 'draft' then
    raise exception 'conflict:This report is already approved.';
  end if;

  if approve_project_report.payload ? 'narrative' then
    if jsonb_typeof(approve_project_report.payload->'narrative') is distinct from 'object'
       or coalesce(approve_project_report.payload->'narrative'->>'engine', '') not like 'claude:%'
       or coalesce(approve_project_report.payload->'narrative'->>'factsHash', '') !~ '^[0-9a-f]{64}$'
       or length(coalesce(approve_project_report.payload->'narrative'->>'text', '')) not between 1 and 4000 then
      raise exception 'conflict:That report could not be saved.';
    end if;
  end if;

  report_status := approve_project_report.payload->>'status';
  if report_status is null or report_status not in ('on-track', 'at-risk', 'behind', 'not-enough-data') then
    raise exception 'conflict:That report could not be saved.';
  end if;

  begin
    report_as_of := (approve_project_report.payload->>'asOf')::date;
    report_generated := (approve_project_report.payload->>'generatedAt')::timestamptz;
  exception when others then
    raise exception 'conflict:That report could not be saved.';
  end;

  insert into project_reports (project_id, as_of, status, engine, payload, generated_at, approved_by, approved_at)
  values (
    approve_project_report.project_id,
    report_as_of,
    report_status,
    'rules-v1',
    approve_project_report.payload || jsonb_build_object(
      'reviewStatus', 'approved',
      'approvedBy', caller,
      'approvedAt', now()
    ),
    report_generated,
    caller,
    now()
  )
  returning * into result_row;

  return to_jsonb(result_row);
end;
$$;
