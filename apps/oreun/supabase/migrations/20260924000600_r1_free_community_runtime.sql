-- Runtime rules for the free-talk community. Depends on 202609240004/005.
create index if not exists community_posts_created_idx on public.community_posts(created_at desc,id desc);
create index if not exists community_posts_game_created_idx on public.community_posts(game_universe_id,created_at desc,id desc);
create index if not exists community_post_comments_post_created_idx on public.community_post_comments(post_id,created_at asc,id asc);
create unique index if not exists community_posts_author_request_unique on public.community_posts(author_id,client_request_id) where client_request_id is not null;
create unique index if not exists community_post_comments_author_request_unique on public.community_post_comments(author_id,client_request_id) where client_request_id is not null;

alter table public.community_posts enable row level security;
alter table public.community_post_comments enable row level security;

drop policy if exists "community posts anon visible" on public.community_posts;
create policy "community posts anon visible" on public.community_posts for select to anon using(moderation_status='visible');
drop policy if exists "community posts authenticated readable" on public.community_posts;
create policy "community posts authenticated readable" on public.community_posts for select to authenticated using(moderation_status='visible' or auth.uid()=author_id or private.r1_is_moderator());
drop policy if exists "community posts author insert" on public.community_posts;
create policy "community posts author insert" on public.community_posts for insert to authenticated with check(auth.uid()=author_id and private.r1_is_active_user());
drop policy if exists "community posts author update" on public.community_posts;
create policy "community posts author update" on public.community_posts for update to authenticated using(auth.uid()=author_id or private.r1_is_moderator()) with check(auth.uid()=author_id or private.r1_is_moderator());

drop policy if exists "community post comments anon visible" on public.community_post_comments;
create policy "community post comments anon visible" on public.community_post_comments for select to anon using(moderation_status='visible');
drop policy if exists "community post comments authenticated readable" on public.community_post_comments;
create policy "community post comments authenticated readable" on public.community_post_comments for select to authenticated using(moderation_status='visible' or auth.uid()=author_id or private.r1_is_moderator());
drop policy if exists "community post comments author insert" on public.community_post_comments;
create policy "community post comments author insert" on public.community_post_comments for insert to authenticated with check(auth.uid()=author_id and private.r1_is_active_user());
drop policy if exists "community post comments author update" on public.community_post_comments;
create policy "community post comments author update" on public.community_post_comments for update to authenticated using(auth.uid()=author_id or private.r1_is_moderator()) with check(auth.uid()=author_id or private.r1_is_moderator());

create or replace function private.r1_guard_community_post_insert() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not private.r1_is_active_user() then raise exception 'community posting is unavailable for this account'; end if;
 if new.author_id is distinct from auth.uid() then raise exception 'author mismatch'; end if;
 new.title:=btrim(new.title);new.body:=btrim(new.body);new.moderation_status:='visible';new.created_at:=now();new.updated_at:=now();
 if private.r1_contains_restricted_contact(new.title||' '||new.body) then raise exception 'restricted contact or credential pattern'; end if;
 perform private.r1_consume_rate_limit('free_post',10,interval '1 hour');
 return new;
end;$$;
revoke all on function private.r1_guard_community_post_insert() from public,anon,authenticated;

create or replace function private.r1_guard_community_post_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.r1_erasing_user(old.author_id) then new:=old;new.author_id:=null;new.title:='작성자가 삭제한 자유글입니다';new.body:='작성자가 탈퇴하며 글 내용을 삭제했습니다.';new.updated_at:=now();return new;end if;
 if new.id is distinct from old.id or new.author_id is distinct from old.author_id or new.game_universe_id is distinct from old.game_universe_id or new.created_at is distinct from old.created_at or new.client_request_id is distinct from old.client_request_id then raise exception 'immutable community post fields changed';end if;
 if private.r1_is_moderator() then
  if new.title is distinct from old.title or new.body is distinct from old.body then raise exception 'moderators may not rewrite user content';end if;
 else
  if auth.uid() is distinct from old.author_id then raise exception 'post ownership required';end if;
  if new.moderation_status is distinct from old.moderation_status then raise exception 'authors may not change moderation state';end if;
  if private.r1_contains_restricted_contact(new.title||' '||new.body) then raise exception 'restricted contact or credential pattern';end if;
 end if;
 new.title:=btrim(new.title);new.body:=btrim(new.body);new.updated_at:=now();return new;
end;$$;
revoke all on function private.r1_guard_community_post_update() from public,anon,authenticated;

create or replace function private.r1_guard_community_comment_insert() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not private.r1_is_active_user() then raise exception 'community posting is unavailable for this account';end if;
 if new.author_id is distinct from auth.uid() then raise exception 'author mismatch';end if;
 if not exists(select 1 from public.community_posts where id=new.post_id and moderation_status='visible') then raise exception 'community post unavailable';end if;
 new.body:=btrim(new.body);new.moderation_status:='visible';new.created_at:=now();new.updated_at:=now();
 if private.r1_contains_restricted_contact(new.body) then raise exception 'restricted contact or credential pattern';end if;
 perform private.r1_consume_rate_limit('free_comment',30,interval '1 hour');return new;
end;$$;
revoke all on function private.r1_guard_community_comment_insert() from public,anon,authenticated;

create or replace function private.r1_guard_community_comment_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.r1_erasing_user(old.author_id) then new:=old;new.author_id:=null;new.body:='작성자가 삭제한 댓글입니다.';new.updated_at:=now();return new;end if;
 if new.id is distinct from old.id or new.author_id is distinct from old.author_id or new.post_id is distinct from old.post_id or new.created_at is distinct from old.created_at or new.client_request_id is distinct from old.client_request_id then raise exception 'immutable community comment fields changed';end if;
 if private.r1_is_moderator() then
  if new.body is distinct from old.body then raise exception 'moderators may not rewrite user content';end if;
 else
  if auth.uid() is distinct from old.author_id then raise exception 'comment ownership required';end if;
  if new.moderation_status is distinct from old.moderation_status then raise exception 'authors may not change moderation state';end if;
  if private.r1_contains_restricted_contact(new.body) then raise exception 'restricted contact or credential pattern';end if;
 end if;
 new.body:=btrim(new.body);new.updated_at:=now();return new;
end;$$;
revoke all on function private.r1_guard_community_comment_update() from public,anon,authenticated;

drop trigger if exists r1_guard_community_post_insert on public.community_posts;
create trigger r1_guard_community_post_insert before insert on public.community_posts for each row execute function private.r1_guard_community_post_insert();
drop trigger if exists r1_guard_community_post_update on public.community_posts;
create trigger r1_guard_community_post_update before update on public.community_posts for each row execute function private.r1_guard_community_post_update();
drop trigger if exists r1_guard_community_comment_insert on public.community_post_comments;
create trigger r1_guard_community_comment_insert before insert on public.community_post_comments for each row execute function private.r1_guard_community_comment_insert();
drop trigger if exists r1_guard_community_comment_update on public.community_post_comments;
create trigger r1_guard_community_comment_update before update on public.community_post_comments for each row execute function private.r1_guard_community_comment_update();

create or replace view public.r1_community_post_feed with(security_invoker=true) as
select p.id,p.game_universe_id,g.canonical_slug game_slug,g.name_ko game_name_ko,p.author_id,profile.handle author_handle,coalesce(profile.display_name,profile.handle,'탈퇴한 이용자'::text) author_name,p.title,p.body,p.created_at,p.updated_at,coalesce(c.comment_count,0)::integer comment_count
from public.community_posts p
left join public.profiles profile on profile.id=p.author_id
left join public.games g on g.universe_id=p.game_universe_id
left join(select post_id,count(*)::integer comment_count from public.community_post_comments where moderation_status='visible' group by post_id)c on c.post_id=p.id
where p.moderation_status='visible';

create or replace view public.r1_community_post_comment_feed with(security_invoker=true) as
select c.id,c.post_id,c.author_id,profile.handle author_handle,coalesce(profile.display_name,profile.handle,'탈퇴한 이용자'::text) author_name,c.body,c.created_at,c.updated_at
from public.community_post_comments c left join public.profiles profile on profile.id=c.author_id
where c.moderation_status='visible';

grant select on public.r1_community_post_feed to anon,authenticated;
grant select on public.r1_community_post_comment_feed to anon,authenticated;

create or replace function public.r1_submit_community_post(p_game_universe_id bigint,p_title text,p_body text,p_request_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid();permissions jsonb;existing public.community_posts%rowtype;result uuid;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 permissions:=public.r1_my_community_permissions();if not coalesce((permissions->>'active')::boolean,false) then raise exception 'posting unavailable' using errcode='42501';end if;
 if p_request_id is null or p_title is null or p_body is null or char_length(btrim(p_title)) not between 2 and 120 or char_length(btrim(p_body)) not between 2 and 5000 then raise exception 'invalid community post input' using errcode='22023';end if;
 if p_game_universe_id is not null and not exists(select 1 from public.games where universe_id=p_game_universe_id) then raise exception 'game unavailable' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text||':'||p_request_id::text,0));
 select * into existing from public.community_posts where author_id=u and client_request_id=p_request_id;
 if found then
  if existing.game_universe_id is distinct from p_game_universe_id or existing.title is distinct from btrim(p_title) or existing.body is distinct from btrim(p_body) then raise exception 'community_post_request_conflict' using errcode='22023';end if;
  return existing.id;
 end if;
 insert into public.community_posts(game_universe_id,author_id,title,body,client_request_id) values(p_game_universe_id,u,btrim(p_title),btrim(p_body),p_request_id) returning id into result;return result;
end;$$;
revoke all on function public.r1_submit_community_post(bigint,text,text,uuid) from public,anon;
grant execute on function public.r1_submit_community_post(bigint,text,text,uuid) to authenticated;

create or replace function public.r1_submit_community_post_comment(p_post_id uuid,p_body text,p_request_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid();permissions jsonb;existing public.community_post_comments%rowtype;result uuid;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 permissions:=public.r1_my_community_permissions();if not coalesce((permissions->>'active')::boolean,false) then raise exception 'posting unavailable' using errcode='42501';end if;
 if p_post_id is null or p_request_id is null or p_body is null or char_length(btrim(p_body)) not between 2 and 1500 then raise exception 'invalid community post comment input' using errcode='22023';end if;
 if not exists(select 1 from public.community_posts where id=p_post_id and moderation_status='visible') then raise exception 'community post unavailable' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text||':'||p_request_id::text,0));
 select * into existing from public.community_post_comments where author_id=u and client_request_id=p_request_id;
 if found then
  if existing.post_id is distinct from p_post_id or existing.body is distinct from btrim(p_body) then raise exception 'community_comment_request_conflict' using errcode='22023';end if;
  return existing.id;
 end if;
 insert into public.community_post_comments(post_id,author_id,body,client_request_id) values(p_post_id,u,btrim(p_body),p_request_id) returning id into result;return result;
end;$$;
revoke all on function public.r1_submit_community_post_comment(uuid,text,uuid) from public,anon;
grant execute on function public.r1_submit_community_post_comment(uuid,text,uuid) to authenticated;

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check check(target_type in('question','answer','comment','profile','party','post','post_comment'));
alter table public.moderation_actions drop constraint if exists moderation_actions_target_type_check;
alter table public.moderation_actions add constraint moderation_actions_target_type_check check(target_type in('question','answer','comment','profile','report','party','post','post_comment'));

-- The existing report guard must accept the two new targets.
create or replace function private.r1_guard_ugc_insert() returns trigger language plpgsql security definer set search_path='' as $$
declare v_action text;v_limit integer;v_window interval:=interval '1 hour';v_text text;
begin
 if not private.r1_is_active_user() then raise exception 'community posting is unavailable for this account';end if;
 if tg_table_name='questions' then if new.author_id is distinct from auth.uid() then raise exception 'author mismatch';end if;new.title:=btrim(new.title);new.body:=btrim(new.body);new.status:='open';new.moderation_status:='visible';new.accepted_answer_id:=null;v_action:='question';v_limit:=5;v_text:=new.title||' '||new.body;
 elsif tg_table_name='answers' then if new.author_id is distinct from auth.uid() then raise exception 'author mismatch';end if;new.body:=btrim(new.body);new.moderation_status:='visible';v_action:='answer';v_limit:=20;v_text:=new.body;
 elsif tg_table_name='comments' then if new.author_id is distinct from auth.uid() then raise exception 'author mismatch';end if;new.body:=btrim(new.body);new.moderation_status:='visible';v_action:='comment';v_limit:=30;v_text:=new.body;
 elsif tg_table_name='reports' then
  if new.reporter_id is distinct from auth.uid() then raise exception 'reporter mismatch';end if;new.details:=btrim(coalesce(new.details,''));new.status:='open';new.reviewed_at:=null;new.reviewed_by:=null;v_action:='report';v_limit:=10;v_text:=new.details;
  if new.target_type='question' and not exists(select 1 from public.questions where id=new.target_id) then raise exception 'report target not found';
  elsif new.target_type='answer' and not exists(select 1 from public.answers where id=new.target_id) then raise exception 'report target not found';
  elsif new.target_type='comment' and not exists(select 1 from public.comments where id=new.target_id) then raise exception 'report target not found';
  elsif new.target_type='profile' and not exists(select 1 from public.profiles where id=new.target_id) then raise exception 'report target not found';
  elsif new.target_type='party' and not exists(select 1 from public.party_posts where id=new.target_id) then raise exception 'report target not found';
  elsif new.target_type='post' and not exists(select 1 from public.community_posts where id=new.target_id) then raise exception 'report target not found';
  elsif new.target_type='post_comment' and not exists(select 1 from public.community_post_comments where id=new.target_id) then raise exception 'report target not found';end if;
 else raise exception 'unsupported community table';end if;
 if private.r1_contains_restricted_contact(v_text) then raise exception 'restricted contact or credential pattern';end if;
 perform private.r1_consume_rate_limit(v_action,v_limit,v_window);return new;
end;$$;

-- Account deletion redacts the departing user's new free-talk content too.
create or replace function private.r1_erase_profile_contents() returns trigger language plpgsql security definer set search_path='' as $$
declare v_parties uuid[];
begin
 if exists(select 1 from auth.users where id=old.id) then raise exception 'delete account through the authenticated Auth API';end if;
 insert into private.r1_erasure_context(transaction_id,user_id) values(pg_catalog.txid_current(),old.id);
 update public.notifications set payload='{}'::jsonb where actor_id=old.id or question_id in(select id from public.questions where author_id=old.id) or answer_id in(select id from public.answers where author_id=old.id);
 update public.questions set accepted_answer_id=null where accepted_answer_id in(select id from public.answers where author_id=old.id);
 update public.questions set author_id=null where author_id=old.id;update public.answers set author_id=null where author_id=old.id;update public.comments set author_id=null where author_id=old.id;
 update public.community_posts set author_id=null where author_id=old.id;update public.community_post_comments set author_id=null where author_id=old.id;
 select array_agg(party_id) into v_parties from public.party_members where user_id=old.id;perform 1 from public.party_posts where id=any(v_parties) order by id for update;delete from public.party_members where user_id=old.id;
 update public.party_posts p set member_count=greatest(1,(select count(*)::int from public.party_members m where m.party_id=p.id)),status=case when p.status in('open','full') then case when p.expires_at<=now() then 'expired' when(select count(*) from public.party_members m where m.party_id=p.id)>=p.max_members then 'full' else 'open' end else p.status end,updated_at=now() where p.id=any(v_parties) and p.host_id<>old.id;
 update public.party_posts set host_id=null,title='종료된 파티 모집',note='',roblox_join_url=null,status='closed',updated_at=now() where host_id=old.id;
 delete from private.r1_erasure_context where transaction_id=pg_catalog.txid_current() and user_id=old.id;return old;
end;$$;
