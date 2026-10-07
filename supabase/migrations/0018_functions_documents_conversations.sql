-- Documents and conversations functions (spec B4), batch 25: publishDocument,
-- uploadDocument, postMessage, logCall, openDirectThread, markThreadRead,
-- markThreadUnread. Message texts and authorization match
-- src/domain/constructionCommands.ts (uploadDocument/publishDocument) and
-- src/domain/conversationCommands.ts (the rest) exactly. Thread readability
-- matches src/domain/conversations.ts (membershipCanRead/readerMembership).
--
-- All function parameters below are prefixed `arg_` even where it reads a
-- little redundant, because several of them collide by name with a column on
-- the table they touch (thread_id, project_id, target_id, body, title, url,
-- type, note, visible...). An unprefixed `thread_id` parameter, for example,
-- makes `insert into thread_reads (thread_id, ...) ... on conflict (thread_id, ...)`
-- raise "column reference thread_id is ambiguous" (42702), because the bare
-- identifier in the ON CONFLICT target list resolves against the plpgsql
-- parameter instead of the table column. Prefixing every parameter sidesteps
-- this everywhere rather than case-by-case.
--
-- ── Fixing thread_visible (migration 0005) ──────────────────────────────────────
-- 0005's thread_visible required public.is_own_participant(participant_membership_ids)
-- for EVERY thread, including 'project' / 'unit' / 'task' / 'issue' / 'homeowner'
-- subjects. But src/domain/conversationCommands.ts only ever populates
-- participant_membership_ids for 'direct' threads (see openDirectThread); every
-- other subject's thread has it empty ('{}'), so is_own_participant('{}') is
-- always false and no one could ever read those threads via RLS. This was latent
-- until now because no earlier batch read threads of those subjects through the
-- authenticated role (seed.sql's conversation fixtures are inserted by the
-- table owner, bypassing RLS). This migration redefines thread_visible to match
-- src/domain/conversations.ts's membershipCanRead/readerMembership instead:
-- direct threads gate on participant membership; 'homeowner' gates on role/
-- permission; 'project'/'unit'/'task'/'issue' gate on project.read + scope
-- (scope added here too -- 0005 never checked it for threads at all).

-- ── Resolving which membership (if any) may read/post in a thread ─────────────
-- Takes the thread's fields directly (not just its id) so postMessage can
-- authorize against a *candidate* thread before it is inserted -- matching
-- src/domain/conversationCommands.ts's postMessage, which builds the Thread
-- object in memory and authorizes against it before persisting anything.
create or replace function public.thread_reader_membership_for(
  arg_project_id uuid,
  arg_subject text,
  arg_target_id uuid,
  arg_participant_membership_ids uuid[]
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_unit uuid;
  target_stage uuid;
  target_trade uuid;
  mid uuid;
begin
  if arg_subject = 'homeowner' then
    select m.id into mid from memberships m
    where m.project_id = arg_project_id
      and m.person_id = public.current_person_id()
      and m.status = 'active'
      and (
        m.role = 'homeowner'
        or m.role in ('project-manager', 'developer-admin')
        or 'customer.publish' = any (m.permissions)
      )
    limit 1;
    return mid;
  end if;

  if arg_subject = 'direct' then
    select m.id into mid from memberships m
    where m.project_id = arg_project_id
      and m.person_id = public.current_person_id()
      and m.status = 'active'
      and m.role <> 'homeowner'
      and m.id = any (arg_participant_membership_ids)
    limit 1;
    return mid;
  end if;

  -- 'project' / 'unit' / 'task' / 'issue': staff only, project.read, in scope.
  if arg_subject = 'unit' then
    select u.id into target_unit from project_units u
    where u.id = arg_target_id and u.project_id = arg_project_id;
  elsif arg_subject = 'task' then
    select t.project_unit_id, t.stage_id, t.trade_id
      into target_unit, target_stage, target_trade
    from tasks t
    where t.id = arg_target_id and t.project_id = arg_project_id;
  elsif arg_subject = 'issue' then
    select i.project_unit_id, i.stage_id, i.trade_id
      into target_unit, target_stage, target_trade
    from issues i
    where i.id = arg_target_id and i.project_id = arg_project_id;
  end if;

  select m.id into mid from memberships m
  where m.project_id = arg_project_id
    and m.person_id = public.current_person_id()
    and m.status = 'active'
    and m.role <> 'homeowner'
    and 'project.read' = any (m.permissions)
    and (
      arg_subject = 'project'
      or public.in_scope(arg_project_id, target_unit, target_stage, target_trade)
    )
  limit 1;
  return mid;
end;
$$;

create or replace function public.thread_reader_membership(tid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.thread_reader_membership_for(t.project_id, t.subject, t.target_id, t.participant_membership_ids)
  from threads t
  where t.id = tid
$$;

-- Supersedes the 0005 definition (see header note above).
create or replace function public.thread_visible(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.thread_reader_membership(tid) is not null
$$;

-- ── Direct-message pairs (matches src/domain/conversations.ts DIRECT_PAIRS) ────
create or replace function public.can_message_directly(a text, b text)
returns boolean
language sql
immutable
as $$
  select (a, b) in (
    ('worker', 'supervisor'), ('supervisor', 'worker'),
    ('worker', 'contractor'), ('contractor', 'worker'),
    ('worker', 'project-manager'), ('project-manager', 'worker'),
    ('contractor', 'supervisor'), ('supervisor', 'contractor'),
    ('contractor', 'project-manager'), ('project-manager', 'contractor'),
    ('contractor', 'developer-admin'), ('developer-admin', 'contractor'),
    ('project-manager', 'supervisor'), ('supervisor', 'project-manager'),
    ('project-manager', 'developer-admin'), ('developer-admin', 'project-manager'),
    ('supervisor', 'developer-admin'), ('developer-admin', 'supervisor'),
    ('project-manager', 'project-manager'),
    ('supervisor', 'supervisor'),
    ('developer-admin', 'developer-admin')
  )
$$;

-- ── uploadDocument ───────────────────────────────────────────────────────────
create or replace function public.upload_document(arg_project_id uuid, arg_title text, arg_category text, arg_url text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uploader_mid uuid;
  trimmed_title text;
  row_result documents%rowtype;
begin
  if not public.has_permission(arg_project_id, 'evidence.capture') then
    raise exception 'permission:Missing permission "evidence.capture" on project %', arg_project_id;
  end if;

  select m.id into uploader_mid from memberships m
  where m.person_id = public.current_person_id()
    and m.project_id = arg_project_id
    and m.status = 'active'
    and 'evidence.capture' = any (m.permissions)
  limit 1;

  trimmed_title := nullif(trim(arg_title), '');
  if trimmed_title is null then
    raise exception 'conflict:Give the document a title.';
  end if;

  insert into documents (project_id, title, category, url, uploaded_by_membership_id, shared_with_homeowner, created_at)
  values (arg_project_id, trimmed_title, arg_category, arg_url, uploader_mid, false, now())
  returning * into row_result;

  return to_jsonb(row_result);
end;
$$;

-- ── publishDocument ──────────────────────────────────────────────────────────
create or replace function public.publish_document(arg_document_id uuid, arg_visible boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  doc documents%rowtype;
begin
  select * into doc from documents where id = arg_document_id;
  if not found then
    raise exception 'permission:Missing permission "customer.publish"';
  end if;

  if not public.has_permission(doc.project_id, 'customer.publish') then
    raise exception 'permission:Missing permission "customer.publish" on project %', doc.project_id;
  end if;

  if doc.shared_with_homeowner = arg_visible then
    return to_jsonb(doc);
  end if;

  update documents set shared_with_homeowner = arg_visible
  where id = arg_document_id
  returning * into doc;

  return to_jsonb(doc);
end;
$$;

-- ── postMessage ──────────────────────────────────────────────────────────────
-- Either arg_thread_id is given (post into an existing thread), or
-- arg_project_id + arg_subject (+ arg_target_id for unit/task/issue)
-- identify/create one -- matching PostMessageTarget's union in
-- src/domain/conversationCommands.ts.
create or replace function public.post_message(
  arg_thread_id uuid,
  arg_project_id uuid,
  arg_subject text,
  arg_target_id uuid,
  arg_body text,
  arg_voice_url text,
  arg_voice_duration_sec integer,
  arg_voice_transcript text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  th threads%rowtype;
  resolved_target_id uuid;
  author_mid uuid;
  trimmed_body text;
  row_result messages%rowtype;
  now_ts timestamptz := now();
begin
  if arg_thread_id is not null then
    select * into th from threads where id = arg_thread_id;
    if not found then
      raise exception 'permission:Missing permission "project.read"';
    end if;
  else
    if arg_subject in ('project', 'homeowner') then
      resolved_target_id := null;
    else
      if arg_target_id is null then
        raise exception 'A unit, task or issue conversation needs its target.';
      end if;
      resolved_target_id := arg_target_id;
    end if;

    select * into th from threads
    where threads.project_id = arg_project_id
      and threads.subject = arg_subject
      and threads.target_id is not distinct from resolved_target_id;
  end if;

  if th.id is null then
    -- Authorize against the candidate thread before it exists.
    author_mid := public.thread_reader_membership_for(
      arg_project_id, arg_subject, resolved_target_id, '{}'::uuid[]
    );
    if author_mid is null then
      raise exception 'permission:Missing permission "project.read" on project %', arg_project_id;
    end if;

    trimmed_body := nullif(trim(arg_body), '');
    if trimmed_body is null and arg_voice_url is null then
      raise exception 'conflict:Write a message or record a voice note.';
    end if;
    if trimmed_body is not null and length(trimmed_body) > 2000 then
      raise exception 'conflict:Messages can be up to 2,000 characters.';
    end if;

    insert into threads (project_id, subject, target_id, audience, created_at, last_message_at)
    values (
      arg_project_id, arg_subject, resolved_target_id,
      case when arg_subject = 'homeowner' then 'homeowner' else 'internal' end,
      now_ts, now_ts
    )
    returning * into th;
  else
    author_mid := public.thread_reader_membership(th.id);
    if author_mid is null then
      raise exception 'permission:Missing permission "project.read" on project %', th.project_id;
    end if;

    trimmed_body := nullif(trim(arg_body), '');
    if trimmed_body is null and arg_voice_url is null then
      raise exception 'conflict:Write a message or record a voice note.';
    end if;
    if trimmed_body is not null and length(trimmed_body) > 2000 then
      raise exception 'conflict:Messages can be up to 2,000 characters.';
    end if;

    update threads set last_message_at = now_ts where id = th.id;
  end if;

  insert into messages (thread_id, author_membership_id, body, voice_url, voice_duration_sec, voice_transcript, created_at)
  values (
    th.id, author_mid, trimmed_body, arg_voice_url, arg_voice_duration_sec,
    nullif(trim(arg_voice_transcript), ''), now_ts
  )
  returning * into row_result;

  insert into thread_reads (thread_id, membership_id, last_read_at)
  values (th.id, author_mid, now_ts)
  on conflict (thread_id, membership_id) do update set last_read_at = excluded.last_read_at;

  return to_jsonb(row_result);
end;
$$;

-- ── openDirectThread ─────────────────────────────────────────────────────────
-- Memberships in this schema are always person-principal (src/data/rows.ts
-- membershipFromRow hard-codes principalType: "person"), so the domain's
-- principalType==='person' check is always true here and is dropped; the
-- domain's self-messaging refusal (other.principalId === actor.personId) is
-- kept via "other_row.person_id <> my_person".
create or replace function public.open_direct_thread(arg_project_id uuid, arg_other_membership_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  my_person uuid := public.current_person_id();
  other_row memberships%rowtype;
  me_mid uuid;
  existing threads%rowtype;
  row_result threads%rowtype;
  pair uuid[];
begin
  if my_person is null or not exists (
    select 1 from memberships m
    where m.project_id = arg_project_id
      and m.status = 'active' and m.person_id = my_person
  ) then
    raise exception 'permission:Missing permission "project.read" on project %', arg_project_id;
  end if;

  select * into other_row from memberships
  where id = arg_other_membership_id
    and project_id = arg_project_id
    and status = 'active';
  if not found then
    raise exception 'Membership % is not active on %', arg_other_membership_id, arg_project_id;
  end if;

  if other_row.person_id <> my_person then
    select m.id into me_mid from memberships m
    where m.project_id = arg_project_id
      and m.status = 'active' and m.person_id = my_person
      and public.can_message_directly(m.role, other_row.role)
    limit 1;
  end if;

  if me_mid is null then
    raise exception 'conflict:You can''t message this person directly. Use the task or project conversation.';
  end if;

  pair := array[me_mid, other_row.id];

  select t.* into existing from threads t
  where t.subject = 'direct'
    and t.project_id = arg_project_id
    and array_length(t.participant_membership_ids, 1) = 2
    and t.participant_membership_ids @> pair
    and t.participant_membership_ids <@ pair;
  if found then
    return to_jsonb(existing);
  end if;

  insert into threads (project_id, subject, audience, participant_membership_ids, created_at)
  values (arg_project_id, 'direct', 'internal', pair, now())
  returning * into row_result;

  return to_jsonb(row_result);
end;
$$;

-- ── markThreadRead ───────────────────────────────────────────────────────────
create or replace function public.mark_thread_read(arg_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reader_mid uuid;
  th threads%rowtype;
begin
  select * into th from threads where id = arg_thread_id;
  if not found then
    raise exception 'permission:Missing permission "project.read"';
  end if;

  reader_mid := public.thread_reader_membership(th.id);
  if reader_mid is null then
    raise exception 'permission:Missing permission "project.read" on project %', th.project_id;
  end if;

  insert into thread_reads (thread_id, membership_id, last_read_at)
  values (th.id, reader_mid, now())
  on conflict (thread_id, membership_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

-- ── markThreadUnread ─────────────────────────────────────────────────────────
-- Moves the caller's own read marker to just before the latest message from
-- someone else; never touches another participant's thread_reads row.
create or replace function public.mark_thread_unread(arg_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reader_mid uuid;
  th threads%rowtype;
  latest_created_at timestamptz;
begin
  select * into th from threads where id = arg_thread_id;
  if not found then
    raise exception 'permission:Missing permission "project.read"';
  end if;

  reader_mid := public.thread_reader_membership(th.id);
  if reader_mid is null then
    raise exception 'permission:Missing permission "project.read" on project %', th.project_id;
  end if;

  select max(created_at) into latest_created_at
  from messages
  where messages.thread_id = th.id and author_membership_id <> reader_mid;

  if latest_created_at is null then
    raise exception 'conflict:There''s no message from someone else to mark unread.';
  end if;

  insert into thread_reads (thread_id, membership_id, last_read_at)
  values (th.id, reader_mid, latest_created_at - interval '1 millisecond')
  on conflict (thread_id, membership_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

-- ── logCall ──────────────────────────────────────────────────────────────────
create or replace function public.log_call(
  arg_thread_id uuid,
  arg_type text,
  arg_started_at timestamptz,
  arg_duration_minutes integer,
  arg_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  th threads%rowtype;
  me_mid uuid;
  other_mid uuid;
  row_result call_logs%rowtype;
begin
  select * into th from threads where id = arg_thread_id;
  if not found then
    raise exception 'permission:Missing permission "project.read"';
  end if;

  me_mid := public.thread_reader_membership(th.id);
  if me_mid is null then
    raise exception 'permission:Missing permission "project.read" on project %', th.project_id;
  end if;

  if th.subject <> 'direct' then
    raise exception 'Thread % is not a direct thread', th.id;
  end if;

  select x into other_mid from unnest(th.participant_membership_ids) as x where x <> me_mid limit 1;
  if other_mid is null then
    raise exception 'Direct thread % has no other participant', th.id;
  end if;

  if arg_duration_minutes is null or arg_duration_minutes < 0 then
    raise exception 'conflict:Enter how long the call lasted.';
  end if;

  if arg_started_at is null or arg_started_at > now() then
    raise exception 'conflict:That doesn''t look like a valid date, or it hasn''t happened yet.';
  end if;

  insert into call_logs (
    thread_id, logged_by_membership_id, other_membership_id, type, started_at, duration_minutes, note, created_at
  )
  values (
    th.id, me_mid, other_mid, arg_type, arg_started_at, arg_duration_minutes,
    nullif(trim(arg_note), ''), now()
  )
  returning * into row_result;

  return to_jsonb(row_result);
end;
$$;
