create or replace function public.r1_my_unread_notification_count()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)
  from public.notifications
  where user_id = (select auth.uid())
    and read_at is null;
$$;

revoke all on function public.r1_my_unread_notification_count()
  from public, anon;
grant execute on function public.r1_my_unread_notification_count()
  to authenticated;