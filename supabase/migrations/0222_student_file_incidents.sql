-- ملف المتعلم: الوقائع الكاملة بقاعدة الاطلاع نفسها لفتح الواقعة (qm_incident_get)
create or replace function public.qm_student_file(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare me uuid := public.qm_me(); adm boolean := public.qm_is_admin(); ag boolean := public.qm_has('agent'); co boolean := public.qm_has('counselor');
begin
  if me is null then raise exception 'not_staff'; end if;
  return public.qm_student_profile(p_student) || jsonb_build_object(
    'is_admin', adm,
    'reinf', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select r.id, t.name_ar as type, r.points, r.description, p.full_name as by, r.created_at, (r.given_by = me) as mine
        from public.qm_reinforcements r join public.qm_reinforcement_types t on t.id = r.type_id join public.staff_members p on p.id = r.given_by
        where r.student_id = p_student and r.voided_at is null) x), '[]'::jsonb),
    'badge_rows', coalesce((select jsonb_agg(x order by x.at desc) from (
        select sb.id, sb.badge_id, b.name_ar as name, b.icon, b.kind,
          coalesce((select sum(l.points) from public.qm_points_ledger l where l.source_type = 'badge' and l.source_id = sb.id), 0)::int as points,
          sb.note, p.full_name as by, sb.created_at as at, (sb.awarded_by = me) as mine
        from public.qm_student_badges sb join public.qm_badges b on b.id = sb.badge_id join public.staff_members p on p.id = sb.awarded_by
        where sb.student_id = p_student and sb.revoked_at is null) x), '[]'::jsonb),
    'positive_rows', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select pr.id, c.name_ar as category, pr.description, p.full_name as by, pr.created_at, (pr.recorded_by = me) as mine
        from public.qm_positive_records pr join public.qm_behavior_categories c on c.id = pr.category_id join public.staff_members p on p.id = pr.recorded_by
        where pr.student_id = p_student) x), '[]'::jsonb),
    -- الوقائع بالقاعدة نفسها لفتح الواقعة: من رصدها، والوكيل والمنسق كل الوقائع، والموجه ما أُحيل إليه
    'incidents_all', (ag or adm or co),
    'incidents', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select i.id, i.no, i.occurred_on, i.occurred_time, i.location, c.name_ar as category, i.description, i.teacher_notes, i.parties,
          coalesce(array_length(i.attachment_paths, 1), 0) as attachments, st.name_ar as status_name, st.tone, st.is_closed,
          rp.full_name as reporter, (i.reported_by = me) as mine, i.created_at, i.updated_at, i.closed_at
        from public.qm_incidents i join public.qm_behavior_categories c on c.id = i.category_id
        join public.qm_incident_statuses st on st.code = i.status join public.staff_members rp on rp.id = i.reported_by
        where i.student_id = p_student and (i.reported_by = me or ag or adm
          or (co and exists (select 1 from public.qm_incident_events e where e.incident_id = i.id and e.kind = 'referred')))) x), '[]'::jsonb));
end $f$;

