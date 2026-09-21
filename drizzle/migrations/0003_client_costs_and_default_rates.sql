-- Net margin per client on the Capacity page.
-- Each active client gets its monthly delivery cost in three parts (filming incl.
-- travel, editing, social scheduling/posting/ads), each as hours x an hourly rate,
-- plus any other monthly cost. A blank rate uses the default rate in settings.
-- Safe to run twice.

create table if not exists public.client_costs (
  client_id uuid primary key references public.clients (id) on delete cascade,
  filming_hours numeric check (filming_hours >= 0),
  filming_rate numeric check (filming_rate >= 0),
  editing_hours numeric check (editing_hours >= 0),
  editing_rate numeric check (editing_rate >= 0),
  social_hours numeric check (social_hours >= 0),
  social_rate numeric check (social_rate >= 0),
  other_cost numeric check (other_cost >= 0),
  notes text,
  updated_at timestamptz not null default now()
);

drop trigger if exists client_costs_touch on public.client_costs;
create trigger client_costs_touch before update on public.client_costs
  for each row execute function public.touch_updated_at();

alter table public.client_costs enable row level security;
drop policy if exists "team can read and write" on public.client_costs;
create policy "team can read and write" on public.client_costs for all to authenticated
  using (public.is_team_member()) with check (public.is_team_member());

grant select, insert, update, delete on public.client_costs to authenticated;
grant all on public.client_costs to service_role;

-- Default hourly rates, used when a client's own rate is blank
alter table public.settings
  add column if not exists default_filming_rate numeric check (default_filming_rate >= 0),
  add column if not exists default_editing_rate numeric check (default_editing_rate >= 0),
  add column if not exists default_social_rate numeric check (default_social_rate >= 0);
