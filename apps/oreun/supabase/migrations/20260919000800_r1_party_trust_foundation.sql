-- R1 / Oreun Sprint 04: game-context party recruitment + public contribution trust.
-- No DM, phone/email/Kakao/Discord exchange, or arbitrary external join links.

alter table public.reports
  drop constraint if exists reports_target_type_check;
alter table public.reports
  add constraint reports_target_type_check
  check (target_type in ('question','answer','comment','profile','party'));

alter table public.moderation_actions
  drop constraint if exists moderation_actions_target_type_check;
alter table public.moderation_actions
  add constraint moderation_actions_target_type_check
  check (target_type in ('question','answer','comment','profile','report','party'));

create table if not exists public.party_posts (
  id uuid primary key default gen_random_uuid(),
  game_universe_id bigint not null references public.games(universe_id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  title text not null,
  note text not null default '',
  playstyle text not null default 'casual'
    check (playstyle in ('casual','competitive','learning','quest','grind')),
  max_members integer not null default 4 check (max_members between 2 and 12),
  member_count integer not null default 1 check (member_count between 1 and 12),
  roblox_join_url text,
  status text not null default 'open'
    check (status in ('open','full','closed','expired')),
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible','removed')),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint party_posts_title_length_check
    check (char_length(btrim(title)) between 5 and 100),
  constraint party_posts_note_length_check
    check (char_length(note) <= 1000),
  constraint party_posts_capacity_check
    check (member_count <= max_members)
);

create table if not exists public.party_members (
  party_id uuid not null references public.party_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id,user_id)
);

create index if not exists party_posts_game_open_idx
  on public.party_posts(game_universe_id, expires_at asc, created_at desc)
  where moderation_status='visible' and status in ('open','full');
create index if not exists party_posts_host_idx
  on public.party_posts(host_id, created_at desc);
create index if not exists party_members_user_idx
  on public.party_members(user_id, joined_at desc);

alter table public.party_posts enable row level security;
alter table public.party_members enable row level security;

create policy "party anon visible active"
on public.party_posts for select
to anon
using (
  moderation_status='visible'
  and status in ('open','full')
  and expires_at > now()
);

create policy "party authenticated readable"
on public.party_posts for select
to authenticated
using (
  (
    moderation_status='visible'
    and status in ('open','full')
    and expires_at > now()
  )
  or (select auth.uid())=host_id
  or (select private.r1_is_moderator())
);

create policy "party host insert"
on public.party_posts for insert
to authenticated
with check (
  (select auth.uid())=host_id
  and (select private.r1_is_active_user())
);

revoke all on public.party_posts from anon,authenticated;
revoke all on public.party_members from public,anon,authenticated;
grant select on public.party_posts to anon,authenticated;
grant insert on public.party_posts to authenticated;
grant all on public.party_posts to service_role;
grant all on public.party_members to service_role;

create or replace function private.r1_valid_roblox_join_url(p_url text)
returns boolean
language sql
immutable
set search_path=''
as $$
  select
    p_url is null
    or btrim(p_url)=''
    or lower(btrim(p_url)) ~ '^https://(www[.])?roblox[.]com/';
$$;

create or replace function private.r1_guard_party_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if not private.r1_is_active_user() then
    raise exception 'party posting is unavailable for this account';
  end if;
  if new.host_id is distinct from auth.uid() then
    raise exception 'host mismatch';
  end if;

  new.title:=btrim(new.title);
  new.note:=btrim(coalesce(new.note,''));
  new.roblox_join_url:=nullif(btrim(new.roblox_join_url),'');
  new.status:='open';
  new.moderation_status:='visible';
  new.member_count:=1;
  new.created_at:=now();
  new.updated_at:=now();

  if new.expires_at <= now()+interval '15 minutes'
     or new.expires_at > now()+interval '6 hours'
  then
    raise exception 'party expiry must be between 15 minutes and 6 hours';
  end if;

  if private.r1_contains_restricted_contact(new.title || ' ' || new.note) then
    raise exception 'restricted contact or credential pattern';
  end if;

  if not private.r1_valid_roblox_join_url(new.roblox_join_url) then
    raise exception 'only roblox.com join links are allowed';
  end if;

  perform private.r1_consume_rate_limit('party',5,interval '1 hour');
  return new;
end;
$$;

drop trigger if exists r1_guard_party_insert on public.party_posts;
create trigger r1_guard_party_insert
before insert on public.party_posts
for each row execute function private.r1_guard_party_insert();

create or replace function private.r1_party_add_host()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.party_members(party_id,user_id)
  values(new.id,new.host_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists r1_party_add_host on public.party_posts;
create trigger r1_party_add_host
after insert on public.party_posts
for each row execute function private.r1_party_add_host();

create or replace function private.r1_join_party_private(p_party_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_party public.party_posts%rowtype;
  v_user uuid:=auth.uid();
  v_count integer;
begin
  if not private.r1_is_active_user() then
    raise exception 'party join is unavailable for this account';
  end if;

  select * into v_party
  from public.party_posts
  where id=p_party_id
  for update;

  if not found then raise exception 'party not found'; end if;
  if v_party.moderation_status<>'visible' then raise exception 'party unavailable'; end if;
  if v_party.expires_at<=now() then
    update public.party_posts
    set status='expired',updated_at=now()
    where id=p_party_id;
    raise exception 'party expired';
  end if;
  if v_party.status not in ('open','full') then raise exception 'party closed'; end if;

  if exists(
    select 1 from public.party_members
    where party_id=p_party_id and user_id=v_user
  ) then
    return jsonb_build_object('joined',true,'already_member',true,'member_count',v_party.member_count);
  end if;

  select count(*)::integer into v_count
  from public.party_members
  where party_id=p_party_id;

  if v_count>=v_party.max_members then
    update public.party_posts
    set status='full',member_count=v_count,updated_at=now()
    where id=p_party_id;
    raise exception 'party is full';
  end if;

  insert into public.party_members(party_id,user_id)
  values(p_party_id,v_user);

  v_count:=v_count+1;
  update public.party_posts
  set
    member_count=v_count,
    status=case when v_count>=max_members then 'full' else 'open' end,
    updated_at=now()
  where id=p_party_id;

  return jsonb_build_object('joined',true,'already_member',false,'member_count',v_count);
end;
$$;

create or replace function public.r1_join_party(p_party_id uuid)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.r1_join_party_private(p_party_id); $$;

create or replace function private.r1_leave_party_private(p_party_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_party public.party_posts%rowtype;
  v_user uuid:=auth.uid();
  v_count integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;

  select * into v_party
  from public.party_posts
  where id=p_party_id
  for update;
  if not found then raise exception 'party not found'; end if;
  if v_party.host_id=v_user then raise exception 'host must close the party'; end if;

  delete from public.party_members
  where party_id=p_party_id and user_id=v_user;

  select count(*)::integer into v_count
  from public.party_members
  where party_id=p_party_id;

  update public.party_posts
  set
    member_count=greatest(1,v_count),
    status=case
      when status='full' and expires_at>now() and moderation_status='visible' then 'open'
      else status
    end,
    updated_at=now()
  where id=p_party_id;

  return jsonb_build_object('left',true,'member_count',v_count);
end;
$$;

create or replace function public.r1_leave_party(p_party_id uuid)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.r1_leave_party_private(p_party_id); $$;

create or replace function private.r1_close_party_private(p_party_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_host uuid;
begin
  select host_id into v_host from public.party_posts where id=p_party_id for update;
  if not found then raise exception 'party not found'; end if;
  if auth.uid() is distinct from v_host and not private.r1_is_moderator() then
    raise exception 'party host or moderator required';
  end if;
  update public.party_posts
  set status='closed',updated_at=now()
  where id=p_party_id;
  return true;
end;
$$;

create or replace function public.r1_close_party(p_party_id uuid)
returns boolean
language sql
security invoker
set search_path=''
as $$ select private.r1_close_party_private(p_party_id); $$;

create or replace function private.r1_set_party_moderation_private(
  p_party_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  if not private.r1_is_moderator() then raise exception 'moderator role required'; end if;
  if p_status not in ('visible','removed') then raise exception 'invalid moderation status'; end if;

  update public.party_posts
  set moderation_status=p_status,updated_at=now()
  where id=p_party_id;

  if not found then raise exception 'party not found'; end if;
  return true;
end;
$$;

create or replace function public.r1_set_party_moderation(
  p_party_id uuid,
  p_status text
)
returns boolean
language sql
security invoker
set search_path=''
as $$ select private.r1_set_party_moderation_private(p_party_id,p_status); $$;

revoke all on function public.r1_join_party(uuid) from public,anon;
revoke all on function public.r1_leave_party(uuid) from public,anon;
revoke all on function public.r1_close_party(uuid) from public,anon;
revoke all on function public.r1_set_party_moderation(uuid,text) from public,anon;
grant execute on function public.r1_join_party(uuid) to authenticated;
grant execute on function public.r1_leave_party(uuid) to authenticated;
grant execute on function public.r1_close_party(uuid) to authenticated;
grant execute on function public.r1_set_party_moderation(uuid,text) to authenticated;

revoke execute on function private.r1_valid_roblox_join_url(text) from public,anon,authenticated;
revoke execute on function private.r1_guard_party_insert() from public,anon,authenticated;
revoke execute on function private.r1_party_add_host() from public,anon,authenticated;
revoke execute on function private.r1_join_party_private(uuid) from public,anon;
revoke execute on function private.r1_leave_party_private(uuid) from public,anon;
revoke execute on function private.r1_close_party_private(uuid) from public,anon;
revoke execute on function private.r1_set_party_moderation_private(uuid,text) from public,anon;
grant execute on function private.r1_join_party_private(uuid) to authenticated;
grant execute on function private.r1_leave_party_private(uuid) to authenticated;
grant execute on function private.r1_close_party_private(uuid) to authenticated;
grant execute on function private.r1_set_party_moderation_private(uuid,text) to authenticated;

create or replace function private.r1_guard_ugc_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_action text;
  v_limit integer;
  v_window interval:=interval '1 hour';
  v_text text;
begin
  if not private.r1_is_active_user() then
    raise exception 'community posting is unavailable for this account';
  end if;

  if tg_table_name='questions' then
    if new.author_id is distinct from auth.uid() then raise exception 'author mismatch'; end if;
    new.title:=btrim(new.title); new.body:=btrim(new.body);
    new.status:='open'; new.moderation_status:='visible'; new.accepted_answer_id:=null;
    v_action:='question';v_limit:=5;v_text:=new.title||' '||new.body;
  elsif tg_table_name='answers' then
    if new.author_id is distinct from auth.uid() then raise exception 'author mismatch'; end if;
    new.body:=btrim(new.body);new.moderation_status:='visible';
    v_action:='answer';v_limit:=20;v_text:=new.body;
  elsif tg_table_name='comments' then
    if new.author_id is distinct from auth.uid() then raise exception 'author mismatch'; end if;
    new.body:=btrim(new.body);new.moderation_status:='visible';
    v_action:='comment';v_limit:=30;v_text:=new.body;
  elsif tg_table_name='reports' then
    if new.reporter_id is distinct from auth.uid() then raise exception 'reporter mismatch'; end if;
    new.details:=btrim(coalesce(new.details,''));new.status:='open';
    new.reviewed_at:=null;new.reviewed_by:=null;
    v_action:='report';v_limit:=10;v_text:=new.details;

    if new.target_type='question'
      and not exists(select 1 from public.questions where id=new.target_id)
    then raise exception 'report target not found';
    elsif new.target_type='answer'
      and not exists(select 1 from public.answers where id=new.target_id)
    then raise exception 'report target not found';
    elsif new.target_type='comment'
      and not exists(select 1 from public.comments where id=new.target_id)
    then raise exception 'report target not found';
    elsif new.target_type='profile'
      and not exists(select 1 from public.profiles where id=new.target_id)
    then raise exception 'report target not found';
    elsif new.target_type='party'
      and not exists(select 1 from public.party_posts where id=new.target_id)
    then raise exception 'report target not found';
    end if;
  else
    raise exception 'unsupported community table';
  end if;

  if private.r1_contains_restricted_contact(v_text) then
    raise exception 'restricted contact or credential pattern';
  end if;
  perform private.r1_consume_rate_limit(v_action,v_limit,v_window);
  return new;
end;
$$;

revoke execute on function private.r1_guard_ugc_insert() from public,anon,authenticated;

create or replace view public.r1_party_feed
with (security_invoker=true)
as
select
  party.id,
  party.game_universe_id,
  game.canonical_slug as game_slug,
  game.name_ko as game_name_ko,
  party.host_id,
  profile.handle as host_handle,
  coalesce(profile.display_name,profile.handle) as host_name,
  party.title,
  party.note,
  party.playstyle,
  party.max_members,
  party.member_count,
  party.roblox_join_url,
  party.status,
  party.expires_at,
  party.created_at,
  party.updated_at
from public.party_posts as party
join public.games as game on game.universe_id=party.game_universe_id
join public.profiles as profile on profile.id=party.host_id
where party.moderation_status='visible'
  and party.status in ('open','full')
  and party.expires_at>now();

revoke all on public.r1_party_feed from public,anon,authenticated;
grant select on public.r1_party_feed to anon,authenticated;

create or replace view public.r1_profile_contribution_summary
with (security_invoker=true)
as
select
  profile.id,
  profile.handle,
  coalesce(profile.display_name,profile.handle) as display_name,
  profile.bio,
  profile.created_at,
  (
    select count(*)::integer from public.questions q
    where q.author_id=profile.id and q.moderation_status='visible'
  ) as question_count,
  (
    select count(*)::integer from public.answers a
    where a.author_id=profile.id and a.moderation_status='visible'
  ) as answer_count,
  (
    select count(*)::integer
    from public.answers a
    join public.questions q on q.accepted_answer_id=a.id
    where a.author_id=profile.id
      and a.moderation_status='visible'
      and q.moderation_status='visible'
  ) as accepted_answer_count,
  (
    select count(*)::integer from public.comments c
    where c.author_id=profile.id and c.moderation_status='visible'
  ) as comment_count
from public.profiles profile;

revoke all on public.r1_profile_contribution_summary from public,anon,authenticated;
grant select on public.r1_profile_contribution_summary to anon,authenticated;
