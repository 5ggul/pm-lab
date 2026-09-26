-- Age self-attestation is retired. Existing technical identifiers remain.
-- A compatibility JSON key is temporarily returned as true so an older rolling
-- deployment does not block active users while the app update propagates.
create or replace function private.r1_current_permissions()
returns jsonb language sql stable security definer set search_path='' as $$
select case when auth.uid() is null then
 jsonb_build_object('authenticated',false,'active',false,'age_confirmed_14_plus',true,'role',null)
else jsonb_build_object(
 'authenticated',true,
 'active',coalesce((select status='active' from private.user_status where user_id=auth.uid()),false),
 'age_confirmed_14_plus',true,
 'role',coalesce((select role from private.user_roles where user_id=auth.uid()),'user')
) end;
$$;

create or replace function private.r1_is_active_user()
returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null
 and exists(select 1 from private.user_status where user_id=auth.uid() and status='active');
$$;

create or replace function public.r1_set_age_confirmation(p_confirmed boolean)
returns boolean language sql set search_path='' as $$ select auth.uid() is not null; $$;

create or replace function public.r1_release_auth_readiness()
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object(
 'google_identity_count',(select count(*)::integer from auth.identities where provider='google'),
 'active_admin_count',(select count(*)::integer from private.user_roles r join private.user_status s on s.user_id=r.user_id where r.role='admin' and s.status='active'),
 'active_google_admin_count',(select count(distinct r.user_id)::integer from private.user_roles r join private.user_status s on s.user_id=r.user_id join auth.identities i on i.user_id=r.user_id and i.provider='google' where r.role='admin' and s.status='active')
);
$$;

create or replace function public.r1_submit_question(p_game_universe_id bigint,p_title text,p_body text,p_request_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $
declare v_user uuid:=auth.uid();v_permissions jsonb;v_existing public.questions%rowtype;v_id uuid;
begin
 if v_user is null then raise exception 'authentication required' using errcode='42501';end if;
 v_permissions:=public.r1_my_community_permissions();
 if not coalesce((v_permissions->>'active')::boolean,false) then raise exception 'community posting is unavailable for this account' using errcode='42501';end if;
 if p_request_id is null or p_game_universe_id is null or p_game_universe_id<=0 or p_title is null or p_body is null or char_length(btrim(p_title)) not between 5 and 120 or char_length(btrim(p_body)) not between 10 and 5000 then raise exception 'invalid question input' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_request_id::text,0));
 select * into v_existing from public.questions where author_id=v_user and client_request_id=p_request_id;
 if found then
  if v_existing.game_universe_id is distinct from p_game_universe_id or v_existing.title is distinct from btrim(p_title) or v_existing.body is distinct from btrim(p_body) then raise exception 'question_request_conflict' using errcode='22023';end if;
  return v_existing.id;
 end if;
 insert into public.questions(game_universe_id,author_id,title,body,client_request_id) values(p_game_universe_id,v_user,btrim(p_title),btrim(p_body),p_request_id) returning id into v_id;
 return v_id;
end;$;

create or replace function public.r1_submit_answer(p_question_id uuid,p_body text,p_request_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $
declare v_user uuid:=auth.uid();v_permissions jsonb;v_existing public.answers%rowtype;v_id uuid;
begin
 if v_user is null then raise exception 'authentication required' using errcode='42501';end if;
 v_permissions:=public.r1_my_community_permissions();
 if not coalesce((v_permissions->>'active')::boolean,false) then raise exception 'community posting is unavailable for this account' using errcode='42501';end if;
 if p_question_id is null or p_request_id is null or p_body is null or char_length(btrim(p_body)) not between 2 and 5000 then raise exception 'invalid answer input' using errcode='22023';end if;
 if not exists(select 1 from public.questions q where q.id=p_question_id and q.moderation_status='visible' and q.status<>'closed') then raise exception 'question_unavailable' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_request_id::text,0));
 select * into v_existing from public.answers where author_id=v_user and client_request_id=p_request_id;
 if found then
  if v_existing.question_id is distinct from p_question_id or v_existing.body is distinct from btrim(p_body) then raise exception 'answer_request_conflict' using errcode='22023';end if;
  return v_existing.id;
 end if;
 insert into public.answers(question_id,author_id,body,client_request_id) values(p_question_id,v_user,btrim(p_body),p_request_id) returning id into v_id;
 return v_id;
end;$;

create or replace function public.r1_submit_comment(p_question_id uuid,p_answer_id uuid,p_body text,p_request_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $
declare u uuid:=auth.uid();permissions jsonb;existing public.comments%rowtype;result uuid;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 permissions:=public.r1_my_community_permissions();
 if not coalesce((permissions->>'active')::boolean,false) then raise exception 'posting unavailable' using errcode='42501';end if;
 if p_question_id is null or p_request_id is null or p_body is null or char_length(btrim(p_body)) not between 2 and 1500 then raise exception 'invalid comment input' using errcode='22023';end if;
 if not exists(select 1 from public.questions where id=p_question_id and moderation_status='visible' and status<>'closed') then raise exception 'question_unavailable' using errcode='22023';end if;
 if p_answer_id is not null and not exists(select 1 from public.answers where id=p_answer_id and question_id=p_question_id and moderation_status='visible') then raise exception 'question_unavailable' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text||':'||p_request_id::text,0));
 select * into existing from public.comments where author_id=u and client_request_id=p_request_id;
 if found then
  if existing.body is distinct from btrim(p_body) or existing.answer_id is distinct from p_answer_id or existing.question_id is distinct from(case when p_answer_id is null then p_question_id else null end) then raise exception 'comment_request_conflict' using errcode='22023';end if;
  return existing.id;
 end if;
 insert into public.comments(author_id,question_id,answer_id,body,client_request_id) values(u,case when p_answer_id is null then p_question_id else null end,p_answer_id,btrim(p_body),p_request_id) returning id into result;
 return result;
end;$;

create or replace function public.r1_submit_party(p_game_universe_id bigint,p_title text,p_note text,p_playstyle text,p_max_members integer,p_duration_minutes integer,p_join_url text,p_request_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $
declare u uuid:=auth.uid();permissions jsonb;existing public.party_posts%rowtype;result uuid;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 permissions:=public.r1_my_community_permissions();
 if not coalesce((permissions->>'active')::boolean,false) then raise exception 'posting unavailable' using errcode='42501';end if;
 if p_game_universe_id is null or p_request_id is null or p_title is null or char_length(btrim(p_title)) not between 5 and 100 or p_note is null or char_length(p_note)>1000 or p_duration_minutes is null or p_duration_minutes not in(30,60,120,180,360) or p_max_members is null or p_max_members not in(2,3,4,5,6,8,10,12) or p_playstyle is null or p_playstyle not in('casual','competitive','learning','quest','grind') or char_length(p_join_url)>2048 then raise exception 'invalid party input' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text||':'||p_request_id::text,0));
 select * into existing from public.party_posts where host_id=u and client_request_id=p_request_id;
 if found then
  if existing.game_universe_id is distinct from p_game_universe_id or existing.title is distinct from btrim(p_title) or existing.note is distinct from btrim(p_note) or existing.playstyle is distinct from p_playstyle or existing.max_members is distinct from p_max_members or existing.requested_duration_minutes is distinct from p_duration_minutes or existing.roblox_join_url is distinct from nullif(btrim(p_join_url),'') then raise exception 'party_request_conflict' using errcode='22023';end if;
  return existing.id;
 end if;
 insert into public.party_posts(game_universe_id,host_id,title,note,playstyle,max_members,expires_at,roblox_join_url,client_request_id,requested_duration_minutes) values(p_game_universe_id,u,btrim(p_title),btrim(p_note),p_playstyle,p_max_members,now()+make_interval(mins=>p_duration_minutes),nullif(btrim(p_join_url),''),p_request_id,p_duration_minutes) returning id into result;
 return result;
end;$;
