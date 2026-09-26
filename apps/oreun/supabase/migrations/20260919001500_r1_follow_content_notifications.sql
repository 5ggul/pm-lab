alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (
    kind in (
      'followed_game_question',
      'followed_game_update',
      'followed_game_code',
      'followed_game_guide',
      'question_answer',
      'question_comment',
      'answer_comment',
      'answer_accepted',
      'moderation'
    )
  );

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
    payload
  )
  select
    follow.user_id,
    'followed_game_update',
    new.universe_id,
    jsonb_build_object(
      'event_id', new.id,
      'source_updated_at', new.source_updated_at
    )
  from public.game_follows as follow
  where follow.universe_id = new.universe_id;

  return new;
end;
$$;

drop trigger if exists r1_notify_followers_of_update
  on public.game_update_events;
create trigger r1_notify_followers_of_update
after insert on public.game_update_events
for each row execute function private.r1_notify_followers_of_update();

create or replace function private.r1_notify_followers_of_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visibility <> 'published' or new.code_status <> 'active' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.visibility = 'published'
    and old.code_status = 'active'
  then
    return new;
  end if;

  insert into public.notifications(
    user_id,
    kind,
    game_universe_id,
    payload
  )
  select
    follow.user_id,
    'followed_game_code',
    new.universe_id,
    jsonb_build_object('code_id', new.id)
  from public.game_follows as follow
  where follow.universe_id = new.universe_id;

  return new;
end;
$$;

drop trigger if exists r1_notify_followers_of_code
  on public.game_codes;
create trigger r1_notify_followers_of_code
after insert or update of visibility, code_status on public.game_codes
for each row execute function private.r1_notify_followers_of_code();

create or replace function private.r1_notify_followers_of_guide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.content_status <> 'published' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.content_status = 'published' then
    return new;
  end if;

  insert into public.notifications(
    user_id,
    kind,
    game_universe_id,
    payload
  )
  select
    follow.user_id,
    'followed_game_guide',
    new.universe_id,
    jsonb_build_object('guide_id', new.id, 'slug', new.slug)
  from public.game_follows as follow
  where follow.universe_id = new.universe_id;

  return new;
end;
$$;

drop trigger if exists r1_notify_followers_of_guide
  on public.game_guides;
create trigger r1_notify_followers_of_guide
after insert or update of content_status on public.game_guides
for each row execute function private.r1_notify_followers_of_guide();

revoke execute on function private.r1_notify_followers_of_update()
  from public, anon, authenticated;
revoke execute on function private.r1_notify_followers_of_code()
  from public, anon, authenticated;
revoke execute on function private.r1_notify_followers_of_guide()
  from public, anon, authenticated;