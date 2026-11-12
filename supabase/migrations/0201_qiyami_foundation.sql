-- ============================================================================
-- قيمي (رعاية المتعلمين): المرحلة 1-3 (التأسيس، التعزيز، السلوك) على قاعدة النواة الرقمية.
-- لا يعدّل أي جدول في النواة؛ يقرأ منها فقط: students, student_enrollments, class_sections,
-- grade_levels, academic_years, staff_members, is_core_admin().
-- جميع جداول النظام بالبادئة qm_. الجداول مغلقة على العميل (RLS)، والعمليات عبر دوال SECURITY DEFINER
-- تتحقق من الدور على الخادم، فلا يكفي إخفاء عناصر الواجهة.
-- ============================================================================

-- ---------- الأدوار الخاصة بالنظام (فوق صلاحيات النواة) ----------
-- admin = is_core_admin() في النواة. المعلم = أي منسوب فعّال. الوكيل والموجه يعيّنهما مدير النواة.
create table if not exists public.qm_staff_roles (
  staff_id   uuid not null references public.staff_members(id) on delete cascade,
  role       text not null check (role in ('agent','counselor')),
  granted_by uuid references public.staff_members(id),
  granted_at timestamptz not null default now(),
  primary key (staff_id, role)
);
-- الموجه الطلابي يُعيَّن مبدئياً من مسماه الوظيفي في النواة (يمكن تغييره من الإدارة)
insert into public.qm_staff_roles (staff_id, role)
  select id, 'counselor' from public.staff_members where job_title = 'student_counselor' and is_active
  on conflict do nothing;

create table if not exists public.qm_settings (
  id int primary key default 1 check (id = 1),
  max_points_per_award int not null default 50 check (max_points_per_award > 0),
  duplicate_window_minutes int not null default 10 check (duplicate_window_minutes >= 0),
  updated_at timestamptz not null default now()
);
insert into public.qm_settings (id) values (1) on conflict do nothing;

-- ---------- الإعدادات القابلة للإدارة ----------
create table if not exists public.qm_reinforcement_types (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  domain text not null default 'general' check (domain in ('academic','behavior','participation','leadership','general')),
  default_points int not null default 0 check (default_points >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0
);
create table if not exists public.qm_badges (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  description text,
  icon text not null default 'trophy',
  criteria text,
  is_active boolean not null default true,
  sort_order int not null default 0
);
create table if not exists public.qm_behavior_categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('positive','negative')),
  name_ar text not null,
  is_active boolean not null default true,
  sort_order int not null default 0
);
create table if not exists public.qm_incident_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  tone text not null default 'info' check (tone in ('ok','info','warn','bad','mute')),
  sort_order int not null default 0,
  is_closed boolean not null default false,
  is_active boolean not null default true
);

insert into public.qm_reinforcement_types (name_ar, domain, default_points, sort_order)
select * from (values ('تميز دراسي','academic',5,1),('مشاركة فاعلة','participation',3,2),('انضباط والتزام','behavior',3,3),
  ('تعاون مع الزملاء','behavior',3,4),('مبادرة','leadership',5,5),('سلوك قيادي','leadership',5,6),('كلمة تشجيع','general',0,7)) v(a,b,c,d)
where not exists (select 1 from public.qm_reinforcement_types);
insert into public.qm_badges (name_ar, description, icon, criteria, sort_order)
select * from (values ('وسام التميز','للتميز المستمر دراسياً أو سلوكياً','trophy','يحدده المسؤول',1),('وسام العطاء','لمن يبذل جهداً لخدمة زملائه ومدرسته','users','يحدده المسؤول',2),
  ('وسام المثابرة','لمن يواصل المحاولة حتى يتحسن','up','يحدده المسؤول',3),('وسام الإبداع','للأفكار والأعمال المبتكرة','star','يحدده المسؤول',4),
  ('وسام التطور','لمن يظهر تحسناً واضحاً','chart','يحدده المسؤول',5)) v(a,b,c,d,e)
where not exists (select 1 from public.qm_badges);
insert into public.qm_behavior_categories (kind, name_ar, sort_order)
select * from (values ('positive','احترام الآخرين',1),('positive','التعاون',2),('positive','الانضباط',3),('positive','تحمل المسؤولية',4),('positive','المبادرة',5),
  ('positive','المحافظة على الممتلكات',6),('positive','السلوك القيادي',7),('positive','المواقف الإنسانية',8),
  ('negative','السلوك داخل الفصل',1),('negative','السلوك خارج الفصل',2),('negative','التعامل مع الزملاء',3),('negative','المحافظة على الممتلكات',4),('negative','أخرى',9)) v(a,b,c)
where not exists (select 1 from public.qm_behavior_categories);
insert into public.qm_incident_statuses (code, name_ar, tone, sort_order, is_closed)
select * from (values ('observed','مرصودة','warn',1,false),('with_agent','لدى وكيل شؤون الطلاب','info',2,false),('needs_info','تحتاج استكمالاً','warn',3,false),
  ('agent_processing','قيد المعالجة لدى الوكيل','info',4,false),('referred_counselor','محالة للموجه الطلابي','info',5,false),
  ('counseling_follow','قيد المتابعة الإرشادية','info',6,false),('closed','مغلقة','ok',7,true),('dismissed','محفوظة دون إجراء','mute',8,true)) v(a,b,c,d,e)
where not exists (select 1 from public.qm_incident_statuses);

-- ---------- التعزيز ودفتر النقاط ----------
-- الطالب والصف والفصل مرجعها النواة؛ نحفظ لقطة الصف/الفصل وقت العملية فقط لأغراض التقارير التاريخية.
create table if not exists public.qm_reinforcements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  year_id uuid references public.academic_years(id),
  grade_code text,
  section_id uuid references public.class_sections(id),
  type_id uuid not null references public.qm_reinforcement_types(id),
  description text,
  points int not null default 0 check (points >= 0),
  given_by uuid not null references public.staff_members(id),
  attachment_path text,
  voided_at timestamptz, voided_by uuid references public.staff_members(id), void_reason text,
  created_at timestamptz not null default now()
);
create index if not exists qm_reinf_student_idx on public.qm_reinforcements (student_id, created_at desc);
create index if not exists qm_reinf_date_idx on public.qm_reinforcements (created_at desc);

create table if not exists public.qm_points_ledger (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  points int not null check (points <> 0),
  kind text not null check (kind in ('reinforcement','correction','reversal')),
  reason text,
  source_type text, source_id uuid,
  reverses_id uuid references public.qm_points_ledger(id),
  created_by uuid not null references public.staff_members(id),
  created_at timestamptz not null default now()
);
create index if not exists qm_ledger_student_idx on public.qm_points_ledger (student_id, created_at desc);
create unique index if not exists qm_ledger_src_uq on public.qm_points_ledger (source_type, source_id) where reverses_id is null and source_id is not null;
create unique index if not exists qm_ledger_rev_uq on public.qm_points_ledger (reverses_id) where reverses_id is not null;

create table if not exists public.qm_student_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  badge_id uuid not null references public.qm_badges(id),
  note text,
  awarded_by uuid not null references public.staff_members(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz, revoked_by uuid references public.staff_members(id)
);
create unique index if not exists qm_student_badge_uq on public.qm_student_badges (student_id, badge_id) where revoked_at is null;

-- ---------- السلوك ----------
create table if not exists public.qm_positive_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  year_id uuid references public.academic_years(id),
  grade_code text, section_id uuid references public.class_sections(id),
  category_id uuid not null references public.qm_behavior_categories(id),
  description text not null,
  recorded_by uuid not null references public.staff_members(id),
  created_at timestamptz not null default now()
);
create index if not exists qm_pos_student_idx on public.qm_positive_records (student_id, created_at desc);

create table if not exists public.qm_incidents (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity unique,
  student_id uuid not null references public.students(id),
  year_id uuid references public.academic_years(id),
  grade_code text, section_id uuid references public.class_sections(id),
  occurred_on date not null,
  occurred_time time,
  location text,
  category_id uuid not null references public.qm_behavior_categories(id),
  description text not null,
  teacher_notes text, parties text,
  attachment_paths text[] not null default '{}',
  status text not null default 'observed' references public.qm_incident_statuses(code),
  reported_by uuid not null references public.staff_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists qm_inc_status_idx on public.qm_incidents (status, created_at desc);
create index if not exists qm_inc_reporter_idx on public.qm_incidents (reported_by, created_at desc);
create index if not exists qm_inc_student_idx on public.qm_incidents (student_id);

-- سجل زمني لكل إجراء. visibility: teacher يراه المعلم، internal للوكيل ومن فوقه، counselor للموجه (سري)
create table if not exists public.qm_incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.qm_incidents(id) on delete cascade,
  actor_id uuid not null references public.staff_members(id),
  kind text not null check (kind in ('reported','status_change','review_note','info_requested','info_provided','action','referred','counselor_note','closed','dismissed')),
  note text,
  visibility text not null default 'internal' check (visibility in ('teacher','internal','counselor')),
  from_status text, to_status text,
  created_at timestamptz not null default now()
);
create index if not exists qm_inc_ev_idx on public.qm_incident_events (incident_id, created_at);

-- ---------- الخدمات المشتركة ----------
create table if not exists public.qm_notifications (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  kind text not null, title text not null, body text, link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists qm_notif_idx on public.qm_notifications (staff_id, is_read, created_at desc);

create table if not exists public.qm_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.staff_members(id),
  action text not null, table_name text not null, record_id uuid,
  old_data jsonb, new_data jsonb, reason text,
  created_at timestamptz not null default now()
);
create index if not exists qm_audit_idx on public.qm_audit_logs (created_at desc);

-- ---------- دوال الهوية ----------
create or replace function public.qm_me() returns uuid language sql stable security definer set search_path = '' as $f$
  select id from public.staff_members where user_id = auth.uid() and is_active and account_status = 'active' limit 1 $f$;
create or replace function public.qm_is_admin() returns boolean language sql stable security definer set search_path = '' as $f$
  select coalesce(public.is_core_admin(), false) $f$;
create or replace function public.qm_has(p_role text) returns boolean language sql stable security definer set search_path = '' as $f$
  select exists (select 1 from public.qm_staff_roles where staff_id = public.qm_me() and role = p_role) $f$;

create or replace function public.qm_whoami() returns jsonb language sql stable security definer set search_path = '' as $f$
  select case when public.qm_me() is null then null else jsonb_build_object(
    'staff_id', public.qm_me(),
    'name', (select full_name from public.staff_members where id = public.qm_me()),
    'job_title', (select job_title from public.staff_members where id = public.qm_me()),
    'is_admin', public.qm_is_admin(), 'is_agent', public.qm_has('agent'), 'is_counselor', public.qm_has('counselor')) end $f$;

create or replace function public.qm_audit(p_action text, p_table text, p_id uuid, p_old jsonb, p_new jsonb, p_reason text default null)
returns void language sql security definer set search_path = '' as $f$
  insert into public.qm_audit_logs (actor_id, action, table_name, record_id, old_data, new_data, reason)
  values (public.qm_me(), p_action, p_table, p_id, p_old, p_new, p_reason) $f$;

create or replace function public.qm_audit_trg() returns trigger language plpgsql security definer set search_path = '' as $f$
begin
  insert into public.qm_audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (public.qm_me(), lower(tg_op), tg_table_name,
    (to_jsonb(coalesce(new, old)) ->> 'id')::uuid,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $f$;
do $$ declare t text; begin
  foreach t in array array['qm_reinforcement_types','qm_badges','qm_behavior_categories','qm_incident_statuses','qm_staff_roles','qm_settings'] loop
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.qm_audit_trg()', t, t);
  end loop; end $$;

create or replace function public.qm_notify(p_staff uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $f$
  insert into public.qm_notifications (staff_id, kind, title, body, link) values (p_staff, p_kind, p_title, p_body, p_link) $f$;

-- ---------- RLS: القراءة المباشرة محصورة، والكتابة عبر الدوال فقط ----------
do $$ declare t text; begin
  foreach t in array array['qm_staff_roles','qm_settings','qm_reinforcement_types','qm_badges','qm_behavior_categories','qm_incident_statuses',
    'qm_reinforcements','qm_points_ledger','qm_student_badges','qm_positive_records','qm_incidents','qm_incident_events','qm_notifications','qm_audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop; end $$;

-- الإعدادات: يقرؤها كل منسوب فعّال، ويعدّلها مدير النواة فقط
do $$ declare t text; begin
  foreach t in array array['qm_settings','qm_reinforcement_types','qm_badges','qm_behavior_categories','qm_incident_statuses'] loop
    execute format('drop policy if exists %I on public.%I', t||'_r', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.qm_me() is not null)', t||'_r', t);
    execute format('drop policy if exists %I on public.%I', t||'_w', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.qm_is_admin()) with check (public.qm_is_admin())', t||'_w', t);
  end loop; end $$;
drop policy if exists qm_staff_roles_r on public.qm_staff_roles;
create policy qm_staff_roles_r on public.qm_staff_roles for select to authenticated using (public.qm_is_admin() or staff_id = public.qm_me());
drop policy if exists qm_notif_r on public.qm_notifications;
create policy qm_notif_r on public.qm_notifications for select to authenticated using (staff_id = public.qm_me());
drop policy if exists qm_audit_r on public.qm_audit_logs;
create policy qm_audit_r on public.qm_audit_logs for select to authenticated using (public.qm_is_admin());

-- ---------- دوال المتعلمين ----------
create or replace function public.qm_students_search(p_q text default '', p_limit int default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare q text := btrim(coalesce(p_q, ''));
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  return coalesce((select jsonb_agg(r) from (
    select s.id, s.full_name as name, s.student_no as no, e.grade_code, g.name_ar as grade, cs.id as section_id, cs.name as section
    from public.students s
    join public.student_enrollments e on e.student_id = s.id and e.status = 'enrolled'
    join public.academic_years y on y.id = e.year_id and y.status = 'current'
    left join public.grade_levels g on g.code = e.grade_code
    left join public.class_sections cs on cs.id = e.section_id
    where s.study_status = 'enrolled' and (q = '' or s.full_name ilike '%' || q || '%' or s.student_no ilike q || '%')
    order by g.sort_order, cs.name, s.full_name
    limit least(greatest(p_limit, 1), 100)) r), '[]'::jsonb);
end $f$;

-- لقطة الصف/الفصل الحالية للمتعلم من النواة
create or replace function public.qm_enrollment(p_student uuid)
returns table (year_id uuid, grade_code text, section_id uuid) language sql stable security definer set search_path = '' as $f$
  select e.year_id, e.grade_code, e.section_id from public.student_enrollments e
  join public.academic_years y on y.id = e.year_id and y.status = 'current'
  where e.student_id = p_student and e.status = 'enrolled' limit 1 $f$;

-- ---------- التعزيز ----------
create or replace function public.qm_give_reinforcement(p_student uuid, p_type uuid, p_description text default null, p_points int default 0, p_attachment text default null)
returns uuid language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); st public.qm_settings%rowtype; en record; rid uuid; ty public.qm_reinforcement_types%rowtype;
begin
  if me is null then raise exception 'not_staff'; end if;
  select * into st from public.qm_settings where id = 1;
  select * into ty from public.qm_reinforcement_types where id = p_type and is_active;
  if not found then raise exception 'type_invalid'; end if;
  if coalesce(p_points, 0) < 0 or coalesce(p_points, 0) > st.max_points_per_award then raise exception 'points_invalid'; end if;
  select * into en from public.qm_enrollment(p_student);
  if not found then raise exception 'student_not_enrolled'; end if;
  if exists (select 1 from public.qm_reinforcements where student_id = p_student and type_id = p_type and given_by = me and voided_at is null
             and created_at > now() - make_interval(mins => st.duplicate_window_minutes)) then raise exception 'duplicate'; end if;
  insert into public.qm_reinforcements (student_id, year_id, grade_code, section_id, type_id, description, points, given_by, attachment_path)
  values (p_student, en.year_id, en.grade_code, en.section_id, p_type, nullif(btrim(p_description), ''), coalesce(p_points, 0), me, p_attachment) returning id into rid;
  if coalesce(p_points, 0) > 0 then
    insert into public.qm_points_ledger (student_id, points, kind, reason, source_type, source_id, created_by)
    values (p_student, p_points, 'reinforcement', ty.name_ar, 'reinforcement', rid, me);
  end if;
  perform public.qm_audit('create', 'qm_reinforcements', rid, null, jsonb_build_object('student_id', p_student, 'type', ty.name_ar, 'points', coalesce(p_points, 0)));
  return rid;
end $f$;

-- إلغاء موثق: لا حذف. يصدر قيداً عكسياً في الدفتر ويبقى السجل الأصلي
create or replace function public.qm_void_reinforcement(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); r public.qm_reinforcements%rowtype; l public.qm_points_ledger%rowtype;
begin
  if me is null then raise exception 'not_staff'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'note_required'; end if;
  select * into r from public.qm_reinforcements where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.voided_at is not null then raise exception 'already_void'; end if;
  if not (public.qm_is_admin() or r.given_by = me) then raise exception 'forbidden'; end if;
  update public.qm_reinforcements set voided_at = now(), voided_by = me, void_reason = btrim(p_reason) where id = p_id;
  select * into l from public.qm_points_ledger where source_type = 'reinforcement' and source_id = p_id and reverses_id is null;
  if found then
    insert into public.qm_points_ledger (student_id, points, kind, reason, source_type, source_id, reverses_id, created_by)
    values (l.student_id, -l.points, 'reversal', btrim(p_reason), 'reinforcement', null, l.id, me);
  end if;
  perform public.qm_audit('void', 'qm_reinforcements', p_id, to_jsonb(r), null, p_reason);
end $f$;

-- تصحيح يدوي للرصيد (مدير النواة فقط، بسبب موثق)
create or replace function public.qm_adjust_points(p_student uuid, p_points int, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); lid uuid;
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  if coalesce(p_points, 0) = 0 or nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'points_invalid'; end if;
  insert into public.qm_points_ledger (student_id, points, kind, reason, created_by) values (p_student, p_points, 'correction', btrim(p_reason), me) returning id into lid;
  perform public.qm_audit('adjust', 'qm_points_ledger', lid, null, jsonb_build_object('student_id', p_student, 'points', p_points), p_reason);
  return lid;
end $f$;

create or replace function public.qm_award_badge(p_student uuid, p_badge uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); bid uuid;
begin
  if not (public.qm_is_admin() or public.qm_has('agent') or public.qm_has('counselor')) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.qm_badges where id = p_badge and is_active) then raise exception 'type_invalid'; end if;
  if not exists (select 1 from public.qm_enrollment(p_student)) then raise exception 'student_not_enrolled'; end if;
  begin
    insert into public.qm_student_badges (student_id, badge_id, note, awarded_by) values (p_student, p_badge, nullif(btrim(p_note), ''), me) returning id into bid;
  exception when unique_violation then raise exception 'duplicate'; end;
  perform public.qm_audit('award_badge', 'qm_student_badges', bid, null, jsonb_build_object('student_id', p_student, 'badge_id', p_badge));
  return bid;
end $f$;

create or replace function public.qm_revoke_badge(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $f$
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'note_required'; end if;
  update public.qm_student_badges set revoked_at = now(), revoked_by = public.qm_me() where id = p_id and revoked_at is null;
  perform public.qm_audit('revoke_badge', 'qm_student_badges', p_id, null, null, p_reason);
end $f$;

create or replace function public.qm_reinforcements_list(p_student uuid default null, p_mine boolean default false, p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  return coalesce((select jsonb_agg(r) from (
    select x.id, x.student_id, s.full_name as student, g.name_ar as grade, cs.name as section, t.name_ar as type, t.domain, x.description, x.points,
      p.full_name as given_by, x.given_by = public.qm_me() as mine, x.created_at, x.voided_at, x.void_reason
    from public.qm_reinforcements x
    join public.students s on s.id = x.student_id
    join public.qm_reinforcement_types t on t.id = x.type_id
    join public.staff_members p on p.id = x.given_by
    left join public.grade_levels g on g.code = x.grade_code
    left join public.class_sections cs on cs.id = x.section_id
    where (p_student is null or x.student_id = p_student) and (not p_mine or x.given_by = public.qm_me())
    order by x.created_at desc limit least(greatest(p_limit, 1), 500)) r), '[]'::jsonb);
end $f$;

create or replace function public.qm_ledger_list(p_student uuid, p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  return jsonb_build_object(
    'balance', coalesce((select sum(points) from public.qm_points_ledger where student_id = p_student), 0),
    'rows', coalesce((select jsonb_agg(r) from (
      select l.id, l.points, l.kind, l.reason, l.reverses_id, p.full_name as by, l.created_at
      from public.qm_points_ledger l join public.staff_members p on p.id = l.created_by
      where l.student_id = p_student order by l.created_at desc limit least(greatest(p_limit, 1), 500)) r), '[]'::jsonb));
end $f$;

-- أرصدة المتعلمين (من الحركات فقط) مع إمكانية البحث
create or replace function public.qm_balances(p_q text default '', p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare q text := btrim(coalesce(p_q, ''));
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  return coalesce((select jsonb_agg(r) from (
    select s.id, s.full_name as name, s.student_no as no, g.name_ar as grade, cs.name as section,
      coalesce(sum(l.points), 0)::int as balance, count(*) filter (where l.kind = 'reinforcement') as awards
    from public.students s
    join public.student_enrollments e on e.student_id = s.id and e.status = 'enrolled'
    join public.academic_years y on y.id = e.year_id and y.status = 'current'
    left join public.grade_levels g on g.code = e.grade_code
    left join public.class_sections cs on cs.id = e.section_id
    left join public.qm_points_ledger l on l.student_id = s.id
    where s.study_status = 'enrolled' and (q = '' or s.full_name ilike '%' || q || '%' or s.student_no ilike q || '%')
    group by s.id, s.full_name, s.student_no, g.name_ar, g.sort_order, cs.name
    order by balance desc, s.full_name limit least(greatest(p_limit, 1), 500)) r), '[]'::jsonb);
end $f$;

-- ---------- السلوك الإيجابي ----------
create or replace function public.qm_record_positive(p_student uuid, p_category uuid, p_description text)
returns uuid language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); en record; rid uuid;
begin
  if me is null then raise exception 'not_staff'; end if;
  if nullif(btrim(coalesce(p_description, '')), '') is null then raise exception 'note_required'; end if;
  if not exists (select 1 from public.qm_behavior_categories where id = p_category and kind = 'positive' and is_active) then raise exception 'type_invalid'; end if;
  select * into en from public.qm_enrollment(p_student);
  if not found then raise exception 'student_not_enrolled'; end if;
  insert into public.qm_positive_records (student_id, year_id, grade_code, section_id, category_id, description, recorded_by)
  values (p_student, en.year_id, en.grade_code, en.section_id, p_category, btrim(p_description), me) returning id into rid;
  perform public.qm_audit('create', 'qm_positive_records', rid, null, jsonb_build_object('student_id', p_student));
  return rid;
end $f$;

-- ---------- الوقائع السلوكية ----------
create or replace function public.qm_report_incident(p_student uuid, p_category uuid, p_description text, p_date date default null, p_time time default null,
  p_location text default null, p_notes text default null, p_parties text default null, p_attachments text[] default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); en record; iid uuid; n bigint; d date := coalesce(p_date, (now() at time zone 'Asia/Riyadh')::date); a record;
begin
  if me is null then raise exception 'not_staff'; end if;
  if nullif(btrim(coalesce(p_description, '')), '') is null then raise exception 'note_required'; end if;
  if d > (now() at time zone 'Asia/Riyadh')::date then raise exception 'date_future'; end if;
  if not exists (select 1 from public.qm_behavior_categories where id = p_category and kind = 'negative' and is_active) then raise exception 'type_invalid'; end if;
  select * into en from public.qm_enrollment(p_student);
  if not found then raise exception 'student_not_enrolled'; end if;
  insert into public.qm_incidents (student_id, year_id, grade_code, section_id, occurred_on, occurred_time, location, category_id, description, teacher_notes, parties, attachment_paths, reported_by)
  values (p_student, en.year_id, en.grade_code, en.section_id, d, p_time, nullif(btrim(p_location), ''), p_category, btrim(p_description), nullif(btrim(p_notes), ''), nullif(btrim(p_parties), ''), coalesce(p_attachments, '{}'), me)
  returning id, no into iid, n;
  insert into public.qm_incident_events (incident_id, actor_id, kind, note, visibility, to_status) values (iid, me, 'reported', 'رُصدت الواقعة وأُحيلت إلى وكيل شؤون الطلاب', 'teacher', 'observed');
  for a in select staff_id from public.qm_staff_roles where role = 'agent' loop
    perform public.qm_notify(a.staff_id, 'incident_new', 'واقعة سلوكية جديدة رقم ' || n, 'وصلت إلى صندوق الوكيل', 'agent.html?i=' || iid);
  end loop;
  perform public.qm_audit('create', 'qm_incidents', iid, null, jsonb_build_object('no', n, 'student_id', p_student));
  return jsonb_build_object('id', iid, 'no', n, 'status', 'observed');
end $f$;

create or replace function public.qm_incident_act(p_id uuid, p_action text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); i public.qm_incidents%rowtype; ag boolean := public.qm_has('agent'); co boolean := public.qm_has('counselor');
  mine boolean; ns text; vis text := 'internal'; k text; n text := nullif(btrim(coalesce(p_note, '')), ''); needs_note boolean := false; a record; stname text;
begin
  if me is null then raise exception 'not_staff'; end if;
  select * into i from public.qm_incidents where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  mine := i.reported_by = me;
  if p_action = 'start_review' and ag and i.status = 'observed' then ns := 'with_agent'; k := 'status_change'; vis := 'teacher';
  elsif p_action = 'request_info' and ag and i.status in ('observed','with_agent','agent_processing') then ns := 'needs_info'; k := 'info_requested'; vis := 'teacher'; needs_note := true;
  elsif p_action = 'provide_info' and mine and i.status = 'needs_info' then ns := 'with_agent'; k := 'info_provided'; vis := 'teacher'; needs_note := true;
  elsif p_action = 'review_note' and ag and i.status in ('with_agent','agent_processing','needs_info') then ns := i.status; k := 'review_note'; needs_note := true;
  elsif p_action = 'document_action' and ag and i.status in ('with_agent','agent_processing') then ns := 'agent_processing'; k := 'action'; needs_note := true;
  elsif p_action = 'refer_counselor' and ag and i.status in ('with_agent','agent_processing') then ns := 'referred_counselor'; k := 'referred'; needs_note := true;
  elsif p_action = 'start_counseling' and co and i.status = 'referred_counselor' then ns := 'counseling_follow'; k := 'status_change';
  elsif p_action = 'counselor_note' and co and i.status in ('referred_counselor','counseling_follow') then ns := i.status; k := 'counselor_note'; vis := 'counselor'; needs_note := true;
  elsif p_action = 'close' and ((ag and i.status in ('with_agent','agent_processing')) or (co and i.status in ('referred_counselor','counseling_follow'))) then ns := 'closed'; k := 'closed'; needs_note := true;
  elsif p_action = 'dismiss' and ag and i.status in ('observed','with_agent','agent_processing') then ns := 'dismissed'; k := 'dismissed'; needs_note := true;
  else raise exception 'not_allowed'; end if;
  if needs_note and n is null then raise exception 'note_required'; end if;
  insert into public.qm_incident_events (incident_id, actor_id, kind, note, visibility, from_status, to_status) values (p_id, me, k, n, vis, i.status, ns);
  update public.qm_incidents set status = ns, updated_at = now(), closed_at = case when ns in ('closed','dismissed') then now() else null end where id = p_id;
  select name_ar into stname from public.qm_incident_statuses where code = ns;
  if i.reported_by <> me and ns <> i.status then
    perform public.qm_notify(i.reported_by, 'incident_status', 'تحديث على الواقعة رقم ' || i.no, 'الحالة: ' || coalesce(stname, ns), 'teacher.html?i=' || p_id);
  end if;
  if p_action = 'provide_info' then
    for a in select staff_id from public.qm_staff_roles where role = 'agent' loop
      perform public.qm_notify(a.staff_id, 'incident_info', 'استُكملت معلومات الواقعة رقم ' || i.no, null, 'agent.html?i=' || p_id);
    end loop;
  end if;
  if p_action = 'refer_counselor' then
    for a in select staff_id from public.qm_staff_roles where role = 'counselor' loop
      perform public.qm_notify(a.staff_id, 'incident_referred', 'حالة محالة إليك: واقعة رقم ' || i.no, null, 'counselor.html?i=' || p_id);
    end loop;
  end if;
  perform public.qm_audit('incident_' || p_action, 'qm_incidents', p_id, jsonb_build_object('status', i.status), jsonb_build_object('status', ns), n);
  return jsonb_build_object('id', p_id, 'status', ns);
end $f$;

-- قائمة الوقائع. scope: mine | inbox (الوكيل) | agent_all | counselor | all (مدير النواة، للقراءة)
create or replace function public.qm_incidents_list(p_scope text default 'mine', p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); ag boolean := public.qm_has('agent'); co boolean := public.qm_has('counselor'); adm boolean := public.qm_is_admin();
begin
  if me is null then raise exception 'not_staff'; end if;
  if p_scope = 'inbox' and not ag then raise exception 'forbidden'; end if;
  if p_scope = 'agent_all' and not (ag or adm) then raise exception 'forbidden'; end if;
  if p_scope = 'counselor' and not co then raise exception 'forbidden'; end if;
  if p_scope = 'all' and not adm then raise exception 'forbidden'; end if;
  if p_scope not in ('mine','inbox','agent_all','counselor','all') then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(r) from (
    select i.id, i.no, i.student_id, s.full_name as student, g.name_ar as grade, cs.name as section, c.name_ar as category, i.occurred_on, i.created_at, i.updated_at,
      i.status, st.name_ar as status_name, st.tone, st.is_closed, rp.full_name as reporter, i.reported_by = me as mine,
      (i.status = 'needs_info' and i.reported_by = me) as needs_my_action,
      (select max(e.created_at) from public.qm_incident_events e where e.incident_id = i.id and e.kind = 'referred') as referred_at
    from public.qm_incidents i
    join public.students s on s.id = i.student_id
    join public.qm_behavior_categories c on c.id = i.category_id
    join public.qm_incident_statuses st on st.code = i.status
    join public.staff_members rp on rp.id = i.reported_by
    left join public.grade_levels g on g.code = i.grade_code
    left join public.class_sections cs on cs.id = i.section_id
    where case p_scope
      when 'mine' then i.reported_by = me
      when 'inbox' then i.status in ('observed','with_agent','agent_processing','needs_info')
      when 'agent_all' then true
      when 'counselor' then exists (select 1 from public.qm_incident_events e where e.incident_id = i.id and e.kind = 'referred')
      else true end
    order by i.created_at desc limit least(greatest(p_limit, 1), 500)) r), '[]'::jsonb);
end $f$;

-- تفاصيل واقعة مع السجل الزمني المسموح للمستخدم فقط
create or replace function public.qm_incident_get(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); ag boolean := public.qm_has('agent'); co boolean := public.qm_has('counselor'); adm boolean := public.qm_is_admin();
  i public.qm_incidents%rowtype; vis text[]; out jsonb;
begin
  if me is null then raise exception 'not_staff'; end if;
  select * into i from public.qm_incidents where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if i.reported_by <> me and not (ag or adm or (co and exists (select 1 from public.qm_incident_events e where e.incident_id = p_id and e.kind = 'referred'))) then raise exception 'forbidden'; end if;
  vis := array['teacher'];
  if ag or adm or co then vis := vis || 'internal'; end if;
  if co then vis := vis || 'counselor'; end if;
  select jsonb_build_object(
    'id', i.id, 'no', i.no, 'status', i.status, 'status_name', st.name_ar, 'tone', st.tone, 'is_closed', st.is_closed,
    'student_id', i.student_id, 'student', s.full_name, 'student_no', s.student_no, 'grade', g.name_ar, 'section', cs.name,
    'occurred_on', i.occurred_on, 'occurred_time', i.occurred_time, 'location', i.location, 'category', c.name_ar,
    'description', i.description, 'teacher_notes', i.teacher_notes, 'parties', i.parties, 'attachments', i.attachment_paths,
    'reporter', rp.full_name, 'mine', i.reported_by = me, 'created_at', i.created_at, 'updated_at', i.updated_at,
    'can', jsonb_build_object('agent', ag, 'counselor', co),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'note', e.note, 'visibility', e.visibility, 'by', a.full_name,
        'from_status', e.from_status, 'to_status', e.to_status, 'created_at', e.created_at) order by e.created_at)
      from public.qm_incident_events e join public.staff_members a on a.id = e.actor_id
      where e.incident_id = i.id and e.visibility = any (vis)), '[]'::jsonb)) into out
  from public.students s
  join public.qm_incident_statuses st on st.code = i.status
  join public.qm_behavior_categories c on c.id = i.category_id
  join public.staff_members rp on rp.id = i.reported_by
  left join public.grade_levels g on g.code = i.grade_code
  left join public.class_sections cs on cs.id = i.section_id
  where s.id = i.student_id;
  return out;
end $f$;

-- ---------- بطاقة المتعلم (حسب الصلاحية) ----------
create or replace function public.qm_student_card(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); sens boolean := public.qm_has('agent') or public.qm_has('counselor') or public.qm_is_admin(); out jsonb;
begin
  if me is null then raise exception 'not_staff'; end if;
  select jsonb_build_object(
    'id', s.id, 'name', s.full_name, 'no', s.student_no, 'grade', g.name_ar, 'section', cs.name,
    'balance', coalesce((select sum(points) from public.qm_points_ledger where student_id = s.id), 0),
    'reinforcements', (select count(*) from public.qm_reinforcements where student_id = s.id and voided_at is null),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('id', sb.id, 'name', b.name_ar, 'icon', b.icon, 'at', sb.created_at) order by sb.created_at desc)
      from public.qm_student_badges sb join public.qm_badges b on b.id = sb.badge_id where sb.student_id = s.id and sb.revoked_at is null), '[]'::jsonb),
    'recent_reinforcements', coalesce((select jsonb_agg(x) from (select t.name_ar as type, r.points, r.description, r.created_at from public.qm_reinforcements r
      join public.qm_reinforcement_types t on t.id = r.type_id where r.student_id = s.id and r.voided_at is null order by r.created_at desc limit 8) x), '[]'::jsonb),
    'positive', coalesce((select jsonb_agg(x) from (select c.name_ar as category, p.description, p.created_at from public.qm_positive_records p
      join public.qm_behavior_categories c on c.id = p.category_id where p.student_id = s.id order by p.created_at desc limit 8) x), '[]'::jsonb),
    'sensitive', sens,
    'incidents', case when sens then coalesce((select jsonb_agg(x) from (select i.id, i.no, i.occurred_on, c.name_ar as category, st.name_ar as status_name, st.tone
      from public.qm_incidents i join public.qm_behavior_categories c on c.id = i.category_id join public.qm_incident_statuses st on st.code = i.status
      where i.student_id = s.id order by i.created_at desc limit 20) x), '[]'::jsonb) else null end) into out
  from public.students s
  left join lateral (select e.grade_code, e.section_id from public.student_enrollments e join public.academic_years y on y.id = e.year_id and y.status = 'current'
    where e.student_id = s.id and e.status = 'enrolled' limit 1) en on true
  left join public.grade_levels g on g.code = en.grade_code
  left join public.class_sections cs on cs.id = en.section_id
  where s.id = p_student;
  if out is null then raise exception 'not_found'; end if;
  return out;
end $f$;

-- ---------- المؤشرات (حقيقية من القاعدة) ----------
create or replace function public.qm_dashboard(p_days int default 14)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); ag boolean := public.qm_has('agent'); co boolean := public.qm_has('counselor'); adm boolean := public.qm_is_admin(); sens boolean;
  d0 date := (now() at time zone 'Asia/Riyadh')::date - (least(greatest(p_days, 7), 90) - 1);
begin
  if me is null then raise exception 'not_staff'; end if;
  sens := ag or co or adm;
  return jsonb_build_object(
    'students', (select count(*) from public.student_enrollments e join public.academic_years y on y.id = e.year_id and y.status = 'current' where e.status = 'enrolled'),
    'reinforcements', (select count(*) from public.qm_reinforcements where voided_at is null),
    'points', coalesce((select sum(points) from public.qm_points_ledger), 0),
    'badges', (select count(*) from public.qm_student_badges where revoked_at is null),
    'my_reinforcements', (select count(*) from public.qm_reinforcements where given_by = me and voided_at is null),
    'my_incidents', (select count(*) from public.qm_incidents where reported_by = me),
    'my_needs_action', (select count(*) from public.qm_incidents where reported_by = me and status = 'needs_info'),
    'incidents_new', case when sens then (select count(*) from public.qm_incidents where status = 'observed') end,
    'incidents_with_agent', case when sens then (select count(*) from public.qm_incidents where status in ('with_agent','agent_processing','needs_info')) end,
    'incidents_referred', case when sens then (select count(*) from public.qm_incidents where status in ('referred_counselor','counseling_follow')) end,
    'incidents_overdue', case when ag or adm then (select count(*) from public.qm_incidents where status in ('observed','with_agent') and updated_at < now() - interval '3 days') end,
    'series', (select coalesce(jsonb_agg(jsonb_build_object('d', g.d, 'n', (select count(*) from public.qm_reinforcements r where r.voided_at is null and (r.created_at at time zone 'Asia/Riyadh')::date = g.d)) order by g.d), '[]'::jsonb)
               from generate_series(d0, (now() at time zone 'Asia/Riyadh')::date, interval '1 day') as gs(dd), lateral (select gs.dd::date as d) g),
    'by_grade', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select coalesce(gl.name_ar, '—') as grade, count(*) as n from public.qm_reinforcements r
        left join public.grade_levels gl on gl.code = r.grade_code where r.voided_at is null and r.created_at >= d0 group by gl.name_ar, gl.sort_order order by gl.sort_order) x),
    'by_type', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select t.name_ar as type, count(*) as n from public.qm_reinforcements r
        join public.qm_reinforcement_types t on t.id = r.type_id where r.voided_at is null and r.created_at >= d0 group by t.name_ar order by n desc) x),
    'recent', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select s.full_name as student, t.name_ar as type, r.points, r.created_at from public.qm_reinforcements r
        join public.students s on s.id = r.student_id join public.qm_reinforcement_types t on t.id = r.type_id where r.voided_at is null order by r.created_at desc limit 8) x),
    'since', d0);
end $f$;

-- لوحة التميز: الأعلى رصيداً هذا العام (للتكريم، وليس ترتيباً تنافسياً رسمياً)
create or replace function public.qm_excellence(p_limit int default 10)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  return coalesce((select jsonb_agg(r) from (
    select s.id, s.full_name as name, g.name_ar as grade, cs.name as section, sum(l.points)::int as balance
    from public.qm_points_ledger l join public.students s on s.id = l.student_id
    join public.student_enrollments e on e.student_id = s.id and e.status = 'enrolled'
    join public.academic_years y on y.id = e.year_id and y.status = 'current'
    left join public.grade_levels g on g.code = e.grade_code left join public.class_sections cs on cs.id = e.section_id
    group by s.id, s.full_name, g.name_ar, cs.name having sum(l.points) > 0
    order by balance desc limit least(greatest(p_limit, 1), 50)) r), '[]'::jsonb);
end $f$;

-- ---------- الإشعارات والإدارة ----------
create or replace function public.qm_notifications_list(p_limit int default 30)
returns jsonb language sql stable security definer set search_path = '' as $f$
  select coalesce(jsonb_agg(r), '[]'::jsonb) from (select id, kind, title, body, link, is_read, created_at from public.qm_notifications
    where staff_id = public.qm_me() order by created_at desc limit least(greatest(p_limit, 1), 100)) r $f$;
create or replace function public.qm_notifications_read(p_id uuid default null)
returns void language sql security definer set search_path = '' as $f$
  update public.qm_notifications set is_read = true where staff_id = public.qm_me() and not is_read and (p_id is null or id = p_id) $f$;

create or replace function public.qm_staff_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(r) from (
    select s.id, s.full_name as name, s.job_title, coalesce(jt.name_ar, s.job_title) as job,
      exists (select 1 from public.qm_staff_roles q where q.staff_id = s.id and q.role = 'agent') as is_agent,
      exists (select 1 from public.qm_staff_roles q where q.staff_id = s.id and q.role = 'counselor') as is_counselor
    from public.staff_members s left join public.job_titles jt on jt.code = s.job_title
    where s.is_active order by s.full_name) r), '[]'::jsonb);
end $f$;
create or replace function public.qm_set_role(p_staff uuid, p_role text, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $f$
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  if p_role not in ('agent','counselor') then raise exception 'forbidden'; end if;
  if p_on then insert into public.qm_staff_roles (staff_id, role, granted_by) values (p_staff, p_role, public.qm_me()) on conflict do nothing;
  else delete from public.qm_staff_roles where staff_id = p_staff and role = p_role; end if;
  perform public.qm_audit(case when p_on then 'grant_role' else 'revoke_role' end, 'qm_staff_roles', p_staff, null, jsonb_build_object('role', p_role));
end $f$;

create or replace function public.qm_audit_list(p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(r) from (select a.id, a.action, a.table_name, a.record_id, a.reason, a.created_at, p.full_name as actor, a.old_data, a.new_data
    from public.qm_audit_logs a left join public.staff_members p on p.id = a.actor_id order by a.created_at desc limit least(greatest(p_limit, 1), 500)) r), '[]'::jsonb);
end $f$;

-- ---------- التخزين الخاص للمرفقات ----------
insert into storage.buckets (id, name, public) values ('qm-attachments', 'qm-attachments', false) on conflict (id) do nothing;
drop policy if exists qm_att_ins on storage.objects;
create policy qm_att_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'qm-attachments' and public.qm_me() is not null and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists qm_att_sel on storage.objects;
create policy qm_att_sel on storage.objects for select to authenticated
  using (bucket_id = 'qm-attachments' and ((storage.foldername(name))[1] = auth.uid()::text or public.qm_has('agent') or public.qm_has('counselor') or public.qm_is_admin()));

-- ---------- الصلاحيات على الدوال: للمستخدمين المسجلين فقط ----------
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'qm\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop; end $$;
