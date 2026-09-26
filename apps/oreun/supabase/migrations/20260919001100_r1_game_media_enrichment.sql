create table if not exists public.game_enrichment (
  universe_id bigint primary key references public.games(universe_id) on delete cascade,
  creator_id bigint,
  creator_name text,
  creator_type text,
  creator_verified boolean not null default false,
  max_players integer,
  genre text,
  genre_l1 text,
  genre_l2 text,
  experience_created_at timestamptz,
  experience_updated_at timestamptz,
  canonical_url_path text,
  is_content_restricted boolean not null default false,
  hero_image_url text,
  media_images jsonb not null default '[]'::jsonb,
  media_videos jsonb not null default '[]'::jsonb,
  details_fetched_at timestamptz,
  media_fetched_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint game_enrichment_creator_type_chk
    check (creator_type is null or creator_type in ('User','Group')),
  constraint game_enrichment_media_images_array_chk
    check (jsonb_typeof(media_images) = 'array'),
  constraint game_enrichment_media_videos_array_chk
    check (jsonb_typeof(media_videos) = 'array')
);

alter table public.game_enrichment enable row level security;

revoke all on public.game_enrichment from public, anon, authenticated;
grant select on public.game_enrichment to anon, authenticated, service_role;
grant insert, update on public.game_enrichment to service_role;

drop policy if exists "public read game enrichment" on public.game_enrichment;
create policy "public read game enrichment"
  on public.game_enrichment
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.games g
      where g.universe_id = game_enrichment.universe_id
        and g.index_state <> 'retired'
    )
  );

create index if not exists game_enrichment_genre_l1_idx
  on public.game_enrichment (genre_l1)
  where genre_l1 is not null;
