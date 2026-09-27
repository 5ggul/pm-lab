-- R2 profile-write fix + community-authored guides.
-- 2026-09-25

-- Profiles already have owner-only RLS, but authenticated users only had SELECT
-- privileges. Grant UPDATE narrowly to the three editable public fields.
revoke update on public.profiles from authenticated;
grant update(handle, display_name, bio) on public.profiles to authenticated;

create table if not exists public.community_guides (
  id uuid primary key default gen_random_uuid(),
  game_universe_id bigint not null references public.games(universe_id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  guide_type text not null default 'guide'
    check (guide_type in ('beginner','mechanic','progression','troubleshooting','faq','guide')),
  title text not null,
  body text not null,
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible','pending','removed')),
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_guides_title_length check (char_length(btrim(title)) between 5 and 120),
  constraint community_guides_body_length check (char_length(btrim(body)) between 100 and 10000)
);

create index if not exists community_guides_game_created_idx
  on public.community_guides(game_universe_id, created_at desc, id desc)
  where moderation_status='visible';
create index if not exists community_guides_author_created_idx
  on public.community_guides(author_id, created_at desc, id desc);
create unique index if not exists community_guides_author_request_unique
  on public.community_guides(author_id, client_request_id)
  where client_request_id is not null;

alter table public.community_guides enable row level security;

drop policy if exists "community guides anon visible" on public.community_guides;
create policy "community guides anon visible"
on public.community_guides for select to anon
using (moderation_status='visible');

drop policy if exists "community guides authenticated readable" on public.community_guides;
create policy "community guides authenticated readable"
on public.community_guides for select to authenticated
using (moderation_status='visible' or auth.uid()=author_id or private.r1_is_moderator());

drop policy if exists "community guides author insert" on public.community_guides;
create policy "community guides author insert"
on public.community_guides for insert to authenticated
with check (auth.uid()=author_id and private.r1_is_active_user());

drop policy if exists "community guides author update" on public.community_guides;
create policy "community guides author update"
on public.community_guides for update to authenticated
using (auth.uid()=author_id or private.r1_is_moderator())
with check (auth.uid()=author_id or private.r1_is_moderator());

revoke all on public.community_guides from public, anon, authenticated;
grant select on public.community_guides to anon, authenticated;
grant insert, update on public.community_guides to authenticated;
grant all on public.community_guides to service_role;

create or replace function private.r1_guard_community_guide_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if not private.r1_is_active_user() then
    raise exception 'community posting is unavailable for this account';
  end if;
  if new.author_id is distinct from auth.uid() then
    raise exception 'author mismatch';
  end if;
  new.title:=btrim(new.title);
  new.body:=btrim(new.body);
  new.moderation_status:='visible';
  new.created_at:=now();
  new.updated_at:=now();
  if private.r1_contains_restricted_contact(new.title||' '||new.body) then
    raise exception 'restricted contact or credential pattern';
  end if;
  perform private.r1_consume_rate_limit('community_guide',5,interval '1 hour');
  return new;
end;
$$;
revoke all on function private.r1_guard_community_guide_insert() from public,anon,authenticated;

create or replace function private.r1_guard_community_guide_update()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.id is distinct from old.id
    or new.author_id is distinct from old.author_id
    or new.game_universe_id is distinct from old.game_universe_id
    or new.client_request_id is distinct from old.client_request_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'immutable community guide fields changed';
  end if;

  if private.r1_is_moderator() then
    if new.title is distinct from old.title
      or new.body is distinct from old.body
      or new.guide_type is distinct from old.guide_type
    then
      raise exception 'moderators may not rewrite user guide content';
    end if;
  else
    if auth.uid() is distinct from old.author_id then
      raise exception 'guide ownership required';
    end if;
    if new.moderation_status is distinct from old.moderation_status then
      raise exception 'authors may not change moderation state';
    end if;
    if private.r1_contains_restricted_contact(new.title||' '||new.body) then
      raise exception 'restricted contact or credential pattern';
    end if;
  end if;

  new.title:=btrim(new.title);
  new.body:=btrim(new.body);
  new.updated_at:=now();
  return new;
end;
$$;
revoke all on function private.r1_guard_community_guide_update() from public,anon,authenticated;

drop trigger if exists r1_guard_community_guide_insert on public.community_guides;
create trigger r1_guard_community_guide_insert
before insert on public.community_guides
for each row execute function private.r1_guard_community_guide_insert();

drop trigger if exists r1_guard_community_guide_update on public.community_guides;
create trigger r1_guard_community_guide_update
before update on public.community_guides
for each row execute function private.r1_guard_community_guide_update();

create or replace view public.r1_community_guide_feed
with(security_invoker=true) as
select
  guide.id,
  guide.game_universe_id,
  game.canonical_slug as game_slug,
  game.name_ko as game_name_ko,
  guide.author_id,
  profile.handle as author_handle,
  coalesce(profile.display_name,profile.handle,'탈퇴한 이용자'::text) as author_name,
  guide.guide_type,
  guide.title,
  guide.body,
  guide.created_at,
  guide.updated_at
from public.community_guides guide
join public.games game on game.universe_id=guide.game_universe_id
left join public.profiles profile on profile.id=guide.author_id
where guide.moderation_status='visible';

grant select on public.r1_community_guide_feed to anon, authenticated;

create or replace function public.r1_submit_community_guide(
  p_game_universe_id bigint,
  p_guide_type text,
  p_title text,
  p_body text,
  p_request_id uuid
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  u uuid:=auth.uid();
  permissions jsonb;
  existing public.community_guides%rowtype;
  result uuid;
begin
  if u is null then
    raise exception 'authentication required' using errcode='42501';
  end if;
  permissions:=public.r1_my_community_permissions();
  if not coalesce((permissions->>'active')::boolean,false) then
    raise exception 'posting unavailable' using errcode='42501';
  end if;
  if p_request_id is null
    or p_game_universe_id is null
    or p_guide_type not in ('beginner','mechanic','progression','troubleshooting','faq','guide')
    or p_title is null
    or p_body is null
    or char_length(btrim(p_title)) not between 5 and 120
    or char_length(btrim(p_body)) not between 100 and 10000
  then
    raise exception 'invalid community guide input' using errcode='22023';
  end if;
  if not exists(select 1 from public.games where universe_id=p_game_universe_id) then
    raise exception 'game unavailable' using errcode='22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(u::text||':'||p_request_id::text,0)
  );

  select * into existing
  from public.community_guides
  where author_id=u and client_request_id=p_request_id;

  if found then
    if existing.game_universe_id is distinct from p_game_universe_id
      or existing.guide_type is distinct from p_guide_type
      or existing.title is distinct from btrim(p_title)
      or existing.body is distinct from btrim(p_body)
    then
      raise exception 'community_guide_request_conflict' using errcode='22023';
    end if;
    return existing.id;
  end if;

  insert into public.community_guides(
    game_universe_id,author_id,guide_type,title,body,client_request_id
  )
  values(
    p_game_universe_id,u,p_guide_type,btrim(p_title),btrim(p_body),p_request_id
  )
  returning id into result;

  return result;
end;
$$;
revoke all on function public.r1_submit_community_guide(bigint,text,text,text,uuid)
from public,anon;
grant execute on function public.r1_submit_community_guide(bigint,text,text,text,uuid)
to authenticated;
