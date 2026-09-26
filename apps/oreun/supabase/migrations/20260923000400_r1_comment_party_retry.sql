-- Preserve existing rows. Only newly submitted content receives a request id.
alter table public.comments add column if not exists client_request_id uuid;
alter table public.party_posts add column if not exists client_request_id uuid;
alter table public.party_posts add column if not exists requested_duration_minutes integer;
create unique index if not exists r1_comments_request_unique on public.comments(author_id,client_request_id) where client_request_id is not null;
create unique index if not exists r1_party_request_unique on public.party_posts(host_id,client_request_id) where client_request_id is not null;
create or replace function private.r1_guard_extra_request_id() returns trigger language plpgsql set search_path='' as $$
begin
 if new.client_request_id is distinct from old.client_request_id then raise exception 'request id is immutable';end if;
 if tg_table_name='party_posts' and (to_jsonb(new)->'requested_duration_minutes') is distinct from (to_jsonb(old)->'requested_duration_minutes') then raise exception 'requested duration is immutable';end if;
 return new;
end;$$;
revoke all on function private.r1_guard_extra_request_id() from public,anon,authenticated;
drop trigger if exists r1_guard_comment_request on public.comments;
create trigger r1_guard_comment_request before update on public.comments for each row execute function private.r1_guard_extra_request_id();
drop trigger if exists r1_guard_party_request on public.party_posts;
create trigger r1_guard_party_request before update on public.party_posts for each row execute function private.r1_guard_extra_request_id();
create or replace function public.r1_submit_comment(p_question_id uuid,p_answer_id uuid,p_body text,p_request_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); permissions jsonb; existing public.comments%rowtype; result uuid;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 permissions:=public.r1_my_community_permissions();
 if not coalesce((permissions->>'active')::boolean,false) or not coalesce((permissions->>'age_confirmed_14_plus')::boolean,false) then raise exception 'posting unavailable' using errcode='42501';end if;
 if p_question_id is null or p_request_id is null or p_body is null or char_length(btrim(p_body)) not between 2 and 1500 then raise exception 'invalid comment input' using errcode='22023';end if;
 if not exists(select 1 from public.questions where id=p_question_id and moderation_status='visible' and status<>'closed') then raise exception 'question_unavailable' using errcode='22023';end if;
 if p_answer_id is not null and not exists(select 1 from public.answers where id=p_answer_id and question_id=p_question_id and moderation_status='visible') then raise exception 'question_unavailable' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text||':'||p_request_id::text,0));
 select * into existing from public.comments where author_id=u and client_request_id=p_request_id;
 if found then
  if existing.body is distinct from btrim(p_body) or existing.answer_id is distinct from p_answer_id or existing.question_id is distinct from (case when p_answer_id is null then p_question_id else null end) then raise exception 'comment_request_conflict' using errcode='22023';end if;
  return existing.id;
 end if;
 insert into public.comments(author_id,question_id,answer_id,body,client_request_id) values(u,case when p_answer_id is null then p_question_id else null end,p_answer_id,btrim(p_body),p_request_id) returning id into result;
 return result;
end;$$;
revoke all on function public.r1_submit_comment(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.r1_submit_comment(uuid,uuid,text,uuid) to authenticated;
create or replace function public.r1_submit_party(p_game_universe_id bigint,p_title text,p_note text,p_playstyle text,p_max_members integer,p_duration_minutes integer,p_join_url text,p_request_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); permissions jsonb; existing public.party_posts%rowtype; result uuid;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 permissions:=public.r1_my_community_permissions();
 if not coalesce((permissions->>'active')::boolean,false) or not coalesce((permissions->>'age_confirmed_14_plus')::boolean,false) then raise exception 'posting unavailable' using errcode='42501';end if;
 if p_game_universe_id is null or p_request_id is null or p_title is null or char_length(btrim(p_title)) not between 5 and 100 or p_note is null or char_length(p_note)>1000 or p_duration_minutes is null or p_duration_minutes not in(30,60,120,180,360) or p_max_members is null or p_max_members not in(2,3,4,5,6,8,10,12) or p_playstyle is null or p_playstyle not in('casual','competitive','learning','quest','grind') or char_length(p_join_url)>2048 then raise exception 'invalid party input' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text||':'||p_request_id::text,0));
 select * into existing from public.party_posts where host_id=u and client_request_id=p_request_id;
 if found then
  if existing.game_universe_id is distinct from p_game_universe_id or existing.title is distinct from btrim(p_title) or existing.note is distinct from btrim(p_note) or existing.playstyle is distinct from p_playstyle or existing.max_members is distinct from p_max_members or existing.requested_duration_minutes is distinct from p_duration_minutes or existing.roblox_join_url is distinct from nullif(btrim(p_join_url),'') then raise exception 'party_request_conflict' using errcode='22023';end if;
  return existing.id;
 end if;
 insert into public.party_posts(game_universe_id,host_id,title,note,playstyle,max_members,expires_at,roblox_join_url,client_request_id,requested_duration_minutes) values(p_game_universe_id,u,btrim(p_title),btrim(p_note),p_playstyle,p_max_members,now()+make_interval(mins=>p_duration_minutes),nullif(btrim(p_join_url),''),p_request_id,p_duration_minutes) returning id into result;
 return result;
end;$$;
revoke all on function public.r1_submit_party(bigint,text,text,text,integer,integer,text,uuid) from public,anon;
grant execute on function public.r1_submit_party(bigint,text,text,text,integer,integer,text,uuid) to authenticated;
