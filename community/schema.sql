-- Apply to a dedicated Supabase project. No changes to vehicle calculation data.
begin;
create schema if not exists pmc_private;
revoke all on schema pmc_private from public, anon;
grant usage on schema pmc_private to authenticated;

create table public.pmc_vehicles (
 id text primary key, name text not null, maker text not null, active boolean not null default true
);
create table public.pmc_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null unique check(char_length(btrim(nickname)) between 2 and 20),
 created_at timestamptz not null default now()
);
create table public.pmc_posts (
 id uuid primary key default gen_random_uuid(), vehicle_id text references public.pmc_vehicles(id),
 photo_paths text[] not null default '{}' check(cardinality(photo_paths)<=5),
 kind text not null check(kind in ('free','question','review')), title text not null, body text not null,
 author_id uuid not null references auth.users(id) on delete cascade, author_nickname text not null,
 status text not null default 'published' check(status in ('published','hidden','deleted')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status='deleted' or (char_length(title) between 4 and 100 and char_length(body) between 10 and 10000))
);
create table public.pmc_comments (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.pmc_posts(id) on delete cascade,
 body text not null, author_id uuid not null references auth.users(id) on delete cascade,
 author_nickname text not null, status text not null default 'published' check(status in ('published','hidden','deleted')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status='deleted' or char_length(body) between 1 and 2000)
);
create table public.pmc_reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references auth.users(id) on delete cascade,
 target_type text not null check(target_type in ('post','comment')), target_id uuid not null,
 reason text not null check(reason in ('spam','abuse','privacy','other')),
 detail text not null default '' check(char_length(detail)<=500), created_at timestamptz not null default now(),
 unique(reporter_id,target_type,target_id)
);
create table pmc_private.write_events (
 user_id uuid not null references auth.users(id) on delete cascade,
 action text not null, created_at timestamptz not null default now()
);
create index community_post_list on public.pmc_posts(vehicle_id,kind,created_at desc,id desc) where status='published';
create index community_post_recent on public.pmc_posts(created_at desc,id desc) where status='published';
create index community_comment_post on public.pmc_comments(post_id,created_at,id) where status='published';
create index pmc_posts_author on public.pmc_posts(author_id);
create index pmc_comments_author on public.pmc_comments(author_id);
create index community_report_target on public.pmc_reports(target_type,target_id);
create index community_rate_user on pmc_private.write_events(user_id,created_at);

alter table public.pmc_vehicles enable row level security;
alter table public.pmc_profiles enable row level security;
alter table public.pmc_posts enable row level security;
alter table public.pmc_comments enable row level security;
alter table public.pmc_reports enable row level security;
alter table pmc_private.write_events enable row level security;
revoke all on public.pmc_vehicles,public.pmc_profiles,public.pmc_posts,public.pmc_comments,public.pmc_reports from anon,authenticated;
grant select on public.pmc_vehicles,public.pmc_posts,public.pmc_comments to anon,authenticated;
grant select on public.pmc_profiles to authenticated;
create policy vehicles_read on public.pmc_vehicles for select to anon,authenticated using(true);
create policy profile_self on public.pmc_profiles for select to authenticated using(id=(select auth.uid()));
create policy posts_read on public.pmc_posts for select to anon,authenticated using(status='published');
create policy comments_read on public.pmc_comments for select to anon,authenticated using(status='published' and exists(select 1 from public.pmc_posts p where p.id=post_id and p.status='published'));

-- Single constrained write boundary. Client roles have no direct table writes.
create function pmc_private.write(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid(); nick text; target uuid; result_id uuid; parent uuid; n integer; photos text[]; photo text;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor) then raise exception 'auth_required'; end if;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'auth_required'; end if;
 if action not in ('profile','create_post','edit_post','delete_post','create_comment','edit_comment','delete_comment','report') then raise exception 'not_allowed'; end if;
 -- Serialize per-account quota checks so concurrent requests cannot bypass them.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
 delete from pmc_private.write_events where user_id=actor and created_at<now()-interval '1 day';
 select count(*) into n from pmc_private.write_events where user_id=actor and created_at>now()-interval '1 hour';
 if n>=60 then raise exception 'rate_limit'; end if;
 if action in ('create_post','create_comment','report') then
  select count(*) into n from pmc_private.write_events where user_id=actor and write_events.action=write.action and created_at>now()-interval '10 minutes';
  if n >= (case action when 'create_post' then 5 when 'create_comment' then 20 else 10 end) then raise exception 'rate_limit'; end if;
 end if;
 insert into pmc_private.write_events(user_id,action) values(actor,action);
 if action='profile' then
  nick=btrim(payload->>'nickname');
  if nick is null or char_length(nick) not between 2 and 20 or nick ~ '[[:cntrl:]]' then raise exception 'invalid_nickname'; end if;
  insert into public.pmc_profiles(id,nickname) values(actor,nick) on conflict(id) do update set nickname=excluded.nickname;
  return jsonb_build_object('nickname',nick);
 end if;
 select nickname into nick from public.pmc_profiles where id=actor;
 if nick is null then raise exception 'profile_required'; end if;
 if action in ('edit_post','delete_post','edit_comment','delete_comment','report') then target=(payload->>'id')::uuid; end if;
 if action in ('create_post','edit_post') and payload ? 'photos' then
  if jsonb_typeof(payload->'photos') <> 'array' or jsonb_array_length(payload->'photos')>5 then raise exception 'invalid_photos'; end if;
  select coalesce(array_agg(value),'{}'::text[]) into photos from jsonb_array_elements_text(payload->'photos');
  if cardinality(photos)<>(select count(distinct v) from unnest(photos) v) then raise exception 'invalid_photos'; end if;
  foreach photo in array photos loop
   if photo is null or split_part(photo,'/',1)<>actor::text or not exists(
    select 1 from storage.objects o where o.bucket_id='pmc-post-images' and o.name=photo and o.owner_id=actor::text
    and o.metadata->>'mimetype' in ('image/webp','image/jpeg','image/png')
    and (o.metadata->>'size')::bigint between 1 and 5242880
   ) then raise exception 'invalid_photos'; end if;
  end loop;
 end if;
 if action='create_post' then
  if nullif(payload->>'vehicle_id','') is not null and not exists(select 1 from public.pmc_vehicles where id=payload->>'vehicle_id' and active) then raise exception 'invalid_vehicle'; end if;
  insert into public.pmc_posts(vehicle_id,kind,title,body,author_id,author_nickname,photo_paths)
  values(nullif(payload->>'vehicle_id',''),payload->>'kind',btrim(payload->>'title'),btrim(payload->>'body'),actor,nick,coalesce(photos,'{}'::text[])) returning id into result_id;
 elsif action='edit_post' then
  if nullif(payload->>'vehicle_id','') is not null and not exists(select 1 from public.pmc_vehicles where id=payload->>'vehicle_id' and active) then raise exception 'invalid_vehicle'; end if;
  update public.pmc_posts set vehicle_id=case when payload ? 'vehicle_id' then nullif(payload->>'vehicle_id','') else vehicle_id end,photo_paths=coalesce(photos,photo_paths),kind=payload->>'kind',title=btrim(payload->>'title'),body=btrim(payload->>'body'),updated_at=now()
  where id=target and author_id=actor and status='published' returning id into result_id;
 elsif action='delete_post' then
  update public.pmc_posts set title='삭제된 글',body='',photo_paths='{}',status='deleted',updated_at=now() where id=target and author_id=actor and status='published' returning id into result_id;
 elsif action='create_comment' then
  parent=(payload->>'post_id')::uuid;
  -- Lock the parent against concurrent removal while inserting its comment.
  perform 1 from public.pmc_posts where id=parent and status='published' for share;
  if not found then raise exception 'not_found'; end if;
  insert into public.pmc_comments(post_id,body,author_id,author_nickname) values(parent,btrim(payload->>'body'),actor,nick) returning id into result_id;
 elsif action='edit_comment' then
  update public.pmc_comments c set body=btrim(payload->>'body'),updated_at=now() where c.id=target and c.author_id=actor and c.status='published'
  and exists(select 1 from public.pmc_posts p where p.id=c.post_id and p.status='published') returning c.id into result_id;
 elsif action='delete_comment' then
  update public.pmc_comments set body='',status='deleted',updated_at=now() where id=target and author_id=actor and status='published' returning id into result_id;
 elsif action='report' then
  if payload->>'type'='post' then
   if not exists(select 1 from public.pmc_posts where id=target and status='published') then raise exception 'not_found'; end if;
  elsif payload->>'type'='comment' then
   if not exists(select 1 from public.pmc_comments c join public.pmc_posts p on p.id=c.post_id where c.id=target and c.status='published' and p.status='published') then raise exception 'not_found'; end if;
  else raise exception 'not_allowed'; end if;
  insert into public.pmc_reports(reporter_id,target_type,target_id,reason,detail) values(actor,payload->>'type',target,payload->>'reason',coalesce(payload->>'detail','')) returning id into result_id;
 end if;
 if result_id is null then raise exception 'not_allowed'; end if;
 return to_jsonb(result_id);
end $$;
revoke all on function pmc_private.write(text,jsonb) from public,anon;
grant execute on function pmc_private.write(text,jsonb) to authenticated;
create function public.pmc_write(action text,payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select pmc_private.write(action,payload) $$;
revoke all on function public.pmc_write(text,jsonb) from public,anon;
grant execute on function public.pmc_write(text,jsonb) to authenticated;

-- A dedicated private bucket; unrelated project storage remains untouched.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pmc-post-images','pmc-post-images',false,5242880,array['image/webp','image/jpeg','image/png']);
create policy pmc_photos_read on storage.objects for select to anon,authenticated using(
 bucket_id='pmc-post-images' and (owner_id=(select auth.uid())::text or exists(
 select 1 from public.pmc_posts p where p.status='published' and name=any(p.photo_paths))));
create policy pmc_photos_insert on storage.objects for insert to authenticated with check(
 bucket_id='pmc-post-images' and owner_id=(select auth.uid())::text
 and split_part(name,'/',1)=(select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'
 and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from public.pmc_profiles where id=(select auth.uid())));
create policy pmc_photos_delete on storage.objects for delete to authenticated using(
 bucket_id='pmc-post-images' and owner_id=(select auth.uid())::text
 and not exists(select 1 from public.pmc_posts p where p.status='published' and name=any(p.photo_paths)));

commit;
