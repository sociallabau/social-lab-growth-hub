-- Revenue goals, so the dashboard can show MRR against the target the tier sheet sets.
-- Safe to run twice.

alter table public.settings
  add column if not exists target_monthly_revenue numeric not null default 125000;

alter table public.packages
  add column if not exists revenue_target numeric;

-- Goals from "P&L - ECO - P&L Tier 26-27"
update public.packages set revenue_target = 45000 where tier = 'Tier 1' and revenue_target is null;
update public.packages set revenue_target = 40000 where tier = 'Tier 2' and revenue_target is null;
update public.packages set revenue_target = 20000 where tier = 'Tier 3' and revenue_target is null;

insert into public.packages (tier, revenue_target)
  select 'Ad Only', 10000
  where not exists (select 1 from public.packages where tier = 'Ad Only');
update public.packages set revenue_target = 10000 where tier = 'Ad Only' and revenue_target is null;
