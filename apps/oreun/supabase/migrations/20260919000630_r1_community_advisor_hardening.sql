-- Sprint 02 advisor hardening: private RLS, invoker RPC wrappers,
-- consolidated SELECT policies, and FK indexes.

alter table private.user_status enable row level security;
alter table private.user_roles enable row level security;
alter table private.ugc_rate_limits enable row level security;

create or replace function private.r1_current_permissions()
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
          select status.age_confirmed_14_plus
          from private.user_status as status
          where status.user_id = auth.uid()
        ), false),
        'role', coalesce((
          select role_row.role
          from private.user_roles as role_row
          where role_row.user_id = auth.uid()
        ), 'user')
      )
  end;
$$;

create or replace function private.r1_set_age_confirmation_private(p_confirmed boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update private.user_status
  set
    age_confirmed_14_plus = p_confirmed,
    updated_at = now()
  where user_id = auth.uid();

  return found;
end;
$$;

grant execute on function private.r1_current_permissions() to authenticated;
grant execute on function private.r1_set_age_confirmation_private(boolean)
  to authenticated;

create or replace function public.r1_my_community_permissions()
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
  select private.r1_current_permissions();
$$;

create or replace function public.r1_set_age_confirmation(p_confirmed boolean)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.r1_set_age_confirmation_private(p_confirmed);
$$;

revoke all on function public.r1_my_community_permissions()
  from public, anon;
revoke all on function public.r1_set_age_confirmation(boolean)
  from public, anon;
grant execute on function public.r1_my_community_permissions()
  to authenticated;
grant execute on function public.r1_set_age_confirmation(boolean)
  to authenticated;

drop policy if exists "questions public visible" on public.questions;
drop policy if exists "questions author read own" on public.questions;
drop policy if exists "questions moderator read all" on public.questions;
create policy "questions anon visible"
on public.questions for select
to anon
using (moderation_status = 'visible');
create policy "questions authenticated readable"
on public.questions for select
to authenticated
using (
  moderation_status = 'visible'
  or (select auth.uid()) = author_id
  or (select private.r1_is_moderator())
);

drop policy if exists "answers public visible" on public.answers;
drop policy if exists "answers author read own" on public.answers;
drop policy if exists "answers moderator read all" on public.answers;
create policy "answers anon visible"
on public.answers for select
to anon
using (moderation_status = 'visible');
create policy "answers authenticated readable"
on public.answers for select
to authenticated
using (
  moderation_status = 'visible'
  or (select auth.uid()) = author_id
  or (select private.r1_is_moderator())
);

drop policy if exists "comments public visible" on public.comments;
drop policy if exists "comments author read own" on public.comments;
drop policy if exists "comments moderator read all" on public.comments;
create policy "comments anon visible"
on public.comments for select
to anon
using (moderation_status = 'visible');
create policy "comments authenticated readable"
on public.comments for select
to authenticated
using (
  moderation_status = 'visible'
  or (select auth.uid()) = author_id
  or (select private.r1_is_moderator())
);

create index if not exists answers_author_idx
  on public.answers(author_id);
create index if not exists comments_author_idx
  on public.comments(author_id);
create index if not exists moderation_actions_moderator_idx
  on public.moderation_actions(moderator_id);
create index if not exists notifications_actor_idx
  on public.notifications(actor_id);
create index if not exists notifications_game_idx
  on public.notifications(game_universe_id);
create index if not exists notifications_question_idx
  on public.notifications(question_id);
create index if not exists notifications_answer_idx
  on public.notifications(answer_id);
create index if not exists notifications_comment_idx
  on public.notifications(comment_id);
create index if not exists questions_accepted_answer_idx
  on public.questions(accepted_answer_id);
create index if not exists reports_reviewed_by_idx
  on public.reports(reviewed_by);
