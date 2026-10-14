-- F4 (progress.md: "worker update path missing in RLS (own contact fields)",
-- carried forward from Task 6's concern (c)): the workers table had no update
-- policy at all, so even a worker correcting their own name, phone or
-- languages was blocked outright, despite table-level update privileges.
-- Add a narrow path: a worker may update only their own name, phone and
-- languages. Everything else (organization_id, status, trade_ids, user_id...)
-- stays reachable only through the Task 7-12 functions and workforce.manage,
-- which this migration does not touch.

revoke update on public.workers from anon, authenticated;
grant update (name, phone, languages) on public.workers to authenticated;

create policy workers_update_own on workers
  for update using (public.is_own_worker(id))
  with check (public.is_own_worker(id));
