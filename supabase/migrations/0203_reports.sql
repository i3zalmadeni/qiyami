-- تقرير مجمّع للفترة: أعداد فقط بلا أسماء متعلمين. الوقائع للإدارة والوكيل والموجه فقط.
create or replace function public.qm_report(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $f$
declare sens boolean := public.qm_is_admin() or public.qm_is_support();
begin
  if public.qm_me() is null then raise exception 'not_staff'; end if;
  if not sens then raise exception 'forbidden'; end if;
  if p_from is null or p_to is null or p_from > p_to then raise exception 'type_invalid'; end if;
  return jsonb_build_object('from', p_from, 'to', p_to,
    'reinforcements', jsonb_build_object(
      'total', (select count(*) from public.qm_reinforcements where voided_at is null and (created_at at time zone 'Asia/Riyadh')::date between p_from and p_to),
      'points', (select coalesce(sum(points),0) from public.qm_reinforcements where voided_at is null and (created_at at time zone 'Asia/Riyadh')::date between p_from and p_to),
      'by_type', (select coalesce(jsonb_agg(jsonb_build_object('name', n, 'n', c) order by c desc), '[]'::jsonb) from (select t.name_ar n, count(*) c from public.qm_reinforcements r join public.qm_reinforcement_types t on t.id = r.type_id where r.voided_at is null and (r.created_at at time zone 'Asia/Riyadh')::date between p_from and p_to group by 1) x),
      'by_grade', (select coalesce(jsonb_agg(jsonb_build_object('name', n, 'n', c) order by c desc), '[]'::jsonb) from (select coalesce(g.name_ar,'—') n, count(*) c from public.qm_reinforcements r left join public.grade_levels g on g.code = r.grade_code where r.voided_at is null and (r.created_at at time zone 'Asia/Riyadh')::date between p_from and p_to group by 1) x)),
    'incidents', jsonb_build_object(
      'total', (select count(*) from public.qm_incidents where occurred_on between p_from and p_to),
      'by_category', (select coalesce(jsonb_agg(jsonb_build_object('name', n, 'n', c) order by c desc), '[]'::jsonb) from (select k.name_ar n, count(*) c from public.qm_incidents i join public.qm_behavior_categories k on k.id = i.category_id where i.occurred_on between p_from and p_to group by 1) x),
      'by_status', (select coalesce(jsonb_agg(jsonb_build_object('name', n, 'n', c) order by c desc), '[]'::jsonb) from (select s.name_ar n, count(*) c from public.qm_incidents i join public.qm_incident_statuses s on s.code = i.status where i.occurred_on between p_from and p_to group by 1) x)),
    'achievements', jsonb_build_object(
      'total', (select count(*) from public.qm_achievements where status = 'verified' and achieved_on between p_from and p_to),
      'by_category', (select coalesce(jsonb_agg(jsonb_build_object('name', n, 'n', c) order by c desc), '[]'::jsonb) from (select k.name_ar n, count(*) c from public.qm_achievements a join public.qm_achievement_categories k on k.id = a.category_id where a.status = 'verified' and a.achieved_on between p_from and p_to group by 1) x),
      'by_level', (select coalesce(jsonb_agg(jsonb_build_object('name', n, 'n', c) order by c desc), '[]'::jsonb) from (select level n, count(*) c from public.qm_achievements where status = 'verified' and achieved_on between p_from and p_to group by 1) x)),
    'support', jsonb_build_object(
      'opened', (select count(*) from public.qm_support_cases where started_on between p_from and p_to),
      'closed', (select count(*) from public.qm_support_cases where closed_at is not null and (closed_at at time zone 'Asia/Riyadh')::date between p_from and p_to),
      'avg_improvement', (select round(avg(final_improvement)::numeric, 1) from public.qm_support_cases where final_improvement is not null and (closed_at at time zone 'Asia/Riyadh')::date between p_from and p_to),
      'by_type', (select coalesce(jsonb_agg(jsonb_build_object('name', n, 'n', c) order by c desc), '[]'::jsonb) from (select t.name_ar n, count(*) c from public.qm_support_cases s join public.qm_support_types t on t.id = s.type_id where s.started_on between p_from and p_to group by 1) x)));
end $f$;
revoke all on function public.qm_report(date, date) from public, anon;
grant execute on function public.qm_report(date, date) to authenticated;
