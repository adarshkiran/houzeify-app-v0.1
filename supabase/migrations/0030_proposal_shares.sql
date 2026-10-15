-- Proposal share links (docs/superpowers/specs/2026-10-15-proposal-share-link-design.md,
-- FR-025). A partner shares a submitted proposal through an unguessable link that
-- anyone can open read-only, without signing in. The token is generated here and
-- only its SHA-256 hash is stored; the raw token is returned once at creation.

create table proposal_shares (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references people (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index proposal_shares_proposal_idx on proposal_shares (proposal_id);

alter table proposal_shares enable row level security;

-- The contractor sees whether a link is active and when it expires. Nobody reads
-- the table anonymously: the public path is get_shared_proposal only.
create policy proposal_shares_select_partner on proposal_shares
  for select using (
    exists (
      select 1 from proposals p
      where p.id = proposal_shares.proposal_id
        and public.is_business_member(p.partner_organization_id)
    )
  );

create or replace function public.share_token_hash(token text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(share_token_hash.token, 'utf8')), 'hex')
$$;

-- create_proposal_share: staff of the proposing organization. Replaces any active
-- link, so a forwarded old link stops working.
create or replace function public.create_proposal_share(proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := public.current_person_id();
  prop proposals%rowtype;
  raw_token text;
  share_row proposal_shares%rowtype;
begin
  select p.* into prop from proposals p where p.id = create_proposal_share.proposal_id;
  if not found
     or caller is null
     or not public.is_business_member(prop.partner_organization_id) then
    raise exception 'permission:Only this organization''s team can act for it.';
  end if;
  if prop.status = 'rejected' then
    raise exception 'conflict:This proposal is no longer open, so it cannot be shared.';
  end if;

  update proposal_shares s
  set revoked_at = now()
  where s.proposal_id = prop.id and s.revoked_at is null;

  raw_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into proposal_shares (proposal_id, token_hash, created_by, expires_at)
  values (prop.id, public.share_token_hash(raw_token), caller, now() + interval '14 days')
  returning * into share_row;

  return jsonb_build_object(
    'id', share_row.id,
    'proposalId', share_row.proposal_id,
    'token', raw_token,
    'createdBy', share_row.created_by,
    'createdAt', share_row.created_at,
    'expiresAt', share_row.expires_at
  );
end;
$$;

create or replace function public.revoke_proposal_share(proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := public.current_person_id();
  prop proposals%rowtype;
  share_row proposal_shares%rowtype;
begin
  select p.* into prop from proposals p where p.id = revoke_proposal_share.proposal_id;
  if not found
     or caller is null
     or not public.is_business_member(prop.partner_organization_id) then
    raise exception 'permission:Only this organization''s team can act for it.';
  end if;

  update proposal_shares s
  set revoked_at = now()
  where s.proposal_id = prop.id and s.revoked_at is null and s.expires_at > now()
  returning * into share_row;
  if not found then
    raise exception 'conflict:There is no active link to revoke.';
  end if;

  return jsonb_build_object(
    'id', share_row.id,
    'proposalId', share_row.proposal_id,
    'createdBy', share_row.created_by,
    'createdAt', share_row.created_at,
    'expiresAt', share_row.expires_at,
    'revokedAt', share_row.revoked_at
  );
end;
$$;

-- get_shared_proposal: callable by anyone holding the token. Returns exactly the
-- fields intended for sharing, or null for an unknown, revoked or expired token
-- (the same answer in each case, so existence is not confirmed).
create or replace function public.get_shared_proposal(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  share_row proposal_shares%rowtype;
  prop proposals%rowtype;
  req marketplace_requirements%rowtype;
  partner_name text;
  shared_lines jsonb;
begin
  if get_shared_proposal.token is null or length(get_shared_proposal.token) < 16 then
    return null;
  end if;

  select s.* into share_row
  from proposal_shares s
  where s.token_hash = public.share_token_hash(get_shared_proposal.token)
    and s.revoked_at is null
    and s.expires_at > now();
  if not found then
    return null;
  end if;

  select p.* into prop from proposals p where p.id = share_row.proposal_id;
  select r.* into req from marketplace_requirements r where r.id = prop.requirement_id;
  select o.name into partner_name from organizations o where o.id = prop.partner_organization_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'category', l.line ->> 'category',
    'item', l.line ->> 'item',
    'quantity', (l.line ->> 'quantity')::numeric,
    'unit', l.line ->> 'unit',
    'rate', (l.line ->> 'rate')::numeric,
    'amount', (l.line ->> 'amount')::numeric
  ) order by l.ord), '[]'::jsonb)
  into shared_lines
  from jsonb_array_elements(prop.lines) with ordinality as l(line, ord);

  return jsonb_build_object(
    'partnerName', partner_name,
    'location', public.city_of(req.location),
    'propertyType', req.property_type,
    'areaBand', public.area_band_of(req.built_up_area_sqft),
    'lines', shared_lines,
    'total', prop.total,
    'assumptions', to_jsonb(prop.assumptions),
    'exclusions', to_jsonb(prop.exclusions),
    'submittedAt', prop.submitted_at,
    'expiresAt', share_row.expires_at
  );
end;
$$;

revoke all on function public.get_shared_proposal(text) from public;
grant execute on function public.get_shared_proposal(text) to anon, authenticated;
