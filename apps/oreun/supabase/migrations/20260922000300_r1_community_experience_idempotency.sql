-- Additive preview migration. No users, roles or existing content are changed.
alter table public.questions add column if not exists client_request_id uuid;
create unique index if not exists r1_questions_author_request_unique
  on public.questions(author_id, client_request_id) where client_request_id is not null;
create or replace function private.r1_guard_question_request_id()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.client_request_id is distinct from old.client_request_id then
    raise exception 'question request id is immutable';
  end if;
  return new;
end;
$$;
revoke all on function private.r1_guard_question_request_id() from public, anon, authenticated;
drop trigger if exists r1_guard_question_request_id on public.questions;
create trigger r1_guard_question_request_id before update on public.questions
for each row execute function private.r1_guard_question_request_id();
create or replace function public.r1_submit_question(
  p_game_universe_id bigint, p_title text, p_body text, p_request_id uuid
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_permissions jsonb;
  v_existing public.questions%rowtype;
  v_id uuid;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  v_permissions := public.r1_my_community_permissions();
  if not coalesce((v_permissions->>'active')::boolean, false)
    or not coalesce((v_permissions->>'age_confirmed_14_plus')::boolean, false) then
    raise exception 'community posting is unavailable for this account' using errcode='42501';
  end if;
  if p_request_id is null or p_game_universe_id is null or p_game_universe_id <= 0
    or p_title is null or p_body is null
    or char_length(btrim(p_title)) not between 5 and 120
    or char_length(btrim(p_body)) not between 10 and 5000 then
    raise exception 'invalid question input' using errcode='22023';
  end if;
  -- Serialize retries before insert and rate-limit/notification triggers.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || ':' || p_request_id::text, 0));
  select * into v_existing from public.questions
    where author_id=v_user and client_request_id=p_request_id;
  if found then
    if v_existing.game_universe_id is distinct from p_game_universe_id
      or v_existing.title is distinct from btrim(p_title)
      or v_existing.body is distinct from btrim(p_body) then
      raise exception 'question_request_conflict' using errcode='22023';
    end if;
    return v_existing.id;
  end if;
  insert into public.questions(game_universe_id, author_id, title, body, client_request_id)
    values(p_game_universe_id, v_user, btrim(p_title), btrim(p_body), p_request_id)
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.r1_submit_question(bigint,text,text,uuid) from public, anon;
grant execute on function public.r1_submit_question(bigint,text,text,uuid) to authenticated;
create or replace function public.r1_mark_notification_read(p_notification_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  update public.notifications set read_at=coalesce(read_at,now())
    where id=p_notification_id and user_id=auth.uid();
  return found;
end;
$$;
revoke all on function public.r1_mark_notification_read(uuid) from public, anon;
grant execute on function public.r1_mark_notification_read(uuid) to authenticated;
-- The older update guard predates update_event_id. Keep routing metadata immutable.
create or replace function private.r1_guard_notification_event_id()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.update_event_id is distinct from old.update_event_id then
    raise exception 'notification routing is immutable';
  end if;
  return new;
end;
$$;
revoke all on function private.r1_guard_notification_event_id() from public, anon, authenticated;
drop trigger if exists r1_guard_notification_event_id on public.notifications;
create trigger r1_guard_notification_event_id before update on public.notifications
for each row execute function private.r1_guard_notification_event_id();
