-- Ad spend is usually for the whole program rather than one tier, so it is
-- logged against "Unallocated". Keeps tier filters honest: filtering to Tier 1
-- shows Tier 1 leads and wins without borrowing program-wide spend.
-- Safe to run twice.

insert into public.list_items (list, value, sort_order)
  select 'tier', 'Unallocated', 90
  where not exists (select 1 from public.list_items where list = 'tier' and value = 'Unallocated');
