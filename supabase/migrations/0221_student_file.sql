-- ملف المتعلم في لوحة التحكم: كل النقاط والأوسمة والمواقف بمعرّفاتها، مع تعديل الأوسمة وحذف المواقف
create or replace function public.qm_student_file(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare me uuid := public.qm_me(); adm boolean := public.qm_is_admin();
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
        where pr.student_id = p_student) x), '[]'::jsonb));
end $f$;

-- سحب الوسام: يعكس صافي نقاطه (الأصل وأي تعديل لاحق)
create or replace function public.qm_revoke_badge(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to '' as $f$
declare me uuid := public.qm_me(); sid uuid; net int; orig uuid;
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'note_required'; end if;
  update public.qm_student_badges set revoked_at = now(), revoked_by = me where id = p_id and revoked_at is null returning student_id into sid;
  if not found then raise exception 'not_found'; end if;
  select coalesce(sum(points), 0) into net from public.qm_points_ledger where source_type = 'badge' and source_id = p_id;
  select id into orig from public.qm_points_ledger where source_type = 'badge' and source_id = p_id order by created_at limit 1;
  if net <> 0 then
    insert into public.qm_points_ledger (student_id, points, kind, reason, source_type, source_id, reverses_id, created_by)
    values (sid, -net, 'reversal', btrim(p_reason), 'badge', null, orig, me);
  end if;
  perform public.qm_audit('revoke_badge', 'qm_student_badges', p_id, null, null, p_reason);
end $f$;

-- تعديل وسام ممنوح: تغيير الوسام أو سبب المنح أو نقاطه، بحركة تصحيح موثقة بالفرق
create or replace function public.qm_edit_student_badge(p_id uuid, p_badge uuid, p_note text, p_points int, p_reason text)
returns void language plpgsql security definer set search_path to '' as $f$
declare me uuid := public.qm_me(); sb public.qm_student_badges%rowtype; b public.qm_badges%rowtype; cur int; delta int;
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'note_required'; end if;
  if coalesce(p_points, -1) < 0 or p_points > 1000 then raise exception 'points_invalid'; end if;
  select * into sb from public.qm_student_badges where id = p_id for update;
  if not found or sb.revoked_at is not null then raise exception 'not_found'; end if;
  select * into b from public.qm_badges where id = coalesce(p_badge, sb.badge_id);
  if not found then raise exception 'type_invalid'; end if;
  update public.qm_student_badges set badge_id = b.id, note = nullif(btrim(coalesce(p_note, '')), '') where id = p_id;
  select coalesce(sum(points), 0) into cur from public.qm_points_ledger where source_type = 'badge' and source_id = p_id;
  delta := p_points - cur;
  if delta <> 0 then
    insert into public.qm_points_ledger (student_id, points, kind, reason, source_type, source_id, created_by)
    values (sb.student_id, delta, 'correction', 'تعديل وسام: ' || b.name_ar || ' — ' || btrim(p_reason), 'badge', p_id, me);
  end if;
  perform public.qm_audit('edit_badge', 'qm_student_badges', p_id,
    jsonb_build_object('badge_id', sb.badge_id, 'note', sb.note, 'points', cur),
    jsonb_build_object('badge_id', b.id, 'note', p_note, 'points', p_points), p_reason);
end $f$;

-- حذف موقف إيجابي (بلا نقاط): للمنسق أو لمن سجّله
create or replace function public.qm_delete_positive(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to '' as $f$
declare me uuid := public.qm_me(); r public.qm_positive_records%rowtype;
begin
  if me is null then raise exception 'not_staff'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'note_required'; end if;
  select * into r from public.qm_positive_records where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if not (public.qm_is_admin() or r.recorded_by = me) then raise exception 'forbidden'; end if;
  delete from public.qm_positive_records where id = p_id;
  perform public.qm_audit('delete_positive', 'qm_positive_records', p_id, to_jsonb(r), null, p_reason);
end $f$;

revoke all on function public.qm_student_file(uuid), public.qm_edit_student_badge(uuid, uuid, text, int, text), public.qm_delete_positive(uuid, text) from public, anon;
grant execute on function public.qm_student_file(uuid), public.qm_edit_student_badge(uuid, uuid, text, int, text), public.qm_delete_positive(uuid, text) to authenticated;
