-- Grants required in addition to RLS for the free-talk tables.
grant select on public.community_posts to anon,authenticated;
grant insert,update on public.community_posts to authenticated;
grant select on public.community_post_comments to anon,authenticated;
grant insert,update on public.community_post_comments to authenticated;
grant select on public.r1_community_post_feed to anon,authenticated;
grant select on public.r1_community_post_comment_feed to anon,authenticated;
