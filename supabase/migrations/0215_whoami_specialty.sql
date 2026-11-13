-- تخصص المنسوب في qm_whoami: تُعرض أوسمة مادته أولاً في نافذة منح الوسام.
create or replace function public.qm_whoami()
returns jsonb language sql stable security definer set search_path = '' as $f$
  select case when public.qm_me() is null then null else jsonb_build_object(
    'staff_id', public.qm_me(),
    'name', (select full_name from public.staff_members where id = public.qm_me()),
    'job_title', (select job_title from public.staff_members where id = public.qm_me()),
    'specialty', (select specialty from public.staff_members where id = public.qm_me()),
    'is_admin', public.qm_is_admin(), 'is_agent', public.qm_has('agent'), 'is_counselor', public.qm_has('counselor')) end $f$;
