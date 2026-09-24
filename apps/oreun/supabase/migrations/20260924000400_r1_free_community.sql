-- Real free-talk community: optional game-scoped posts, comments, moderation and caller-RLS idempotency.
-- Applied to Supabase as migration r1_free_community on 2026-09-24.
-- See live schema for the full definitions; this file intentionally mirrors the public contract.
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  game_universe_id bigint references public.games(universe_id) on delete restrict,
  author_id uuid references public.profiles(id) on delete restrict default auth.uid(),
  title text not null check(char_length(btrim(title)) between 2 and 120),
  body text not null check(char_length(btrim(body)) between 2 and 5000),
  moderation_status text not null default 'visible' check(moderation_status in('visible','pending','removed')),
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete restrict default auth.uid(),
  body text not null check(char_length(btrim(body)) between 2 and 1500),
  moderation_status text not null default 'visible' check(moderation_status in('visible','pending','removed')),
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Live migration additionally creates RLS policies, guards, feed views,
-- r1_submit_community_post / r1_submit_community_post_comment RPCs,
-- report/moderation target support and account-erasure redaction.
