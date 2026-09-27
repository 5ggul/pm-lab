drop policy if exists "service role manages provider fallbacks"
  on public.game_provider_fallbacks;

create policy "service role manages provider fallbacks"
  on public.game_provider_fallbacks
  for all
  to service_role
  using (true)
  with check (true);