-- R1 / Oreun Sprint 03 content foundation.
-- Verified codes, editorial guides, and provider-update observations.

create or replace function private.r1_is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from private.user_roles as role_row
      join private.user_status as status_row
        on status_row.user_id = role_row.user_id
      where role_row.user_id = auth.uid()
        and role_row.role = 'admin'
        and status_row.status = 'active'
    );
$$;

revoke execute on function private.r1_is_admin()
  from public, anon;
grant execute on function private.r1_is_admin()
  to authenticated;

create table if not exists public.content_sources (
  id uuid primary key default gen_random_uuid(),
  universe_id bigint references public.games(universe_id) on delete cascade,
  source_type text not null check (
    source_type in (
      'official_game_page',
      'official_group',
      'official_social',
      'official_docs',
      'in_game_verified',
      'other'
    )
  ),
  label text not null,
  source_url text not null,
  last_checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_sources_label_length
    check (char_length(btrim(label)) between 2 and 120),
  constraint content_sources_https_url
    check (source_url ~ '^https://'),
  unique (universe_id, source_url)
);

create table if not exists public.game_guides (
  id uuid primary key default gen_random_uuid(),
  universe_id bigint not null references public.games(universe_id) on delete cascade,
  slug text not null,
  guide_type text not null default 'guide'
    check (guide_type in ('beginner','mechanic','progression','troubleshooting','faq','guide')),
  title text not null,
  summary text not null,
  body text not null,
  source_id uuid references public.content_sources(id) on delete set null,
  content_status text not null default 'draft'
    check (content_status in ('draft','published','archived')),
  index_state text not null default 'noindex'
    check (index_state in ('noindex','indexable')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_guides_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint game_guides_title_length
    check (char_length(btrim(title)) between 5 and 120),
  constraint game_guides_summary_length
    check (char_length(btrim(summary)) between 20 and 400),
  constraint game_guides_body_length
    check (char_length(btrim(body)) between 100 and 20000),
  unique (universe_id, slug)
);

create table if not exists public.game_codes (
  id uuid primary key default gen_random_uuid(),
  universe_id bigint not null references public.games(universe_id) on delete cascade,
  code text not null,
  reward_text text not null default '',
  code_status text not null default 'unknown'
    check (code_status in ('active','expired','unknown')),
  visibility text not null default 'draft'
    check (visibility in ('draft','published','archived')),
  source_id uuid references public.content_sources(id) on delete set null,
  verified_at timestamptz,
  last_checked_at timestamptz,
  expires_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_codes_code_length
    check (char_length(btrim(code)) between 1 and 120),
  constraint game_codes_reward_length
    check (char_length(reward_text) <= 500),
  constraint game_codes_notes_length
    check (char_length(notes) <= 1000),
  unique (universe_id, code)
);

create table if not exists public.game_update_events (
  id uuid primary key default gen_random_uuid(),
  universe_id bigint not null references public.games(universe_id) on delete cascade,
  source_updated_at timestamptz not null,
  first_observed_at timestamptz not null default now(),
  event_kind text not null
    check (event_kind in ('baseline','provider_update_detected')),
  source_url text not null,
  created_at timestamptz not null default now(),
  constraint game_update_events_https_url
    check (source_url ~ '^https://'),
  unique (universe_id, source_updated_at)
);

create index if not exists content_sources_game_idx
  on public.content_sources(universe_id, last_checked_at desc);
create index if not exists game_guides_game_status_idx
  on public.game_guides(universe_id, content_status, published_at desc);
create index if not exists game_codes_game_status_idx
  on public.game_codes(universe_id, visibility, code_status, last_checked_at desc);
create index if not exists game_update_events_game_time_idx
  on public.game_update_events(universe_id, source_updated_at desc);

alter table public.content_sources enable row level security;
alter table public.game_guides enable row level security;
alter table public.game_codes enable row level security;
alter table public.game_update_events enable row level security;

create policy "content sources anon read"
on public.content_sources for select
to anon
using (true);

create policy "content sources authenticated read"
on public.content_sources for select
to authenticated
using (true);

create policy "content sources admin insert"
on public.content_sources for insert
to authenticated
with check ((select private.r1_is_admin()));

create policy "content sources admin update"
on public.content_sources for update
to authenticated
using ((select private.r1_is_admin()))
with check ((select private.r1_is_admin()));

create policy "guides anon published"
on public.game_guides for select
to anon
using (content_status = 'published');

create policy "guides authenticated readable"
on public.game_guides for select
to authenticated
using (
  content_status = 'published'
  or (select private.r1_is_admin())
);

create policy "guides admin insert"
on public.game_guides for insert
to authenticated
with check ((select private.r1_is_admin()));

create policy "guides admin update"
on public.game_guides for update
to authenticated
using ((select private.r1_is_admin()))
with check ((select private.r1_is_admin()));

create policy "codes anon published"
on public.game_codes for select
to anon
using (visibility = 'published');

create policy "codes authenticated readable"
on public.game_codes for select
to authenticated
using (
  visibility = 'published'
  or (select private.r1_is_admin())
);

create policy "codes admin insert"
on public.game_codes for insert
to authenticated
with check ((select private.r1_is_admin()));

create policy "codes admin update"
on public.game_codes for update
to authenticated
using ((select private.r1_is_admin()))
with check ((select private.r1_is_admin()));

create policy "update events public read"
on public.game_update_events for select
to anon, authenticated
using (true);

revoke all on public.content_sources from anon, authenticated;
revoke all on public.game_guides from anon, authenticated;
revoke all on public.game_codes from anon, authenticated;
revoke all on public.game_update_events from anon, authenticated;

grant select on public.content_sources to anon, authenticated;
grant select on public.game_guides to anon, authenticated;
grant select on public.game_codes to anon, authenticated;
grant select on public.game_update_events to anon, authenticated;
grant insert, update on public.content_sources to authenticated;
grant insert, update on public.game_guides to authenticated;
grant insert, update on public.game_codes to authenticated;

grant all on public.content_sources to service_role;
grant all on public.game_guides to service_role;
grant all on public.game_codes to service_role;
grant all on public.game_update_events to service_role;

create or replace function private.r1_guard_content_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.r1_is_admin() then
    raise exception 'admin role required';
  end if;

  new.label := btrim(new.label);
  new.source_url := btrim(new.source_url);
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.r1_guard_guide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.r1_is_admin() then
    raise exception 'admin role required';
  end if;

  new.slug := lower(btrim(new.slug));
  new.title := btrim(new.title);
  new.summary := btrim(new.summary);
  new.body := btrim(new.body);

  if new.content_status = 'published' then
    if new.source_id is null then
      raise exception 'published guides require a source';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;

  if new.index_state = 'indexable'
    and new.content_status <> 'published'
  then
    raise exception 'only published guides can be indexable';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.r1_guard_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.r1_is_admin() then
    raise exception 'admin role required';
  end if;

  new.code := btrim(new.code);
  new.reward_text := btrim(new.reward_text);
  new.notes := btrim(new.notes);

  if new.visibility = 'published' then
    if new.source_id is null or new.last_checked_at is null then
      raise exception 'published codes require source and last_checked_at';
    end if;
  end if;

  if new.code_status = 'active' and new.verified_at is null then
    raise exception 'active codes require verified_at';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists r1_guard_content_source on public.content_sources;
create trigger r1_guard_content_source
before insert or update on public.content_sources
for each row execute function private.r1_guard_content_source();

drop trigger if exists r1_guard_guide on public.game_guides;
create trigger r1_guard_guide
before insert or update on public.game_guides
for each row execute function private.r1_guard_guide();

drop trigger if exists r1_guard_code on public.game_codes;
create trigger r1_guard_code
before insert or update on public.game_codes
for each row execute function private.r1_guard_code();

create or replace function private.r1_capture_provider_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_root_place_id bigint;
begin
  if new.source_updated_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.source_updated_at is not distinct from old.source_updated_at
  then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.source_updated_at is not null
    and new.source_updated_at <= old.source_updated_at
  then
    return new;
  end if;

  select root_place_id
  into v_root_place_id
  from public.games
  where universe_id = new.universe_id;

  insert into public.game_update_events(
    universe_id,
    source_updated_at,
    first_observed_at,
    event_kind,
    source_url
  )
  values (
    new.universe_id,
    new.source_updated_at,
    new.fetched_at,
    case when tg_op = 'INSERT' then 'baseline' else 'provider_update_detected' end,
    'https://www.roblox.com/games/' || v_root_place_id::text
  )
  on conflict (universe_id, source_updated_at) do nothing;

  return new;
end;
$$;

drop trigger if exists r1_capture_provider_update on public.game_provider_state;
create trigger r1_capture_provider_update
after insert or update of source_updated_at on public.game_provider_state
for each row execute function private.r1_capture_provider_update();

insert into public.game_update_events(
  universe_id,
  source_updated_at,
  first_observed_at,
  event_kind,
  source_url
)
select
  state.universe_id,
  state.source_updated_at,
  state.fetched_at,
  'baseline',
  'https://www.roblox.com/games/' || game.root_place_id::text
from public.game_provider_state as state
join public.games as game
  on game.universe_id = state.universe_id
where state.source_updated_at is not null
on conflict (universe_id, source_updated_at) do nothing;

revoke execute on function private.r1_guard_content_source()
  from public, anon, authenticated;
revoke execute on function private.r1_guard_guide()
  from public, anon, authenticated;
revoke execute on function private.r1_guard_code()
  from public, anon, authenticated;
revoke execute on function private.r1_capture_provider_update()
  from public, anon, authenticated;
