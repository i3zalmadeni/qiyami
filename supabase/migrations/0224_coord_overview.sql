-- الرئيسية للمنسق: نظرة شاملة تفاعلية لما يدور في قيمي خلال فترة، مع المقارنة بالفترة السابقة
create or replace function public.qm_coord_overview(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare
  v_n int := least(greatest(coalesce(p_days, 30), 7), 366);
  v_today date := (now() at time zone 'Asia/Riyadh')::date;
  v_d0 date := v_today - (v_n - 1);
  v_p0 date := v_d0 - v_n;
  v_t0 timestamptz := (v_d0::timestamp at time zone 'Asia/Riyadh');
  v_tp timestamptz := (v_p0::timestamp at time zone 'Asia/Riyadh');
  v_yr uuid := (select id from public.academic_years where status = 'current' limit 1);
  out jsonb;
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;

  with
  enr as (select e.student_id, e.grade_code, e.section_id from public.student_enrollments e where e.year_id = v_yr and e.status = 'enrolled'),
  r as (select * from public.qm_reinforcements where voided_at is null and created_at >= v_tp),
  b as (select sb.*, bd.name_ar as badge, coalesce(bd.points, 0) as bpoints from public.qm_student_badges sb join public.qm_badges bd on bd.id = sb.badge_id where sb.revoked_at is null and sb.created_at >= v_tp),
  i as (select * from public.qm_incidents where created_at >= v_tp),
  reached as (select student_id from r where created_at >= v_t0 union select student_id from b where created_at >= v_t0),
  kp as (select
      (select count(*) from r where created_at >= v_t0) r1, (select count(*) from r where created_at < v_t0) r0,
      (select coalesce(sum(points),0) from r where created_at >= v_t0) + (select coalesce(sum(bpoints),0) from b where created_at >= v_t0) p1,
      (select coalesce(sum(points),0) from r where created_at < v_t0) + (select coalesce(sum(bpoints),0) from b where created_at < v_t0) pp0,
      (select count(*) from b where created_at >= v_t0) b1, (select count(*) from b where created_at < v_t0) b0,
      (select count(*) from reached) s1,
      (select count(*) from (select student_id from r where created_at < v_t0 union select student_id from b where created_at < v_t0) z) s0,
      (select count(*) from i where created_at >= v_t0) i1, (select count(*) from i where created_at < v_t0) i0,
      (select count(distinct given_by) from r where created_at >= v_t0) g1, (select count(distinct given_by) from r where created_at < v_t0) g0,
      (select count(*) from public.qm_achievements where status = 'verified' and achieved_on >= v_d0) a1,
      (select count(*) from public.qm_achievements where status = 'verified' and achieved_on >= v_p0 and achieved_on < v_d0) a0)
  select jsonb_build_object(
    'from', v_d0, 'to', v_today, 'days', v_n,
    'enrolled', (select count(*) from enr),
    'givers_possible', (select count(distinct staff_id) from public.qm_staff_roles where role = 'reinforce'),
    'kpi', (select jsonb_build_object(
        'reinf', jsonb_build_array(r1, r0), 'points', jsonb_build_array(p1, pp0), 'badges', jsonb_build_array(b1, b0),
        'reached', jsonb_build_array(s1, s0), 'incidents', jsonb_build_array(i1, i0), 'givers', jsonb_build_array(g1, g0),
        'achievements', jsonb_build_array(a1, a0)) from kp),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('d', g.d,
        'reinf', (select count(*) from r where (r.created_at at time zone 'Asia/Riyadh')::date = g.d),
        'points', (select coalesce(sum(points),0) from r where (r.created_at at time zone 'Asia/Riyadh')::date = g.d)
                + (select coalesce(sum(bpoints),0) from b where (b.created_at at time zone 'Asia/Riyadh')::date = g.d),
        'badges', (select count(*) from b where (b.created_at at time zone 'Asia/Riyadh')::date = g.d),
        'incidents', (select count(*) from i where (i.created_at at time zone 'Asia/Riyadh')::date = g.d)) order by g.d), '[]'::jsonb)
      from (select generate_series(v_d0, v_today, interval '1 day')::date d) g),
    'sections', (select coalesce(jsonb_agg(x order by x.gsort, x.section), '[]'::jsonb) from (
        select cs.id, gl.code as grade_code, gl.name_ar as grade, gl.sort_order as gsort, cs.name as section,
          (select count(*) from enr where enr.section_id = cs.id) enrolled,
          (select count(*) from reached z join enr on enr.student_id = z.student_id where enr.section_id = cs.id) reached,
          (select count(*) from r where r.section_id = cs.id and r.created_at >= v_t0) reinf,
          (select coalesce(sum(points),0) from r where r.section_id = cs.id and r.created_at >= v_t0) points,
          (select count(*) from i where i.section_id = cs.id and i.created_at >= v_t0) incidents
        from public.class_sections cs join public.grade_levels gl on gl.code = cs.grade_code
        where cs.year_id = v_yr and cs.is_active) x where x.enrolled > 0),
    'types', (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (select t.name_ar as name, count(*) n, coalesce(sum(r.points),0) points
        from r join public.qm_reinforcement_types t on t.id = r.type_id where r.created_at >= v_t0 group by t.name_ar) x),
    'badges', (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (select badge as name, count(*) n from b where created_at >= v_t0 group by badge) x),
    'givers', (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (select p.id, p.full_name as name, count(*) n, coalesce(sum(r.points),0) points, count(distinct r.student_id) students
        from r join public.staff_members p on p.id = r.given_by where r.created_at >= v_t0 group by p.id, p.full_name order by count(*) desc limit 10) x),
    'idle', (select coalesce(jsonb_agg(x order by x.name), '[]'::jsonb) from (select p.id, p.full_name as name from public.qm_staff_roles sr join public.staff_members p on p.id = sr.staff_id
        where sr.role = 'reinforce' and p.is_active and not exists (select 1 from r where r.given_by = p.id and r.created_at >= v_t0)) x),
    'unreached', (select count(*) from enr where not exists (select 1 from reached z where z.student_id = enr.student_id)),
    'unreached_list', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select s.id, s.full_name as name, gl.name_ar as grade, cs.name as section
        from enr join public.students s on s.id = enr.student_id left join public.grade_levels gl on gl.code = enr.grade_code left join public.class_sections cs on cs.id = enr.section_id
        where not exists (select 1 from reached z where z.student_id = enr.student_id) order by gl.sort_order, cs.name, s.full_name limit 60) x),
    'pipeline', (select coalesce(jsonb_agg(x order by x.sort), '[]'::jsonb) from (select st.code, st.name_ar as name, st.tone, st.sort_order sort, st.is_closed,
        (select count(*) from public.qm_incidents q where q.status = st.code and (not st.is_closed or q.updated_at >= v_t0)) n
        from public.qm_incident_statuses st where st.is_active) x),
    'inc_categories', (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (select c.name_ar as name, count(*) n from i join public.qm_behavior_categories c on c.id = i.category_id
        where i.created_at >= v_t0 group by c.name_ar) x),
    'inc_overdue', (select count(*) from public.qm_incidents where status in ('observed','with_agent') and updated_at < now() - interval '3 days'),
    'achievements', jsonb_build_object(
        'pending', (select count(*) from public.qm_achievements where status = 'pending'),
        'needs_info', (select count(*) from public.qm_achievements where status = 'needs_info'),
        'verified', (select count(*) from public.qm_achievements where status = 'verified'),
        'by_level', (select coalesce(jsonb_object_agg(level, n), '{}'::jsonb) from (select level, count(*) n from public.qm_achievements where status = 'verified' group by level) z),
        'talents', (select count(*) from public.qm_talents where is_active),
        'talents_new', (select count(*) from public.qm_talents where is_active and created_at >= v_t0)),
    'support', jsonb_build_object(
        'active', (select count(*) from public.qm_support_cases where status in ('new','active')),
        'new', (select count(*) from public.qm_support_cases where status = 'new'),
        'due', (select count(*) from public.qm_support_cases where status <> 'closed' and next_follow_up < v_today),
        'closed', (select count(*) from public.qm_support_cases where status = 'closed' and closed_at >= v_t0)),
    'feed', (select coalesce(jsonb_agg(x order by x.at desc), '[]'::jsonb) from (
        (select 'points' k, s.id sid, s.full_name student, t.name_ar title, r.points, p.full_name as by, r.created_at as at
          from public.qm_reinforcements r join public.students s on s.id = r.student_id join public.qm_reinforcement_types t on t.id = r.type_id join public.staff_members p on p.id = r.given_by
          where r.voided_at is null order by r.created_at desc limit 25)
        union all (select 'badge', s.id, s.full_name, bd.name_ar, null, p.full_name, sb.created_at
          from public.qm_student_badges sb join public.students s on s.id = sb.student_id join public.qm_badges bd on bd.id = sb.badge_id join public.staff_members p on p.id = sb.awarded_by
          where sb.revoked_at is null order by sb.created_at desc limit 15)
        union all (select 'incident', s.id, s.full_name, c.name_ar, null, p.full_name, q.created_at
          from public.qm_incidents q join public.students s on s.id = q.student_id join public.qm_behavior_categories c on c.id = q.category_id join public.staff_members p on p.id = q.reported_by
          order by q.created_at desc limit 15)
        union all (select 'achievement', null, null, a.title, null, p.full_name, a.created_at
          from public.qm_achievements a join public.staff_members p on p.id = a.recorded_by order by a.created_at desc limit 10)
        order by at desc limit 40) x)
  ) into out from kp;
  return out;
end $f$;
revoke all on function public.qm_coord_overview(int) from public, anon;
grant execute on function public.qm_coord_overview(int) to authenticated;
