-- الملف الشخصي للمتعلم: الجانب الإيجابي فقط. لا وقائع ولا حالات دعم ولا بيانات تواصل.
create or replace function public.qm_student_profile(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare out jsonb;
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  select jsonb_build_object(
    'id', s.id, 'name', s.full_name, 'no', s.student_no, 'grade', g.name_ar, 'section', cs.name,
    'balance', coalesce((select sum(points) from public.qm_points_ledger where student_id = s.id), 0),
    'rank', (select count(*) + 1 from (select l.student_id, sum(l.points) t from public.qm_points_ledger l group by 1) z
              where z.t > coalesce((select sum(points) from public.qm_points_ledger where student_id = s.id), 0)),
    'reinforcements', (select count(*) from public.qm_reinforcements where student_id = s.id and voided_at is null),
    'givers', coalesce((select jsonb_agg(x order by x.points desc) from (select p.full_name as name, count(*) as n, sum(r.points) as points
        from public.qm_reinforcements r join public.staff_members p on p.id = r.given_by where r.student_id = s.id and r.voided_at is null group by p.full_name) x), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('name', b.name_ar, 'icon', b.icon, 'at', sb.created_at, 'by', p.full_name) order by sb.created_at desc)
        from public.qm_student_badges sb join public.qm_badges b on b.id = sb.badge_id join public.staff_members p on p.id = sb.awarded_by where sb.student_id = s.id and sb.revoked_at is null), '[]'::jsonb),
    'reinforcement_list', coalesce((select jsonb_agg(x) from (select t.name_ar as type, r.points, r.description, p.full_name as by, r.created_at
        from public.qm_reinforcements r join public.qm_reinforcement_types t on t.id = r.type_id join public.staff_members p on p.id = r.given_by
        where r.student_id = s.id and r.voided_at is null order by r.created_at desc limit 50) x), '[]'::jsonb),
    'positive', coalesce((select jsonb_agg(x) from (select c.name_ar as category, pr.description, p.full_name as by, pr.created_at
        from public.qm_positive_records pr join public.qm_behavior_categories c on c.id = pr.category_id join public.staff_members p on p.id = pr.recorded_by
        where pr.student_id = s.id order by pr.created_at desc limit 20) x), '[]'::jsonb),
    'achievements', coalesce((select jsonb_agg(x) from (select a.id, a.title, k.name_ar as category, a.level, a.achieved_on
        from public.qm_achievement_students y join public.qm_achievements a on a.id = y.achievement_id and a.status = 'verified'
        join public.qm_achievement_categories k on k.id = a.category_id where y.student_id = s.id order by a.achieved_on desc limit 30) x), '[]'::jsonb),
    'talents', coalesce((select jsonb_agg(x) from (select t.field, t.name, t.description from public.qm_talents t where t.student_id = s.id and t.is_active order by t.created_at desc) x), '[]'::jsonb)
  ) into out
  from public.students s
  left join lateral (select e.grade_code, e.section_id from public.student_enrollments e join public.academic_years y on y.id = e.year_id and y.status = 'current'
    where e.student_id = s.id and e.status = 'enrolled' limit 1) en on true
  left join public.grade_levels g on g.code = en.grade_code
  left join public.class_sections cs on cs.id = en.section_id
  where s.id = p_student;
  if out is null then raise exception 'not_found'; end if;
  return out;
end $f$;
revoke all on function public.qm_student_profile(uuid) from public, anon;
grant execute on function public.qm_student_profile(uuid) to authenticated;
