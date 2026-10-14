begin;
select plan(15);

-- Fixtures are inserted as the table owner (bypasses RLS). Each check acts as one
-- authenticated user and records what it saw in rls_probe; assertions run after reset.
-- A write check records a row only when its insert succeeds.

create temp table rls_probe (name text primary key, n bigint);
grant all on rls_probe to authenticated;

insert into organizations (id, legacy_id, name) values
  ('20000000-0000-0000-0000-000000000001', 'st-org-a', 'Storage Org A'),
  ('20000000-0000-0000-0000-000000000002', 'st-org-b', 'Storage Org B');

insert into auth.users (id) values
  ('20000000-0000-0000-0000-000000000201'),
  ('20000000-0000-0000-0000-000000000202'),
  ('20000000-0000-0000-0000-000000000203'),
  ('20000000-0000-0000-0000-000000000204'),
  ('20000000-0000-0000-0000-000000000205');

insert into people (id, legacy_id, phone, full_name, auth_user_id) values
  ('20000000-0000-0000-0000-000000000101', 'st-p-worker', '+6598000701', 'Worker', '20000000-0000-0000-0000-000000000201'),
  ('20000000-0000-0000-0000-000000000102', 'st-p-home', '+6598000702', 'Homeowner', '20000000-0000-0000-0000-000000000202'),
  ('20000000-0000-0000-0000-000000000103', 'st-p-sup', '+6598000703', 'Supervisor', '20000000-0000-0000-0000-000000000203'),
  ('20000000-0000-0000-0000-000000000104', 'st-p-other', '+6598000704', 'Other Org User', '20000000-0000-0000-0000-000000000204'),
  ('20000000-0000-0000-0000-000000000105', 'st-p-mgr', '+6598000705', 'Manager', '20000000-0000-0000-0000-000000000205');

insert into projects (id, legacy_id, organization_id, name) values
  ('20000000-0000-0000-0000-000000000301', 'st-proj-1', '20000000-0000-0000-0000-000000000001', 'Storage Project'),
  ('20000000-0000-0000-0000-000000000302', 'st-proj-2', '20000000-0000-0000-0000-000000000002', 'Other Project');

insert into memberships (id, legacy_id, person_id, organization_id, project_id, role, permissions, scope) values
  ('20000000-0000-0000-0000-000000000501', 'st-m-worker', '20000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000301', 'worker', array['project.read'], '{}'::jsonb),
  ('20000000-0000-0000-0000-000000000502', 'st-m-home', '20000000-0000-0000-0000-000000000102', '20000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000301', 'homeowner', array['project.read'], '{}'::jsonb),
  ('20000000-0000-0000-0000-000000000503', 'st-m-sup', '20000000-0000-0000-0000-000000000103', '20000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000301', 'supervisor', array['project.read', 'progress.submit'], '{}'::jsonb),
  ('20000000-0000-0000-0000-000000000504', 'st-m-other', '20000000-0000-0000-0000-000000000104', '20000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000302', 'supervisor', array['project.read', 'progress.submit', 'project.manage'], '{}'::jsonb),
  ('20000000-0000-0000-0000-000000000505', 'st-m-mgr', '20000000-0000-0000-0000-000000000105', '20000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000301', 'supervisor', array['project.read', 'project.manage'], '{}'::jsonb);

-- Evidence: one customer-visible photo, one private photo
insert into evidence (id, legacy_id, project_id, type, url, customer_visibility, captured_by_membership_id) values
  ('20000000-0000-0000-0000-000000000d01', 'st-ev-pub', '20000000-0000-0000-0000-000000000301', 'photo', 'https://example.test/pub.jpg',
   'customer-visible', '20000000-0000-0000-0000-000000000503'),
  ('20000000-0000-0000-0000-000000000d02', 'st-ev-priv', '20000000-0000-0000-0000-000000000301', 'photo', 'https://example.test/priv.jpg',
   'private', '20000000-0000-0000-0000-000000000503');

-- Documents: one shared with the homeowner, one internal
insert into documents (id, legacy_id, project_id, title, category, url, shared_with_homeowner) values
  ('20000000-0000-0000-0000-000000000d03', 'st-doc-shared', '20000000-0000-0000-0000-000000000301', 'Approval', 'approval', 'https://example.test/a.pdf', true),
  ('20000000-0000-0000-0000-000000000d04', 'st-doc-internal', '20000000-0000-0000-0000-000000000301', 'Internal', 'other', 'https://example.test/i.pdf', false);

-- Storage objects at {organization_id}/{project_id}/{kind}/{id}
insert into storage.objects (bucket_id, name) values
  ('evidence', '20000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000301/evidence/20000000-0000-0000-0000-000000000d01'),
  ('evidence', '20000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000301/evidence/20000000-0000-0000-0000-000000000d02'),
  ('documents', '20000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000301/documents/20000000-0000-0000-0000-000000000d03'),
  ('documents', '20000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000301/documents/20000000-0000-0000-0000-000000000d04');

-- Reads as each user
set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-000000000201"}';
insert into rls_probe values ('worker_private', (select count(*) from storage.objects
  where bucket_id = 'evidence' and name like '%/20000000-0000-0000-0000-000000000d02'));
insert into rls_probe values ('worker_public', (select count(*) from storage.objects
  where bucket_id = 'evidence' and name like '%/20000000-0000-0000-0000-000000000d01'));
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-000000000202"}';
insert into rls_probe values ('home_public', (select count(*) from storage.objects
  where bucket_id = 'evidence' and name like '%/20000000-0000-0000-0000-000000000d01'));
insert into rls_probe values ('home_private', (select count(*) from storage.objects
  where bucket_id = 'evidence' and name like '%/20000000-0000-0000-0000-000000000d02'));
insert into rls_probe values ('home_shared_doc', (select count(*) from storage.objects
  where bucket_id = 'documents' and name like '%/20000000-0000-0000-0000-000000000d03'));
insert into rls_probe values ('home_internal_doc', (select count(*) from storage.objects
  where bucket_id = 'documents' and name like '%/20000000-0000-0000-0000-000000000d04'));
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-000000000204"}';
insert into rls_probe values ('outside_public', (select count(*) from storage.objects
  where bucket_id = 'evidence' and name like '%/20000000-0000-0000-0000-000000000d01'));
insert into rls_probe values ('outside_private', (select count(*) from storage.objects
  where bucket_id = 'evidence' and name like '%/20000000-0000-0000-0000-000000000d02'));
reset role;

-- A path with the right object id but another project segment is refused
set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-000000000201"}';
insert into rls_probe values ('worker_wrong_project', (select count(*) from storage.objects
  where bucket_id = 'evidence'
    and name = '20000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000302/evidence/20000000-0000-0000-0000-000000000d01'));
reset role;

-- Writes as each user: a refused insert raises and records nothing
set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-000000000203"}';
do $$
begin
  insert into storage.objects (bucket_id, name) values
    ('evidence', '20000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000301/evidence/20000000-0000-0000-0000-000000000e01');
  insert into rls_probe values ('sup_evidence_insert', 1);
exception when others then null;
end $$;
do $$
begin
  insert into storage.objects (bucket_id, name) values
    ('documents', '20000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000301/documents/20000000-0000-0000-0000-000000000e02');
  insert into rls_probe values ('sup_document_insert', 1);
exception when others then null;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-000000000201"}';
do $$
begin
  insert into storage.objects (bucket_id, name) values
    ('evidence', '20000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000301/evidence/20000000-0000-0000-0000-000000000e03');
  insert into rls_probe values ('worker_evidence_insert', 1);
exception when others then null;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-000000000205"}';
do $$
begin
  insert into storage.objects (bucket_id, name) values
    ('documents', '20000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000301/documents/20000000-0000-0000-0000-000000000e04');
  insert into rls_probe values ('mgr_document_insert', 1);
exception when others then null;
end $$;
reset role;

select is((select bool_and(public = false) from storage.buckets where id = 'evidence'), true, 'the evidence bucket exists and is not public');
select is((select bool_and(public = false) from storage.buckets where id = 'documents'), true, 'the documents bucket exists and is not public');
select is((select n from rls_probe where name = 'worker_private'), 1::bigint, 'a member with project.read reads an unpublished evidence object');
select is((select n from rls_probe where name = 'worker_public'), 1::bigint, 'a member with project.read reads a customer-visible evidence object');
select is((select n from rls_probe where name = 'home_public'), 1::bigint, 'a homeowner reads a customer-visible evidence object');
select is((select n from rls_probe where name = 'home_private'), 0::bigint, 'a homeowner cannot read an unpublished evidence object path');
select is((select n from rls_probe where name = 'home_shared_doc'), 1::bigint, 'a homeowner reads a document shared with them');
select is((select n from rls_probe where name = 'home_internal_doc'), 0::bigint, 'a homeowner cannot read an internal document');
select is((select n from rls_probe where name = 'outside_public'), 0::bigint, 'a user outside the organization cannot read a customer-visible evidence object');
select is((select n from rls_probe where name = 'outside_private'), 0::bigint, 'a user outside the organization cannot read an unpublished evidence object');
select is((select n from rls_probe where name = 'worker_wrong_project'), 0::bigint, 'an object path with another project segment is refused');
select is(coalesce((select n from rls_probe where name = 'sup_evidence_insert'), 0), 1::bigint, 'a supervisor with progress.submit can upload evidence');
select is(coalesce((select n from rls_probe where name = 'worker_evidence_insert'), 0), 0::bigint, 'a worker without progress.submit cannot upload evidence');
select is(coalesce((select n from rls_probe where name = 'sup_document_insert'), 0), 0::bigint, 'a supervisor without project.manage cannot upload documents');
select is(coalesce((select n from rls_probe where name = 'mgr_document_insert'), 0), 1::bigint, 'a manager with project.manage can upload documents');

select * from finish();
rollback;
