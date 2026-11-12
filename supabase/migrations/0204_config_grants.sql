-- الجداول المرجعية: قراءة لكل مسجّل، والكتابة يحكمها RLS (مدير النواة فقط)
grant select, insert, update, delete on public.qm_reinforcement_types, public.qm_badges, public.qm_behavior_categories, public.qm_incident_statuses, public.qm_achievement_categories, public.qm_support_types to authenticated;
grant select, update on public.qm_settings to authenticated;
