-- إصلاح فتح الواقعة: «vis || 'internal'» كان يُفسَّر دمج مصفوفتين فيفشل بـ malformed array literal
-- لكل من يملك دور الوكيل أو الموجه أو الإدارة. الصحيح array_append.
do $do$
declare d text := pg_get_functiondef('public.qm_incident_get(uuid)'::regprocedure);
begin
  if position('array_append(vis' in d) = 0 then
    d := replace(d, $$vis := vis || 'internal'$$, $$vis := array_append(vis, 'internal')$$);
    d := replace(d, $$vis := vis || 'counselor'$$, $$vis := array_append(vis, 'counselor')$$);
    if position($$vis || '$$ in d) > 0 then raise exception 'patch failed'; end if;
    execute d;
  end if;
end $do$;
