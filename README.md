# Social Lab Growth Hub

Build an internal growth dashboard for Social Lab, a Gold Coast marketing agency. Use Lovable Cloud for the database and authentication.

Enable Lovable Cloud, then run this SQL migration exactly as written. It creates every table, the row level security and the defaults. Do not change table or column names:

-- Social Lab Growth Hub: database, access rules and defaults.
-- Only signed-in people listed in team_members can read or write anything.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Team allowlist (no public sign-up; accounts are created by an admin)
-- ---------------------------------------------------------------------------
create table public.team_members (
  email text primary key check (email = lower(email)),
  full_name text,
  role text not null default 'admin' check (role in ('admin', 'member')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.team_members (email, full_name) values
  ('dan@sociallab.com.au', 'Dan'),
  ('blake@sociallab.com.au', 'Blake'),
  ('digital@sociallab.com.au', 'Digital'),
  ('emily@sociallab.com.au', 'Emily'),
  ('chloe@sociallab.com.au', 'Chloe');

create or replace function public.is_team_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where email = lower(coalesce(auth.jwt() ->> 'email', '')) and active
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Settings: one row of assumptions and targets
-- ---------------------------------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  tracking_start_month date not null default date '2026-09-01',
  gross_margin numeric not null default 0.5,
  avg_client_lifetime_months numeric not null default 18,
  fixed_monthly_acquisition_cost numeric not null default 0,
  target_leads_per_week numeric not null default 10,
  target_conversion numeric not null default 0.3,
  target_aov numeric not null default 4500,
  target_responded_30 numeric not null default 0.9,
  target_ltv_cac numeric not null default 3,
  -- Price test in thirds: current, mid and high monthly price points for proposals
  price_point_current numeric not null default 3000,
  price_point_mid numeric not null default 3600,
  price_point_high numeric not null default 4500,
  not_fit_resource_url text,
  enquiry_owner_email text,
  plan_ceiling numeric not null default 0.85,
  target_labour_pct numeric not null default 0.5,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- Editable dropdown lists
create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list text not null check (list in ('channel', 'service_line', 'tier', 'role')),
  value text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  unique (list, value)
);

insert into public.list_items (list, value, sort_order) values
  ('channel', 'Google Ads', 1), ('channel', 'Meta Ads', 2), ('channel', 'Instagram (organic)', 3),
  ('channel', 'Website / SEO', 4), ('channel', 'Email enquiry', 5), ('channel', 'Client referral', 6),
  ('channel', 'Partner referral', 7), ('channel', 'Existing client upsell', 8),
  ('channel', 'Networking / events', 9), ('channel', 'Outbound', 10), ('channel', 'Other', 11),
  ('service_line', 'Media', 1), ('service_line', 'Digital & Brand', 2), ('service_line', 'Podcast', 3),
  ('tier', 'Tier 1', 1), ('tier', 'Tier 2', 2), ('tier', 'Tier 3', 3), ('tier', 'One-off job', 4),
  ('role', 'Strategy & account management', 1), ('role', 'Videographer', 2), ('role', 'Editor', 3),
  ('role', 'Photographer', 4), ('role', 'Podcast producer', 5);

-- ---------------------------------------------------------------------------
-- Daily entries: one row per channel per service line per day
-- ---------------------------------------------------------------------------
create table public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  channel text not null,
  service_line text not null,
  new_leads int not null default 0 check (new_leads >= 0),
  responded_within_30_min int not null default 0 check (responded_within_30_min >= 0),
  meetings_held int not null default 0 check (meetings_held >= 0),
  clients_won int not null default 0 check (clients_won >= 0),
  value_won_monthly numeric not null default 0 check (value_won_monthly >= 0),
  marketing_spend numeric not null default 0 check (marketing_spend >= 0),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, channel, service_line),
  check (responded_within_30_min <= new_leads)
);
create index daily_entries_date on public.daily_entries (date);
create trigger daily_entries_touch before update on public.daily_entries
  for each row execute function public.touch_updated_at();

-- One row per day: who completed the "Log today" check-in and the day's notes
create table public.daily_checkins (
  date date primary key,
  completed_by uuid default auth.uid(),
  completed_at timestamptz not null default now(),
  leads_reviewed int not null default 0,
  highlights text,
  blockers text
);

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service_line text,
  tier text,
  lead_channel text,
  start_date date,
  monthly_fee numeric check (monthly_fee >= 0),
  end_date date,
  last_scope_review date,
  price_review_status text not null default 'none'
    check (price_review_status in ('none', 'planned', 'notice_given', 'accepted', 'transitioning_out')),
  notes text,
  lead_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

-- Status, months active and revenue to date, matching the spreadsheet formulas
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

-- Hours per client, for the four-week capacity baseline and scope reviews
create table public.client_hours (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  date date not null default current_date,
  person text,
  role text,
  hours numeric not null check (hours > 0),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index client_hours_client_date on public.client_hours (client_id, date);

-- ---------------------------------------------------------------------------
-- Leads CRM: every enquiry from every channel, including auto-captured ones
-- awaiting approval in the inbox (status = 'pending')
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  source text not null default 'manual'
    check (source in ('manual', 'email', 'instagram', 'calendly', 'meta_lead_form', 'website')),
  source_ref text unique,
  name text, company text, email text, phone text, instagram_handle text,
  channel text,
  service_line text,
  subject text,
  message text,
  ai_summary text,
  ai_is_lead boolean,
  ai_reason text,
  status text not null default 'pending' check (status in
    ('pending', 'rejected', 'new', 'contacted', 'meeting_booked', 'meeting_held', 'proposal', 'won', 'lost', 'nurture')),
  owner_email text,
  first_response_at timestamptz,
  meeting_at timestamptz,
  -- Qualifying questions from the enquiry form
  number_of_agents text,
  monthly_marketing_budget text,
  fit text not null default 'unknown' check (fit in ('unknown', 'fit', 'not_fit')),
  -- Price testing in thirds
  price_band text check (price_band in ('current', 'mid', 'high')),
  quoted_value numeric,
  won_value numeric,
  won_at timestamptz,
  lost_reason text,
  client_id uuid references public.clients (id) on delete set null,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_status on public.leads (status);
create index leads_received_at on public.leads (received_at);
create index leads_email on public.leads (lower(email));
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

alter table public.clients
  add constraint clients_lead_fk foreign key (lead_id) references public.leads (id) on delete set null;

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null default 'note',
  body text,
  created_by uuid default auth.uid()
);
create index lead_activities_lead on public.lead_activities (lead_id, at desc);

-- ---------------------------------------------------------------------------
-- Capacity planning
-- ---------------------------------------------------------------------------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  location text not null default 'Australia' check (location in ('Australia', 'Philippines')),
  hours_per_week numeric,
  annual_leave_weeks numeric,
  public_holidays_days numeric,
  sick_days numeric,
  training_days numeric,
  utilisation numeric,
  annual_cost numeric,
  pay_rise_per_year numeric,
  created_at timestamptz not null default now()
);

create table public.location_defaults (
  location text primary key,
  hours_per_week numeric not null,
  annual_leave_weeks numeric not null,
  public_holidays_days numeric not null,
  sick_days numeric not null,
  training_days numeric not null,
  utilisation numeric not null
);
insert into public.location_defaults values
  ('Australia', 38, 4, 11, 5, 5, 0.75),
  ('Philippines', 40, 1, 18, 5, 5, 0.80);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  tier text not null unique,
  price numeric,
  planned_volume int,
  -- hours per client per month by role, e.g. {"Editor": 12, "Videographer": 6}
  hours_by_role jsonb not null default '{}'::jsonb
);
insert into public.packages (tier) values ('Tier 1'), ('Tier 2'), ('Tier 3'), ('One-off job');

-- ---------------------------------------------------------------------------
-- Integrations
-- ---------------------------------------------------------------------------
create table public.meta_ads_daily (
  date date not null,
  ad_account_id text not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  leads int not null default 0,
  schedules int not null default 0,
  actions jsonb,
  synced_at timestamptz not null default now(),
  primary key (date, ad_account_id)
);

create table public.integration_runs (
  id uuid primary key default gen_random_uuid(),
  integration text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  items int default 0,
  message text
);
create index integration_runs_recent on public.integration_runs (integration, started_at desc);

create table public.integration_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- 30-day plan from the mentor email
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null,
  title text not null,
  done boolean not null default false,
  done_by uuid,
  done_at timestamptz
);
insert into public.checklist_items (sort_order, title) values
  (1, 'Load current clients into the tracker and start the Daily Log from Monday'),
  (2, 'Switch on lead generation for Social Lab'),
  (3, 'Agree who owns inbound enquiries and lock in the 30 minute response rule'),
  (4, 'Set the three test price points and use them on every new proposal'),
  (5, 'List the bottom 30% of clients by fee and time spent, and plan the price conversation'),
  (6, 'Track hours per client for four weeks to get a capacity baseline');

-- ---------------------------------------------------------------------------
-- Row level security: team members only, on every table
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'list_items', 'daily_entries', 'daily_checkins', 'clients', 'client_hours',
    'leads', 'lead_activities', 'staff', 'location_defaults', 'packages',
    'meta_ads_daily', 'integration_runs', 'integration_state', 'checklist_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "team can read and write" on public.%I for all to authenticated
         using (public.is_team_member()) with check (public.is_team_member())', t);
  end loop;
end $$;

alter table public.team_members enable row level security;
create policy "team can see team" on public.team_members
  for select to authenticated using (public.is_team_member());
create or replace function public.is_team_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where email = lower(coalesce(auth.jwt() ->> 'email', '')) and active and role = 'admin'
  );
$$;

create policy "admins manage team" on public.team_members
  for all to authenticated using (public.is_team_admin()) with check (public.is_team_admin());


Authentication:
- Email and password login only. No sign-up page, no public sign-up (turn sign-ups off), no social logins.
- Add "Forgot password" (email reset link).
- After login, check the user's email exists in public.team_members with active = true. If not, sign them out and show "This account isn't on the Social Lab team list."
- Every page except /login requires a session.

App shell only for now (no page content yet):
- Left sidebar on desktop, bottom tab bar on mobile: Dashboard, Leads, Daily Log, Clients, Capacity, Settings.
- Top bar: Social Lab logo text, a service line filter (All, then the active list_items where list = 'service_line'), a prominent "Log today" button (it will open a dialog later), and the signed-in user's name with sign out.
- Keep the service line filter in a React context so every page can read it, and persist it in the URL (?service=).
- Currency is AUD, dates display as dd/mm/yyyy, timezone Australia/Brisbane.
- Design: clean, fast, mobile friendly. Light and dark mode. Neutral surfaces, one accent colour (#2a78d6). Status colours: good #0ca30c, warning #fab219, critical #d03b3b, always paired with an icon and a label, never colour alone.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/eab9b70b-74d2-4b86-9b62-b2c37f53e818).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
