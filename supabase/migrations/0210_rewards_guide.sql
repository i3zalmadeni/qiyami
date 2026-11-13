-- 0210: دليل النقاط والأوسمة العام. نوع وسام ثالث (إداري)، وطريقة استحقاق لأنواع التعزيز.
alter table public.qm_badges drop constraint if exists qm_badges_kind_check;
alter table public.qm_badges add constraint qm_badges_kind_check check (kind in ('educational','administrative','general'));
alter table public.qm_reinforcement_types add column if not exists criteria text;

create or replace function public.qm_pub_rewards()
returns jsonb language sql stable security definer set search_path = '' as $f$
  select jsonb_build_object(
    'types', coalesce((select jsonb_agg(jsonb_build_object('name', t.name_ar, 'points', t.default_points, 'domain', t.domain, 'criteria', t.criteria) order by t.default_points desc, t.sort_order) from public.qm_reinforcement_types t where t.is_active), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('name', b.name_ar, 'points', b.points, 'kind', b.kind, 'icon', b.icon, 'image', b.image_path, 'criteria', b.criteria) order by b.sort_order, b.name_ar) from public.qm_badges b where b.is_active), '[]'::jsonb)) $f$;
revoke all on function public.qm_pub_rewards() from public;
grant execute on function public.qm_pub_rewards() to anon, authenticated;
