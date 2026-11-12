-- لوحة الصدارة: الأعلى نقاطاً في المدرسة أو الصف أو الفصل. الأرصدة الموجبة فقط، وحد أقصى 30.
create or replace function public.qm_leaderboard(p_scope text default 'school', p_grade text default null, p_section uuid default null, p_limit int default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare lim int := case when p_limit >= 30 then 30 else 20 end;
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  if p_scope not in ('school','grade','section') then raise exception 'type_invalid'; end if;
  if p_scope = 'grade' and p_grade is null then raise exception 'type_invalid'; end if;
  if p_scope = 'section' and p_section is null then raise exception 'type_invalid'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.rank, r.name) from (
    select * from (
      select s.id, s.full_name as name, g.name_ar as grade, cs.name as section, sum(l.points)::int as balance,
             rank() over (order by sum(l.points) desc) as rank
      from public.qm_points_ledger l join public.students s on s.id = l.student_id
      join public.student_enrollments e on e.student_id = s.id and e.status = 'enrolled'
      join public.academic_years y on y.id = e.year_id and y.status = 'current'
      left join public.grade_levels g on g.code = e.grade_code left join public.class_sections cs on cs.id = e.section_id
      where (p_scope = 'school' or (p_scope = 'grade' and e.grade_code = p_grade) or (p_scope = 'section' and e.section_id = p_section))
      group by s.id, s.full_name, g.name_ar, cs.name having sum(l.points) > 0) z
    where z.rank <= lim order by z.rank, z.name limit 40) r), '[]'::jsonb);
end $f$;

create or replace function public.qm_leaderboard_filters()
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  return jsonb_build_object(
    'grades', coalesce((select jsonb_agg(jsonb_build_object('code', g.code, 'name', g.name_ar) order by g.sort_order) from public.grade_levels g where g.is_active), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'grade', c.grade_code) order by c.grade_code, c.name)
      from public.class_sections c join public.academic_years y on y.id = c.year_id and y.status = 'current' where c.is_active), '[]'::jsonb));
end $f$;
revoke all on function public.qm_leaderboard(text, text, uuid, int), public.qm_leaderboard_filters() from public, anon;
grant execute on function public.qm_leaderboard(text, text, uuid, int), public.qm_leaderboard_filters() to authenticated;
