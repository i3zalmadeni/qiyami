-- صلاحيات قيمي الكاملة: كل قدرة في البوابة صلاحية تُمنح لكل منسوب من صفحة «الصلاحيات».
--   reinforce    التعزيز: منح النقاط والأوسمة وتوثيق المواقف الإيجابية
--   behavior     تسجيل السلوك السلبي ورفع الوقائع إلى الوكيل
--   agent        وكيل شؤون الطلاب (يستقبل الوقائع)
--   counselor    الموجه الطلابي (الحالات الإجرائية)
--   reports      التقارير المجمّعة
--   portal_admin إدارة البوابة والصلاحيات (يمنحها مدير النواة فقط)
-- يبقى مدير النواة الرقمية مالكاً لكل الصلاحيات تلقائياً.

-- 1) دليل المتعلمين: اسم مستقل (كان qm_students_directory() يتعارض مع دالة قديمة بالاسم نفسه ومعاملات افتراضية)
drop function if exists public.qm_students_directory();
create or replace function public.qm_students_all()
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  return coalesce((select jsonb_agg(r order by r.grade_sort, r.section, r.name) from (
    select e.student_id as id, e.name, s.student_no as no, e.grade_code, e.grade, coalesce(e.grade_sort, 99) as grade_sort,
      e.section_id, coalesce(e.section, '') as section,
      coalesce((select sum(l.points) from public.qm_points_ledger l where l.student_id = e.student_id), 0)::int as balance,
      (select count(*) from public.qm_student_badges sb where sb.student_id = e.student_id and sb.revoked_at is null)::int as badges
    from public.qm_enrolled() e join public.students s on s.id = e.student_id
    where s.study_status = 'enrolled') r), '[]'::jsonb);
end $f$;
revoke all on function public.qm_students_all() from public, anon;
grant execute on function public.qm_students_all() to authenticated;

-- 2) الأدوار المسموحة
alter table public.qm_staff_roles drop constraint if exists qm_staff_roles_role_check;
alter table public.qm_staff_roles add constraint qm_staff_roles_role_check
  check (role in ('agent', 'counselor', 'reinforce', 'behavior', 'reports', 'portal_admin'));

-- 3) يبقى الحال كما كان: كل منسوب فعّال يملك التعزيز وتسجيل السلوك، ثم يعدّلها المدير من «الصلاحيات»
insert into public.qm_staff_roles (staff_id, role)
select s.id, r from public.staff_members s cross join (values ('reinforce'), ('behavior')) v(r)
where s.is_active on conflict do nothing;

-- 4) مدير البوابة يملك الإدارة، ومدير النواة يملك كل شيء
create or replace function public.qm_is_core_admin()
returns boolean language sql stable security definer set search_path = '' as $f$ select coalesce(public.is_core_admin(), false) $f$;
create or replace function public.qm_is_admin()
returns boolean language sql stable security definer set search_path = '' as $f$
  select public.qm_is_core_admin() or public.qm_has('portal_admin') $f$;
create or replace function public.qm_can(p_role text)
returns boolean language sql stable security definer set search_path = '' as $f$
  select public.qm_is_admin() or public.qm_has(p_role) $f$;
revoke all on function public.qm_is_core_admin(), public.qm_can(text) from public, anon;
grant execute on function public.qm_is_core_admin(), public.qm_can(text) to authenticated;

-- 5) فرض الصلاحيات في دوال الكتابة (سطر بعد فحص «not_staff»)
do $do$
declare f text; r text; d text;
begin
  for f, r in select * from (values ('public.qm_give_reinforcement(uuid,uuid,text,integer,text)', 'reinforce'),
                     ('public.qm_award_badge(uuid,uuid,text)', 'reinforce'),
                     ('public.qm_record_positive(uuid,uuid,text)', 'reinforce'),
                     ('public.qm_report_incident(uuid,uuid,text,date,time without time zone,text,text,text,text[])', 'behavior')) v loop
    d := pg_get_functiondef(f::regprocedure);
    if position('qm_can(''' || r || ''')' in d) = 0 then
      d := replace(d, $$if me is null then raise exception 'not_staff'; end if;$$,
        $$if me is null then raise exception 'not_staff'; end if;
  if not public.qm_can('$$ || r || $$') then raise exception 'forbidden'; end if;$$);
      if position('qm_can(''' || r || ''')' in d) = 0 then raise exception 'patch failed: %', f; end if;
      execute d;
    end if;
  end loop;
  d := pg_get_functiondef('public.qm_grant_bulk(uuid[],text,uuid,integer,text)'::regprocedure);
  if position('qm_can(''reinforce'')' in d) = 0 then
    d := replace(d, $$if public.qm_me() is null then raise exception 'not_staff'; end if;$$,
      $$if public.qm_me() is null then raise exception 'not_staff'; end if;
  if not public.qm_can('reinforce') then raise exception 'forbidden'; end if;$$);
    if position('qm_can(''reinforce'')' in d) = 0 then raise exception 'patch failed: grant_bulk'; end if;
    execute d;
  end if;
  d := pg_get_functiondef('public.qm_report(date,date)'::regprocedure);
  if position('qm_has(''reports'')' in d) = 0 then
    d := replace(d, 'declare sens boolean := public.qm_is_admin() or public.qm_is_support();',
      'declare sens boolean := public.qm_is_admin() or public.qm_is_support() or public.qm_has(''reports'');');
    if position('qm_has(''reports'')' in d) = 0 then raise exception 'patch failed: report'; end if;
    execute d;
  end if;
end $do$;

-- 6) هوية المستخدم: كل صلاحياته للواجهة
create or replace function public.qm_whoami()
returns jsonb language sql stable security definer set search_path = '' as $f$
  select case when public.qm_me() is null then null else jsonb_build_object(
    'staff_id', public.qm_me(),
    'name', (select full_name from public.staff_members where id = public.qm_me()),
    'job_title', (select job_title from public.staff_members where id = public.qm_me()),
    'specialty', (select specialty from public.staff_members where id = public.qm_me()),
    'is_admin', public.qm_is_admin(), 'is_core_admin', public.qm_is_core_admin(),
    'is_agent', public.qm_has('agent'), 'is_counselor', public.qm_has('counselor'),
    'can_reinforce', public.qm_can('reinforce'), 'can_behavior', public.qm_can('behavior'),
    'can_reports', public.qm_is_admin() or public.qm_is_support() or public.qm_has('reports')) end $f$;

-- 7) قائمة المنسوبين كاملة مع كل صلاحية
create or replace function public.qm_staff_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(r) from (
    select s.id, s.full_name as name, s.job_title, coalesce(jt.name_ar, s.job_title) as job,
      (s.user_id is not null and s.account_status = 'active') as has_account,
      coalesce((select jsonb_agg(q.role) from public.qm_staff_roles q where q.staff_id = s.id), '[]'::jsonb) as roles,
      exists (select 1 from public.qm_staff_roles q where q.staff_id = s.id and q.role = 'agent') as is_agent,
      exists (select 1 from public.qm_staff_roles q where q.staff_id = s.id and q.role = 'counselor') as is_counselor
    from public.staff_members s left join public.job_titles jt on jt.code = s.job_title
    where s.is_active order by s.full_name) r), '[]'::jsonb);
end $f$;

-- 8) منح الصلاحية وسحبها (فردياً أو لكل المنسوبين دفعة واحدة)
create or replace function public.qm_set_role(p_staff uuid, p_role text, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $f$
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  if p_role not in ('agent', 'counselor', 'reinforce', 'behavior', 'reports', 'portal_admin') then raise exception 'forbidden'; end if;
  if p_role = 'portal_admin' and not public.qm_is_core_admin() then raise exception 'forbidden'; end if;
  if p_on then insert into public.qm_staff_roles (staff_id, role, granted_by) values (p_staff, p_role, public.qm_me()) on conflict do nothing;
  else delete from public.qm_staff_roles where staff_id = p_staff and role = p_role; end if;
  perform public.qm_audit(case when p_on then 'grant_role' else 'revoke_role' end, 'qm_staff_roles', p_staff, null, jsonb_build_object('role', p_role));
end $f$;

create or replace function public.qm_set_role_all(p_role text, p_on boolean)
returns int language plpgsql security definer set search_path = '' as $f$
declare n int;
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  if p_role not in ('reinforce', 'behavior', 'reports') then raise exception 'forbidden'; end if;
  if p_on then
    insert into public.qm_staff_roles (staff_id, role, granted_by)
    select s.id, p_role, public.qm_me() from public.staff_members s where s.is_active on conflict do nothing;
  else delete from public.qm_staff_roles where role = p_role; end if;
  get diagnostics n = row_count;
  perform public.qm_audit(case when p_on then 'grant_role' else 'revoke_role' end, 'qm_staff_roles', null, null, jsonb_build_object('role', p_role, 'all', true, 'count', n));
  return n;
end $f$;
revoke all on function public.qm_set_role_all(text, boolean) from public, anon;
grant execute on function public.qm_set_role_all(text, boolean) to authenticated;
