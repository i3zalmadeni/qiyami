-- 0208: إدارة النقاط (إضافة/تعديل/حذف) وإثراء الملف الشخصي بالمراتب والتحديثات
create or replace function public.qm_edit_reinforcement_points(p_id uuid, p_points int, p_reason text)
returns void language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); r public.qm_reinforcements%rowtype; delta int;
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  if coalesce(p_points, -1) < 0 or p_points > 1000 then raise exception 'points_invalid'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'note_required'; end if;
  select * into r from public.qm_reinforcements where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.voided_at is not null then raise exception 'already_void'; end if;
  delta := p_points - r.points;
  if delta = 0 then return; end if;
  update public.qm_reinforcements set points = p_points where id = p_id;
  insert into public.qm_points_ledger (student_id, points, kind, reason, created_by)
  values (r.student_id, delta, 'correction', 'تعديل نقاط تعزيز: ' || btrim(p_reason), me);
  perform public.qm_audit('edit_points', 'qm_reinforcements', p_id, jsonb_build_object('points', r.points), jsonb_build_object('points', p_points), p_reason);
end $f$;

create or replace function public.qm_admin_add_points(p_student uuid, p_type uuid, p_points int, p_description text default null)
returns uuid language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); en record; rid uuid; ty public.qm_reinforcement_types%rowtype;
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  if coalesce(p_points, 0) <= 0 or p_points > 1000 then raise exception 'points_invalid'; end if;
  select * into ty from public.qm_reinforcement_types where id = p_type and is_active;
  if not found then raise exception 'type_invalid'; end if;
  select * into en from public.qm_enrollment(p_student);
  if not found then raise exception 'student_not_enrolled'; end if;
  insert into public.qm_reinforcements (student_id, year_id, grade_code, section_id, type_id, description, points, given_by)
  values (p_student, en.year_id, en.grade_code, en.section_id, p_type, nullif(btrim(p_description), ''), p_points, me) returning id into rid;
  insert into public.qm_points_ledger (student_id, points, kind, reason, source_type, source_id, created_by)
  values (p_student, p_points, 'reinforcement', ty.name_ar, 'reinforcement', rid, me);
  perform public.qm_audit('create', 'qm_reinforcements', rid, null, jsonb_build_object('student_id', p_student, 'points', p_points, 'by_admin', true));
  return rid;
end $f$;

create or replace function public.qm_student_reinforcements_admin(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'balance', coalesce((select sum(points) from public.qm_points_ledger where student_id = p_student), 0),
    'rows', coalesce((select jsonb_agg(x order by x.created_at desc) from (select r.id, t.name_ar as type, r.points, r.description, p.full_name as by, r.created_at
       from public.qm_reinforcements r join public.qm_reinforcement_types t on t.id = r.type_id join public.staff_members p on p.id = r.given_by
       where r.student_id = p_student and r.voided_at is null order by r.created_at desc limit 100) x), '[]'::jsonb));
end $f$;

-- الملف الشخصي: مراتب (مدرسة/صف/فصل) وإجمالي النقاط الممنوحة وآخر التحديثات
create or replace function public.qm_student_profile(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare out jsonb; bal int; gcode text; sid uuid;
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  select coalesce(sum(points),0) into bal from public.qm_points_ledger where student_id = p_student;
  select e.grade_code, e.section_id into gcode, sid from public.qm_enrollment(p_student) e;
  select jsonb_build_object(
    'id', s.id, 'name', s.full_name, 'no', s.student_no, 'grade', g.name_ar, 'section', cs.name,
    'balance', bal,
    'earned', (select coalesce(sum(points),0) from public.qm_reinforcements where student_id = s.id and voided_at is null),
    'rank', (select count(*) + 1 from (select l.student_id, sum(l.points) t from public.qm_points_ledger l group by 1) z where z.t > bal),
    'rank_total', (select count(*) from (select l.student_id from public.qm_points_ledger l group by 1 having sum(l.points) > 0) z),
    'rank_grade', (select count(*) + 1 from (select l.student_id, sum(l.points) t from public.qm_points_ledger l
        join lateral public.qm_enrollment(l.student_id) e on e.grade_code = gcode group by 1) z where z.t > bal),
    'grade_total', (select count(*) from public.student_enrollments e join public.academic_years y on y.id = e.year_id and y.status = 'current' where e.status = 'enrolled' and e.grade_code = gcode),
    'rank_section', (select count(*) + 1 from (select l.student_id, sum(l.points) t from public.qm_points_ledger l
        join lateral public.qm_enrollment(l.student_id) e on e.section_id = sid group by 1) z where z.t > bal),
    'section_total', (select count(*) from public.student_enrollments e join public.academic_years y on y.id = e.year_id and y.status = 'current' where e.status = 'enrolled' and e.section_id = sid),
    'reinforcements', (select count(*) from public.qm_reinforcements where student_id = s.id and voided_at is null),
    'givers', coalesce((select jsonb_agg(x order by x.points desc) from (select p.full_name as name, count(*) as n, sum(r.points) as points
        from public.qm_reinforcements r join public.staff_members p on p.id = r.given_by where r.student_id = s.id and r.voided_at is null group by p.full_name) x), '[]'::jsonb),
    'by_type', coalesce((select jsonb_agg(x order by x.points desc, x.n desc) from (select t.name_ar as type, t.domain, count(*) as n, coalesce(sum(r.points), 0)::int as points
        from public.qm_reinforcements r join public.qm_reinforcement_types t on t.id = r.type_id where r.student_id = s.id and r.voided_at is null group by t.name_ar, t.domain) x), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('name', b.name_ar, 'icon', b.icon, 'desc', b.description, 'at', sb.created_at, 'by', p.full_name) order by sb.created_at desc)
        from public.qm_student_badges sb join public.qm_badges b on b.id = sb.badge_id join public.staff_members p on p.id = sb.awarded_by where sb.student_id = s.id and sb.revoked_at is null), '[]'::jsonb),
    'updates', coalesce((select jsonb_agg(u order by (u->>'at') desc) from (select u from (
        select jsonb_build_object('kind','points','title',t.name_ar,'points',r.points,'by',p.full_name,'at',r.created_at,'note',r.description) u
          from public.qm_reinforcements r join public.qm_reinforcement_types t on t.id = r.type_id join public.staff_members p on p.id = r.given_by where r.student_id = s.id and r.voided_at is null
        union all
        select jsonb_build_object('kind','badge','title',b.name_ar,'points',0,'by',p.full_name,'at',sb.created_at,'note',sb.note)
          from public.qm_student_badges sb join public.qm_badges b on b.id = sb.badge_id join public.staff_members p on p.id = sb.awarded_by where sb.student_id = s.id and sb.revoked_at is null) w
        order by (u->>'at') desc limit 15) q), '[]'::jsonb),
    'positive', coalesce((select jsonb_agg(x) from (select c.name_ar as category, pr.description, p.full_name as by, pr.created_at
        from public.qm_positive_records pr join public.qm_behavior_categories c on c.id = pr.category_id join public.staff_members p on p.id = pr.recorded_by
        where pr.student_id = s.id order by pr.created_at desc limit 20) x), '[]'::jsonb),
    'achievements', coalesce((select jsonb_agg(x) from (select a.id, a.title, k.name_ar as category, a.level, a.achieved_on
        from public.qm_achievement_students y join public.qm_achievements a on a.id = y.achievement_id and a.status = 'verified'
        join public.qm_achievement_categories k on k.id = a.category_id where y.student_id = s.id order by a.achieved_on desc limit 30) x), '[]'::jsonb),
    'talents', coalesce((select jsonb_agg(x) from (select t.field, t.name, t.description from public.qm_talents t where t.student_id = s.id and t.is_active order by t.created_at desc) x), '[]'::jsonb)
  ) into out
  from public.students s
  left join public.grade_levels g on g.code = gcode
  left join public.class_sections cs on cs.id = sid
  where s.id = p_student;
  if out is null then raise exception 'not_found'; end if;
  return out;
end $f$;

revoke all on function public.qm_edit_reinforcement_points(uuid,int,text), public.qm_admin_add_points(uuid,uuid,int,text), public.qm_student_reinforcements_admin(uuid), public.qm_student_profile(uuid) from public, anon;
grant execute on function public.qm_edit_reinforcement_points(uuid,int,text), public.qm_admin_add_points(uuid,uuid,int,text), public.qm_student_reinforcements_admin(uuid), public.qm_student_profile(uuid) to authenticated;
