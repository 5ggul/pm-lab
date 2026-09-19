alter table public.game_enrichment
  add column if not exists media_failure_count integer not null default 0,
  add column if not exists media_next_retry_at timestamptz,
  add column if not exists media_last_error text;

update public.game_enrichment
set media_fetched_at = null,
    details_fetched_at = null,
    media_failure_count = 0,
    media_next_retry_at = null,
    media_last_error = null
where universe_id = 1686885941
  and creator_name is null
  and max_players is null
  and coalesce(jsonb_array_length(media_images),0)=0
  and coalesce(jsonb_array_length(media_videos),0)=0;