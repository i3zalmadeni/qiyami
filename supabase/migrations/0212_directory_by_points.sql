-- 0212: ترتيب دليل الطلاب من الأعلى نقاطاً إلى الأقل.
create or replace function public.qm_pub_directory(p_grade text default null, p_section uuid default null, p_q text default null, p_limit int default 48, p_offset int default 0)
returns jsonb language sql stable security definer set search_path = '' as $f$
  with f as (select e.* from public.qm_enrolled() e
    where (p_grade is null or e.grade_code = p_grade) and (p_section is null or e.section_id = p_section)
      and (nullif(btrim(coalesce(p_q, '')), '') is null or e.name ilike '%' || btrim(p_q) || '%'))
  select jsonb_build_object('total', (select count(*) from f),
    'rows', coalesce((select jsonb_agg(r order by r.balance desc, r.grade_sort, r.section, r.name) from (
      select f.student_id as id, f.name, f.grade, f.section, f.grade_sort,
        coalesce((select sum(points) from public.qm_points_ledger where student_id = f.student_id), 0)::int as balance,
        (select count(*) from public.qm_student_badges sb where sb.student_id = f.student_id and sb.revoked_at is null)::int as badges
      from f order by balance desc, f.grade_sort, f.section, f.name limit least(greatest(coalesce(p_limit, 48), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) r), '[]'::jsonb)) $f$;
