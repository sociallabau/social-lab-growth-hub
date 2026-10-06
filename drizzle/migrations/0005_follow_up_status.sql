alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status in (
  'pending', 'rejected', 'new', 'contacted', 'follow_up',
  'meeting_booked', 'meeting_held', 'proposal', 'won', 'lost', 'nurture'
));