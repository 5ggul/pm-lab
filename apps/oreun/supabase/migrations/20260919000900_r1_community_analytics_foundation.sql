-- R1 / Oreun Sprint 05: feature-flagged Roblox Open Cloud community analytics.
-- Aggregate-only. No forum post/comment bodies or user identities are stored.

create table if not exists public.roblox_community_targets (
  universe_id bigint primary key references public.games(universe_id) on delete cascade,
  group_id bigint not null check (group_id > 0),
  authorization_state text not null default 'unverified'
    check (authorization_state in ('unverified','authorized','revoked')),
  enabled boolean not null default false,
  last_verified_at timestamptz,
  last_collected_at timestamptz,
  last_error text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roblox_community_targets_notes_length
    check (char_length(notes) <= 1000)
);

create table if not exists public.roblox_community_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running','success','partial','failed','disabled')),
  target_count integer not null default 0 check (target_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  failure_count integer not null default 0 check (failure_count >= 0),
  error_summary jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint roblox_community_runs_accounting
    check (
      status='running'
      or target_count=success_count+failure_count
      or status='disabled'
    )
);

create table if not exists public.roblox_community_snapshots (
  id bigint generated always as identity primary key,
  run_id uuid references public.roblox_community_runs(id) on delete set null,
  universe_id bigint not null references public.games(universe_id) on delete cascade,
  group_id bigint not null,
  captured_at timestamptz not null,
  forum_category_count integer not null check (forum_category_count >= 0),
  observed_post_count integer not null check (observed_post_count >= 0),
  observed_comment_count integer not null check (observed_comment_count >= 0),
  categories_scanned integer not null check (categories_scanned >= 0),
  posts_scanned integer not null check (posts_scanned >= 0),
  truncated boolean not null default false,
  source_class text not null default 'OFFICIAL_OPEN_CLOUD'
    check (source_class='OFFICIAL_OPEN_CLOUD'),
  source_scope text not null default 'group-forum:read',
  calculation_version text not null default 'community_aggregate_v1',
  created_at timestamptz not null default now(),
  unique (universe_id,captured_at)
);

create index if not exists roblox_community_snapshots_game_time_idx
  on public.roblox_community_snapshots(universe_id,captured_at desc);
create index if not exists roblox_community_snapshots_run_idx
  on public.roblox_community_snapshots(run_id);
create index if not exists roblox_community_targets_group_idx
  on public.roblox_community_targets(group_id);

alter table public.roblox_community_targets enable row level security;
alter table public.roblox_community_runs enable row level security;
alter table public.roblox_community_snapshots enable row level security;

drop policy if exists "deny public community targets" on public.roblox_community_targets;
create policy "deny public community targets"
on public.roblox_community_targets for all
to anon,authenticated
using(false) with check(false);

drop policy if exists "deny public community runs" on public.roblox_community_runs;
create policy "deny public community runs"
on public.roblox_community_runs for all
to anon,authenticated
using(false) with check(false);

drop policy if exists "deny public community snapshots" on public.roblox_community_snapshots;
create policy "deny public community snapshots"
on public.roblox_community_snapshots for all
to anon,authenticated
using(false) with check(false);

revoke all on public.roblox_community_targets from anon,authenticated;
revoke all on public.roblox_community_runs from anon,authenticated;
revoke all on public.roblox_community_snapshots from anon,authenticated;

grant all on public.roblox_community_targets to service_role;
grant all on public.roblox_community_runs to service_role;
grant all on public.roblox_community_snapshots to service_role;
grant usage,select on sequence public.roblox_community_snapshots_id_seq to service_role;

create or replace view public.r1_community_analytics_readiness
with (security_invoker=true)
as
select
  game.universe_id,
  game.canonical_slug,
  game.name_ko,
  target.group_id,
  target.authorization_state,
  target.enabled,
  target.last_verified_at,
  target.last_collected_at,
  target.last_error,
  (
    target.enabled
    and target.authorization_state='authorized'
    and target.last_verified_at is not null
  ) as ready_for_server_collection,
  (
    select max(snapshot.captured_at)
    from public.roblox_community_snapshots snapshot
    where snapshot.universe_id=game.universe_id
  ) as latest_snapshot_at
from public.games game
left join public.roblox_community_targets target
  on target.universe_id=game.universe_id;

revoke all on public.r1_community_analytics_readiness
  from public,anon,authenticated;
grant select on public.r1_community_analytics_readiness to service_role;
