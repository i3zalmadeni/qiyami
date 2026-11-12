-- ============================================================================
-- قيمي: المرحلة 4 (الإنجاز والمواهب) والمرحلة 5 (المتابعة والدعم التربوي).
-- إضافي فقط على 0201: جداول ودوال بالبادئة qm_، ولا يعدّل أي جدول في النواة.
-- التحقق من الإنجازات حالياً لمدير النواة فقط، وسلسلة اعتماد أدق تُضبط لاحقاً دون تغيير البنية.
-- حالات الدعم حساسة: يديرها الموجه الطلابي، ويفتحها الوكيل أو الموجه، ولا يراها المعلم.
-- ============================================================================
alter table public.qm_settings add column if not exists support_retention_months int not null default 24 check (support_retention_months >= 1);

create table if not exists public.qm_achievement_categories (
  id uuid primary key default gen_random_uuid(), name_ar text not null, is_active boolean not null default true, sort_order int not null default 0);
create table if not exists public.qm_support_types (
  id uuid primary key default gen_random_uuid(), name_ar text not null, is_active boolean not null default true, sort_order int not null default 0);

insert into public.qm_achievement_categories (name_ar, sort_order)
select * from (values ('أكاديمي',1),('علمي وتقني',2),('ابتكاري',3),('ثقافي',4),('رياضي',5),('اجتماعي وتطوعي',6),('قيادي',7),('مسابقات وجوائز',8)) v(a,b)
where not exists (select 1 from public.qm_achievement_categories);
insert into public.qm_support_types (name_ar, sort_order)
select * from (values ('تعليمي',1),('سلوكي',2),('اجتماعي وتربوي',3),('الاندماج والمشاركة',4),('رعاية الموهبة والتميز',5)) v(a,b)
where not exists (select 1 from public.qm_support_types);

create table if not exists public.qm_achievements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id uuid not null references public.qm_achievement_categories(id),
  achieved_on date not null,
  description text,
  level text not null check (level in ('school','local','national','international')),
  organizer text,
  attachment_paths text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','verified','needs_info','rejected')),
  recorded_by uuid not null references public.staff_members(id),
  reviewed_by uuid references public.staff_members(id), reviewed_at timestamptz, review_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists qm_ach_status_idx on public.qm_achievements (status, achieved_on desc);
create table if not exists public.qm_achievement_students (
  achievement_id uuid not null references public.qm_achievements(id) on delete cascade,
  student_id uuid not null references public.students(id),
  year_id uuid references public.academic_years(id), grade_code text, section_id uuid references public.class_sections(id),
  contribution text,
  primary key (achievement_id, student_id)
);
create index if not exists qm_ach_stu_idx on public.qm_achievement_students (student_id);
create table if not exists public.qm_talents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  field text not null, name text not null, description text,
  noted_by uuid not null references public.staff_members(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists qm_talent_stu_idx on public.qm_talents (student_id);

create table if not exists public.qm_support_cases (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity unique,
  student_id uuid not null references public.students(id),
  year_id uuid references public.academic_years(id), grade_code text, section_id uuid references public.class_sections(id),
  type_id uuid not null references public.qm_support_types(id),
  need_description text not null, goal text,
  owner_id uuid references public.staff_members(id),
  source_incident_id uuid references public.qm_incidents(id),
  status text not null default 'new' check (status in ('new','active','closed')),
  started_on date not null default ((now() at time zone 'Asia/Riyadh')::date),
  next_follow_up date,
  result text, final_improvement int check (final_improvement between 1 and 5),
  opened_by uuid not null references public.staff_members(id),
  closed_by uuid references public.staff_members(id), closed_at timestamptz, retention_until date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists qm_sup_status_idx on public.qm_support_cases (status, next_follow_up);
create index if not exists qm_sup_stu_idx on public.qm_support_cases (student_id);
create table if not exists public.qm_support_plans (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.qm_support_cases(id) on delete cascade,
  title text not null, strategies text, review_on date,
  created_by uuid not null references public.staff_members(id), created_at timestamptz not null default now()
);
create table if not exists public.qm_support_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.qm_support_cases(id) on delete cascade,
  actor_id uuid not null references public.staff_members(id),
  kind text not null check (kind in ('opened','plan','action','follow_up','note','closed','reopened','assigned')),
  note text, improvement int check (improvement between 1 and 5), next_follow_up date,
  created_at timestamptz not null default now()
);
create index if not exists qm_sup_ev_idx on public.qm_support_events (case_id, created_at);

do $$ declare t text; begin
  foreach t in array array['qm_achievement_categories','qm_support_types','qm_achievements','qm_achievement_students','qm_talents','qm_support_cases','qm_support_plans','qm_support_events'] loop
    execute format('alter table public.%I enable row level security', t); end loop;
  foreach t in array array['qm_achievement_categories','qm_support_types'] loop
    execute format('drop policy if exists %I on public.%I', t||'_r', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.qm_me() is not null)', t||'_r', t);
    execute format('drop policy if exists %I on public.%I', t||'_w', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.qm_is_admin()) with check (public.qm_is_admin())', t||'_w', t);
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.qm_audit_trg()', t, t);
  end loop; end $$;

create or replace function public.qm_is_support() returns boolean language sql stable security definer set search_path = '' as $f$
  select public.qm_has('agent') or public.qm_has('counselor') $f$;

-- ---------- الإنجازات ----------
create or replace function public.qm_achievement_create(p_title text, p_category uuid, p_date date, p_level text, p_organizer text, p_desc text, p_students jsonb, p_attachments text[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); aid uuid; s jsonb; sid uuid; en record; a record;
begin
  if me is null then raise exception 'not_staff'; end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then raise exception 'note_required'; end if;
  if p_level not in ('school','local','national','international') then raise exception 'type_invalid'; end if;
  if p_date is null or p_date > (now() at time zone 'Asia/Riyadh')::date then raise exception 'date_future'; end if;
  if not exists (select 1 from public.qm_achievement_categories where id = p_category and is_active) then raise exception 'type_invalid'; end if;
  if jsonb_typeof(p_students) <> 'array' or jsonb_array_length(p_students) < 1 then raise exception 'student_required'; end if;
  insert into public.qm_achievements (title, category_id, achieved_on, description, level, organizer, attachment_paths, recorded_by)
  values (btrim(p_title), p_category, p_date, nullif(btrim(p_desc), ''), p_level, nullif(btrim(p_organizer), ''), coalesce(p_attachments, '{}'), me) returning id into aid;
  for s in select * from jsonb_array_elements(p_students) loop
    sid := (s ->> 'student_id')::uuid;
    select * into en from public.qm_enrollment(sid);
    if not found then raise exception 'student_not_enrolled'; end if;
    insert into public.qm_achievement_students (achievement_id, student_id, year_id, grade_code, section_id, contribution)
    values (aid, sid, en.year_id, en.grade_code, en.section_id, nullif(btrim(s ->> 'contribution'), '')) on conflict do nothing;
  end loop;
  for a in select distinct sf.id from public.staff_members sf join public.staff_roles r on r.staff_id = sf.id
           where r.role_code in ('core_admin','principal') and r.ended_on is null and sf.is_active loop
    perform public.qm_notify(a.id, 'achievement_new', 'إنجاز جديد بانتظار التحقق', btrim(p_title), 'achievements.html?t=review');
  end loop;
  perform public.qm_audit('create', 'qm_achievements', aid, null, jsonb_build_object('title', btrim(p_title)));
  return aid;
end $f$;

create or replace function public.qm_achievement_verify(p_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); a public.qm_achievements%rowtype; n text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  if p_decision not in ('verified','needs_info','rejected') then raise exception 'type_invalid'; end if;
  if p_decision <> 'verified' and n is null then raise exception 'note_required'; end if;
  select * into a from public.qm_achievements where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  update public.qm_achievements set status = p_decision, reviewed_by = me, reviewed_at = now(), review_note = n, updated_at = now() where id = p_id;
  if a.recorded_by <> me then
    perform public.qm_notify(a.recorded_by, 'achievement_review', 'مراجعة الإنجاز: ' || a.title,
      case p_decision when 'verified' then 'تم التحقق واعتماد الإنجاز' when 'needs_info' then 'يحتاج استكمالاً: ' || n else 'لم يُعتمد: ' || n end, 'achievements.html?t=mine');
  end if;
  perform public.qm_audit('achievement_' || p_decision, 'qm_achievements', p_id, jsonb_build_object('status', a.status), jsonb_build_object('status', p_decision), n);
end $f$;

create or replace function public.qm_achievement_resubmit(p_id uuid, p_desc text, p_attachments text[] default '{}')
returns void language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); a public.qm_achievements%rowtype;
begin
  select * into a from public.qm_achievements where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if a.recorded_by <> me or a.status <> 'needs_info' then raise exception 'not_allowed'; end if;
  update public.qm_achievements set description = coalesce(nullif(btrim(p_desc), ''), description), attachment_paths = a.attachment_paths || coalesce(p_attachments, '{}'), status = 'pending', updated_at = now() where id = p_id;
  perform public.qm_audit('achievement_resubmit', 'qm_achievements', p_id, null, null);
end $f$;

-- scope: gallery (المعتمدة للجميع) | mine | review (للمدير) | all (للمدير)
create or replace function public.qm_achievements_list(p_scope text default 'gallery', p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); adm boolean := public.qm_is_admin();
begin
  if me is null then raise exception 'not_staff'; end if;
  if p_scope in ('review','all') and not adm then raise exception 'forbidden'; end if;
  if p_scope not in ('gallery','mine','review','all') then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(r) from (
    select a.id, a.title, c.name_ar as category, a.achieved_on, a.level, a.organizer, a.status, a.review_note, p.full_name as recorded_by, a.recorded_by = me as mine, a.created_at,
      (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.full_name, 'grade', g.name_ar)), '[]'::jsonb)
         from public.qm_achievement_students x join public.students s on s.id = x.student_id left join public.grade_levels g on g.code = x.grade_code where x.achievement_id = a.id) as students
    from public.qm_achievements a join public.qm_achievement_categories c on c.id = a.category_id join public.staff_members p on p.id = a.recorded_by
    where case p_scope when 'gallery' then a.status = 'verified' when 'mine' then a.recorded_by = me
                       when 'review' then a.status in ('pending','needs_info') else true end
    order by a.achieved_on desc, a.created_at desc limit least(greatest(p_limit, 1), 500)) r), '[]'::jsonb);
end $f$;

create or replace function public.qm_achievement_get(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); a public.qm_achievements%rowtype; adm boolean := public.qm_is_admin(); fullv boolean;
begin
  if me is null then raise exception 'not_staff'; end if;
  select * into a from public.qm_achievements where id = p_id;
  if not found then raise exception 'not_found'; end if;
  fullv := adm or a.recorded_by = me;
  if a.status <> 'verified' and not fullv then raise exception 'forbidden'; end if;
  return jsonb_build_object('id', a.id, 'title', a.title, 'category', (select name_ar from public.qm_achievement_categories where id = a.category_id),
    'achieved_on', a.achieved_on, 'level', a.level, 'organizer', a.organizer, 'description', a.description, 'status', a.status,
    'review_note', case when fullv then a.review_note end, 'attachments', case when fullv then a.attachment_paths else '{}'::text[] end,
    'recorded_by', (select full_name from public.staff_members where id = a.recorded_by), 'mine', a.recorded_by = me, 'can_review', adm,
    'students', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.full_name, 'grade', g.name_ar, 'section', cs.name, 'contribution', x.contribution)), '[]'::jsonb)
      from public.qm_achievement_students x join public.students s on s.id = x.student_id
      left join public.grade_levels g on g.code = x.grade_code left join public.class_sections cs on cs.id = x.section_id where x.achievement_id = a.id));
end $f$;

-- ---------- المواهب والقدرات ----------
create or replace function public.qm_talent_add(p_student uuid, p_field text, p_name text, p_desc text default null)
returns uuid language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); tid uuid;
begin
  if me is null then raise exception 'not_staff'; end if;
  if nullif(btrim(coalesce(p_field, '')), '') is null or nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'note_required'; end if;
  if not exists (select 1 from public.qm_enrollment(p_student)) then raise exception 'student_not_enrolled'; end if;
  insert into public.qm_talents (student_id, field, name, description, noted_by) values (p_student, btrim(p_field), btrim(p_name), nullif(btrim(p_desc), ''), me) returning id into tid;
  perform public.qm_audit('create', 'qm_talents', tid, null, jsonb_build_object('student_id', p_student));
  return tid;
end $f$;
create or replace function public.qm_talent_archive(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $f$
declare t public.qm_talents%rowtype;
begin
  select * into t from public.qm_talents where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if not (public.qm_is_admin() or t.noted_by = public.qm_me()) then raise exception 'forbidden'; end if;
  update public.qm_talents set is_active = false where id = p_id;
  perform public.qm_audit('archive', 'qm_talents', p_id, null, null, p_reason);
end $f$;
create or replace function public.qm_talents_list(p_student uuid default null, p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  return coalesce((select jsonb_agg(r) from (select t.id, t.student_id, s.full_name as student, g.name_ar as grade, cs.name as section, t.field, t.name, t.description,
      p.full_name as noted_by, t.noted_by = public.qm_me() as mine, t.created_at
    from public.qm_talents t join public.students s on s.id = t.student_id join public.staff_members p on p.id = t.noted_by
    left join lateral (select e.grade_code, e.section_id from public.student_enrollments e join public.academic_years y on y.id = e.year_id and y.status = 'current' where e.student_id = s.id and e.status = 'enrolled' limit 1) en on true
    left join public.grade_levels g on g.code = en.grade_code left join public.class_sections cs on cs.id = en.section_id
    where t.is_active and (p_student is null or t.student_id = p_student) order by t.created_at desc limit least(greatest(p_limit, 1), 500)) r), '[]'::jsonb);
end $f$;

-- ---------- المتابعة والدعم التربوي ----------
create or replace function public.qm_support_open(p_student uuid, p_type uuid, p_need text, p_goal text default null, p_incident uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); en record; cid uuid; n bigint; co boolean := public.qm_has('counselor'); a record;
begin
  if not public.qm_is_support() then raise exception 'forbidden'; end if;
  if nullif(btrim(coalesce(p_need, '')), '') is null then raise exception 'note_required'; end if;
  if not exists (select 1 from public.qm_support_types where id = p_type and is_active) then raise exception 'type_invalid'; end if;
  select * into en from public.qm_enrollment(p_student);
  if not found then raise exception 'student_not_enrolled'; end if;
  insert into public.qm_support_cases (student_id, year_id, grade_code, section_id, type_id, need_description, goal, owner_id, source_incident_id, opened_by)
  values (p_student, en.year_id, en.grade_code, en.section_id, p_type, btrim(p_need), nullif(btrim(p_goal), ''), case when co then me end, p_incident, me) returning id, no into cid, n;
  insert into public.qm_support_events (case_id, actor_id, kind, note) values (cid, me, 'opened', btrim(p_need));
  if not co then
    for a in select staff_id from public.qm_staff_roles where role = 'counselor' loop
      perform public.qm_notify(a.staff_id, 'support_new', 'حالة دعم جديدة رقم ' || n, null, 'support.html?i=' || cid);
    end loop;
  end if;
  perform public.qm_audit('create', 'qm_support_cases', cid, null, jsonb_build_object('no', n, 'student_id', p_student));
  return jsonb_build_object('id', cid, 'no', n);
end $f$;

create or replace function public.qm_support_list(p_scope text default 'active', p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
begin
  if not public.qm_is_support() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(r) from (
    select c.id, c.no, c.student_id, s.full_name as student, g.name_ar as grade, cs.name as section, t.name_ar as type, c.status, c.started_on, c.next_follow_up,
      (c.status <> 'closed' and c.next_follow_up is not null and c.next_follow_up < (now() at time zone 'Asia/Riyadh')::date) as overdue,
      o.full_name as owner, c.updated_at
    from public.qm_support_cases c join public.students s on s.id = c.student_id join public.qm_support_types t on t.id = c.type_id
    left join public.staff_members o on o.id = c.owner_id left join public.grade_levels g on g.code = c.grade_code left join public.class_sections cs on cs.id = c.section_id
    where case p_scope when 'new' then c.status = 'new' when 'active' then c.status in ('new','active') when 'closed' then c.status = 'closed' else true end
    order by (c.status = 'closed'), c.next_follow_up nulls last, c.created_at desc limit least(greatest(p_limit, 1), 500)) r), '[]'::jsonb);
end $f$;

create or replace function public.qm_support_get(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare c public.qm_support_cases%rowtype;
begin
  if not public.qm_is_support() then raise exception 'forbidden'; end if;
  select * into c from public.qm_support_cases where id = p_id;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('id', c.id, 'no', c.no, 'status', c.status, 'student_id', c.student_id,
    'student', (select full_name from public.students where id = c.student_id), 'grade', (select name_ar from public.grade_levels where code = c.grade_code),
    'section', (select name from public.class_sections where id = c.section_id), 'type', (select name_ar from public.qm_support_types where id = c.type_id),
    'need', c.need_description, 'goal', c.goal, 'owner', (select full_name from public.staff_members where id = c.owner_id), 'started_on', c.started_on, 'next_follow_up', c.next_follow_up,
    'result', c.result, 'final_improvement', c.final_improvement, 'closed_at', c.closed_at, 'retention_until', c.retention_until, 'source_incident', c.source_incident_id,
    'can', jsonb_build_object('manage', public.qm_has('counselor')),
    'plans', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'strategies', p.strategies, 'review_on', p.review_on, 'by', u.full_name, 'created_at', p.created_at) order by p.created_at), '[]'::jsonb)
      from public.qm_support_plans p join public.staff_members u on u.id = p.created_by where p.case_id = c.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'note', e.note, 'improvement', e.improvement, 'next', e.next_follow_up, 'by', u.full_name, 'created_at', e.created_at) order by e.created_at), '[]'::jsonb)
      from public.qm_support_events e join public.staff_members u on u.id = e.actor_id where e.case_id = c.id));
end $f$;

create or replace function public.qm_support_add_plan(p_case uuid, p_title text, p_strategies text default null, p_review_on date default null)
returns uuid language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); c public.qm_support_cases%rowtype; pid uuid;
begin
  if not public.qm_has('counselor') then raise exception 'forbidden'; end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then raise exception 'note_required'; end if;
  select * into c from public.qm_support_cases where id = p_case for update;
  if not found then raise exception 'not_found'; end if;
  if c.status = 'closed' then raise exception 'not_allowed'; end if;
  insert into public.qm_support_plans (case_id, title, strategies, review_on, created_by) values (p_case, btrim(p_title), nullif(btrim(p_strategies), ''), p_review_on, me) returning id into pid;
  insert into public.qm_support_events (case_id, actor_id, kind, note, next_follow_up) values (p_case, me, 'plan', btrim(p_title), p_review_on);
  update public.qm_support_cases set status = 'active', owner_id = coalesce(owner_id, me), next_follow_up = coalesce(p_review_on, next_follow_up), updated_at = now() where id = p_case;
  perform public.qm_audit('support_plan', 'qm_support_cases', p_case, null, jsonb_build_object('plan', btrim(p_title)));
  return pid;
end $f$;

-- kinds: action | follow_up | note | close | reopen | take
create or replace function public.qm_support_act(p_id uuid, p_kind text, p_note text default null, p_improvement int default null, p_next date default null)
returns jsonb language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); c public.qm_support_cases%rowtype; n text := nullif(btrim(coalesce(p_note, '')), ''); st text; ek text; ret int;
begin
  if not public.qm_has('counselor') then raise exception 'forbidden'; end if;
  select * into c from public.qm_support_cases where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  st := c.status;
  if p_kind in ('action','follow_up') and c.status <> 'closed' then ek := p_kind; st := 'active'; if n is null then raise exception 'note_required'; end if;
  elsif p_kind = 'note' and c.status <> 'closed' then ek := 'note'; if n is null then raise exception 'note_required'; end if;
  elsif p_kind = 'take' and c.status <> 'closed' then ek := 'assigned'; n := coalesce(n, 'استلام الحالة');
  elsif p_kind = 'close' and c.status <> 'closed' then ek := 'closed'; st := 'closed'; if n is null then raise exception 'note_required'; end if;
  elsif p_kind = 'reopen' and c.status = 'closed' then ek := 'reopened'; st := 'active'; if n is null then raise exception 'note_required'; end if;
  else raise exception 'not_allowed'; end if;
  insert into public.qm_support_events (case_id, actor_id, kind, note, improvement, next_follow_up) values (p_id, me, ek, n, p_improvement, p_next);
  if p_kind = 'close' then
    select support_retention_months into ret from public.qm_settings where id = 1;
    update public.qm_support_cases set status = 'closed', result = n, final_improvement = p_improvement, closed_by = me, closed_at = now(),
      retention_until = ((now() at time zone 'Asia/Riyadh')::date + make_interval(months => ret))::date, next_follow_up = null, updated_at = now() where id = p_id;
  elsif p_kind = 'reopen' then
    update public.qm_support_cases set status = 'active', closed_at = null, closed_by = null, retention_until = null, updated_at = now() where id = p_id;
  else
    update public.qm_support_cases set status = st, owner_id = case when p_kind = 'take' then me else coalesce(owner_id, me) end, next_follow_up = coalesce(p_next, next_follow_up), updated_at = now() where id = p_id;
  end if;
  perform public.qm_audit('support_' || p_kind, 'qm_support_cases', p_id, jsonb_build_object('status', c.status), jsonb_build_object('status', st), n);
  return jsonb_build_object('id', p_id, 'status', st);
end $f$;

-- مؤشرات إضافية للوحة الرئيسية (أعداد فقط، دون أي تفاصيل حساسة)
create or replace function public.qm_dashboard_ext()
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); sup boolean := public.qm_is_support() or public.qm_is_admin(); today date := (now() at time zone 'Asia/Riyadh')::date;
begin
  if me is null then raise exception 'not_staff'; end if;
  return jsonb_build_object(
    'achievements', (select count(*) from public.qm_achievements where status = 'verified'),
    'achievements_pending', case when public.qm_is_admin() then (select count(*) from public.qm_achievements where status in ('pending','needs_info')) end,
    'my_achievements_needs', (select count(*) from public.qm_achievements where recorded_by = me and status = 'needs_info'),
    'talents', (select count(*) from public.qm_talents where is_active),
    'support_active', case when sup then (select count(*) from public.qm_support_cases where status in ('new','active')) end,
    'support_new', case when sup then (select count(*) from public.qm_support_cases where status = 'new') end,
    'support_due', case when sup then (select count(*) from public.qm_support_cases where status <> 'closed' and next_follow_up < today) end);
end $f$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'qm\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop; end $$;
