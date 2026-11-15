-- دليل المتعلمين: كل المتعلمين المقيدين في العام الحالي دفعة واحدة، للفرز حسب المرحلة والصف والفصل في الواجهة.
-- لكل منسوب فعّال في النواة (كالبحث qm_students_search)، مع الرصيد وعدد الأوسمة.
create or replace function public.qm_students_directory()
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
revoke all on function public.qm_students_directory() from public, anon;
grant execute on function public.qm_students_directory() to authenticated;
