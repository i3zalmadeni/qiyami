-- 1) يجوز منح الوسام نفسه للمتعلم نفسه مرة واحدة في كل شهر (بدل مرة واحدة طوال العام).
-- 2) الأوسمة التعليمية لمعلم المادة فقط (مدير النظام مستثنى).
drop index if exists public.qm_student_badge_uq;
create index if not exists qm_student_badges_recent_idx on public.qm_student_badges (student_id, badge_id, created_at desc) where revoked_at is null;

-- تخصص المنسوب (من النواة) إلى تصنيف المادة في الأوسمة
create or replace function public.qm_subject_of(p_specialty text)
returns text language sql immutable set search_path = '' as $f$
  select case
    when p_specialty is null then null
    when p_specialty like '%رياضيات%' then 'الرياضيات'
    when p_specialty like '%عربي%' then 'لغتي الخالدة'
    when p_specialty like '%إنجليزي%' or p_specialty like '%انجليزي%' then 'اللغة الإنجليزية'
    when p_specialty like '%علوم%' then 'العلوم'
    when p_specialty like '%إسلامي%' or p_specialty like '%اسلامي%' then 'الدراسات الإسلامية'
    when p_specialty like '%اجتماعي%' then 'الدراسات الاجتماعية'
    when p_specialty like '%حاسب%' or p_specialty like '%رقمي%' then 'المهارات الرقمية'
  end $f$;

create or replace function public.qm_award_badge(p_student uuid, p_badge uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); bid uuid; b public.qm_badges%rowtype;
begin
  if me is null then raise exception 'not_staff'; end if;
  select * into b from public.qm_badges where id = p_badge and is_active;
  if not found then raise exception 'type_invalid'; end if;
  if b.kind = 'educational' and not public.qm_is_admin()
     and coalesce(public.qm_subject_of((select specialty from public.staff_members where id = me)), '') <> coalesce(b.category, '-') then
    raise exception 'subject_mismatch';
  end if;
  if not exists (select 1 from public.qm_enrollment(p_student)) then raise exception 'student_not_enrolled'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_student::text || p_badge::text, 0));
  if exists (select 1 from public.qm_student_badges where student_id = p_student and badge_id = p_badge and revoked_at is null and created_at >= public.qm_month_start()) then
    raise exception 'month_dup';
  end if;
  insert into public.qm_student_badges (student_id, badge_id, note, awarded_by) values (p_student, p_badge, nullif(btrim(p_note), ''), me) returning id into bid;
  if b.points > 0 then
    insert into public.qm_points_ledger (student_id, points, kind, reason, source_type, source_id, created_by)
    values (p_student, b.points, 'badge', 'وسام: ' || b.name_ar, 'badge', bid, me);
  end if;
  perform public.qm_audit('award_badge', 'qm_student_badges', bid, null, jsonb_build_object('student_id', p_student, 'badge_id', p_badge, 'points', b.points));
  return bid;
end $f$;

create or replace function public.qm_grant_bulk(p_students uuid[], p_kind text, p_ref uuid, p_points integer default 0, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $f$
declare sid uuid; ok int := 0; skipped jsonb := '[]'::jsonb; ids uuid[];
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  if p_kind not in ('points', 'badge') then raise exception 'type_invalid'; end if;
  select array_agg(distinct x) into ids from unnest(p_students) x where x is not null;
  if coalesce(array_length(ids, 1), 0) = 0 then raise exception 'student_required'; end if;
  if array_length(ids, 1) > 60 then raise exception 'too_many'; end if;
  foreach sid in array ids loop
    begin
      if p_kind = 'points' then perform public.qm_give_reinforcement(sid, p_ref, p_note, coalesce(p_points, 0), null);
      else perform public.qm_award_badge(sid, p_ref, p_note); end if;
      ok := ok + 1;
    exception when others then
      if sqlerrm in ('duplicate', 'month_dup', 'student_not_enrolled') then
        skipped := skipped || jsonb_build_object('id', sid, 'why', sqlerrm, 'name', (select full_name from public.students where id = sid));
      else raise; end if;
    end;
  end loop;
  return jsonb_build_object('ok', ok, 'skipped', skipped);
end $f$;
