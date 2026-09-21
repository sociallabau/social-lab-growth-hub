alter table public.settings
  add column if not exists target_net_margin numeric not null default 0.5
    check (target_net_margin >= 0 and target_net_margin <= 1);