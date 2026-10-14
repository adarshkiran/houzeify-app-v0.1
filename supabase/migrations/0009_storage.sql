-- Supabase Storage: two private buckets and access policies (spec §6).
-- Object path: {organization_id}/{project_id}/{kind}/{id}, where kind is the bucket id
-- and id is the evidence or documents row. No public URLs: downloads use signed URLs
-- created only for rows the caller can read.
--
-- Reads reuse the row-level security on evidence and documents: the policy finds the
-- row by the path's id, project and organization, and that lookup is itself filtered by
-- the table's own policies (project.read and scope for staff, customer visibility for
-- homeowners). A row the caller cannot read is therefore not found, and the object is refused.
-- Path segments are compared as text, so a malformed path matches nothing instead of raising.

insert into storage.buckets (id, name, public) values
  ('evidence', 'evidence', false),
  ('documents', 'documents', false)
on conflict (id) do update set public = false;

drop policy if exists storage_evidence_select on storage.objects;
create policy storage_evidence_select on storage.objects
  for select to authenticated using (
    bucket_id = 'evidence'
    and array_length(string_to_array(name, '/'), 1) = 4
    and split_part(name, '/', 3) = 'evidence'
    and exists (
      select 1
      from public.evidence e
      join public.projects p on p.id = e.project_id
      where e.id::text = split_part(storage.objects.name, '/', 4)
        and e.project_id::text = split_part(storage.objects.name, '/', 2)
        and p.organization_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists storage_evidence_insert on storage.objects;
create policy storage_evidence_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'evidence'
    and array_length(string_to_array(name, '/'), 1) = 4
    and split_part(name, '/', 3) = 'evidence'
    and exists (
      select 1
      from public.projects p
      where p.id::text = split_part(storage.objects.name, '/', 2)
        and p.organization_id::text = split_part(storage.objects.name, '/', 1)
        and public.has_permission(p.id, 'progress.submit')
    )
  );

drop policy if exists storage_documents_select on storage.objects;
create policy storage_documents_select on storage.objects
  for select to authenticated using (
    bucket_id = 'documents'
    and array_length(string_to_array(name, '/'), 1) = 4
    and split_part(name, '/', 3) = 'documents'
    and exists (
      select 1
      from public.documents d
      join public.projects p on p.id = d.project_id
      where d.id::text = split_part(storage.objects.name, '/', 4)
        and d.project_id::text = split_part(storage.objects.name, '/', 2)
        and p.organization_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists storage_documents_insert on storage.objects;
create policy storage_documents_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'documents'
    and array_length(string_to_array(name, '/'), 1) = 4
    and split_part(name, '/', 3) = 'documents'
    and exists (
      select 1
      from public.projects p
      where p.id::text = split_part(storage.objects.name, '/', 2)
        and p.organization_id::text = split_part(storage.objects.name, '/', 1)
        and public.has_permission(p.id, 'project.manage')
    )
  );

-- No update or delete policy: objects are replaced or removed through a function, not directly.
