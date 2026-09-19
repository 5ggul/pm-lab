create table if not exists public.game_provider_fallbacks (
  universe_id bigint primary key references public.games(universe_id) on delete cascade,
  provider text not null,
  group_id bigint,
  group_name text,
  verified_at timestamptz not null default now(),
  source_url text,
  note text,
  constraint game_provider_fallbacks_provider_chk
    check (provider in ('roblox_group_games'))
);

alter table public.game_provider_fallbacks enable row level security;
revoke all on public.game_provider_fallbacks from public, anon, authenticated;
grant select, insert, update, delete on public.game_provider_fallbacks to service_role;

alter table public.game_enrichment
  add column if not exists fallback_name text,
  add column if not exists fallback_description text,
  add column if not exists fallback_visits bigint,
  add column if not exists fallback_favorites bigint,
  add column if not exists fallback_source_updated_at timestamptz,
  add column if not exists fallback_fetched_at timestamptz,
  add column if not exists fallback_source_provider text;

insert into public.game_provider_fallbacks (
  universe_id,
  provider,
  group_id,
  group_name,
  verified_at,
  source_url,
  note
)
values (
  1686885941,
  'roblox_group_games',
  3104358,
  'Brookhaven by Voldex',
  now(),
  'https://games.roblox.com/v2/groups/3104358/gamesV2',
  'Public Games /v1/games returns an id=0 restricted placeholder from the Preview collector egress. Use official group games metadata only as a static/detail fallback. Current playing remains unavailable unless the primary provider succeeds.'
)
on conflict (universe_id) do update
set provider=excluded.provider,
    group_id=excluded.group_id,
    group_name=excluded.group_name,
    verified_at=excluded.verified_at,
    source_url=excluded.source_url,
    note=excluded.note;
