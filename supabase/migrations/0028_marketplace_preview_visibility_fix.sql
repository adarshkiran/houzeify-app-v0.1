-- Found live while exercising the marketplace unlock flow (after 0025/0026
-- fixed is_org_member/is_business_member): the Opportunities screen still
-- showed 0 requirements for Arjun even with a posted one in the seed and his
-- org correctly set up to unlock it. marketplace_requirement_previews (0006)
-- has its own INLINE copy of the same "project_id is null" bug 0025/0026
-- fixed elsewhere -- it does not call is_org_member or is_business_member at
-- all, so neither fix touched it. Nothing in seed data or any command ever
-- creates an org-level-only membership for a business user, so this view has
-- been showing zero rows to every real business user since it was written.
--
-- Fix: is_business_user() (0014) already encodes exactly the right bar for
-- "is the caller a business-side user, anywhere" (no project_id restriction,
-- role not worker/homeowner, no particular organization -- this is a general
-- browse feed, not scoped to one org). Use it instead of the duplicated,
-- broken inline check.

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
  and public.is_business_user();

revoke all on public.marketplace_requirement_previews from anon;
grant select on public.marketplace_requirement_previews to authenticated;
