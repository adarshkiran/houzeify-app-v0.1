-- Marketplace and billing functions (spec B4), the partner preview view and the
-- helpers they share. Each function is security definer, reads the caller through
-- current_person_id(), performs every check before any write, and refuses with
-- P0001 and a message 'conflict:<text>' (state or plan) or 'permission:<text>'
-- (who may act). Message texts match src/domain/marketplaceCommands.ts and
-- src/domain/billingCommands.ts.

-- Organization kind, used by the unlock rule (contractor or builder only).
alter table organizations add column if not exists kind text;
alter table organizations
  add constraint organizations_kind_check
  check (kind is null or kind in ('developer', 'construction-company', 'builder', 'contractor', 'subcontractor'));

-- Organization-level membership only. Project-scoped memberships (homeowners,
-- workers, project staff) do not make a person a member of the organization.
create or replace function public.is_org_member(oid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.organization_id = oid and m.status = 'active' and m.project_id is null
  )
$$;

create or replace function public.is_business_member(oid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.organization_id = oid and m.status = 'active' and m.project_id is null
  )
$$;

-- Plan entitlements of the organization's active subscription.
create or replace function public.has_entitlement(organization_id uuid, key text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from subscriptions s
    join plans p on p.id = s.plan_id
    where s.organization_id = has_entitlement.organization_id
      and s.status = 'active'
      and has_entitlement.key = any (p.entitlements)
  )
$$;

-- City segment of a location, as in src/domain/marketplaceVisibility.ts cityOf:
-- split on commas, trim, drop empty parts; second-to-last part, or the only part.
create or replace function public.city_of(location text)
returns text language sql immutable set search_path = public
as $$
  select case
    when coalesce(array_length(x.parts, 1), 0) = 0 then ''
    when array_length(x.parts, 1) >= 2 then x.parts[array_length(x.parts, 1) - 1]
    else x.parts[1]
  end
  from (
    select array(
      select trim(p.part)
      from unnest(string_to_array(city_of.location, ',')) with ordinality as p(part, ord)
      where length(trim(p.part)) > 0
      order by p.ord
    ) as parts
  ) x
$$;

-- Area band shown before unlock: 500 sq ft steps, as areaBand() in the domain.
create or replace function public.area_band_of(area numeric)
returns text language sql immutable set search_path = public
as $$
  select to_char(floor(area / 500) * 500, 'FM999,999,990')
    || '–' || to_char(floor(area / 500) * 500 + 500, 'FM999,999,990') || ' sq ft'
$$;

-- Catalog estimate lines priced from the shared rate card (src/domain/rateCard.ts),
-- with the 5% contingency line. Returns a jsonb array of lines.
create or replace function public.catalog_estimate_lines(area numeric, level text)
returns jsonb language plpgsql stable set search_path = public
as $$
declare
  r_cement numeric;
  r_steel numeric;
  r_blocks numeric;
  r_mason numeric;
  r_helper numeric;
  r_finishing numeric;
  body jsonb;
  subtotal numeric;
  contingency numeric;
begin
  case level
    when 'basic' then
      r_cement := 350; r_steel := 62000; r_blocks := 60; r_mason := 850; r_helper := 550; r_finishing := 180;
    when 'standard' then
      r_cement := 380; r_steel := 70000; r_blocks := 70; r_mason := 950; r_helper := 600; r_finishing := 234;
    when 'premium' then
      r_cement := 420; r_steel := 78000; r_blocks := 85; r_mason := 1100; r_helper := 680; r_finishing := 320;
    else
      raise exception 'conflict:Choose a construction level before pricing.';
  end case;

  body := jsonb_build_array(
    jsonb_build_object('category', 'materials', 'item', 'Cement (OPC 53 Grade)',
      'quantity', greatest(1, round(0.93 * area)), 'unit', 'bags', 'rate', r_cement,
      'amount', greatest(1, round(0.93 * area)) * r_cement, 'confidence', 'medium'),
    jsonb_build_object('category', 'materials', 'item', 'TMT Steel (Fe 500)',
      'quantity', greatest(0.1, round(0.006 * area * 10) / 10), 'unit', 'MT', 'rate', r_steel,
      'amount', greatest(0.1, round(0.006 * area * 10) / 10) * r_steel, 'confidence', 'medium'),
    jsonb_build_object('category', 'materials', 'item', 'AAC Blocks',
      'quantity', greatest(1, round(3.6 * area)), 'unit', 'blocks', 'rate', r_blocks,
      'amount', greatest(1, round(3.6 * area)) * r_blocks, 'confidence', 'medium'),
    jsonb_build_object('category', 'labour', 'item', 'Mason (skilled)',
      'quantity', greatest(1, round(0.27 * area)), 'unit', 'days', 'rate', r_mason,
      'amount', greatest(1, round(0.27 * area)) * r_mason, 'confidence', 'medium'),
    jsonb_build_object('category', 'labour', 'item', 'Helper (unskilled)',
      'quantity', greatest(1, round(0.35 * area)), 'unit', 'days', 'rate', r_helper,
      'amount', greatest(1, round(0.35 * area)) * r_helper, 'confidence', 'medium'),
    jsonb_build_object('category', 'finishing', 'item', 'Finishing works (flooring, painting, fixtures)',
      'quantity', area, 'unit', 'sqft', 'rate', r_finishing, 'amount', area * r_finishing, 'confidence', 'medium')
  );

  select coalesce(sum((x.line ->> 'amount')::numeric), 0) into subtotal
  from jsonb_array_elements(body) as x(line);
  contingency := subtotal * 0.05;

  return body || jsonb_build_array(jsonb_build_object(
    'category', 'contingency', 'item', 'Contingency (5% policy buffer)',
    'quantity', 1, 'unit', 'lump sum', 'rate', contingency, 'amount', contingency, 'confidence', 'high'
  ));
end;
$$;

-- Partner preview. Partners (organization members) see posted requirements only,
-- as the preview columns: city, property type, area band and the estimate range
-- rounded outward to the lakh. Exact columns come only through unlock_requirement.
create or replace view public.marketplace_requirement_previews
with (security_barrier = true)
as
select
  r.id,
  public.city_of(r.location) as location,
  r.property_type,
  public.area_band_of(r.built_up_area_sqft) as area_band,
  floor(r.estimate_total_low / 100000) * 100000 as estimate_total_low,
  ceiling(r.estimate_total_high / 100000) * 100000 as estimate_total_high,
  r.status
from public.marketplace_requirements r
where r.status = 'posted'
  and exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.status = 'active' and m.project_id is null
  );

revoke all on public.marketplace_requirement_previews from anon;
grant select on public.marketplace_requirement_previews to authenticated;

-- unlock_requirement: a contractor or builder organization pays 10 credits once
-- per requirement. The unlock row links to the debit.
create or replace function public.unlock_requirement(requirement_id uuid, organization_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  req marketplace_requirements%rowtype;
  org_kind text;
  balance integer;
  new_balance integer;
  txn_id uuid;
  unlock_row marketplace_unlocks%rowtype;
begin
  if not public.has_entitlement(unlock_requirement.organization_id, 'marketplace.unlock') then
    raise exception 'conflict:Your plan doesn''t include marketplace unlocks. Upgrade to Contractor Starter.';
  end if;
  if not public.is_business_member(unlock_requirement.organization_id) then
    raise exception 'permission:Only this organization''s team can act for it.';
  end if;

  select o.kind into org_kind from organizations o where o.id = unlock_requirement.organization_id;
  if org_kind is null or org_kind not in ('contractor', 'builder') then
    raise exception 'conflict:Only contractor or builder organizations can unlock requirements.';
  end if;

  select r.* into req from marketplace_requirements r where r.id = unlock_requirement.requirement_id for update;
  if not found then
    raise exception 'conflict:That requirement no longer exists.';
  end if;
  if req.status <> 'posted' then
    raise exception 'conflict:This requirement is no longer open.';
  end if;
  if exists (
    select 1 from marketplace_unlocks u
    where u.requirement_id = unlock_requirement.requirement_id
      and u.partner_organization_id = unlock_requirement.organization_id
  ) then
    raise exception 'conflict:You have already unlocked this requirement.';
  end if;

  select w.balance into balance from credit_wallets w
  where w.organization_id = unlock_requirement.organization_id for update;
  balance := coalesce(balance, 0);
  if balance < 10 then
    raise exception 'conflict:You need 10 credits. You have %.', balance;
  end if;

  new_balance := balance - 10;
  update credit_wallets w set balance = new_balance
  where w.organization_id = unlock_requirement.organization_id;

  insert into credit_transactions (organization_id, kind, amount, balance_after, requirement_id)
  values (unlock_requirement.organization_id, 'unlock', -10, new_balance, unlock_requirement.requirement_id)
  returning id into txn_id;

  insert into marketplace_unlocks (requirement_id, partner_organization_id, credit_transaction_id)
  values (unlock_requirement.requirement_id, unlock_requirement.organization_id, txn_id)
  returning * into unlock_row;

  return to_jsonb(unlock_row);
end;
$$;

-- submit_proposal: an unlocking organization proposes once, priced from the rate card.
create or replace function public.submit_proposal(
  requirement_id uuid,
  organization_id uuid,
  assumptions text[],
  exclusions text[]
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  caller uuid := public.current_person_id();
  req marketplace_requirements%rowtype;
  lines jsonb;
  total numeric;
  proposal_row proposals%rowtype;
begin
  if not public.is_business_member(submit_proposal.organization_id) then
    raise exception 'permission:Only this organization''s team can act for it.';
  end if;
  if not public.has_entitlement(submit_proposal.organization_id, 'marketplace.propose') then
    raise exception 'conflict:Your plan doesn''t include submitting proposals. Upgrade to Contractor Starter.';
  end if;

  select r.* into req from marketplace_requirements r where r.id = submit_proposal.requirement_id for update;
  if not found then
    raise exception 'conflict:That requirement no longer exists.';
  end if;
  if req.status <> 'posted' then
    raise exception 'conflict:This requirement is no longer open.';
  end if;
  if not exists (
    select 1 from marketplace_unlocks u
    where u.requirement_id = submit_proposal.requirement_id
      and u.partner_organization_id = submit_proposal.organization_id
  ) then
    raise exception 'conflict:Unlock the requirement before submitting a proposal.';
  end if;
  if exists (
    select 1 from proposals p
    where p.requirement_id = submit_proposal.requirement_id
      and p.partner_organization_id = submit_proposal.organization_id
  ) then
    raise exception 'conflict:You have already submitted a proposal for this requirement.';
  end if;

  lines := public.catalog_estimate_lines(req.built_up_area_sqft, req.construction_level);
  select coalesce(sum((x.line ->> 'amount')::numeric), 0) into total
  from jsonb_array_elements(lines) as x(line);

  insert into proposals (requirement_id, partner_organization_id, submitted_by_person_id, lines, total, assumptions, exclusions)
  values (
    submit_proposal.requirement_id, submit_proposal.organization_id, caller, lines, total,
    coalesce(submit_proposal.assumptions, '{}'), coalesce(submit_proposal.exclusions, '{}')
  )
  returning * into proposal_row;

  return to_jsonb(proposal_row);
end;
$$;

-- select_proposal: the homeowner awards the requirement to one proposal, rejects
-- the rest, and creates the project with the homeowner and partner memberships.
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

  insert into projects (organization_id, name, status)
  values (prop.partner_organization_id, req.project_name, 'planning')
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
