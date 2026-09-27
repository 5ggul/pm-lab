alter table public.notifications
  add column if not exists update_event_id uuid
  references public.game_update_events(id) on delete cascade;

update public.notifications as notification
set update_event_id = event.id
from public.game_update_events as event
where notification.kind = 'followed_game_update'
  and notification.update_event_id is null
  and notification.payload ? 'event_id'
  and notification.payload ->> 'event_id' = event.id::text;

create unique index if not exists notifications_followed_update_unique
  on public.notifications(user_id, update_event_id)
  where kind = 'followed_game_update'
    and update_event_id is not null;

create index if not exists notifications_update_event_idx
  on public.notifications(update_event_id)
  where update_event_id is not null;

create or replace function private.r1_notify_followers_of_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_kind <> 'provider_update_detected' then
    return new;
  end if;

  insert into public.notifications(
    user_id,
    kind,
    game_universe_id,
    update_event_id,
    payload
  )
  select
    follow.user_id,
    'followed_game_update',
    new.universe_id,
    new.id,
    jsonb_build_object(
      'event_id', new.id,
      'source_updated_at', new.source_updated_at,
      'first_observed_at', new.first_observed_at
    )
  from public.game_follows as follow
  where follow.universe_id = new.universe_id
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function private.r1_notify_followers_of_update()
  from public, anon, authenticated;