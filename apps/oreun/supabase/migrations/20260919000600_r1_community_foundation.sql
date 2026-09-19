-- R1 / Oreun Sprint 02 community foundation.
-- Auth + Q&A + comments + follows + notifications + reports + moderation.
-- Apply only to a dedicated R1 Supabase project.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null,
  display_name text,
  bio text not null default '',
  age_confirmed_14_plus boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format_check
    check (handle ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_length_check
    check (display_name is null or char_length(display_name) between 1 and 30),
  constraint profiles_bio_length_check
    check (char_length(bio) <= 300)
);
create unique index if not exists profiles_handle_lower_unique
  on public.profiles (lower(handle));

create table if not exists private.user_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active','suspended','deleted')),
  reason text,
  updated_at timestamptz not null default now()
);

create table if not exists private.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user'
    check (role in ('user','moderator','admin')),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  game_universe_id bigint not null references public.games(universe_id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  title text not null,
  body text not null,
  status text not null default 'open'
    check (status in ('open','answered','closed')),
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible','pending','removed')),
  accepted_answer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_title_length_check
    check (char_length(btrim(title)) between 5 and 120),
  constraint questions_body_length_check
    check (char_length(btrim(body)) between 10 and 5000)
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  body text not null,
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible','pending','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint answers_body_length_check
    check (char_length(btrim(body)) between 2 and 5000)
);

alter table public.questions
  drop constraint if exists questions_accepted_answer_id_fkey;
alter table public.questions
  add constraint questions_accepted_answer_id_fkey
  foreign key (accepted_answer_id)
  references public.answers(id)
  on delete set null;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions(id) on delete cascade,
  answer_id uuid references public.answers(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  body text not null,
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible','pending','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_exactly_one_parent_check
    check ((question_id is not null)::integer + (answer_id is not null)::integer = 1),
  constraint comments_body_length_check
    check (char_length(btrim(body)) between 2 and 1500)
);

create table if not exists public.game_follows (
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  universe_id bigint not null references public.games(universe_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, universe_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (
    kind in (
      'followed_game_question',
      'question_answer',
      'question_comment',
      'answer_comment',
      'answer_accepted',
      'moderation'
    )
  ),
  actor_id uuid references public.profiles(id) on delete set null,
  game_universe_id bigint references public.games(universe_id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  answer_id uuid references public.answers(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  target_type text not null check (target_type in ('question','answer','comment','profile')),
  target_id uuid not null,
  reason text not null check (
    reason in ('spam','harassment','sexual','personal_info','scam','exploit','malicious_link','other')
  ),
  details text not null default '',
  status text not null default 'open'
    check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  constraint reports_details_length_check check (char_length(details) <= 1000)
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  target_type text not null check (target_type in ('question','answer','comment','profile','report')),
  target_id uuid not null,
  action text not null check (action in ('hide','restore','warn','suspend','unsuspend','resolve_report','dismiss_report')),
  reason text not null,
  created_at timestamptz not null default now(),
  constraint moderation_actions_reason_length_check
    check (char_length(btrim(reason)) between 2 and 1000)
);

create table if not exists private.ugc_rate_limits (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists questions_game_created_idx
  on public.questions(game_universe_id, created_at desc)
  where moderation_status = 'visible';
create index if not exists questions_author_created_idx
  on public.questions(author_id, created_at desc);
create index if not exists answers_question_created_idx
  on public.answers(question_id, created_at asc)
  where moderation_status = 'visible';
create index if not exists comments_question_created_idx
  on public.comments(question_id, created_at asc)
  where moderation_status = 'visible';
create index if not exists comments_answer_created_idx
  on public.comments(answer_id, created_at asc)
  where moderation_status = 'visible';
create index if not exists game_follows_universe_idx
  on public.game_follows(universe_id, created_at desc);
create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, created_at desc)
  where read_at is null;
create index if not exists reports_status_created_idx
  on public.reports(status, created_at asc);
create index if not exists reports_reporter_created_idx
  on public.reports(reporter_id, created_at desc);
create index if not exists ugc_rate_limits_user_action_idx
  on private.ugc_rate_limits(user_id, action, created_at desc);

create or replace function private.r1_is_active_user()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.profiles as profile
      join private.user_status as status
        on status.user_id = profile.id
      where profile.id = auth.uid()
        and profile.age_confirmed_14_plus
        and status.status = 'active'
    );
$$;

create or replace function private.r1_is_moderator()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from private.user_roles as role_row
      join private.user_status as status_row
        on status_row.user_id = role_row.user_id
      where role_row.user_id = auth.uid()
        and role_row.role in ('moderator','admin')
        and status_row.status = 'active'
    );
$$;

grant execute on function private.r1_is_active_user() to authenticated;
grant execute on function private.r1_is_moderator() to authenticated;

create or replace function public.r1_my_community_permissions()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when auth.uid() is null then
      jsonb_build_object(
        'authenticated', false,
        'active', false,
        'age_confirmed_14_plus', false,
        'role', null
      )
    else
      jsonb_build_object(
        'authenticated', true,
        'active', coalesce((
          select status.status = 'active'
          from private.user_status as status
          where status.user_id = auth.uid()
        ), false),
        'age_confirmed_14_plus', coalesce((
          select profile.age_confirmed_14_plus
          from public.profiles as profile
          where profile.id = auth.uid()
        ), false),
        'role', coalesce((
          select role_row.role
          from private.user_roles as role_row
          where role_row.user_id = auth.uid()
        ), 'user')
      )
  end;
$$;
revoke all on function public.r1_my_community_permissions() from public, anon;
grant execute on function public.r1_my_community_permissions() to authenticated;

create or replace function private.r1_contains_restricted_contact(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_text, '') ~* (
    '(\\.roblosecurity|javascript\\s*:|<\\s*script|discord\\.(gg|com/invite)/'
    || '|[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}'
    || '|01[016789][ -]?[0-9]{3,4}[ -]?[0-9]{4}'
    || '|(카카오톡|카톡|telegram|텔레그램)[[:space:]]*(id|아이디|:))'
  );
$$;

create or replace function private.r1_consume_rate_limit(
  p_action text,
  p_max_count integer,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  select count(*)::integer
  into v_count
  from private.ugc_rate_limits
  where user_id = v_user
    and action = p_action
    and created_at >= now() - p_window;

  if v_count >= p_max_count then
    raise exception 'rate limit exceeded for %', p_action;
  end if;

  insert into private.ugc_rate_limits(user_id, action)
  values (v_user, p_action);
end;
$$;

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

  if new.author_id is distinct from auth.uid() and tg_table_name <> 'reports' then
    raise exception 'author mismatch';
  end if;
  if tg_table_name = 'reports' and new.reporter_id is distinct from auth.uid() then
    raise exception 'reporter mismatch';
  end if;

  if tg_table_name = 'questions' then
    v_action := 'question';
    v_limit := 5;
    v_text := coalesce(new.title, '') || ' ' || coalesce(new.body, '');
  elsif tg_table_name = 'answers' then
    v_action := 'answer';
    v_limit := 20;
    v_text := coalesce(new.body, '');
  elsif tg_table_name = 'comments' then
    v_action := 'comment';
    v_limit := 30;
    v_text := coalesce(new.body, '');
  elsif tg_table_name = 'reports' then
    v_action := 'report';
    v_limit := 10;
    v_text := coalesce(new.details, '');
  else
    raise exception 'unsupported community table';
  end if;

  if private.r1_contains_restricted_contact(v_text) then
    raise exception 'restricted contact or credential pattern';
  end if;

  perform private.r1_consume_rate_limit(v_action, v_limit, v_window);

  if tg_table_name = 'reports' then
    if new.target_type = 'question'
      and not exists (select 1 from public.questions where id = new.target_id)
    then raise exception 'report target not found';
    elsif new.target_type = 'answer'
      and not exists (select 1 from public.answers where id = new.target_id)
    then raise exception 'report target not found';
    elsif new.target_type = 'comment'
      and not exists (select 1 from public.comments where id = new.target_id)
    then raise exception 'report target not found';
    elsif new.target_type = 'profile'
      and not exists (select 1 from public.profiles where id = new.target_id)
    then raise exception 'report target not found';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists r1_guard_question_insert on public.questions;
create trigger r1_guard_question_insert
before insert on public.questions
for each row execute function private.r1_guard_ugc_insert();

drop trigger if exists r1_guard_answer_insert on public.answers;
create trigger r1_guard_answer_insert
before insert on public.answers
for each row execute function private.r1_guard_ugc_insert();

drop trigger if exists r1_guard_comment_insert on public.comments;
create trigger r1_guard_comment_insert
before insert on public.comments
for each row execute function private.r1_guard_ugc_insert();

drop trigger if exists r1_guard_report_insert on public.reports;
create trigger r1_guard_report_insert
before insert on public.reports
for each row execute function private.r1_guard_ugc_insert();

create or replace function private.r1_guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception 'profile id is immutable';
  end if;

  new.handle := lower(btrim(new.handle));
  new.display_name := nullif(btrim(new.display_name), '');
  new.bio := btrim(coalesce(new.bio, ''));

  if private.r1_contains_restricted_contact(
    coalesce(new.display_name, '') || ' ' || new.bio
  ) then
    raise exception 'restricted contact or credential pattern';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists r1_guard_profile_update on public.profiles;
create trigger r1_guard_profile_update
before update on public.profiles
for each row execute function private.r1_guard_profile_update();

create or replace function private.r1_guard_question_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.author_id is distinct from old.author_id
    or new.game_universe_id is distinct from old.game_universe_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'immutable question fields changed';
  end if;

  if private.r1_is_moderator() then
    if new.title is distinct from old.title or new.body is distinct from old.body then
      raise exception 'moderators may not rewrite user content';
    end if;
  else
    if auth.uid() is distinct from old.author_id then
      raise exception 'question ownership required';
    end if;
    if new.moderation_status is distinct from old.moderation_status then
      raise exception 'authors may not change moderation state';
    end if;
    if private.r1_contains_restricted_contact(new.title || ' ' || new.body) then
      raise exception 'restricted contact or credential pattern';
    end if;
  end if;

  if new.accepted_answer_id is not null
    and not exists (
      select 1
      from public.answers
      where id = new.accepted_answer_id
        and question_id = old.id
        and moderation_status = 'visible'
    )
  then
    raise exception 'accepted answer must belong to the question';
  end if;

  if new.accepted_answer_id is not null then
    new.status := 'answered';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists r1_guard_question_update on public.questions;
create trigger r1_guard_question_update
before update on public.questions
for each row execute function private.r1_guard_question_update();

create or replace function private.r1_guard_answer_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.author_id is distinct from old.author_id
    or new.question_id is distinct from old.question_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'immutable answer fields changed';
  end if;

  if private.r1_is_moderator() then
    if new.body is distinct from old.body then
      raise exception 'moderators may not rewrite user content';
    end if;
  else
    if auth.uid() is distinct from old.author_id then
      raise exception 'answer ownership required';
    end if;
    if new.moderation_status is distinct from old.moderation_status then
      raise exception 'authors may not change moderation state';
    end if;
    if private.r1_contains_restricted_contact(new.body) then
      raise exception 'restricted contact or credential pattern';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists r1_guard_answer_update on public.answers;
create trigger r1_guard_answer_update
before update on public.answers
for each row execute function private.r1_guard_answer_update();

create or replace function private.r1_guard_comment_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.author_id is distinct from old.author_id
    or new.question_id is distinct from old.question_id
    or new.answer_id is distinct from old.answer_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'immutable comment fields changed';
  end if;

  if private.r1_is_moderator() then
    if new.body is distinct from old.body then
      raise exception 'moderators may not rewrite user content';
    end if;
  else
    if auth.uid() is distinct from old.author_id then
      raise exception 'comment ownership required';
    end if;
    if new.moderation_status is distinct from old.moderation_status then
      raise exception 'authors may not change moderation state';
    end if;
    if private.r1_contains_restricted_contact(new.body) then
      raise exception 'restricted contact or credential pattern';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists r1_guard_comment_update on public.comments;
create trigger r1_guard_comment_update
before update on public.comments
for each row execute function private.r1_guard_comment_update();

create or replace function private.r1_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text := 'u_' || substr(replace(new.id::text, '-', ''), 1, 12);
  v_age_confirmed boolean :=
    lower(coalesce(new.raw_user_meta_data->>'age_confirmed_14_plus', '')) in ('true','1','yes');
begin
  insert into public.profiles(id, handle, age_confirmed_14_plus)
  values (new.id, v_handle, v_age_confirmed)
  on conflict (id) do nothing;

  insert into private.user_status(user_id, status)
  values (new.id, 'active')
  on conflict (user_id) do nothing;

  insert into private.user_roles(user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists r1_on_auth_user_created on auth.users;
create trigger r1_on_auth_user_created
after insert on auth.users
for each row execute function private.r1_handle_new_user();

create or replace function private.r1_notify_question_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications(
    user_id, kind, actor_id, game_universe_id, question_id
  )
  select
    follow.user_id,
    'followed_game_question',
    new.author_id,
    new.game_universe_id,
    new.id
  from public.game_follows as follow
  join private.user_status as status
    on status.user_id = follow.user_id
  where follow.universe_id = new.game_universe_id
    and follow.user_id <> new.author_id
    and status.status = 'active';

  return new;
end;
$$;

drop trigger if exists r1_notify_question_insert on public.questions;
create trigger r1_notify_question_insert
after insert on public.questions
for each row execute function private.r1_notify_question_insert();

create or replace function private.r1_notify_answer_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications(
    user_id, kind, actor_id, game_universe_id, question_id, answer_id
  )
  select
    question.author_id,
    'question_answer',
    new.author_id,
    question.game_universe_id,
    question.id,
    new.id
  from public.questions as question
  where question.id = new.question_id
    and question.author_id <> new.author_id;

  return new;
end;
$$;

drop trigger if exists r1_notify_answer_insert on public.answers;
create trigger r1_notify_answer_insert
after insert on public.answers
for each row execute function private.r1_notify_answer_insert();

create or replace function private.r1_notify_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.question_id is not null then
    insert into public.notifications(
      user_id, kind, actor_id, game_universe_id, question_id, comment_id
    )
    select
      question.author_id,
      'question_comment',
      new.author_id,
      question.game_universe_id,
      question.id,
      new.id
    from public.questions as question
    where question.id = new.question_id
      and question.author_id <> new.author_id;
  else
    insert into public.notifications(
      user_id, kind, actor_id, game_universe_id, question_id, answer_id, comment_id
    )
    select
      answer.author_id,
      'answer_comment',
      new.author_id,
      question.game_universe_id,
      question.id,
      answer.id,
      new.id
    from public.answers as answer
    join public.questions as question
      on question.id = answer.question_id
    where answer.id = new.answer_id
      and answer.author_id <> new.author_id;
  end if;

  return new;
end;
$$;

drop trigger if exists r1_notify_comment_insert on public.comments;
create trigger r1_notify_comment_insert
after insert on public.comments
for each row execute function private.r1_notify_comment_insert();

create or replace function private.r1_notify_answer_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.accepted_answer_id is distinct from old.accepted_answer_id
    and new.accepted_answer_id is not null
  then
    insert into public.notifications(
      user_id, kind, actor_id, game_universe_id, question_id, answer_id
    )
    select
      answer.author_id,
      'answer_accepted',
      new.author_id,
      new.game_universe_id,
      new.id,
      answer.id
    from public.answers as answer
    where answer.id = new.accepted_answer_id
      and answer.author_id <> new.author_id;
  end if;
  return new;
end;
$$;

drop trigger if exists r1_notify_answer_accepted on public.questions;
create trigger r1_notify_answer_accepted
after update of accepted_answer_id on public.questions
for each row execute function private.r1_notify_answer_accepted();

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.comments enable row level security;
alter table public.game_follows enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;

drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "questions public visible" on public.questions;
create policy "questions public visible"
on public.questions for select
to anon, authenticated
using (moderation_status = 'visible');

drop policy if exists "questions author read own" on public.questions;
create policy "questions author read own"
on public.questions for select
to authenticated
using ((select auth.uid()) = author_id);

drop policy if exists "questions moderator read all" on public.questions;
create policy "questions moderator read all"
on public.questions for select
to authenticated
using ((select private.r1_is_moderator()));

drop policy if exists "questions author insert" on public.questions;
create policy "questions author insert"
on public.questions for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and (select private.r1_is_active_user())
);

drop policy if exists "questions author update" on public.questions;
create policy "questions author update"
on public.questions for update
to authenticated
using (
  (select auth.uid()) = author_id
  or (select private.r1_is_moderator())
)
with check (
  (select auth.uid()) = author_id
  or (select private.r1_is_moderator())
);

drop policy if exists "answers public visible" on public.answers;
create policy "answers public visible"
on public.answers for select
to anon, authenticated
using (moderation_status = 'visible');

drop policy if exists "answers author read own" on public.answers;
create policy "answers author read own"
on public.answers for select
to authenticated
using ((select auth.uid()) = author_id);

drop policy if exists "answers moderator read all" on public.answers;
create policy "answers moderator read all"
on public.answers for select
to authenticated
using ((select private.r1_is_moderator()));

drop policy if exists "answers author insert" on public.answers;
create policy "answers author insert"
on public.answers for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and (select private.r1_is_active_user())
);

drop policy if exists "answers author update" on public.answers;
create policy "answers author update"
on public.answers for update
to authenticated
using (
  (select auth.uid()) = author_id
  or (select private.r1_is_moderator())
)
with check (
  (select auth.uid()) = author_id
  or (select private.r1_is_moderator())
);

drop policy if exists "comments public visible" on public.comments;
create policy "comments public visible"
on public.comments for select
to anon, authenticated
using (moderation_status = 'visible');

drop policy if exists "comments author read own" on public.comments;
create policy "comments author read own"
on public.comments for select
to authenticated
using ((select auth.uid()) = author_id);

drop policy if exists "comments moderator read all" on public.comments;
create policy "comments moderator read all"
on public.comments for select
to authenticated
using ((select private.r1_is_moderator()));

drop policy if exists "comments author insert" on public.comments;
create policy "comments author insert"
on public.comments for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and (select private.r1_is_active_user())
);

drop policy if exists "comments author update" on public.comments;
create policy "comments author update"
on public.comments for update
to authenticated
using (
  (select auth.uid()) = author_id
  or (select private.r1_is_moderator())
)
with check (
  (select auth.uid()) = author_id
  or (select private.r1_is_moderator())
);

drop policy if exists "follows own read" on public.game_follows;
create policy "follows own read"
on public.game_follows for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "follows own insert" on public.game_follows;
create policy "follows own insert"
on public.game_follows for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (select private.r1_is_active_user())
);

drop policy if exists "follows own delete" on public.game_follows;
create policy "follows own delete"
on public.game_follows for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read"
on public.notifications for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update"
on public.notifications for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "reports own insert" on public.reports;
create policy "reports own insert"
on public.reports for insert
to authenticated
with check (
  (select auth.uid()) = reporter_id
  and (select private.r1_is_active_user())
);

drop policy if exists "reports own or moderator read" on public.reports;
create policy "reports own or moderator read"
on public.reports for select
to authenticated
using (
  (select auth.uid()) = reporter_id
  or (select private.r1_is_moderator())
);

drop policy if exists "reports moderator update" on public.reports;
create policy "reports moderator update"
on public.reports for update
to authenticated
using ((select private.r1_is_moderator()))
with check ((select private.r1_is_moderator()));

drop policy if exists "moderation actions moderator read" on public.moderation_actions;
create policy "moderation actions moderator read"
on public.moderation_actions for select
to authenticated
using ((select private.r1_is_moderator()));

drop policy if exists "moderation actions moderator insert" on public.moderation_actions;
create policy "moderation actions moderator insert"
on public.moderation_actions for insert
to authenticated
with check (
  (select private.r1_is_moderator())
  and (select auth.uid()) = moderator_id
);

revoke all on public.profiles from anon, authenticated;
revoke all on public.questions from anon, authenticated;
revoke all on public.answers from anon, authenticated;
revoke all on public.comments from anon, authenticated;
revoke all on public.game_follows from anon, authenticated;
revoke all on public.notifications from anon, authenticated;
revoke all on public.reports from anon, authenticated;
revoke all on public.moderation_actions from anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant select on public.questions to anon, authenticated;
grant insert, update on public.questions to authenticated;
grant select on public.answers to anon, authenticated;
grant insert, update on public.answers to authenticated;
grant select on public.comments to anon, authenticated;
grant insert, update on public.comments to authenticated;
grant select, insert, delete on public.game_follows to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, insert on public.moderation_actions to authenticated;

create or replace view public.r1_question_feed
with (security_invoker = true)
as
select
  question.id,
  question.game_universe_id,
  game.canonical_slug as game_slug,
  game.name_ko as game_name_ko,
  question.author_id,
  profile.handle as author_handle,
  coalesce(profile.display_name, profile.handle) as author_name,
  question.title,
  question.body,
  question.status,
  question.accepted_answer_id,
  question.created_at,
  question.updated_at,
  (
    select count(*)::integer
    from public.answers as answer
    where answer.question_id = question.id
      and answer.moderation_status = 'visible'
  ) as answer_count,
  (
    select count(*)::integer
    from public.comments as comment_row
    where comment_row.question_id = question.id
      and comment_row.moderation_status = 'visible'
  ) as comment_count
from public.questions as question
join public.games as game
  on game.universe_id = question.game_universe_id
join public.profiles as profile
  on profile.id = question.author_id
where question.moderation_status = 'visible';

create or replace view public.r1_answer_feed
with (security_invoker = true)
as
select
  answer.id,
  answer.question_id,
  answer.author_id,
  profile.handle as author_handle,
  coalesce(profile.display_name, profile.handle) as author_name,
  answer.body,
  answer.created_at,
  answer.updated_at,
  (question.accepted_answer_id = answer.id) as is_accepted,
  (
    select count(*)::integer
    from public.comments as comment_row
    where comment_row.answer_id = answer.id
      and comment_row.moderation_status = 'visible'
  ) as comment_count
from public.answers as answer
join public.questions as question
  on question.id = answer.question_id
join public.profiles as profile
  on profile.id = answer.author_id
where answer.moderation_status = 'visible'
  and question.moderation_status = 'visible';

create or replace view public.r1_comment_feed
with (security_invoker = true)
as
select
  comment_row.id,
  comment_row.question_id,
  comment_row.answer_id,
  comment_row.author_id,
  profile.handle as author_handle,
  coalesce(profile.display_name, profile.handle) as author_name,
  comment_row.body,
  comment_row.created_at,
  comment_row.updated_at
from public.comments as comment_row
join public.profiles as profile
  on profile.id = comment_row.author_id
where comment_row.moderation_status = 'visible';

revoke all on public.r1_question_feed from public, anon, authenticated;
revoke all on public.r1_answer_feed from public, anon, authenticated;
revoke all on public.r1_comment_feed from public, anon, authenticated;
grant select on public.r1_question_feed to anon, authenticated;
grant select on public.r1_answer_feed to anon, authenticated;
grant select on public.r1_comment_feed to anon, authenticated;

-- Keep all server/admin privileges explicit after the project-wide default grant lockdown.
grant all on public.profiles to service_role;
grant all on public.questions to service_role;
grant all on public.answers to service_role;
grant all on public.comments to service_role;
grant all on public.game_follows to service_role;
grant all on public.notifications to service_role;
grant all on public.reports to service_role;
grant all on public.moderation_actions to service_role;
grant all on private.user_status to service_role;
grant all on private.user_roles to service_role;
grant all on private.ugc_rate_limits to service_role;
grant usage, select on all sequences in schema private to service_role;
