-- F2: projects lacks location and kind, so select_proposal could not persist what
-- src/domain/marketplaceCommands.ts selectProposal puts on the created project
-- (requirement.location verbatim, and a project kind derived from the
-- requirement's property type). Add the columns and make select_proposal set them.

alter table projects add column location text;
alter table projects add column kind text;

-- Mirrors src/domain/marketplaceCommands.ts projectKindForPropertyType exactly:
-- 'Apartment' -> apartment, 'Villa' -> villa-development, anything else -> individual-house.
create or replace function public.project_kind_for_property_type(property_type text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when property_type = 'Apartment' then 'apartment'
    when property_type = 'Villa' then 'villa-development'
    else 'individual-house'
  end
$$;

create or replace function public.select_proposal(proposal_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  caller uuid := public.current_person_id();
  prop proposals%rowtype;
  req marketplace_requirements%rowtype;
  new_project projects%rowtype;
begin
  select p.* into prop from proposals p where p.id = select_proposal.proposal_id;
  if not found then
    raise exception 'conflict:That proposal no longer exists.';
  end if;
  select r.* into req from marketplace_requirements r where r.id = prop.requirement_id for update;
  if not found then
    raise exception 'conflict:That requirement no longer exists.';
  end if;

  if caller is null or exists (
    select 1 from memberships m
    where m.person_id = caller and m.status = 'active' and m.project_id is null
  ) then
    raise exception 'permission:Only homeowners can select a proposal.';
  end if;
  if req.homeowner_person_id <> caller then
    raise exception 'permission:You can only select proposals for your own requirement.';
  end if;
  if req.status <> 'posted' then
    raise exception 'conflict:This requirement is no longer open.';
  end if;

  insert into projects (organization_id, name, status, location, kind)
  values (
    prop.partner_organization_id, req.project_name, 'planning',
    req.location, public.project_kind_for_property_type(req.property_type)
  )
  returning * into new_project;

  insert into memberships (person_id, organization_id, project_id, role, permissions, status)
  values
    (req.homeowner_person_id, prop.partner_organization_id, new_project.id, 'homeowner',
      array['project.read'], 'active'),
    (prop.submitted_by_person_id, prop.partner_organization_id, new_project.id, 'project-manager',
      array['project.read', 'project.manage', 'task.manage', 'progress.submit', 'progress.review',
        'customer.publish', 'workforce.manage', 'evidence.capture', 'issue.manage'], 'active');

  update proposals p set status = 'selected' where p.id = prop.id;
  update proposals p set status = 'rejected'
  where p.requirement_id = req.id and p.id <> prop.id;
  update marketplace_requirements r set status = 'awarded', awarded_proposal_id = prop.id
  where r.id = req.id;

  return to_jsonb(new_project);
end;
$$;
