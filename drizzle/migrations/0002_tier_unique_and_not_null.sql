-- Move the per-day uniqueness from service_line to tier, and make tier required now that every row is backfilled.
-- The app no longer reads or writes service_line; the column stays in place.
alter table public.daily_entries alter column service_line drop not null;
alter table public.daily_entries drop constraint if exists daily_entries_date_channel_service_line_key;
create unique index if not exists daily_entries_date_channel_tier_key on public.daily_entries (date, channel, tier);
alter table public.daily_entries alter column tier set not null;