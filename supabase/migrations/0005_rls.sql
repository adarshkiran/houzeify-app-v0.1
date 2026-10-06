-- Row-level security. Every table is enabled; policies implement the spec §3
-- permission matrix. Writes governed by a B4 rule (unlocks, proposals, credits,
-- onboarding, attendance, progress review and publication, worker end) have no
-- direct insert, update or delete policy: the functions in later migrations
-- perform them as security definer.

-- Helpers. All are security definer so policies never recurse through RLS on
-- memberships or other policed tables.

-- Any active membership on the project that is not a homeowner (workers included).
create or replace function public.is_staff(pid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.project_id = pid and m.status = 'active' and m.role <> 'homeowner'
  )
$$;

-- Supervisor-level staff: not a worker and not a homeowner.
create or replace function public.is_supervisor(pid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.project_id = pid and m.status = 'active' and m.role not in ('worker', 'homeowner')
  )
$$;

-- Active homeowner membership on the project.
create or replace function public.is_homeowner_of(pid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.project_id = pid and m.status = 'active' and m.role = 'homeowner'
  )
$$;

create or replace function public.is_own_membership(mid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.id = mid and m.person_id = public.current_person_id() and m.status = 'active'
  )
$$;

create or replace function public.is_own_participant(participants uuid[])
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.status = 'active' and m.id = any (participants)
  )
$$;

create or replace function public.is_own_worker(wid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from workers w
    where w.id = wid and w.user_id = public.current_person_id()
  )
$$;

create or replace function public.is_org_member(oid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.organization_id = oid and m.status = 'active'
  )
$$;

create or replace function public.has_org_permission(oid uuid, perm text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.person_id = public.current_person_id()
      and m.organization_id = oid and m.status = 'active' and perm = any (m.permissions)
  )
$$;

create or replace function public.task_in_scope(tid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from tasks t
    where t.id = tid
      and public.in_scope(t.project_id, t.project_unit_id, t.stage_id, t.trade_id)
  )
$$;

create or replace function public.daily_progress_reviewable(dpid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from daily_progress d
    where d.id = dpid
      and public.has_permission(d.project_id, 'progress.review')
      and public.in_scope(d.project_id, d.project_unit_id, d.stage_id, d.trade_id)
  )
$$;

create or replace function public.thread_visible(tid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from threads t
    where t.id = tid
      and public.is_own_participant(t.participant_membership_ids)
      and (
        (t.audience = 'internal' and public.is_staff(t.project_id)
          and public.has_permission(t.project_id, 'project.read'))
        or (t.audience = 'homeowner' and public.is_homeowner_of(t.project_id))
      )
  )
$$;

create or replace function public.owns_requirement(rid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from marketplace_requirements r
    where r.id = rid and r.homeowner_person_id = public.current_person_id()
  )
$$;

create or replace function public.partner_unlocked(rid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from marketplace_unlocks u
    where u.requirement_id = rid and public.is_org_member(u.partner_organization_id)
  )
$$;

-- Enable row-level security on every table.
alter table organizations enable row level security;
alter table people enable row level security;
alter table memberships enable row level security;
alter table workers enable row level security;
alter table worker_onboardings enable row level security;
alter table projects enable row level security;
alter table project_units enable row level security;
alter table stages enable row level security;
alter table trades enable row level security;
alter table work_types enable row level security;
alter table task_templates enable row level security;
alter table work_plan_items enable row level security;
alter table tasks enable row level security;
alter table task_assignments enable row level security;
alter table worker_project_assignments enable row level security;
alter table daily_progress enable row level security;
alter table progress_reviews enable row level security;
alter table progress_publications enable row level security;
alter table evidence enable row level security;
alter table documents enable row level security;
alter table issues enable row level security;
alter table threads enable row level security;
alter table messages enable row level security;
alter table thread_reads enable row level security;
alter table call_logs enable row level security;
alter table worker_attendance enable row level security;
alter table estimates enable row level security;
alter table marketplace_requirements enable row level security;
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table credit_wallets enable row level security;
alter table credit_transactions enable row level security;
alter table marketplace_unlocks enable row level security;
alter table proposals enable row level security;

-- Organizations, people, memberships, projects

create policy organizations_select_member on organizations
  for select using (public.is_org_member(id));

create policy people_select_self on people
  for select using (id = public.current_person_id());

create policy people_update_self on people
  for update using (id = public.current_person_id())
  with check (id = public.current_person_id());

create policy memberships_select_self_or_reader on memberships
  for select using (
    person_id = public.current_person_id()
    or (project_id is not null and public.has_permission(project_id, 'project.read'))
  );

create policy memberships_insert_manager on memberships
  for insert with check (project_id is not null and public.has_permission(project_id, 'project.manage'));

create policy memberships_update_manager on memberships
  for update using (project_id is not null and public.has_permission(project_id, 'project.manage'))
  with check (project_id is not null and public.has_permission(project_id, 'project.manage'));

create policy memberships_delete_manager on memberships
  for delete using (project_id is not null and public.has_permission(project_id, 'project.manage'));

create policy projects_select_reader on projects
  for select using (public.has_permission(id, 'project.read'));

create policy projects_update_manager on projects
  for update using (public.has_permission(id, 'project.manage'))
  with check (public.has_permission(id, 'project.manage'));

-- Project setup reference data: read by staff, written by project managers

create policy project_units_select_staff on project_units
  for select using (public.is_staff(project_id) and public.has_permission(project_id, 'project.read'));
create policy project_units_insert_manager on project_units
  for insert with check (public.has_permission(project_id, 'project.manage'));
create policy project_units_update_manager on project_units
  for update using (public.has_permission(project_id, 'project.manage'))
  with check (public.has_permission(project_id, 'project.manage'));
create policy project_units_delete_manager on project_units
  for delete using (public.has_permission(project_id, 'project.manage'));

create policy stages_select_staff on stages
  for select using (public.is_staff(project_id) and public.has_permission(project_id, 'project.read'));
create policy stages_insert_manager on stages
  for insert with check (public.has_permission(project_id, 'project.manage'));
create policy stages_update_manager on stages
  for update using (public.has_permission(project_id, 'project.manage'))
  with check (public.has_permission(project_id, 'project.manage'));
create policy stages_delete_manager on stages
  for delete using (public.has_permission(project_id, 'project.manage'));

create policy trades_select_staff on trades
  for select using (public.is_staff(project_id) and public.has_permission(project_id, 'project.read'));
create policy trades_insert_manager on trades
  for insert with check (public.has_permission(project_id, 'project.manage'));
create policy trades_update_manager on trades
  for update using (public.has_permission(project_id, 'project.manage'))
  with check (public.has_permission(project_id, 'project.manage'));
create policy trades_delete_manager on trades
  for delete using (public.has_permission(project_id, 'project.manage'));

create policy work_types_select_staff on work_types
  for select using (public.is_staff(project_id) and public.has_permission(project_id, 'project.read'));
create policy work_types_insert_manager on work_types
  for insert with check (public.has_permission(project_id, 'project.manage'));
create policy work_types_update_manager on work_types
  for update using (public.has_permission(project_id, 'project.manage'))
  with check (public.has_permission(project_id, 'project.manage'));
create policy work_types_delete_manager on work_types
  for delete using (public.has_permission(project_id, 'project.manage'));

create policy task_templates_select_staff on task_templates
  for select using (public.is_staff(project_id) and public.has_permission(project_id, 'project.read'));
create policy task_templates_insert_manager on task_templates
  for insert with check (public.has_permission(project_id, 'project.manage'));
create policy task_templates_update_manager on task_templates
  for update using (public.has_permission(project_id, 'project.manage'))
  with check (public.has_permission(project_id, 'project.manage'));
create policy task_templates_delete_manager on task_templates
  for delete using (public.has_permission(project_id, 'project.manage'));

-- Work plan and tasks: scoped read; task.manage within scope for writes

create policy work_plan_items_select_scoped on work_plan_items
  for select using (
    public.is_staff(project_id) and public.has_permission(project_id, 'project.read')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
  );
create policy work_plan_items_insert_task_manager on work_plan_items
  for insert with check (
    public.has_permission(project_id, 'task.manage')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
  );
create policy work_plan_items_update_task_manager on work_plan_items
  for update using (
    public.has_permission(project_id, 'task.manage')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
  ) with check (
    public.has_permission(project_id, 'task.manage')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
  );
create policy work_plan_items_delete_task_manager on work_plan_items
  for delete using (
    public.has_permission(project_id, 'task.manage')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
  );

create policy tasks_select_scoped on tasks
  for select using (
    public.is_staff(project_id) and public.has_permission(project_id, 'project.read')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
  );
create policy tasks_insert_task_manager on tasks
  for insert with check (
    public.has_permission(project_id, 'task.manage')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
  );
create policy tasks_update_task_manager on tasks
  for update using (
    public.has_permission(project_id, 'task.manage')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
  ) with check (
    public.has_permission(project_id, 'task.manage')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
  );
create policy tasks_delete_task_manager on tasks
  for delete using (
    public.has_permission(project_id, 'task.manage')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
  );

create policy task_assignments_select_scoped_or_own on task_assignments
  for select using (
    (public.is_staff(project_id) and public.has_permission(project_id, 'project.read') and public.task_in_scope(task_id))
    or public.is_own_worker(worker_id)
  );
create policy task_assignments_insert_task_manager on task_assignments
  for insert with check (public.has_permission(project_id, 'task.manage') and public.task_in_scope(task_id));
create policy task_assignments_update_task_manager on task_assignments
  for update using (public.has_permission(project_id, 'task.manage') and public.task_in_scope(task_id))
  with check (public.has_permission(project_id, 'task.manage') and public.task_in_scope(task_id));
create policy task_assignments_delete_task_manager on task_assignments
  for delete using (public.has_permission(project_id, 'task.manage') and public.task_in_scope(task_id));

-- Workforce: a worker reads only their own rows; workforce.manage reads the organization's workers

create policy workers_select_own_or_manager on workers
  for select using (public.is_own_worker(id) or public.has_org_permission(organization_id, 'workforce.manage'));
create policy workers_insert_workforce_manager on workers
  for insert with check (public.has_org_permission(organization_id, 'workforce.manage'));

create policy worker_onboardings_select_workforce_manager on worker_onboardings
  for select using (public.has_org_permission(organization_id, 'workforce.manage'));

create policy worker_project_assignments_select_own_or_supervisor on worker_project_assignments
  for select using (
    public.is_own_worker(worker_id)
    or (public.is_supervisor(project_id) and public.has_permission(project_id, 'project.read'))
  );
create policy worker_project_assignments_insert_workforce_manager on worker_project_assignments
  for insert with check (public.has_permission(project_id, 'workforce.manage'));

-- Daily progress: submitters write drafts; homeowners read only the published version

create policy daily_progress_select_scoped_or_homeowner on daily_progress
  for select using (
    (
      public.is_staff(project_id) and public.has_permission(project_id, 'project.read')
      and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
    )
    or (
      public.is_homeowner_of(project_id)
      and publication_status = 'published' and superseded_by_id is null
    )
  );
create policy daily_progress_insert_submitter on daily_progress
  for insert with check (
    public.has_permission(project_id, 'progress.submit')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
    and public.is_own_membership(submitted_by_membership_id)
  );
create policy daily_progress_update_own_draft on daily_progress
  for update using (
    public.is_own_membership(submitted_by_membership_id)
    and review_status = 'draft' and publication_status = 'private'
  ) with check (
    public.is_own_membership(submitted_by_membership_id)
    and review_status = 'draft' and publication_status = 'private'
  );

-- Review notes and publication records are internal; homeowners never read them

create policy progress_reviews_select_reviewer on progress_reviews
  for select using (public.daily_progress_reviewable(daily_progress_id));

create policy progress_publications_select_reviewer on progress_publications
  for select using (public.daily_progress_reviewable(daily_progress_id));

-- Evidence and documents: internal read by scope; homeowners read only what is shared

create policy evidence_select_scoped_or_homeowner on evidence
  for select using (
    (
      public.is_staff(project_id) and public.has_permission(project_id, 'project.read')
      and public.in_scope(project_id, project_unit_id, null, null)
    )
    or (public.is_homeowner_of(project_id) and customer_visibility = 'customer-visible')
  );
create policy evidence_insert_capturer on evidence
  for insert with check (
    (public.has_permission(project_id, 'progress.submit') or public.has_permission(project_id, 'project.manage'))
    and public.in_scope(project_id, project_unit_id, null, null)
  );
create policy evidence_update_capturer on evidence
  for update using (
    (public.has_permission(project_id, 'progress.submit') or public.has_permission(project_id, 'project.manage'))
    and public.in_scope(project_id, project_unit_id, null, null)
  ) with check (
    (public.has_permission(project_id, 'progress.submit') or public.has_permission(project_id, 'project.manage'))
    and public.in_scope(project_id, project_unit_id, null, null)
  );

create policy documents_select_scoped_or_homeowner on documents
  for select using (
    (
      public.is_staff(project_id) and public.has_permission(project_id, 'project.read')
      and public.in_scope(project_id, null, null, null)
    )
    or (public.is_homeowner_of(project_id) and shared_with_homeowner)
  );
create policy documents_insert_manager on documents
  for insert with check (
    public.has_permission(project_id, 'progress.submit') or public.has_permission(project_id, 'project.manage')
  );
create policy documents_update_manager on documents
  for update using (
    public.has_permission(project_id, 'progress.submit') or public.has_permission(project_id, 'project.manage')
  ) with check (
    public.has_permission(project_id, 'progress.submit') or public.has_permission(project_id, 'project.manage')
  );

-- Issues: scoped internal read; homeowners read customer-visible issues only

create policy issues_select_scoped_or_homeowner on issues
  for select using (
    (
      public.is_staff(project_id) and public.has_permission(project_id, 'project.read')
      and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
    )
    or (public.is_homeowner_of(project_id) and customer_visible)
  );
create policy issues_insert_reporter on issues
  for insert with check (
    (public.has_permission(project_id, 'progress.submit') or public.has_permission(project_id, 'issue.manage'))
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
    and public.is_own_membership(created_by_membership_id)
  );
create policy issues_update_issue_manager on issues
  for update using (
    public.has_permission(project_id, 'issue.manage')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
  ) with check (
    public.has_permission(project_id, 'issue.manage')
    and public.in_scope(project_id, project_unit_id, stage_id, trade_id)
  );

-- Conversations: visible only to participants of the thread's audience

create policy threads_select_participant on threads
  for select using (public.thread_visible(id));
create policy threads_insert_participant on threads
  for insert with check (
    public.is_own_participant(participant_membership_ids)
    and (
      (audience = 'internal' and public.is_staff(project_id) and public.has_permission(project_id, 'project.read'))
      or (audience = 'homeowner' and public.is_homeowner_of(project_id))
    )
  );
create policy threads_update_participant on threads
  for update using (public.thread_visible(id)) with check (public.thread_visible(id));

create policy messages_select_participant on messages
  for select using (public.thread_visible(thread_id));
create policy messages_insert_author on messages
  for insert with check (public.is_own_membership(author_membership_id) and public.thread_visible(thread_id));

create policy thread_reads_select_own on thread_reads
  for select using (public.is_own_membership(membership_id));
create policy thread_reads_insert_own on thread_reads
  for insert with check (public.is_own_membership(membership_id) and public.thread_visible(thread_id));
create policy thread_reads_update_own on thread_reads
  for update using (public.is_own_membership(membership_id)) with check (public.is_own_membership(membership_id));

create policy call_logs_select_participant on call_logs
  for select using (public.thread_visible(thread_id));
create policy call_logs_insert_participant on call_logs
  for insert with check (public.is_own_membership(logged_by_membership_id) and public.thread_visible(thread_id));

-- Attendance: a worker reads only their own rows; supervisors read the project's rows

create policy worker_attendance_select_own_or_supervisor on worker_attendance
  for select using (
    public.is_own_worker(worker_id)
    or (public.is_supervisor(project_id) and public.has_permission(project_id, 'project.read'))
  );

-- Person-owned data and the marketplace

create policy estimates_select_owner on estimates
  for select using (homeowner_person_id = public.current_person_id());
create policy estimates_insert_owner on estimates
  for insert with check (homeowner_person_id = public.current_person_id());
create policy estimates_update_owner on estimates
  for update using (homeowner_person_id = public.current_person_id())
  with check (homeowner_person_id = public.current_person_id());

create policy marketplace_requirements_select_owner_or_unlocked on marketplace_requirements
  for select using (
    homeowner_person_id = public.current_person_id() or public.partner_unlocked(id)
  );
create policy marketplace_requirements_insert_owner on marketplace_requirements
  for insert with check (homeowner_person_id = public.current_person_id());
create policy marketplace_requirements_update_owner on marketplace_requirements
  for update using (homeowner_person_id = public.current_person_id())
  with check (homeowner_person_id = public.current_person_id());

-- Plans are the public catalog; subscriptions and credits belong to the organization.

create policy plans_select_authenticated on plans
  for select to authenticated using (true);

create policy subscriptions_select_member on subscriptions
  for select using (public.is_org_member(organization_id));

create policy credit_wallets_select_member on credit_wallets
  for select using (public.is_org_member(organization_id));

create policy credit_transactions_select_member on credit_transactions
  for select using (public.is_org_member(organization_id));

create policy marketplace_unlocks_select_partner_or_owner on marketplace_unlocks
  for select using (
    public.is_org_member(partner_organization_id) or public.owns_requirement(requirement_id)
  );

create policy proposals_select_partner_or_owner on proposals
  for select using (
    public.is_org_member(partner_organization_id) or public.owns_requirement(requirement_id)
  );

-- Guard: every public table must have row-level security enabled.
do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if missing is not null then
    raise exception 'row-level security is disabled on: %', missing;
  end if;
end $$;
