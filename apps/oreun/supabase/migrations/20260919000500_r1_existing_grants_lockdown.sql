-- Defense-in-depth: align existing exposed objects with their intended RLS surface.
-- Public clients only need read access to catalog/current-state/rollup/trend tables.

revoke all privileges on all tables in schema public from anon, authenticated;

grant select on table
  public.games,
  public.game_aliases,
  public.game_provider_state,
  public.game_rollups_hourly,
  public.game_rollups_daily,
  public.trend_scores
to anon, authenticated;

revoke all privileges on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
