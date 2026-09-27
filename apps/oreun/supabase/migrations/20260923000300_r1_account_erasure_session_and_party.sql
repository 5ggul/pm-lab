-- Bind recent authentication to this validated JWT session, not another device.
create or replace function public.r1_account_recent_session(p_user_id uuid,p_session_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from auth.sessions s where s.id=p_session_id and s.user_id=p_user_id and s.created_at>=now()-interval '10 minutes' and s.created_at<=now()+interval '1 minute'); $$;
revoke all on function public.r1_account_recent_session(uuid,uuid) from public,anon,authenticated;
grant execute on function public.r1_account_recent_session(uuid,uuid) to service_role;
create or replace function private.r1_erase_profile_contents() returns trigger language plpgsql security definer set search_path='' as $$
declare v_parties uuid[];
begin
 if exists(select 1 from auth.users where id=old.id) then raise exception 'delete account through the authenticated Auth API'; end if;
 insert into private.r1_erasure_context(transaction_id,user_id) values(pg_catalog.txid_current(),old.id);
 update public.notifications set payload='{}'::jsonb where actor_id=old.id or question_id in(select id from public.questions where author_id=old.id) or answer_id in(select id from public.answers where author_id=old.id);
 update public.questions set accepted_answer_id=null where accepted_answer_id in(select id from public.answers where author_id=old.id);
 update public.questions set author_id=null where author_id=old.id;
 update public.answers set author_id=null where author_id=old.id;
 update public.comments set author_id=null where author_id=old.id;
 select array_agg(party_id) into v_parties from public.party_members where user_id=old.id;
 perform 1 from public.party_posts where id=any(v_parties) order by id for update;
 delete from public.party_members where user_id=old.id;
 update public.party_posts p set member_count=greatest(1,(select count(*)::int from public.party_members m where m.party_id=p.id)),status=case when p.status in('open','full') then case when p.expires_at<=now() then 'expired' when (select count(*) from public.party_members m where m.party_id=p.id)>=p.max_members then 'full' else 'open' end else p.status end,updated_at=now() where p.id=any(v_parties) and p.host_id<>old.id;
 update public.party_posts set host_id=null,title='종료된 파티 모집',note='',roblox_join_url=null,status='closed',updated_at=now() where host_id=old.id;
 delete from private.r1_erasure_context where transaction_id=pg_catalog.txid_current() and user_id=old.id;
 return old;
end;$$;
revoke all on function private.r1_erase_profile_contents() from public,anon,authenticated,service_role;
