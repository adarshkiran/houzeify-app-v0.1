-- Project setup functions (spec B4), batch 21: createProject, updateOrganizationProfile,
-- addProjectUnit(s), setStageBaselines, addLibraryStage/Trade/WorkType. Message texts
-- match src/domain/constructionCommands.ts.
--
-- Two schema gaps are closed here because the feature cannot be represented at all
-- without them (not just a lost cosmetic field, as in earlier batches):
--  1. organizations gains city/phone/team_size (kind already exists, added in 0006).
--  2. stages/trades/work_types/task_templates become a *global library*, matching the
--     domain model exactly: project_id becomes nullable (a null row is a library entry,
--     shared by every project, exactly like src/domain/constructionCommands.ts
--     addLibraryStage/addLibraryTrade/addLibraryWorkType, which take no project or even
--     organization id — any business user can add to it). work_types also gains
--     stage_id/trade_id/default_unit, which this table never had before; without them
--     a work type cannot record what stage or trade it belongs to.
--
-- projects also gains stage_baselines (jsonb) and progress (int), which the schema
-- never stored (projectFromRow hard-coded them). Project progress is recalculated here
-- with the same stage-weight formula as src/domain/progress.ts calculateProjectProgress;
-- the weights are keyed by a new stages.code column (STAGE_WEIGHTS is keyed by a short
-- code such as 'RCC', which this schema never stored either -- stages.legacy_id is a
-- full id like 'stage-site-prep', not that code).

alter table organizations add column if not exists city text;
alter table organizations add column if not exists phone text;
alter table organizations add column if not exists team_size text;

alter table projects add column if not exists stage_baselines jsonb not null default '{}'::jsonb;
alter table projects add column if not exists progress integer not null default 0;
alter table projects add constraint projects_progress_check check (progress between 0 and 100);

alter table stages add column if not exists code text;
alter table stages alter column project_id drop not null;
alter table trades alter column project_id drop not null;
alter table work_types alter column project_id drop not null;
alter table work_types add column if not exists stage_id uuid references stages (id) on delete set null;
alter table work_types add column if not exists trade_id uuid references trades (id) on delete set null;
alter table work_types add column if not exists default_unit text not null default 'nos';
alter table task_templates alter column project_id drop not null;

-- Library rows (project_id is null) are a shared catalog, like plans: readable by
-- anyone signed in, the same way the per-project rows stay staff-and-scoped-only.
create policy stages_select_library on stages for select using (project_id is null);
create policy trades_select_library on trades for select using (project_id is null);
create policy work_types_select_library on work_types for select using (project_id is null);
create policy task_templates_select_library on task_templates for select using (project_id is null);

-- Any active membership in the organization, project-scoped or not, other than a
-- worker or homeowner. Used for createProject (src/domain/constructionCommands.ts
-- authorizeOrganization checks actor.organizationId match plus a business account;
-- this schema has no separate "account type", so a staff membership in the org stands
-- in for it).
create or replace function public.is_org_staff(oid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.organization_id = oid and m.status = 'active' and m.role not in ('worker', 'homeowner')
  )
$$;

-- Any active staff membership, anywhere, in any organization. Mirrors
-- authorizeOrganization(ctx, undefined, ...): the work library has no owning
-- organization in the domain model, so any business user may add to it.
create or replace function public.is_business_user()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.status = 'active' and m.role not in ('worker', 'homeowner')
  )
$$;

-- As src/domain/workLibrary.ts slugifyLibraryName: lowercase, non [a-z0-9] runs become
-- one hyphen, no leading or trailing hyphen.
create or replace function public.slugify_library_name(value text)
returns text language sql immutable set search_path = public
as $$
  select trim(both '-' from regexp_replace(lower(value), '[^a-z0-9]+', '-', 'g'))
$$;

-- Stage weight by code, as STAGE_WEIGHTS in src/domain/progress.ts. An unknown or
-- unset code weighs 0, same as the domain's `?? 0`.
create or replace function public.stage_weight(code text)
returns integer language sql immutable set search_path = public
as $$
  select case code
    when 'SITE' then 5
    when 'FND' then 12
    when 'RCC' then 25
    when 'MSN' then 12
    when 'PLS' then 10
    when 'WPF' then 5
    when 'SRV' then 13
    when 'FLR' then 8
    when 'FIN' then 10
    else 0
  end
$$;

-- taskPercent in src/domain/progress.ts: a tracked quantity wins when planned and the
-- units match; otherwise a task is 100% once approved or completed, else 0%.
create or replace function public.task_percent(
  planned_quantity numeric, planned_unit text, completed_quantity numeric, completed_unit text, status text
)
returns numeric language sql immutable set search_path = public
as $$
  select case
    when planned_quantity is not null and planned_quantity > 0 then
      case when completed_quantity is not null and completed_unit = planned_unit
        then least(100, greatest(0, (completed_quantity / planned_quantity) * 100))
        else 0
      end
    else
      case when status in ('approved', 'completed') then 100 else 0 end
  end
$$;

-- calculateProjectProgress in src/domain/progress.ts: task % -> stage % (baseline plus
-- the remainder times the average task %) -> fixed stage weights -> project %. Stages
-- with no weight (code not in stage_weight's list) contribute nothing, same as the
-- domain's `if (!weight) return sum`.
create or replace function public.calculate_project_progress(project_id uuid)
returns integer language plpgsql stable set search_path = public
as $$
declare
  baselines jsonb;
  total numeric := 0;
  stage record;
  weight integer;
  task_count integer;
  task_avg numeric;
  base numeric;
  percent numeric;
begin
  select p.stage_baselines into baselines from projects p where p.id = calculate_project_progress.project_id;
  if baselines is null then baselines := '{}'::jsonb; end if;

  for stage in select s.id, s.code from stages s where s.project_id = calculate_project_progress.project_id loop
    weight := public.stage_weight(stage.code);
    if weight = 0 then
      continue;
    end if;

    select count(*), coalesce(avg(public.task_percent(
        t.planned_quantity, t.planned_quantity_unit, t.completed_quantity, t.completed_quantity_unit, t.status)), 0)
      into task_count, task_avg
      from tasks t
      where t.project_id = calculate_project_progress.project_id
        and t.stage_id = stage.id
        and t.status <> 'cancelled';

    base := least(100, greatest(0, coalesce((baselines ->> stage.id::text)::numeric, 0)));
    if task_count = 0 then
      percent := base;
    else
      percent := base + (100 - base) * task_avg / 100;
    end if;
    total := total + (weight * percent) / 100;
  end loop;

  return round(least(100, greatest(0, total)));
end;
$$;

-- Fills the organization profile. Deliberately unauthorized, as
-- src/domain/constructionCommands.ts updateOrganizationProfile: business onboarding
-- fills the profile before the business user has any membership to be checked.
create or replace function public.update_organization_profile(
  organization_id uuid,
  name text,
  kind text,
  city text,
  phone text,
  team_size text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update organizations o
  set name = update_organization_profile.name,
      kind = update_organization_profile.kind,
      city = update_organization_profile.city,
      phone = update_organization_profile.phone,
      team_size = update_organization_profile.team_size
  where o.id = update_organization_profile.organization_id;
end;
$$;

-- Creates a project (project.manage on the organization), its root unit when the
-- project kind has one (only "individual-house", src/domain/projectSetup.ts
-- defaultRootUnitForKind), and a project-manager membership for the creator.
create or replace function public.create_project(
  organization_id uuid,
  name text,
  kind text,
  status text,
  location text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proj projects%rowtype;
  actor_id uuid := public.current_person_id();
begin
  if not public.is_org_staff(create_project.organization_id) then
    raise exception 'permission:Missing permission "project.manage"';
  end if;

  insert into projects (organization_id, name, status, location, kind, require_checkout, created_at)
  values (
    create_project.organization_id, create_project.name, create_project.status,
    create_project.location, create_project.kind, false, now()
  )
  returning * into proj;

  if create_project.kind = 'individual-house' then
    insert into project_units (project_id, parent_id, name, created_at)
    values (proj.id, null, 'Main House', now());
  end if;

  if actor_id is not null then
    insert into memberships (person_id, organization_id, project_id, role, permissions, scope, status)
    values (
      actor_id, create_project.organization_id, proj.id, 'project-manager',
      array['project.read', 'project.manage', 'task.manage', 'progress.submit', 'progress.review',
        'customer.publish', 'workforce.manage', 'evidence.capture', 'issue.manage'],
      '{"projectUnitIds": [], "stageIds": [], "tradeIds": []}'::jsonb, 'active'
    );
  end if;

  return to_jsonb(proj);
end;
$$;

-- Records stage-completion baselines (project.manage) and refreshes stored progress.
-- Every baseline's stage must belong to the project (IntegrityError in the domain,
-- a bug-level error here too -- not a conflict: this is a caller mistake, not a state
-- the UI can normally reach) and be 0-100 (ConflictError in the domain).
create or replace function public.set_stage_baselines(project_id uuid, baselines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proj projects%rowtype;
  entry record;
begin
  if not public.has_permission(set_stage_baselines.project_id, 'project.manage') then
    raise exception 'permission:Missing permission "project.manage" on project %', set_stage_baselines.project_id;
  end if;

  select p.* into proj from projects p where p.id = set_stage_baselines.project_id;
  if not found then
    raise exception 'Unknown project %', set_stage_baselines.project_id;
  end if;

  for entry in select e.k as key, e.v as val from jsonb_each_text(set_stage_baselines.baselines) as e(k, v) loop
    if not exists (select 1 from stages s where s.id = entry.key::uuid and s.project_id = set_stage_baselines.project_id) then
      raise exception 'Unknown stage %', entry.key;
    end if;
    if entry.val::numeric < 0 or entry.val::numeric > 100 then
      raise exception 'conflict:Stage baselines must be between 0 and 100.';
    end if;
  end loop;

  update projects p
  set stage_baselines = set_stage_baselines.baselines
  where p.id = set_stage_baselines.project_id;

  update projects p
  set progress = public.calculate_project_progress(set_stage_baselines.project_id)
  where p.id = set_stage_baselines.project_id
  returning p.* into proj;

  return to_jsonb(proj);
end;
$$;

-- Shared by add_library_stage and add_library_work_type's inline stage creation.
-- One row per slug: a repeat add with the same name returns the existing row (as the
-- domain's `if (existing) return { state, result: existing }`). Not callable by
-- clients directly -- the permission check lives in the public wrapper.
create or replace function public.add_library_stage_row(name text, code text)
returns stages
language plpgsql
security definer
set search_path = public
as $$
declare
  slug text;
  legacy text;
  result_row stages%rowtype;
begin
  slug := nullif(public.slugify_library_name(add_library_stage_row.name), '');
  if slug is null then
    slug := 'stage-' || substr(md5(gen_random_uuid()::text), 1, 8);
  end if;
  legacy := 'stage-' || slug;

  select s.* into result_row from stages s where s.legacy_id = legacy and s.project_id is null;
  if found then
    return result_row;
  end if;

  insert into stages (legacy_id, project_id, name, sort_order, code)
  values (
    legacy, null, btrim(add_library_stage_row.name),
    (select count(*)::int from stages where project_id is null) + 1,
    upper(coalesce(nullif(add_library_stage_row.code, ''), left(slug, 6)))
  )
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.add_library_stage_row(text, text) from public, anon, authenticated;

create or replace function public.add_library_trade_row(name text, code text)
returns trades
language plpgsql
security definer
set search_path = public
as $$
declare
  slug text;
  legacy text;
  result_row trades%rowtype;
begin
  slug := nullif(public.slugify_library_name(add_library_trade_row.name), '');
  if slug is null then
    slug := 'trade-' || substr(md5(gen_random_uuid()::text), 1, 8);
  end if;
  legacy := 'trade-' || slug;

  select t.* into result_row from trades t where t.legacy_id = legacy and t.project_id is null;
  if found then
    return result_row;
  end if;

  insert into trades (legacy_id, project_id, name)
  values (legacy, null, btrim(add_library_trade_row.name))
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.add_library_trade_row(text, text) from public, anon, authenticated;

create or replace function public.add_library_stage(name text, code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row stages%rowtype;
begin
  if not public.is_business_user() then
    raise exception 'permission:Missing permission "project.manage"';
  end if;
  result_row := public.add_library_stage_row(add_library_stage.name, add_library_stage.code);
  return to_jsonb(result_row);
end;
$$;

create or replace function public.add_library_trade(name text, code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row trades%rowtype;
begin
  if not public.is_business_user() then
    raise exception 'permission:Missing permission "project.manage"';
  end if;
  result_row := public.add_library_trade_row(add_library_trade.name, add_library_trade.code);
  return to_jsonb(result_row);
end;
$$;

-- Adds a work type to the library, optionally creating its stage and/or trade first
-- (src/domain/constructionCommands.ts addLibraryWorkType). An unknown stage or trade id
-- (passed directly, not created here) changes nothing, same as the domain's
-- "no partial library entries" rule.
create or replace function public.add_library_work_type(
  name text,
  stage_id uuid,
  trade_id uuid,
  new_stage_name text,
  new_trade_name text,
  default_unit text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  final_stage_id uuid;
  final_trade_id uuid;
  slug text;
  wt_legacy text;
  tmpl_legacy text;
  wt_row work_types%rowtype;
  tmpl_row task_templates%rowtype;
  new_stage stages%rowtype;
  new_trade trades%rowtype;
begin
  if not public.is_business_user() then
    raise exception 'permission:Missing permission "project.manage"';
  end if;

  final_stage_id := add_library_work_type.stage_id;
  if add_library_work_type.new_stage_name is not null and btrim(add_library_work_type.new_stage_name) <> '' then
    new_stage := public.add_library_stage_row(add_library_work_type.new_stage_name, null);
    final_stage_id := new_stage.id;
  end if;

  final_trade_id := add_library_work_type.trade_id;
  if add_library_work_type.new_trade_name is not null and btrim(add_library_work_type.new_trade_name) <> '' then
    new_trade := public.add_library_trade_row(add_library_work_type.new_trade_name, null);
    final_trade_id := new_trade.id;
  end if;

  if final_stage_id is null or final_trade_id is null then
    raise exception 'Stage and trade are required to add a work type';
  end if;

  -- An id passed straight through (no newStageName/newTradeName) must already be a
  -- library stage/trade; otherwise nothing is written (mirrors the domain's early return).
  if not exists (select 1 from stages where id = final_stage_id and project_id is null)
    or not exists (select 1 from trades where id = final_trade_id and project_id is null) then
    return jsonb_build_object(
      'workType', jsonb_build_object('id', null, 'stageId', final_stage_id, 'tradeId', final_trade_id,
        'name', btrim(add_library_work_type.name), 'skipped', true),
      'template', null
    );
  end if;

  slug := nullif(public.slugify_library_name(add_library_work_type.name), '');
  if slug is null then
    slug := 'work-' || substr(md5(gen_random_uuid()::text), 1, 8);
  end if;
  wt_legacy := 'work-' || slug;
  tmpl_legacy := 'template-' || slug;

  select * into wt_row from work_types where legacy_id = wt_legacy and project_id is null;
  if found then
    select * into tmpl_row from task_templates where work_type_id = wt_row.id and project_id is null limit 1;
    return jsonb_build_object('workType', to_jsonb(wt_row), 'template', to_jsonb(tmpl_row));
  end if;

  insert into work_types (legacy_id, project_id, name, stage_id, trade_id, default_unit)
  values (
    wt_legacy, null, btrim(add_library_work_type.name), final_stage_id, final_trade_id,
    coalesce(nullif(add_library_work_type.default_unit, ''), 'nos')
  )
  returning * into wt_row;

  insert into task_templates (legacy_id, project_id, work_type_id, name)
  values (tmpl_legacy, null, wt_row.id, btrim(add_library_work_type.name) || ' — Standard')
  returning * into tmpl_row;

  return jsonb_build_object('workType', to_jsonb(wt_row), 'template', to_jsonb(tmpl_row));
end;
$$;
