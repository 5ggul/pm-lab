-- Fix generic Sprint 02 insert guard so table-specific NEW fields are only
-- referenced inside the matching branch.

create or replace function private.r1_guard_ugc_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_limit integer;
  v_window interval := interval '1 hour';
  v_text text;
begin
  if not private.r1_is_active_user() then
    raise exception 'community posting is unavailable for this account';
  end if;

  if tg_table_name = 'questions' then
    if new.author_id is distinct from auth.uid() then
      raise exception 'author mismatch';
    end if;
    v_action := 'question';
    v_limit := 5;
    v_text := coalesce(new.title, '') || ' ' || coalesce(new.body, '');

  elsif tg_table_name = 'answers' then
    if new.author_id is distinct from auth.uid() then
      raise exception 'author mismatch';
    end if;
    v_action := 'answer';
    v_limit := 20;
    v_text := coalesce(new.body, '');

  elsif tg_table_name = 'comments' then
    if new.author_id is distinct from auth.uid() then
      raise exception 'author mismatch';
    end if;
    v_action := 'comment';
    v_limit := 30;
    v_text := coalesce(new.body, '');

  elsif tg_table_name = 'reports' then
    if new.reporter_id is distinct from auth.uid() then
      raise exception 'reporter mismatch';
    end if;
    v_action := 'report';
    v_limit := 10;
    v_text := coalesce(new.details, '');

    if new.target_type = 'question'
      and not exists (select 1 from public.questions where id = new.target_id)
    then
      raise exception 'report target not found';
    elsif new.target_type = 'answer'
      and not exists (select 1 from public.answers where id = new.target_id)
    then
      raise exception 'report target not found';
    elsif new.target_type = 'comment'
      and not exists (select 1 from public.comments where id = new.target_id)
    then
      raise exception 'report target not found';
    elsif new.target_type = 'profile'
      and not exists (select 1 from public.profiles where id = new.target_id)
    then
      raise exception 'report target not found';
    end if;

  else
    raise exception 'unsupported community table';
  end if;

  if private.r1_contains_restricted_contact(v_text) then
    raise exception 'restricted contact or credential pattern';
  end if;

  perform private.r1_consume_rate_limit(v_action, v_limit, v_window);
  return new;
end;
$$;
