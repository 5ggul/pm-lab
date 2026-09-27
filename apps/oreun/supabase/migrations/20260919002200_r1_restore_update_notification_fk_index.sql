create index if not exists notifications_update_event_idx
  on public.notifications(update_event_id)
  where update_event_id is not null;