-- Task 31 / T2 (FINAL TS-LAYER REVIEW): addProjectUnit/addProjectUnits in
-- src/data/adapter.ts were the only direct table writes in the whole adapter
-- -- everything else routes through a security-definer rpc. The project_units
-- RLS policy (0005_rls.sql project_units_insert_manager) only checked
-- has_permission(project_id, 'project.manage'), ignoring the caller's
-- membership scope and never validating that parent_id belongs to the same
-- project_id at all. CONFIRMED LIVE: a project-manager with project.manage on
-- one project could insert a unit there whose parent_id names a unit from a
-- completely different project.
--
-- src/domain/constructionCommands.ts addProjectUnits calls, per unit:
--   authorizeProject(state, ctx, input.projectId, [Permissions.PROJECT_MANAGE], { projectUnitId: input.parentUnitId })
--   assertUnitInProject(state, input.projectId, input.parentUnitId)
-- i.e. the actor needs project.manage AND a scope that covers the parent unit
-- (a root unit, parentUnitId undefined, needs a whole-project/unrestricted
-- scope), and the parent unit, if given, must belong to the same project.
--
-- Fix: a new add_project_units(units jsonb) function (shaped as an array so
-- it covers both addProjectUnit and addProjectUnits with one rpc, matching
-- what the adapter already passes per unit -- projectId, parentId, name) that
-- checks has_permission, checks in_scope (mirrors scopeCovers/
-- authorizingMembership in src/domain/session.ts) and validates parent_id
-- against project_id, refusing a mismatch with a ConflictError-style message.
-- The direct-table RLS policies are hardened the same way: src/data/
-- adapter.ts no longer uses them, but they must not stay weaker than the
-- function that replaces them (same reasoning as 0023's R3 INSERT hardening).

create or replace function public.add_project_units(units jsonb)
returns setof project_units
language plpgsql
security definer
set search_path = public
as $$
declare
  unit jsonb;
  unit_project uuid;
  parent uuid;
  inserted project_units%rowtype;
begin
  for unit in select * from jsonb_array_elements(add_project_units.units)
  loop
    unit_project := (unit->>'projectId')::uuid;
    parent := nullif(unit->>'parentId', '')::uuid;

    if not public.has_permission(unit_project, 'project.manage') then
      raise exception 'permission:Missing permission "project.manage"';
    end if;

    if parent is not null and not exists (
      select 1 from project_units pu where pu.id = parent and pu.project_id = unit_project
    ) then
      raise exception 'conflict:Unit % does not belong to project %', parent, unit_project;
    end if;

    if not public.in_scope(unit_project, parent, null, null) then
      raise exception 'permission:Missing permission "project.manage"';
    end if;

    insert into project_units (project_id, parent_id, name)
    values (unit_project, parent, unit->>'name')
    returning * into inserted;

    return next inserted;
  end loop;
  return;
end;
$$;

-- Helper for the two policies below. A policy expression's bare column names
-- resolve against the row being checked, but project_units itself has a
-- parent_id column, so a correlated "where pu.id = parent_id" subquery against
-- the same table is ambiguous between the NEW row's parent_id and pu's own --
-- Postgres binds it to pu.parent_id, silently defeating the check. Naming the
-- arguments differently inside a function's own scope avoids that entirely.
create or replace function public.project_unit_parent_ok(unit_project_id uuid, candidate_parent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select candidate_parent_id is null or exists (
    select 1 from project_units pu
    where pu.id = candidate_parent_id and pu.project_id = unit_project_id
  )
$$;

-- Harden the direct-table policies to match: a raw insert/update must still
-- carry project.manage and in-scope standing, and parent_id, when given, must
-- belong to the same project_id as the row itself.
drop policy project_units_insert_manager on project_units;
create policy project_units_insert_manager on project_units
  for insert with check (
    public.has_permission(project_id, 'project.manage')
    and public.in_scope(project_id, parent_id, null, null)
    and public.project_unit_parent_ok(project_id, parent_id)
  );

drop policy project_units_update_manager on project_units;
create policy project_units_update_manager on project_units
  for update using (public.has_permission(project_id, 'project.manage'))
  with check (
    public.has_permission(project_id, 'project.manage')
    and public.in_scope(project_id, parent_id, null, null)
    and public.project_unit_parent_ok(project_id, parent_id)
  );
