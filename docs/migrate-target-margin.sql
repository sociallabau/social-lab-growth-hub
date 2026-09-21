-- Target net margin for the Capacity page headline ("are we on track?").
-- Net margin = client fees less filming, editing and social delivery costs.
-- Safe to run twice.

alter table public.settings
  add column if not exists target_net_margin numeric not null default 0.5
    check (target_net_margin >= 0 and target_net_margin <= 1);
