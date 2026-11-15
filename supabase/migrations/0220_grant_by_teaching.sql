-- المنح للمتعلمين المسندين فقط: النقاط والأوسمة لطلاب الفصول المسندة للمعلم في «إسناد التدريس» بالنواة الرقمية.
-- يُستثنى: إدارة البوابة ومدير النواة، ومن تُمنح له صلاحية «كل الفصول» (all_sections) من صفحة الصلاحيات.

alter table public.qm_staff_roles drop constraint if exists qm_staff_roles_role_check;
alter table public.qm_staff_roles add constraint qm_staff_roles_role_check
  check (role in ('agent', 'counselor', 'reinforce', 'behavior', 'reports', 'portal_admin', 'all_sections'));

-- وكيل شؤون الطلاب يمنح أوسمته لكل المدرسة: يبدأ بصلاحية «كل الفصول» (ويمكن سحبها)
insert into public.qm_staff_roles (staff_id, role) select staff_id, 'all_sections' from public.qm_staff_roles where role = 'agent' on conflict do nothing;

-- فصول المستخدم الحالي في العام الحالي
create or replace function public.qm_my_sections()
returns uuid[] language sql stable security definer set search_path = '' as $f$
  select coalesce(array_agg(distinct ta.section_id), '{}') from public.teaching_assignments ta
  join public.academic_years y on y.id = ta.year_id and y.status = 'current'
  where ta.staff_id = public.qm_me() $f$;
create or replace function public.qm_all_sections()
returns boolean language sql stable security definer set search_path = '' as $f$
  select public.qm_is_admin() or public.qm_has('all_sections') $f$;
create or replace function public.qm_can_student(p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $f$
  select public.qm_all_sections() or exists (select 1 from public.qm_enrollment(p_student) e where e.section_id = any (public.qm_my_sections())) $f$;
revoke all on function public.qm_my_sections(), public.qm_all_sections(), public.qm_can_student(uuid) from public, anon;
grant execute on function public.qm_my_sections(), public.qm_all_sections(), public.qm_can_student(uuid) to authenticated;

-- الفرض في دالتي المنح (سطر بعد فحص الصلاحية)، والمنح الجماعي يتجاوز غير المسند ويذكره
do $do$
declare f text; d text;
begin
  foreach f in array array['public.qm_give_reinforcement(uuid,uuid,text,integer,text)', 'public.qm_award_badge(uuid,uuid,text)'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position('qm_can_student' in d) = 0 then
      d := replace(d, $$if not public.qm_can('reinforce') then raise exception 'forbidden'; end if;$$,
        $$if not public.qm_can('reinforce') then raise exception 'forbidden'; end if;
  if not public.qm_can_student(p_student) then raise exception 'student_not_assigned'; end if;$$);
      if position('qm_can_student' in d) = 0 then raise exception 'patch failed: %', f; end if;
      execute d;
    end if;
  end loop;
  d := pg_get_functiondef('public.qm_grant_bulk(uuid[],text,uuid,integer,text)'::regprocedure);
  if position('student_not_assigned' in d) = 0 then
    d := replace(d, $$sqlerrm in ('duplicate', 'month_dup', 'student_not_enrolled')$$, $$sqlerrm in ('duplicate', 'month_dup', 'student_not_enrolled', 'student_not_assigned')$$);
    if position('student_not_assigned' in d) = 0 then raise exception 'patch failed: grant_bulk'; end if;
    execute d;
  end if;
end $do$;

-- الهوية: هل يمنح لكل الفصول، وما فصوله
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
    'can_reports', public.qm_is_admin() or public.qm_is_support() or public.qm_has('reports'),
    'all_sections', public.qm_all_sections(), 'my_sections', to_jsonb(public.qm_my_sections())) end $f$;

-- منح «كل الفصول» وسحبها من صفحة الصلاحيات
create or replace function public.qm_set_role(p_staff uuid, p_role text, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $f$
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  if p_role not in ('agent', 'counselor', 'reinforce', 'behavior', 'reports', 'portal_admin', 'all_sections') then raise exception 'forbidden'; end if;
  if p_role = 'portal_admin' and not public.qm_is_core_admin() then raise exception 'forbidden'; end if;
  if p_on then insert into public.qm_staff_roles (staff_id, role, granted_by) values (p_staff, p_role, public.qm_me()) on conflict do nothing;
  else delete from public.qm_staff_roles where staff_id = p_staff and role = p_role; end if;
  perform public.qm_audit(case when p_on then 'grant_role' else 'revoke_role' end, 'qm_staff_roles', p_staff, null, jsonb_build_object('role', p_role));
end $f$;
