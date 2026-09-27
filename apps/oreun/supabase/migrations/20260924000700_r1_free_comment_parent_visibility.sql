-- Do not expose comments whose parent free-talk post is hidden.
drop policy if exists "community post comments anon visible" on public.community_post_comments;
create policy "community post comments anon visible" on public.community_post_comments
for select to anon using (
  moderation_status='visible'
  and exists (
    select 1 from public.community_posts p
    where p.id=post_id and p.moderation_status='visible'
  )
);

drop policy if exists "community post comments authenticated readable" on public.community_post_comments;
create policy "community post comments authenticated readable" on public.community_post_comments
for select to authenticated using (
  (
    moderation_status='visible'
    and exists (
      select 1 from public.community_posts p
      where p.id=post_id and p.moderation_status='visible'
    )
  )
  or auth.uid()=author_id
  or private.r1_is_moderator()
);

create or replace view public.r1_community_post_comment_feed
with (security_invoker=true)
as
select c.id,c.post_id,c.author_id,profile.handle as author_handle,
  coalesce(profile.display_name,profile.handle,'탈퇴한 이용자'::text) as author_name,
  c.body,c.created_at,c.updated_at
from public.community_post_comments c
join public.community_posts p on p.id=c.post_id and p.moderation_status='visible'
left join public.profiles profile on profile.id=c.author_id
where c.moderation_status='visible';
