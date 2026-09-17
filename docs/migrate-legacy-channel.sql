-- Clients imported from Xero and the tier sheet pre-date lead tracking, so we
-- do not know where they came from. They are marked "Legacy client" rather than
-- left blank, so channel reporting only ever describes leads we actually tracked.
-- Safe to run twice.

insert into public.list_items (list, value, sort_order)
  select 'channel', 'Legacy client', 99
  where not exists (select 1 from public.list_items where list = 'channel' and value = 'Legacy client');

update public.clients
  set lead_channel = 'Legacy client'
  where lead_channel is null or btrim(lead_channel) = '';
