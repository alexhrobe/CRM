-- ─── Views: SECURITY INVOKER ──────────────────────────────────────────────────
-- Por padrão, views no Postgres rodam como SECURITY DEFINER (com privilégios do
-- dono), o que ignora a RLS de quem consulta — o Advisor do Supabase sinaliza
-- isso. Com security_invoker = on, as views passam a respeitar a RLS do usuário.
-- (Postgres 15+; o projeto usa 17.) As tabelas-base já permitem SELECT a
-- usuários autenticados, então as telas continuam funcionando.

alter view public.v_pipeline_active set (security_invoker = on);
alter view public.v_account_health set (security_invoker = on);
alter view public.v_country_metrics set (security_invoker = on);
alter view public.v_monthly_kpis set (security_invoker = on);
