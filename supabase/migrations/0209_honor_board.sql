-- 0209: لوحة الشرف العامة (للزائر دون دخول)، نقاط الوسام ونوعه وصورته، المنح الجماعي حسب الفصل، الرصيد الشهري، أنشط المانحين.
-- العرض العام يقتصر على: الاسم، الصف والفصل، النقاط، الأوسمة، واسم المانح. لا رقم متعلم ولا ملاحظات نصية ولا أي بيانات سلوكية.

-- ---------- الأوسمة: نقاط ونوع وصورة ----------
alter table public.qm_badges add column if not exists points int not null default 0 check (points >= 0 and points <= 1000);
alter table public.qm_badges add column if not exists kind text not null default 'general' check (kind in ('educational','general'));
alter table public.qm_badges add column if not exists image_path text;

alter table public.qm_points_ledger drop constraint if exists qm_points_ledger_kind_check;
alter table public.qm_points_ledger add constraint qm_points_ledger_kind_check check (kind in ('reinforcement','correction','reversal','badge'));

-- صور الأوسمة: حاوية عامة للقراءة، والرفع والحذف لمدير النواة فقط
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('qm-badges', 'qm-badges', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists qm_badge_img_ins on storage.objects;
create policy qm_badge_img_ins on storage.objects for insert to authenticated with check (bucket_id = 'qm-badges' and public.qm_is_admin());
drop policy if exists qm_badge_img_upd on storage.objects;
create policy qm_badge_img_upd on storage.objects for update to authenticated using (bucket_id = 'qm-badges' and public.qm_is_admin()) with check (bucket_id = 'qm-badges' and public.qm_is_admin());
drop policy if exists qm_badge_img_del on storage.objects;
create policy qm_badge_img_del on storage.objects for delete to authenticated using (bucket_id = 'qm-badges' and public.qm_is_admin());

-- ---------- دوال مساعدة داخلية ----------
create or replace function public.qm_month_start() returns timestamptz language sql stable set search_path = '' as $f$
  select date_trunc('month', now() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh' $f$;

create or replace function public.qm_enrolled()
returns table (student_id uuid, name text, grade_code text, grade text, grade_sort int, section_id uuid, section text)
language sql stable security definer set search_path = '' as $f$
  select s.id, s.full_name, e.grade_code, g.name_ar, g.sort_order, cs.id, cs.name
  from public.students s
  join public.student_enrollments e on e.student_id = s.id and e.status = 'enrolled'
  join public.academic_years y on y.id = e.year_id and y.status = 'current'
  left join public.grade_levels g on g.code = e.grade_code
  left join public.class_sections cs on cs.id = e.section_id $f$;

-- ---------- منح الوسام: متاح لكل منسوب فعّال، ويضيف نقاط الوسام إلى الدفتر ----------
create or replace function public.qm_award_badge(p_student uuid, p_badge uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); bid uuid; b public.qm_badges%rowtype;
begin
  if me is null then raise exception 'not_staff'; end if;
  select * into b from public.qm_badges where id = p_badge and is_active;
  if not found then raise exception 'type_invalid'; end if;
  if not exists (select 1 from public.qm_enrollment(p_student)) then raise exception 'student_not_enrolled'; end if;
  begin
    insert into public.qm_student_badges (student_id, badge_id, note, awarded_by) values (p_student, p_badge, nullif(btrim(p_note), ''), me) returning id into bid;
  exception when unique_violation then raise exception 'duplicate'; end;
  if b.points > 0 then
    insert into public.qm_points_ledger (student_id, points, kind, reason, source_type, source_id, created_by)
    values (p_student, b.points, 'badge', 'وسام: ' || b.name_ar, 'badge', bid, me);
  end if;
  perform public.qm_audit('award_badge', 'qm_student_badges', bid, null, jsonb_build_object('student_id', p_student, 'badge_id', p_badge, 'points', b.points));
  return bid;
end $f$;

create or replace function public.qm_revoke_badge(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $f$
declare me uuid := public.qm_me(); l public.qm_points_ledger%rowtype;
begin
  if not public.qm_is_admin() then raise exception 'forbidden'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'note_required'; end if;
  update public.qm_student_badges set revoked_at = now(), revoked_by = me where id = p_id and revoked_at is null;
  if not found then raise exception 'not_found'; end if;
  select * into l from public.qm_points_ledger where source_type = 'badge' and source_id = p_id and reverses_id is null;
  if found then
    insert into public.qm_points_ledger (student_id, points, kind, reason, source_type, source_id, reverses_id, created_by)
    values (l.student_id, -l.points, 'reversal', btrim(p_reason), 'badge', null, l.id, me);
  end if;
  perform public.qm_audit('revoke_badge', 'qm_student_badges', p_id, null, null, p_reason);
end $f$;

-- ---------- المنح: كشف الفصل، والمنح الفردي أو الجماعي ----------
create or replace function public.qm_section_roster(p_section uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  return coalesce((select jsonb_agg(r order by r.name) from (
    select e.student_id as id, e.name, e.grade, e.section,
      coalesce((select sum(l.points) from public.qm_points_ledger l where l.student_id = e.student_id), 0)::int as balance,
      coalesce((select sum(l.points) from public.qm_points_ledger l where l.student_id = e.student_id and l.created_at >= public.qm_month_start()), 0)::int as month,
      coalesce((select jsonb_agg(sb.badge_id) from public.qm_student_badges sb where sb.student_id = e.student_id and sb.revoked_at is null), '[]'::jsonb) as badges
    from public.qm_enrolled() e where e.section_id = p_section) r), '[]'::jsonb);
end $f$;

-- p_kind: points (p_ref نوع التعزيز) أو badge (p_ref الوسام). المكرر وغير المقيّد يُتجاوز ويُذكر في النتيجة.
create or replace function public.qm_grant_bulk(p_students uuid[], p_kind text, p_ref uuid, p_points int default 0, p_note text default null)
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
      if sqlerrm in ('duplicate', 'student_not_enrolled') then
        skipped := skipped || jsonb_build_object('id', sid, 'why', sqlerrm, 'name', (select full_name from public.students where id = sid));
      else raise; end if;
    end;
  end loop;
  return jsonb_build_object('ok', ok, 'skipped', skipped);
end $f$;

-- ---------- العرض العام (للزائر) ----------
create or replace function public.qm_pub_filters()
returns jsonb language sql stable security definer set search_path = '' as $f$
  select jsonb_build_object(
    'grades', coalesce((select jsonb_agg(jsonb_build_object('code', g.code, 'name', g.name_ar) order by g.sort_order) from public.grade_levels g where g.is_active), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'grade', c.grade_code) order by c.grade_code, c.name)
      from public.class_sections c join public.academic_years y on y.id = c.year_id and y.status = 'current' where c.is_active), '[]'::jsonb)) $f$;

-- p_period: all (الرصيد التراكمي) أو month (الشهر الحالي)
create or replace function public.qm_pub_leaderboard(p_scope text default 'school', p_grade text default null, p_section uuid default null, p_limit int default 10, p_period text default 'all')
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare lim int := least(greatest(coalesce(p_limit, 10), 3), 30); since timestamptz := case when p_period = 'month' then public.qm_month_start() else '-infinity'::timestamptz end;
begin
  if p_scope not in ('school','grade','section') or p_period not in ('all','month') then raise exception 'type_invalid'; end if;
  if (p_scope = 'grade' and p_grade is null) or (p_scope = 'section' and p_section is null) then raise exception 'type_invalid'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.rank, r.name) from (
    select * from (
      select e.student_id as id, e.name, e.grade, e.section, sum(l.points)::int as balance, rank() over (order by sum(l.points) desc) as rank
      from public.qm_points_ledger l join public.qm_enrolled() e on e.student_id = l.student_id
      where l.created_at >= since and (p_scope = 'school' or (p_scope = 'grade' and e.grade_code = p_grade) or (p_scope = 'section' and e.section_id = p_section))
      group by e.student_id, e.name, e.grade, e.section having sum(l.points) > 0) z
    where z.rank <= lim order by z.rank, z.name limit lim + 10) r), '[]'::jsonb);
end $f$;

create or replace function public.qm_pub_home()
returns jsonb language sql stable security definer set search_path = '' as $f$
  select jsonb_build_object(
    'stats', jsonb_build_object(
      'students_awarded', (select count(distinct student_id) from public.qm_points_ledger),
      'points', (select coalesce(sum(points), 0) from public.qm_points_ledger),
      'month_points', (select coalesce(sum(points), 0) from public.qm_points_ledger where created_at >= public.qm_month_start()),
      'badges', (select count(*) from public.qm_student_badges where revoked_at is null),
      'week', (select count(*) from public.qm_reinforcements where voided_at is null and created_at >= now() - interval '7 days')
              + (select count(*) from public.qm_student_badges where revoked_at is null and created_at >= now() - interval '7 days')),
    'top', public.qm_pub_leaderboard('school', null, null, 10, 'all'),
    'last_badges', coalesce((select jsonb_agg(x) from (
      select e.student_id as id, e.name, e.grade, e.section, b.name_ar as badge, b.icon, b.image_path as image, b.kind, b.points, p.full_name as by, sb.created_at as at
      from public.qm_student_badges sb join public.qm_badges b on b.id = sb.badge_id join public.qm_enrolled() e on e.student_id = sb.student_id
      join public.staff_members p on p.id = sb.awarded_by where sb.revoked_at is null order by sb.created_at desc limit 8) x), '[]'::jsonb),
    'last_points', coalesce((select jsonb_agg(x) from (
      select e.student_id as id, e.name, e.grade, e.section, t.name_ar as type, r.points, p.full_name as by, r.created_at as at
      from public.qm_reinforcements r join public.qm_reinforcement_types t on t.id = r.type_id join public.qm_enrolled() e on e.student_id = r.student_id
      join public.staff_members p on p.id = r.given_by where r.voided_at is null and r.points > 0 order by r.created_at desc limit 8) x), '[]'::jsonb),
    'givers', coalesce((select jsonb_agg(x) from (
      select p.full_name as name, sum(g.n_points)::int as awards, sum(g.points)::int as points, sum(g.n_badges)::int as badges
      from (select given_by as staff, 1 as n_points, points, 0 as n_badges from public.qm_reinforcements where voided_at is null
            union all select awarded_by, 0, 0, 1 from public.qm_student_badges where revoked_at is null) g
      join public.staff_members p on p.id = g.staff group by p.id, p.full_name
      order by sum(g.n_points) + sum(g.n_badges) desc, sum(g.points) desc, p.full_name limit 5) x), '[]'::jsonb),
    'ways', coalesce((select jsonb_agg(jsonb_build_object('name', t.name_ar, 'points', t.default_points) order by t.default_points desc, t.sort_order)
      from public.qm_reinforcement_types t where t.is_active and t.default_points > 0), '[]'::jsonb)) $f$;

create or replace function public.qm_pub_directory(p_grade text default null, p_section uuid default null, p_q text default null, p_limit int default 48, p_offset int default 0)
returns jsonb language sql stable security definer set search_path = '' as $f$
  with f as (select e.* from public.qm_enrolled() e
    where (p_grade is null or e.grade_code = p_grade) and (p_section is null or e.section_id = p_section)
      and (nullif(btrim(coalesce(p_q, '')), '') is null or e.name ilike '%' || btrim(p_q) || '%'))
  select jsonb_build_object('total', (select count(*) from f),
    'rows', coalesce((select jsonb_agg(r) from (
      select f.student_id as id, f.name, f.grade, f.section,
        coalesce((select sum(points) from public.qm_points_ledger where student_id = f.student_id), 0)::int as balance,
        (select count(*) from public.qm_student_badges sb where sb.student_id = f.student_id and sb.revoked_at is null)::int as badges
      from f order by f.grade_sort, f.section, f.name limit least(greatest(coalesce(p_limit, 48), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) r), '[]'::jsonb)) $f$;

create or replace function public.qm_pub_student(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare e record; bal int; out jsonb;
begin
  select * into e from public.qm_enrolled() x where x.student_id = p_student limit 1;
  if not found then raise exception 'not_found'; end if;
  select coalesce(sum(points), 0) into bal from public.qm_points_ledger where student_id = p_student;
  return jsonb_build_object(
    'id', e.student_id, 'name', e.name, 'grade', e.grade, 'section', e.section,
    'balance', bal,
    'month', (select coalesce(sum(points), 0) from public.qm_points_ledger where student_id = p_student and created_at >= public.qm_month_start()),
    'months', coalesce((select jsonb_agg(jsonb_build_object('m', m, 'points', p) order by m desc) from (
        select to_char(created_at at time zone 'Asia/Riyadh', 'YYYY-MM') as m, sum(points)::int as p from public.qm_points_ledger where student_id = p_student group by 1) q), '[]'::jsonb),
    'rank', (select count(*) + 1 from (select l.student_id from public.qm_points_ledger l join public.qm_enrolled() x on x.student_id = l.student_id group by 1 having sum(l.points) > bal) z),
    'rank_total', (select count(*) from public.qm_enrolled()),
    'rank_grade', (select count(*) + 1 from (select l.student_id from public.qm_points_ledger l join public.qm_enrolled() x on x.student_id = l.student_id and x.grade_code = e.grade_code group by 1 having sum(l.points) > bal) z),
    'grade_total', (select count(*) from public.qm_enrolled() x where x.grade_code = e.grade_code),
    'rank_section', (select count(*) + 1 from (select l.student_id from public.qm_points_ledger l join public.qm_enrolled() x on x.student_id = l.student_id and x.section_id = e.section_id group by 1 having sum(l.points) > bal) z),
    'section_total', (select count(*) from public.qm_enrolled() x where x.section_id = e.section_id),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('name', b.name_ar, 'icon', b.icon, 'image', b.image_path, 'kind', b.kind, 'points', b.points, 'criteria', b.criteria, 'by', p.full_name, 'at', sb.created_at) order by sb.created_at desc)
        from public.qm_student_badges sb join public.qm_badges b on b.id = sb.badge_id join public.staff_members p on p.id = sb.awarded_by where sb.student_id = p_student and sb.revoked_at is null), '[]'::jsonb),
    'points', coalesce((select jsonb_agg(x) from (select t.name_ar as type, r.points, p.full_name as by, r.created_at as at
        from public.qm_reinforcements r join public.qm_reinforcement_types t on t.id = r.type_id join public.staff_members p on p.id = r.given_by
        where r.student_id = p_student and r.voided_at is null and r.points > 0 order by r.created_at desc limit 60) x), '[]'::jsonb));
end $f$;

-- ---------- الصلاحيات ----------
revoke all on function public.qm_enrolled(), public.qm_month_start() from public, anon, authenticated;
revoke all on function public.qm_section_roster(uuid), public.qm_grant_bulk(uuid[], text, uuid, int, text), public.qm_award_badge(uuid, uuid, text), public.qm_revoke_badge(uuid, text) from public, anon;
grant execute on function public.qm_section_roster(uuid), public.qm_grant_bulk(uuid[], text, uuid, int, text), public.qm_award_badge(uuid, uuid, text), public.qm_revoke_badge(uuid, text) to authenticated;
revoke all on function public.qm_pub_filters(), public.qm_pub_home(), public.qm_pub_leaderboard(text, text, uuid, int, text), public.qm_pub_directory(text, uuid, text, int, int), public.qm_pub_student(uuid) from public;
grant execute on function public.qm_pub_filters(), public.qm_pub_home(), public.qm_pub_leaderboard(text, text, uuid, int, text), public.qm_pub_directory(text, uuid, text, int, int), public.qm_pub_student(uuid) to anon, authenticated;

-- سبب الاستحقاق للأوسمة الأولية: يُؤخذ من الوصف بدل العبارة المؤقتة
update public.qm_badges set criteria = description where criteria = 'يحدده المسؤول' and description is not null;
