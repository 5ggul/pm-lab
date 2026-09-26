-- Run ONLY against the disposable CI Postgres database. No service credentials.
\set ON_ERROR_STOP on
begin;
do $$ declare s text; n integer; begin
 select state into s from public.r1_public_guide_states() where universe_id=6035872082 and slug='first-duel';
 if s<>'published' then raise exception 'initial published state missing';end if;
 select state into s from public.r1_public_guide_states() where universe_id=5750914919 and slug='fishing-controls';
 if s<>'missing' then raise exception 'absent static guide incorrectly blocked';end if;
 update public.game_guides set content_status='archived' where universe_id=6035872082;
 select state into s from public.r1_public_guide_states() where universe_id=6035872082;
 if s<>'withheld' then raise exception 'archived guide resurrected';end if;
 update public.game_guides set content_status='published',review_status='rejected' where universe_id=6035872082;
 select state into s from public.r1_public_guide_states() where universe_id=6035872082;
 if s<>'withheld' then raise exception 'rejected guide resurrected';end if;
 update public.game_guides set review_status='approved' where universe_id=6035872082;
 delete from public.game_guides where universe_id=6035872082;
 select state into s from public.r1_public_guide_states() where universe_id=6035872082;
 if s<>'withheld' then raise exception 'deleted guide lost tombstone';end if;
 insert into public.game_guides values(6035872082,'first-duel','published','approved','private test body');
 select state into s from public.r1_public_guide_states() where universe_id=6035872082;
 if s<>'published' then raise exception 'explicit republication not reflected';end if;
 if has_table_privilege('anon','private.r1_fallback_guide_visibility','SELECT') then raise exception 'private registry readable';end if;
 if has_table_privilege('anon','public.game_guides','SELECT') then raise exception 'private original readable';end if;
 select count(*) into n from public.r1_public_guide_states();if n<>26 then raise exception 'registry must expose only 26 known public keys';end if;
end $$;
set local role anon;
select count(*)=26 as public_visibility_only from public.r1_public_guide_states();
reset role;
rollback;
select 'PASS: missing/published/archived/rejected/deleted/republication, public metadata only. Disposable CI DB.' as result;
