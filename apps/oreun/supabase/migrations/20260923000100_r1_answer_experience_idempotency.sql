-- Additive answer retry protection. Existing answers and users are unchanged.
alter table public.answers add column if not exists client_request_id uuid;
create unique index if not exists r1_answers_author_request_unique
  on public.answers(author_id, client_request_id)
  where client_request_id is not null;

create or replace function private.r1_guard_answer_request_id()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.client_request_id is distinct from old.client_request_id then
    raise exception 'answer request id is immutable';
  end if;
  return new;
end;
$$;
revoke all on function private.r1_guard_answer_request_id() from public, anon, authenticated;
drop trigger if exists r1_guard_answer_request_id on public.answers;
create trigger r1_guard_answer_request_id before update on public.answers
for each row execute function private.r1_guard_answer_request_id();

create or replace function public.r1_submit_answer(
  p_question_id uuid, p_body text, p_request_id uuid
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_permissions jsonb;
  v_existing public.answers%rowtype;
  v_id uuid;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  v_permissions := public.r1_my_community_permissions();
  if not coalesce((v_permissions->>'active')::boolean, false)
    or not coalesce((v_permissions->>'age_confirmed_14_plus')::boolean, false)
  then raise exception 'community posting is unavailable for this account' using errcode='42501'; end if;
  if p_question_id is null or p_request_id is null or p_body is null
    or char_length(btrim(p_body)) not between 2 and 5000
  then raise exception 'invalid answer input' using errcode='22023'; end if;
  if not exists (
    select 1 from public.questions q
    where q.id=p_question_id and q.moderation_status='visible' and q.status<>'closed'
  ) then raise exception 'question_unavailable' using errcode='22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text || ':' || p_request_id::text, 0)
  );
  select * into v_existing from public.answers
    where author_id=v_user and client_request_id=p_request_id;
  if found then
    if v_existing.question_id is distinct from p_question_id
      or v_existing.body is distinct from btrim(p_body)
    then raise exception 'answer_request_conflict' using errcode='22023'; end if;
    return v_existing.id;
  end if;

  insert into public.answers(question_id, author_id, body, client_request_id)
  values(p_question_id, v_user, btrim(p_body), p_request_id)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.r1_submit_answer(uuid,text,uuid) from public, anon;
grant execute on function public.r1_submit_answer(uuid,text,uuid) to authenticated;
