-- Zero-downtime route for docs/migrate-to-tiers.sql: add tier alongside service_line and backfill.
alter table public.daily_entries add column if not exists tier text;
alter table public.leads add column if not exists tier text;

update public.daily_entries set tier = case
  when service_line is null or service_line in ('Media', 'Digital & Brand', 'Podcast') then 'Tier 2'
  else service_line end
where tier is null;

update public.leads set tier = case
  when service_line in ('Media', 'Digital & Brand', 'Podcast') then null
  else service_line end
where tier is null;

-- Recreate the stats view without service_line
drop view if exists public.clients_with_stats;
create view public.clients_with_stats with (security_invoker = true) as
select c.id, c.name, c.tier, c.lead_channel, c.start_date, c.monthly_fee, c.end_date,
  c.last_scope_review, c.price_review_status, c.notes, c.lead_id, c.created_at, c.updated_at,
  case when c.end_date is null then 'Active' else 'Lost' end as status,
  case when c.start_date is null then null else
    greatest(0,
      (extract(year from age(coalesce(c.end_date, current_date), c.start_date)) * 12
       + extract(month from age(coalesce(c.end_date, current_date), c.start_date)))::int)
  end as months_active,
  case when c.start_date is null or c.monthly_fee is null then null else
    c.monthly_fee * (greatest(0,
      (extract(year from age(coalesce(c.end_date, current_date), c.start_date)) * 12
       + extract(month from age(coalesce(c.end_date, current_date), c.start_date)))::int) + 1)
  end as revenue_to_date
from public.clients c;

-- Revenue targets from docs/migrate-targets.sql
alter table public.settings
  add column if not exists target_monthly_revenue numeric not null default 125000;

alter table public.packages
  add column if not exists revenue_target numeric;