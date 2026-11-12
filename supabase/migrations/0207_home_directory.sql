-- أرقام الرئيسية، ودليل الملفات للموقع، وتفصيل جوانب التعزيز في ملف المتعلم.
create or replace function public.qm_home_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  return jsonb_build_object(
    'students_awarded', (select count(distinct student_id) from public.qm_reinforcements where voided_at is null),
    'reinforcements', (select count(*) from public.qm_reinforcements where voided_at is null),
    'week', (select count(*) from public.qm_reinforcements where voided_at is null and created_at >= now() - interval '7 days'),
    'points', (select coalesce(sum(points), 0) from public.qm_points_ledger where points > 0),
    'badges', (select count(*) from public.qm_student_badges where revoked_at is null),
    'achievements', (select count(*) from public.qm_achievements where status = 'verified'),
    'students', (select count(*) from public.student_enrollments e join public.academic_years y on y.id = e.year_id and y.status = 'current' where e.status = 'enrolled'));
end $f$;

create or replace function public.qm_students_directory(p_grade text default null, p_section uuid default null, p_q text default null, p_limit int default 60, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.students s join public.student_enrollments e on e.student_id = s.id and e.status = 'enrolled'
      join public.academic_years y on y.id = e.year_id and y.status = 'current'
      where (p_grade is null or e.grade_code = p_grade) and (p_section is null or e.section_id = p_section) and (q is null or s.full_name ilike '%' || q || '%')),
    'rows', coalesce((select jsonb_agg(r) from (
      select s.id, s.full_name as name, g.name_ar as grade, cs.name as section, coalesce((select sum(points) from public.qm_points_ledger where student_id = s.id), 0)::int as balance
      from public.students s join public.student_enrollments e on e.student_id = s.id and e.status = 'enrolled'
      join public.academic_years y on y.id = e.year_id and y.status = 'current'
      left join public.grade_levels g on g.code = e.grade_code left join public.class_sections cs on cs.id = e.section_id
      where (p_grade is null or e.grade_code = p_grade) and (p_section is null or e.section_id = p_section) and (q is null or s.full_name ilike '%' || q || '%')
      order by g.sort_order, cs.name, s.full_name limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) r), '[]'::jsonb));
end $f$;
revoke all on function public.qm_home_stats(), public.qm_students_directory(text, uuid, text, int, int) from public, anon;
grant execute on function public.qm_home_stats(), public.qm_students_directory(text, uuid, text, int, int) to authenticated;
