-- Self-service hard deletion uses Auth Admin API, not a caller-supplied user-id RPC.
-- No existing account or post is changed by applying this migration.
alter table public.questions alter column author_id drop not null;
alter table public.answers alter column author_id drop not null;
alter table public.comments alter column author_id drop not null;
alter table public.party_posts alter column host_id drop not null;
create table if not exists private.r1_erasure_context(transaction_id bigint not null,user_id uuid not null,primary key(transaction_id,user_id));
alter table private.r1_erasure_context enable row level security;
revoke all on private.r1_erasure_context from public,anon,authenticated,service_role;
create or replace function private.r1_erasing_user(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$ select p_user is not null and exists(select 1 from private.r1_erasure_context where transaction_id=pg_catalog.txid_current() and user_id=p_user); $$;
revoke all on function private.r1_erasing_user(uuid) from public,anon,authenticated,service_role;
-- Preserve existing guards; only the private transaction capability enables redaction.
do $migration$
declare name text; definition text; addition text;
begin
foreach name in array array['r1_guard_question_update','r1_guard_answer_update','r1_guard_comment_update','r1_guard_notification_update'] loop
 definition:=pg_get_functiondef(('private.'||name||'()')::regprocedure);
 if position('r1_erasing_user' in definition)>0 then continue; end if;
 if position(E'\nbegin\n' in definition)=0 then raise exception 'unexpected guard format: %',name; end if;
 if name='r1_guard_question_update' then addition:=$body$
  if private.r1_erasing_user(old.author_id) then
    new:=old; new.author_id:=null; new.title:='작성자가 삭제한 질문입니다'; new.body:='작성자가 탈퇴하며 질문 내용을 삭제했습니다.';
    new.accepted_answer_id:=null; new.status:='closed'; new.updated_at:=now(); return new;
  end if;
  if old.accepted_answer_id is not null and exists(select 1 from public.answers a where a.id=old.accepted_answer_id and private.r1_erasing_user(a.author_id)) then
    new:=old; new.accepted_answer_id:=null; if new.status='answered' then new.status:='open'; end if;
    new.updated_at:=now(); return new;
  end if;
$body$;
 elsif name='r1_guard_answer_update' then addition:=$body$
  if private.r1_erasing_user(old.author_id) then
    new:=old; new.author_id:=null; new.body:='작성자가 삭제한 답변입니다.'; new.updated_at:=now(); return new;
  end if;
$body$;
 elsif name='r1_guard_comment_update' then addition:=$body$
  if private.r1_erasing_user(old.author_id) then
    new:=old; new.author_id:=null; new.body:='작성자가 삭제한 댓글입니다.'; new.updated_at:=now(); return new;
  end if;
$body$;
 else addition:=$body$
  if private.r1_erasing_user(old.actor_id)
    or exists(select 1 from public.questions q where q.id=old.question_id and private.r1_erasing_user(q.author_id))
    or exists(select 1 from public.answers a where a.id=old.answer_id and private.r1_erasing_user(a.author_id))
  then
    new:=old; if private.r1_erasing_user(old.actor_id) then new.actor_id:=null; end if;
    new.payload:='{}'::jsonb; return new;
  end if;
$body$;
 end if;
 execute replace(definition,E'\nbegin\n',E'\nbegin\n'||addition);
end loop;
end;
$migration$;
create or replace function private.r1_erase_profile_contents() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from auth.users where id=old.id) then raise exception 'delete account through the authenticated Auth API'; end if;
 insert into private.r1_erasure_context(transaction_id,user_id) values(pg_catalog.txid_current(),old.id);
 update public.notifications set payload='{}'::jsonb where actor_id=old.id or question_id in(select id from public.questions where author_id=old.id) or answer_id in(select id from public.answers where author_id=old.id);
 update public.questions set accepted_answer_id=null where accepted_answer_id in(select id from public.answers where author_id=old.id);
 update public.questions set author_id=null where author_id=old.id;
 update public.answers set author_id=null where author_id=old.id;
 update public.comments set author_id=null where author_id=old.id;
 update public.party_posts set host_id=null,title='종료된 파티 모집',note='',roblox_join_url=null,status='closed',updated_at=now() where host_id=old.id;
 delete from private.r1_erasure_context where transaction_id=pg_catalog.txid_current() and user_id=old.id;
 return old;
end;
$$;
revoke all on function private.r1_erase_profile_contents() from public,anon,authenticated,service_role;
drop trigger if exists r1_erase_profile_contents on public.profiles;
create trigger r1_erase_profile_contents before delete on public.profiles for each row execute function private.r1_erase_profile_contents();
-- Retain other authors' replies in a thread with an anonymous deleted-author shell.
do $views$
declare v text; definition text;
begin
foreach v in array array['r1_question_feed','r1_answer_feed','r1_comment_feed'] loop
 definition:=pg_get_viewdef(('public.'||v)::regclass,true);
 definition:=replace(definition,'JOIN profiles profile ON','LEFT JOIN profiles profile ON');
 definition:=replace(definition,'JOIN public.profiles profile ON','LEFT JOIN public.profiles profile ON');
 definition:=replace(definition,'COALESCE(profile.display_name, profile.handle) AS author_name','COALESCE(profile.display_name, profile.handle, ''탈퇴한 이용자''::text) AS author_name');
 definition:=replace(definition,'LEFT LEFT JOIN','LEFT JOIN');
 execute 'create or replace view public.'||quote_ident(v)||' with(security_invoker=true) as '||definition;
end loop;
end;
$views$;
create or replace function public.r1_account_erasure_ready() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.profiles'::regclass and tgname='r1_erase_profile_contents' and tgenabled='O'); $$;
revoke all on function public.r1_account_erasure_ready() from public,anon,authenticated;
grant execute on function public.r1_account_erasure_ready() to service_role;
