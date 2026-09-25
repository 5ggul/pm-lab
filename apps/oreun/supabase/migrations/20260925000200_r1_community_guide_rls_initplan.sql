-- Optimize R2 community guide RLS so auth helpers are evaluated once per statement.
drop policy if exists "community guides authenticated readable" on public.community_guides;
create policy "community guides authenticated readable"
on public.community_guides for select to authenticated
using (
  moderation_status='visible'
  or (select auth.uid())=author_id
  or (select private.r1_is_moderator())
);

drop policy if exists "community guides author insert" on public.community_guides;
create policy "community guides author insert"
on public.community_guides for insert to authenticated
with check (
  (select auth.uid())=author_id
  and (select private.r1_is_active_user())
);

drop policy if exists "community guides author update" on public.community_guides;
create policy "community guides author update"
on public.community_guides for update to authenticated
using (
  (select auth.uid())=author_id
  or (select private.r1_is_moderator())
)
with check (
  (select auth.uid())=author_id
  or (select private.r1_is_moderator())
);
