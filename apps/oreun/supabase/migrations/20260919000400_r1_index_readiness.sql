-- R1 launch-readiness view. Internal review only; it does not change index_state.
create or replace view public.r1_game_index_readiness
with (security_invoker = true)
as
select
  game.universe_id,
  game.canonical_slug,
  game.index_state,
  state.fetched_at,
  count(hourly.bucket_at) filter (
    where hourly.bucket_at >= date_trunc('hour', now() - interval '24 hours')
  )::integer as hourly_buckets_24h,
  coalesce(
    avg(hourly.coverage_ratio) filter (
      where hourly.bucket_at >= date_trunc('hour', now() - interval '24 hours')
    ),
    0
  )::numeric as avg_coverage_24h,
  (
    state.fetched_at is not null
    and state.fetched_at >= now() - interval '20 minutes'
  ) as current_data_recent,
  (
    char_length(trim(game.description_ko)) >= 20
  ) as has_editorial_description,
  (
    game.index_state in ('candidate','indexable')
    and state.fetched_at is not null
    and state.fetched_at >= now() - interval '20 minutes'
    and char_length(trim(game.description_ko)) >= 20
    and count(hourly.bucket_at) filter (
      where hourly.bucket_at >= date_trunc('hour', now() - interval '24 hours')
    ) >= 24
    and coalesce(
      avg(hourly.coverage_ratio) filter (
        where hourly.bucket_at >= date_trunc('hour', now() - interval '24 hours')
      ),
      0
    ) >= 0.70
  ) as data_ready_for_index_review
from public.games as game
left join public.game_provider_state as state
  on state.universe_id = game.universe_id
left join public.game_rollups_hourly as hourly
  on hourly.universe_id = game.universe_id
group by
  game.universe_id,
  game.canonical_slug,
  game.index_state,
  game.description_ko,
  state.fetched_at;

revoke all on public.r1_game_index_readiness from public, anon, authenticated;
grant select on public.r1_game_index_readiness to service_role;
