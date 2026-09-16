-- Schedules the integration syncs. Run AFTER the edge functions are deployed and
-- the secrets are set. Replace the two placeholders first:
--   <PROJECT_URL>  e.g. https://abcdefghijkl.supabase.co  (Lovable Cloud > Settings)
--   <CRON_SECRET>  the same value you saved as the CRON_SECRET secret

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('email-sync', '*/10 * * * *', $$
  select net.http_post(
    url := '<PROJECT_URL>/functions/v1/email-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);

select cron.schedule('instagram-sync', '*/10 * * * *', $$
  select net.http_post(
    url := '<PROJECT_URL>/functions/v1/instagram-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);

-- Hourly at 5 past; Meta revises recent days, so it re-pulls the last 7
select cron.schedule('meta-ads-sync', '5 * * * *', $$
  select net.http_post(
    url := '<PROJECT_URL>/functions/v1/meta-ads-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);

-- To stop one: select cron.unschedule('email-sync');
