-- Found while seeding demo data to exercise the daily progress flow live:
-- create_task (0015) takes a work_type_id parameter and validates it
-- (assert_work_type_matches) but the tasks table has no work_type_id column
-- to store it in, so the insert silently drops it. src/domain/models.ts's
-- Task.workTypeId is a required (non-optional) field, and
-- src/data/rows.ts's taskFromRow papered over the missing column with a
-- hardcoded "" rather than reading a real value. Every downstream consumer
-- of task.workTypeId was therefore broken for any Supabase-mode task,
-- including src/screens/DailyProgressSubmitScreen.tsx, which sends it
-- straight to submit_daily_progress's work_type_id uuid parameter --
-- failing with "invalid input syntax for type uuid: ''" for every task,
-- since daily_progress.work_type_id is NOT NULL. No pgTAP test caught this
-- because 0015's own tests check create_task's returned row shape, not a
-- round trip through taskFromRow's mapping.

alter table tasks add column work_type_id uuid references work_types (id) on delete set null;

create or replace function public.create_task(
  project_id uuid,
  project_unit_id uuid,
  stage_id uuid,
  trade_id uuid,
  work_type_id uuid,
  template_id uuid,
  title text,
  planned_quantity numeric,
  planned_quantity_unit text,
  source_thread_id uuid,
  source_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row tasks%rowtype;
begin
  if not (
    public.has_permission(create_task.project_id, 'task.manage')
    and public.in_scope(create_task.project_id, create_task.project_unit_id,
      create_task.stage_id, create_task.trade_id)
  ) then
    raise exception 'permission:Missing permission "task.manage" on project %', create_task.project_id;
  end if;

  perform public.assert_unit_in_project(create_task.project_id, create_task.project_unit_id);
  perform public.assert_work_type_matches(create_task.work_type_id, create_task.stage_id, create_task.trade_id);
  perform public.assert_source_message(create_task.project_id, create_task.source_thread_id, create_task.source_message_id);

  insert into tasks (
    project_id, work_plan_item_id, project_unit_id, stage_id, trade_id, work_type_id, title, status,
    planned_quantity, planned_quantity_unit, created_at
  ) values (
    create_task.project_id, create_task.template_id, create_task.project_unit_id, create_task.stage_id,
    create_task.trade_id, create_task.work_type_id, create_task.title, 'draft',
    create_task.planned_quantity, create_task.planned_quantity_unit, now()
  )
  returning * into result_row;

  update projects set progress = public.calculate_project_progress(create_task.project_id)
  where id = create_task.project_id;

  return to_jsonb(result_row);
end;
$$;
