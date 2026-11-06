-- R1 / Oreun Sprint 01 reference migration. Do not apply to unrelated Supabase projects.
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.games (
  universe_id bigint primary key,
  root_place_id bigint not null unique,
  canonical_slug text not null unique,
  name_ko text not null,
  description_ko text not null default '',
  index_state text not null default 'collecting' check (index_state in ('collecting','candidate','indexable','noindex','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.game_aliases (
  id bigint generated always as identity primary key,
  universe_id bigint not null references public.games(universe_id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  lang text not null default 'ko',
  alias_type text not null check (alias_type in ('korean','english','transliteration','typo','former_name')),
  created_at timestamptz not null default now(),
  unique(universe_id, normalized_alias)
);
create index if not exists game_aliases_trgm_idx on public.game_aliases using gin (normalized_alias gin_trgm_ops);
create index if not exists game_aliases_prefix_idx on public.game_aliases(normalized_alias text_pattern_ops);

create table if not exists public.game_slug_history (
  id bigint generated always as identity primary key,
  universe_id bigint not null references public.games(universe_id) on delete cascade,
  slug text not null,
  is_canonical boolean not null default false,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  unique(universe_id, slug)
);

create table if not exists public.data_sources (
  id bigint generated always as identity primary key,
  provider text not null,
  source_class text not null check (source_class in ('OFFICIAL_OPEN_CLOUD','ROBLOX_PUBLIC_API','R1_DERIVED','R1_EDITORIAL','COMMUNITY_UGC')),
  endpoint text not null,
  endpoint_version text,
  stability text not null,
  auth_mode text not null,
  enabled boolean not null default true,
  purge_group text not null,
  created_at timestamptz not null default now(),
  unique(provider,endpoint)
);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  data_source_id bigint not null references public.data_sources(id),
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('running','success','partial','failed','rate_limited')),
  requested_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  rate_limit_count integer not null default 0,
  retry_after_seconds integer,
  latency_p50_ms integer,
  latency_p95_ms integer,
  error_summary jsonb not null default '[]'::jsonb
);

create table if not exists public.game_provider_state (
  universe_id bigint primary key references public.games(universe_id) on delete cascade,
  data_source_id bigint not null references public.data_sources(id),
  ingestion_run_id uuid references public.ingestion_runs(id) on delete set null,
  name text not null,
  description text not null default '',
  creator_name text,
  playing bigint,
  visits bigint,
  favorites bigint,
  source_updated_at timestamptz,
  fetched_at timestamptz not null,
  freshness_state text not null check (freshness_state in ('fresh','delayed','stale','unavailable','insufficient_data'))
);

create table if not exists public.game_snapshots (
  universe_id bigint not null references public.games(universe_id) on delete cascade,
  captured_at timestamptz not null,
  playing bigint,
  visits bigint,
  favorites bigint,
  data_source_id bigint not null references public.data_sources(id),
  ingestion_run_id uuid references public.ingestion_runs(id) on delete set null,
  fetched_at timestamptz not null,
  raw_or_derived text not null default 'raw' check (raw_or_derived in ('raw','derived')),
  primary key (universe_id,captured_at)
);
create index if not exists game_snapshots_time_idx on public.game_snapshots(captured_at desc);

create table if not exists public.game_rollups_hourly (
  universe_id bigint not null references public.games(universe_id) on delete cascade,
  bucket_at timestamptz not null,
  playing_min bigint,
  playing_max bigint,
  playing_avg numeric,
  playing_last bigint,
  visits_last bigint,
  favorites_last bigint,
  sample_count integer not null,
  expected_samples integer not null,
  coverage_ratio numeric not null check (coverage_ratio between 0 and 1),
  calculated_at timestamptz not null default now(),
  primary key(universe_id,bucket_at)
);
create table if not exists public.game_rollups_daily (like public.game_rollups_hourly including all);

create table if not exists public.trend_scores (
  universe_id bigint not null references public.games(universe_id) on delete cascade,
  calculated_at timestamptz not null,
  total_score numeric,
  absolute_component numeric not null,
  relative_component numeric not null,
  baseline_component numeric not null,
  coverage_component numeric not null,
  update_component numeric not null,
  interest_component numeric,
  confidence text not null check (confidence in ('high','medium','low','insufficient')),
  calculation_version text not null,
  component_payload jsonb not null default '{}'::jsonb,
  primary key(universe_id,calculated_at,calculation_version)
);

create table if not exists public.data_quality_flags (
  id bigint generated always as identity primary key,
  universe_id bigint references public.games(universe_id) on delete cascade,
  ingestion_run_id uuid references public.ingestion_runs(id) on delete set null,
  flag_type text not null,
  severity text not null check (severity in ('info','warning','error')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Exposed-schema defense in depth. No public writes exist in Sprint 01.
alter table public.games enable row level security;
alter table public.game_aliases enable row level security;
alter table public.game_slug_history enable row level security;
alter table public.data_sources enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.game_provider_state enable row level security;
alter table public.game_snapshots enable row level security;
alter table public.game_rollups_hourly enable row level security;
alter table public.game_rollups_daily enable row level security;
alter table public.trend_scores enable row level security;
alter table public.data_quality_flags enable row level security;

create policy "public read games" on public.games for select to anon, authenticated using (index_state <> 'retired');
create policy "public read aliases" on public.game_aliases for select to anon, authenticated using (true);
create policy "public read current game state" on public.game_provider_state for select to anon, authenticated using (true);
create policy "public read hourly rollups" on public.game_rollups_hourly for select to anon, authenticated using (true);
create policy "public read daily rollups" on public.game_rollups_daily for select to anon, authenticated using (true);
create policy "public read trend scores" on public.trend_scores for select to anon, authenticated using (true);
-- ingestion_runs, raw snapshots, data_sources and quality flags intentionally have no anon/authenticated policy.
