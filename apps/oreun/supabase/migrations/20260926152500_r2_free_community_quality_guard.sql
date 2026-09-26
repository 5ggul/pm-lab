-- Keep obviously incomplete free-talk posts out of the public community.
-- Applied to Supabase as migration r2_free_community_quality_guard.
alter table public.community_posts
  drop constraint if exists community_posts_body_length_check;

alter table public.community_posts
  add constraint community_posts_body_length_check
  check (char_length(btrim(body)) between 10 and 5000);
