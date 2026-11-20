-- التقارير لا تظهر للمعلم (قرار المستخدم): تُقصر على المنسق والوكيل والموجه، وتُلغى صلاحية «التقارير» الفردية
do $m$
declare d text;
begin
  d := pg_get_functiondef('public.qm_report'::regproc);
  d := replace(d, 'public.qm_is_admin() or public.qm_is_support() or public.qm_has(''reports'')', 'public.qm_is_admin() or public.qm_is_support()');
  execute d;
  d := pg_get_functiondef('public.qm_whoami'::regproc);
  d := replace(d, 'public.qm_is_admin() or public.qm_is_support() or public.qm_has(''reports'')', 'public.qm_is_admin() or public.qm_is_support()');
  execute d;
end $m$;
