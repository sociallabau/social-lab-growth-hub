-- The growth hub tracks one program: the Ecosystem (Digital & Brand) retainer.
-- Service line was the wrong dimension, so everything is tracked by tier instead.
-- Safe to run twice.

-- 1. Daily entries: one row per channel per tier per day
alter table public.daily_entries rename column service_line to tier;

-- 2. Leads: which tier the enquiry is being sold into
alter table public.leads rename column service_line to tier;

-- 3. Clients already have a tier, so the service line column goes.
--    The view depends on it, so drop and recreate.
drop view if exists public.clients_with_stats;
alter table public.clients drop column if exists service_line;

create view public.clients_with_stats with (security_invoker = true) as
select c.*,
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

-- 4. Retire the service line list; tiers are the only dimension now
delete from public.list_items where list = 'service_line';

-- 5. Anything logged before this change keeps a tier, defaulting to Tier 2 (the middle of the book)
update public.daily_entries set tier = 'Tier 2' where tier is null or tier in ('Media', 'Digital & Brand', 'Podcast');
update public.leads set tier = null where tier in ('Media', 'Digital & Brand', 'Podcast');
