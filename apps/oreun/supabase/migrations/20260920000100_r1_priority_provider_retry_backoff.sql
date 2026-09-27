-- Preserve frequent retry opportunities for recently successful, high-interest games.
-- This only changes scheduling/backoff. It never fabricates provider observations or history.
create or replace function public.r1_mark_targets_failed(
  p_universe_ids bigint[],
  p_lease_token uuid,
  p_error text,
  p_retry_after_seconds integer default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  with target_context as (
    select
      target.universe_id,
      coalesce(state.playing, 0) as last_known_playing,
      state.fetched_at as last_provider_success_at
    from public.collector_targets as target
    left join public.game_provider_state as state
      on state.universe_id = target.universe_id
    where target.universe_id = any(p_universe_ids)
      and target.lease_token = p_lease_token
  )
  update public.collector_targets as target
  set
    failure_count = target.failure_count + 1,
    tier = case
      when context.last_provider_success_at >= now() - interval '24 hours'
        and context.last_known_playing >= 100000 then 'hot'
      when context.last_provider_success_at >= now() - interval '24 hours'
        and context.last_known_playing >= 2000 then 'active'
      when target.failure_count + 1 >= 3 then 'longtail'
      else target.tier
    end,
    cadence_minutes = case
      when context.last_provider_success_at >= now() - interval '24 hours'
        and context.last_known_playing >= 100000 then 5
      when context.last_provider_success_at >= now() - interval '24 hours'
        and context.last_known_playing >= 2000 then 15
      when target.failure_count + 1 >= 3 then greatest(target.cadence_minutes, 120)
      else target.cadence_minutes
    end,
    next_due_at = now() + make_interval(
      secs => greatest(
        coalesce(nullif(greatest(0, p_retry_after_seconds), 0), 0),
        case
          when context.last_provider_success_at >= now() - interval '24 hours'
            and context.last_known_playing >= 100000
            then least(
              900,
              greatest(
                300,
                (60 * power(2, least(target.failure_count, 4)))::integer
              )
            )
          when context.last_provider_success_at >= now() - interval '24 hours'
            and context.last_known_playing >= 2000
            then least(
              1800,
              greatest(
                900,
                (60 * power(2, least(target.failure_count, 5)))::integer
              )
            )
          when target.failure_count + 1 >= 3 then 7200
          else least(
            3600,
            greatest(
              60,
              (60 * power(2, least(target.failure_count, 5)))::integer
            )
          )
        end
      )
    ),
    last_failure_at = now(),
    last_error = left(p_error, 500),
    lease_token = null,
    leased_until = null,
    updated_at = now()
  from target_context as context
  where target.universe_id = context.universe_id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;
