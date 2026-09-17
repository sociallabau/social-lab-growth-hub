-- Social Lab retainer clients, imported from 'P&L - ECO - P&L Tier 26-27' and 14 months of Xero invoices.
-- Tier and monthly fee come from the tier sheet (the Ecosystem program); start dates use the first month invoiced at the retainer fee.
-- Safe to run twice: a client is only inserted when that name isn't already there.

insert into public.list_items (list, value, sort_order)
  select 'tier', 'Ad Only', 0
  where not exists (select 1 from public.list_items where list = 'tier' and value = 'Ad Only');

insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Callum Ansell', 'Ad Only', date '2026-04-01', 500, null, 'Imported from tier sheet - Xero: Ansell Real Estate'
  where not exists (select 1 from public.clients where lower(name) = lower('Callum Ansell'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Guy Powell', 'Ad Only', date '2026-03-01', 650, null, 'Imported from tier sheet - Xero: Guy Powell'
  where not exists (select 1 from public.clients where lower(name) = lower('Guy Powell'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Milestone', 'Ad Only', date '2025-08-01', 500, date '2026-09-01', 'Imported from tier sheet - Xero: Milestone Real Estate'
  where not exists (select 1 from public.clients where lower(name) = lower('Milestone'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Shannon Brett', 'Ad Only', date '2025-09-01', 1500, null, 'Imported from tier sheet - Xero: Shannon Brett'
  where not exists (select 1 from public.clients where lower(name) = lower('Shannon Brett'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Simar Singh', 'Ad Only', date '2026-03-01', 500, date '2026-07-01', 'Imported from tier sheet - Xero: Simar Singh'
  where not exists (select 1 from public.clients where lower(name) = lower('Simar Singh'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Affinity Res', 'Tier 1', date '2026-05-01', 3000, null, 'Imported from tier sheet - Xero: Affinity Res'
  where not exists (select 1 from public.clients where lower(name) = lower('Affinity Res'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Arch Brokerage', 'Tier 1', date '2025-09-01', 2727, null, 'Imported from tier sheet - Xero: Arch Brokerage'
  where not exists (select 1 from public.clients where lower(name) = lower('Arch Brokerage'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Ben Hyrapietian', 'Tier 1', date '2026-07-01', 3500, null, 'Imported from tier sheet - Xero: Ben Hyrapietian - Place'
  where not exists (select 1 from public.clients where lower(name) = lower('Ben Hyrapietian'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Coast Modular', 'Tier 1', date '2025-09-01', 3000, null, 'Imported from tier sheet - Xero: Coast Modular'
  where not exists (select 1 from public.clients where lower(name) = lower('Coast Modular'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Cullen & Co', 'Tier 1', date '2026-04-01', 2500, null, 'Imported from tier sheet - no Xero match (Stripe or card)'
  where not exists (select 1 from public.clients where lower(name) = lower('Cullen & Co'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Greg Corcoran', 'Tier 1', date '2026-08-01', 3500, null, 'Imported from tier sheet - Xero: Greg Corcoran'
  where not exists (select 1 from public.clients where lower(name) = lower('Greg Corcoran'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Image Property GC', 'Tier 1', date '2025-08-01', 4000, null, 'Imported from tier sheet - Xero: Image Property Gold Coast'
  where not exists (select 1 from public.clients where lower(name) = lower('Image Property GC'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Kai Konstruct', 'Tier 1', date '2025-12-01', 3250, null, 'Imported from tier sheet - Xero: Kai Konstruct'
  where not exists (select 1 from public.clients where lower(name) = lower('Kai Konstruct'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Matt Hughes', 'Tier 1', date '2025-08-01', 3000, null, 'Imported from tier sheet - Xero: Matt Hughes'
  where not exists (select 1 from public.clients where lower(name) = lower('Matt Hughes'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Matt Micallef - TMG', 'Tier 1', date '2026-06-01', 3500, null, 'Imported from tier sheet - Xero: Matt Micallef'
  where not exists (select 1 from public.clients where lower(name) = lower('Matt Micallef - TMG'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Matt Srama - TSG', 'Tier 1', date '2026-04-01', 4546, date '2026-06-01', 'Imported from tier sheet - Xero: The Srama Group'
  where not exists (select 1 from public.clients where lower(name) = lower('Matt Srama - TSG'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Mitch Booth', 'Tier 1', date '2026-04-01', 3000, null, 'Imported from tier sheet - no Xero match (Stripe or card)'
  where not exists (select 1 from public.clients where lower(name) = lower('Mitch Booth'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Owen Fredericks', 'Tier 1', date '2026-01-01', 3000, null, 'Imported from tier sheet - Xero: Owen Fredericks'
  where not exists (select 1 from public.clients where lower(name) = lower('Owen Fredericks'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Rarestate', 'Tier 1', date '2026-04-01', 3000, null, 'Imported from tier sheet - Xero: Rarestate'
  where not exists (select 1 from public.clients where lower(name) = lower('Rarestate'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Ray White Alliance', 'Tier 1', date '2025-12-01', 3750, null, 'Imported from tier sheet - Xero: Ray White Alliance'
  where not exists (select 1 from public.clients where lower(name) = lower('Ray White Alliance'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Remax Revolution: Hunt Property Sisters', 'Tier 1', date '2026-08-01', 3500, null, 'Imported from tier sheet - Xero: Hunt Property Sisters'
  where not exists (select 1 from public.clients where lower(name) = lower('Remax Revolution: Hunt Property Sisters'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Rose & Jones', 'Tier 1', date '2026-04-01', 4000, null, 'Imported from tier sheet - no Xero match (Stripe or card)'
  where not exists (select 1 from public.clients where lower(name) = lower('Rose & Jones'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Sproule Property', 'Tier 1', date '2025-09-01', 4090, null, 'Imported from tier sheet - Xero: Sproule Property'
  where not exists (select 1 from public.clients where lower(name) = lower('Sproule Property'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Sutto''s Floor Coverings', 'Tier 1', date '2026-04-01', 3000, null, 'Imported from tier sheet - no Xero match (Stripe or card)'
  where not exists (select 1 from public.clients where lower(name) = lower('Sutto''s Floor Coverings'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Cameron Cullen', 'Tier 2', date '2026-01-01', 2500, null, 'Imported from tier sheet - Xero: Cameron Cullen'
  where not exists (select 1 from public.clients where lower(name) = lower('Cameron Cullen'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Carita Lanham', 'Tier 2', date '2026-08-01', 2500, null, 'Imported from tier sheet - Xero: Carita Lanham'
  where not exists (select 1 from public.clients where lower(name) = lower('Carita Lanham'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Coast Buyers Agency', 'Tier 2', date '2026-04-01', 2500, null, 'Imported from tier sheet - no Xero match (Stripe or card)'
  where not exists (select 1 from public.clients where lower(name) = lower('Coast Buyers Agency'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Davey', 'Tier 2', date '2025-09-01', 2250, null, 'Imported from tier sheet - Xero: Davey Construction Group'
  where not exists (select 1 from public.clients where lower(name) = lower('Davey'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'David Norvill', 'Tier 2', date '2026-07-01', 2000, null, 'Imported from tier sheet - Xero: david.norvill@imageproperty.com.au'
  where not exists (select 1 from public.clients where lower(name) = lower('David Norvill'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Fifth Avenue Property', 'Tier 2', date '2026-06-01', 2500, null, 'Imported from tier sheet - no Xero match (Stripe or card)'
  where not exists (select 1 from public.clients where lower(name) = lower('Fifth Avenue Property'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Fiona Cardow Moraes', 'Tier 2', date '2026-08-01', 2250, null, 'Imported from tier sheet - no Xero match (Stripe or card)'
  where not exists (select 1 from public.clients where lower(name) = lower('Fiona Cardow Moraes'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Jacob Samuelson (No Filming)', 'Tier 2', date '2026-05-01', 3000, null, 'Imported from tier sheet - no Xero match (Stripe or card)'
  where not exists (select 1 from public.clients where lower(name) = lower('Jacob Samuelson (No Filming)'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'James Devlin', 'Tier 2', date '2026-09-01', 2500, null, 'Imported from tier sheet - no Xero match (Stripe or card)'
  where not exists (select 1 from public.clients where lower(name) = lower('James Devlin'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Joe Walker', 'Tier 2', date '2026-07-01', 3000, null, 'Imported from tier sheet - Xero: Joe Walker'
  where not exists (select 1 from public.clients where lower(name) = lower('Joe Walker'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Jonathan Koleszar', 'Tier 2', date '2026-08-01', 2250, null, 'Imported from tier sheet - no Xero match (Stripe or card)'
  where not exists (select 1 from public.clients where lower(name) = lower('Jonathan Koleszar'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Jukic Property', 'Tier 2', date '2026-04-01', 3000, null, 'Imported from tier sheet - Xero: Dilon Jukic'
  where not exists (select 1 from public.clients where lower(name) = lower('Jukic Property'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Lacey West Commercial', 'Tier 2', date '2026-08-01', 2500, null, 'Imported from tier sheet - Xero: Lacey West Commercial'
  where not exists (select 1 from public.clients where lower(name) = lower('Lacey West Commercial'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Max Kenny', 'Tier 2', date '2026-04-01', 2500, null, 'Imported from tier sheet - Xero: Max Kenny'
  where not exists (select 1 from public.clients where lower(name) = lower('Max Kenny'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'McGrath Redcliffe', 'Tier 2', date '2026-08-01', 3500, null, 'Imported from tier sheet - Xero: McGrath Redcliffe'
  where not exists (select 1 from public.clients where lower(name) = lower('McGrath Redcliffe'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Michael Hamilton', 'Tier 2', date '2025-10-01', 2000, null, 'Imported from tier sheet - Xero: Michael Hamilton'
  where not exists (select 1 from public.clients where lower(name) = lower('Michael Hamilton'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Selina McIntyre', 'Tier 2', date '2026-06-01', 2500, null, 'Imported from tier sheet - Xero: Selina McIntyre'
  where not exists (select 1 from public.clients where lower(name) = lower('Selina McIntyre'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Vivian Madrieux', 'Tier 2', date '2026-09-01', 2500, null, 'Imported from tier sheet - Xero: Viviane Madrieux'
  where not exists (select 1 from public.clients where lower(name) = lower('Vivian Madrieux'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Cameron Thomas', 'Tier 3', date '2025-09-01', 1800, null, 'Imported from tier sheet - Xero: Cameron Thomas'
  where not exists (select 1 from public.clients where lower(name) = lower('Cameron Thomas'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Jared Malan', 'Tier 3', date '2026-04-01', 2500, null, 'Imported from tier sheet - Xero: Jared Malan'
  where not exists (select 1 from public.clients where lower(name) = lower('Jared Malan'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Marc Layzell', 'Tier 3', date '2026-04-01', 1500, date '2026-07-01', 'Imported from tier sheet - Xero: Marc Layzell'
  where not exists (select 1 from public.clients where lower(name) = lower('Marc Layzell'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Matt Srama - Personal', 'Tier 3', date '2026-04-01', 1363, date '2026-06-01', 'Imported from tier sheet - Xero: The Srama Group'
  where not exists (select 1 from public.clients where lower(name) = lower('Matt Srama - Personal'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Michelle Marsh - Belle Property', 'Tier 3', date '2026-05-01', 1500, null, 'Imported from tier sheet - Xero: Belle Property'
  where not exists (select 1 from public.clients where lower(name) = lower('Michelle Marsh - Belle Property'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Olivia Mcrea', 'Tier 3', date '2026-04-01', 1500, null, 'Imported from tier sheet - Xero: Olivia McCrae'
  where not exists (select 1 from public.clients where lower(name) = lower('Olivia Mcrea'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Premium Buyers Agents', 'Tier 3', date '2026-08-01', 2000, null, 'Imported from tier sheet - Xero: Premium Buyers'
  where not exists (select 1 from public.clients where lower(name) = lower('Premium Buyers Agents'));
insert into public.clients (name, tier, start_date, monthly_fee, end_date, notes)
  select 'Team Willis', 'Tier 3', date '2026-09-01', 2000, null, 'Imported from tier sheet - no Xero match (Stripe or card)'
  where not exists (select 1 from public.clients where lower(name) = lower('Team Willis'));
