-- Estimate and billing functions (final unwired batch, Task 26): generateEstimate,
-- confirmEstimate, postRequirement, purchaseCredits. Each function is security
-- definer, reads the caller through current_person_id(), performs every check
-- before any write, and refuses with P0001 and a message 'conflict:<text>'
-- (state or plan) or 'permission:<text>' (who may act). Message texts match
-- src/domain/estimateCommands.ts, src/domain/marketplaceCommands.ts (postRequirement)
-- and src/domain/billingCommands.ts (purchaseCredits) exactly.

-- generate_estimate: a homeowner prices a self-serve estimate from the shared
-- rate card. Reuses public.catalog_estimate_lines (migration 0006/0012) for the
-- line items rather than re-porting src/domain/rateCard.ts a second time.
create or replace function public.generate_estimate(
  project_name text,
  property_type text,
  location text,
  built_up_area_sqft integer,
  floors integer,
  construction_level text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  caller uuid := public.current_person_id();
  trimmed_name text := trim(coalesce(generate_estimate.project_name, ''));
  trimmed_location text := trim(coalesce(generate_estimate.location, ''));
  lines jsonb;
  total numeric;
  materials numeric;
  labour numeric;
  finishing numeric;
  contingency numeric;
  est estimates%rowtype;
begin
  if caller is null or exists (
    select 1 from memberships m
    where m.person_id = caller and m.status = 'active' and m.project_id is null
  ) then
    raise exception 'permission:Only homeowners can generate an estimate.';
  end if;

  if trimmed_name = '' then
    raise exception 'conflict:Give the project a name.';
  end if;
  if trimmed_location = '' then
    raise exception 'conflict:Add a location.';
  end if;
  if generate_estimate.built_up_area_sqft is null or generate_estimate.built_up_area_sqft <= 0 then
    raise exception 'conflict:Enter a built-up area greater than zero.';
  end if;
  if generate_estimate.floors is null or generate_estimate.floors < 1 then
    raise exception 'conflict:Enter at least 1 floor.';
  end if;

  lines := public.catalog_estimate_lines(generate_estimate.built_up_area_sqft, generate_estimate.construction_level);

  select coalesce(sum((x.line ->> 'amount')::numeric), 0) into total
  from jsonb_array_elements(lines) as x(line);
  select coalesce(sum((x.line ->> 'amount')::numeric), 0) into materials
  from jsonb_array_elements(lines) as x(line) where x.line ->> 'category' = 'materials';
  select coalesce(sum((x.line ->> 'amount')::numeric), 0) into labour
  from jsonb_array_elements(lines) as x(line) where x.line ->> 'category' = 'labour';
  select coalesce(sum((x.line ->> 'amount')::numeric), 0) into finishing
  from jsonb_array_elements(lines) as x(line) where x.line ->> 'category' = 'finishing';
  select coalesce(sum((x.line ->> 'amount')::numeric), 0) into contingency
  from jsonb_array_elements(lines) as x(line) where x.line ->> 'category' = 'contingency';

  insert into estimates (
    homeowner_person_id, project_name, property_type, location, built_up_area_sqft,
    floors, construction_level, total_low, total_high, breakdown, review_status
  ) values (
    caller, trimmed_name, generate_estimate.property_type, trimmed_location, generate_estimate.built_up_area_sqft,
    generate_estimate.floors, generate_estimate.construction_level, total * 0.92, total * 1.08,
    jsonb_build_object('materials', materials, 'labour', labour, 'finishing', finishing, 'contingency', contingency),
    'draft'
  )
  returning * into est;

  return to_jsonb(est);
end;
$$;

-- confirm_estimate: the owning homeowner marks a draft estimate reviewed.
-- Confirming twice is refused rather than accepted silently.
create or replace function public.confirm_estimate(estimate_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  caller uuid := public.current_person_id();
  est estimates%rowtype;
begin
  if caller is null or exists (
    select 1 from memberships m
    where m.person_id = caller and m.status = 'active' and m.project_id is null
  ) then
    raise exception 'permission:Only homeowners can confirm an estimate.';
  end if;

  select e.* into est from estimates e where e.id = confirm_estimate.estimate_id for update;
  if not found then
    raise exception 'conflict:That estimate no longer exists.';
  end if;
  if est.homeowner_person_id <> caller then
    raise exception 'conflict:You can only confirm your own estimate.';
  end if;
  if est.review_status = 'confirmed' then
    raise exception 'conflict:This estimate is already confirmed.';
  end if;

  update estimates e set review_status = 'confirmed' where e.id = est.id returning * into est;

  return to_jsonb(est);
end;
$$;

-- post_requirement: the owning homeowner posts a confirmed estimate as a
-- requirement. One requirement per estimate.
create or replace function public.post_requirement(estimate_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  caller uuid := public.current_person_id();
  est estimates%rowtype;
  req marketplace_requirements%rowtype;
begin
  if caller is null or exists (
    select 1 from memberships m
    where m.person_id = caller and m.status = 'active' and m.project_id is null
  ) then
    raise exception 'conflict:Only homeowners can post a requirement.';
  end if;

  select e.* into est from estimates e where e.id = post_requirement.estimate_id for update;
  if not found then
    raise exception 'conflict:That estimate no longer exists.';
  end if;
  if est.homeowner_person_id <> caller then
    raise exception 'conflict:You can only post your own estimate.';
  end if;
  if est.review_status <> 'confirmed' then
    raise exception 'conflict:Confirm the estimate before posting it.';
  end if;
  if exists (select 1 from marketplace_requirements r where r.estimate_id = est.id) then
    raise exception 'conflict:This estimate has already been posted.';
  end if;

  insert into marketplace_requirements (
    estimate_id, homeowner_person_id, project_name, location, built_up_area_sqft,
    construction_level, property_type, estimate_total_low, estimate_total_high, status, posted_at
  ) values (
    est.id, est.homeowner_person_id, est.project_name, est.location, est.built_up_area_sqft,
    est.construction_level, est.property_type, est.total_low, est.total_high, 'posted', now()
  )
  returning * into req;

  return to_jsonb(req);
end;
$$;

-- Shared wallet balance change + transaction insert. Mirrors the debit pattern
-- unlock_requirement (migration 0006) applies inline; purchase_credits reuses
-- this helper rather than duplicating that logic for a positive delta.
create or replace function public.apply_credit_wallet_delta(
  organization_id uuid,
  delta integer,
  kind text,
  requirement_id uuid default null
)
returns credit_transactions language plpgsql security definer set search_path = public
as $$
declare
  balance integer;
  new_balance integer;
  txn credit_transactions%rowtype;
begin
  select w.balance into balance from credit_wallets w
  where w.organization_id = apply_credit_wallet_delta.organization_id for update;
  balance := coalesce(balance, 0);
  new_balance := balance + apply_credit_wallet_delta.delta;
  if new_balance < 0 then
    raise exception 'conflict:You need % credits. You have %.', -apply_credit_wallet_delta.delta, balance;
  end if;

  if exists (select 1 from credit_wallets w where w.organization_id = apply_credit_wallet_delta.organization_id) then
    update credit_wallets w set balance = new_balance where w.organization_id = apply_credit_wallet_delta.organization_id;
  else
    insert into credit_wallets (organization_id, balance) values (apply_credit_wallet_delta.organization_id, new_balance);
  end if;

  insert into credit_transactions (organization_id, kind, amount, balance_after, requirement_id)
  values (apply_credit_wallet_delta.organization_id, apply_credit_wallet_delta.kind, apply_credit_wallet_delta.delta,
    new_balance, apply_credit_wallet_delta.requirement_id)
  returning * into txn;

  return txn;
end;
$$;

-- purchase_credits: simulated top-up, no money moves. Business accounts acting
-- for their own organization only, pack size restricted to 50/150/500.
create or replace function public.purchase_credits(organization_id uuid, credits integer)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  wallet credit_wallets%rowtype;
begin
  if not public.is_business_member(purchase_credits.organization_id) then
    raise exception 'conflict:Only this organization''s team can buy credits.';
  end if;
  if purchase_credits.credits is null or purchase_credits.credits not in (50, 150, 500) then
    raise exception 'conflict:Choose a 50, 150, or 500 credit pack.';
  end if;

  perform public.apply_credit_wallet_delta(purchase_credits.organization_id, purchase_credits.credits, 'purchase');

  select w.* into wallet from credit_wallets w where w.organization_id = purchase_credits.organization_id;
  return to_jsonb(wallet);
end;
$$;
