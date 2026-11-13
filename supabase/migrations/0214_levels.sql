-- 0214: مستويات الطلاب حسب الرصيد التراكمي. يعدّل مدير النواة الاسم وحد النقاط وعدد المستويات.
create table if not exists public.qm_levels (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (char_length(btrim(name_ar)) between 1 and 40),
  min_points int not null check (min_points >= 0 and min_points <= 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint qm_levels_min_uq unique (min_points)
);
alter table public.qm_levels enable row level security;
drop policy if exists qm_levels_r on public.qm_levels;
create policy qm_levels_r on public.qm_levels for select to authenticated using (public.qm_me() is not null);
drop policy if exists qm_levels_w on public.qm_levels;
create policy qm_levels_w on public.qm_levels for all to authenticated using (public.qm_is_admin()) with check (public.qm_is_admin());
grant select, insert, update, delete on public.qm_levels to authenticated;
drop trigger if exists qm_levels_audit on public.qm_levels;
create trigger qm_levels_audit after insert or update or delete on public.qm_levels for each row execute function public.qm_audit_trg();

insert into public.qm_levels (name_ar, min_points)
select v.n, v.p from (values ('المنطلق', 0), ('الواعد', 50), ('المتميز', 100), ('الرائد', 200), ('القمّة', 500)) v(n, p)
where not exists (select 1 from public.qm_levels);

create or replace function public.qm_pub_levels()
returns jsonb language sql stable security definer set search_path = '' as $f$
  select coalesce(jsonb_agg(jsonb_build_object('name', name_ar, 'min', min_points) order by min_points), '[]'::jsonb)
  from public.qm_levels where is_active $f$;
grant execute on function public.qm_pub_levels() to anon, authenticated;
