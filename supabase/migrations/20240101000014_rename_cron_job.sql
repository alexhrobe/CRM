-- Renomeia job de cron (marca interna, sem referência PLP)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'plp-daily-maintenance') then
    perform cron.unschedule('plp-daily-maintenance');
  end if;
  if not exists (select 1 from cron.job where jobname = 'crm-export-daily-maintenance') then
    perform cron.schedule(
      'crm-export-daily-maintenance',
      '0 10 * * *',
      $$select public.run_daily_maintenance()$$
    );
  end if;
exception
  when undefined_table then null;
  when insufficient_privilege then null;
end;
$$;
