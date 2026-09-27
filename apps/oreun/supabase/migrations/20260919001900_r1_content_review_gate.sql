alter table public.game_guides
  add column if not exists review_status text not null default 'draft',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists review_note text not null default '';

alter table public.game_codes
  add column if not exists review_status text not null default 'draft',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists review_note text not null default '';

alter table public.game_guides
  drop constraint if exists game_guides_review_status_check;
alter table public.game_guides
  add constraint game_guides_review_status_check
  check (review_status in ('draft','pending','approved','rejected'));

alter table public.game_codes
  drop constraint if exists game_codes_review_status_check;
alter table public.game_codes
  add constraint game_codes_review_status_check
  check (review_status in ('draft','pending','approved','rejected'));

alter table public.game_guides
  drop constraint if exists game_guides_review_note_length;
alter table public.game_guides
  add constraint game_guides_review_note_length
  check (char_length(review_note) <= 1000);

alter table public.game_codes
  drop constraint if exists game_codes_review_note_length;
alter table public.game_codes
  add constraint game_codes_review_note_length
  check (char_length(review_note) <= 1000);

update public.game_guides
set review_status = 'approved',
    reviewed_at = coalesce(reviewed_at, published_at, updated_at)
where content_status = 'published'
  and review_status <> 'approved';

update public.game_codes
set review_status = 'approved',
    reviewed_at = coalesce(reviewed_at, verified_at, last_checked_at, updated_at)
where visibility = 'published'
  and review_status <> 'approved';

create index if not exists game_guides_review_idx
  on public.game_guides(review_status, updated_at desc);
create index if not exists game_codes_review_idx
  on public.game_codes(review_status, updated_at desc);

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
  new.review_note := btrim(coalesce(new.review_note, ''));

  if tg_op = 'UPDATE'
    and old.review_status = 'approved'
    and (
      new.slug is distinct from old.slug
      or new.guide_type is distinct from old.guide_type
      or new.title is distinct from old.title
      or new.summary is distinct from old.summary
      or new.body is distinct from old.body
      or new.source_id is distinct from old.source_id
    )
  then
    new.review_status := 'draft';
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.review_note := '';
    if new.content_status = 'published' then
      new.content_status := 'draft';
      new.index_state := 'noindex';
      new.published_at := null;
    end if;
  end if;

  if new.review_status = 'approved' and new.reviewed_at is null then
    raise exception 'approved guides require reviewed_at';
  end if;

  if new.content_status = 'published' then
    if new.source_id is null then
      raise exception 'published guides require a source';
    end if;
    if new.review_status <> 'approved' or new.reviewed_at is null then
      raise exception 'published guides require approved review';
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
  new.review_note := btrim(coalesce(new.review_note, ''));

  if tg_op = 'UPDATE'
    and old.review_status = 'approved'
    and (
      new.code is distinct from old.code
      or new.reward_text is distinct from old.reward_text
      or new.source_id is distinct from old.source_id
      or new.notes is distinct from old.notes
    )
  then
    new.review_status := 'draft';
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.review_note := '';
    if new.visibility = 'published' then
      new.visibility := 'draft';
    end if;
  end if;

  if new.review_status = 'approved' and new.reviewed_at is null then
    raise exception 'approved codes require reviewed_at';
  end if;

  if new.visibility = 'published' then
    if new.source_id is null or new.last_checked_at is null then
      raise exception 'published codes require source and last_checked_at';
    end if;
    if new.review_status <> 'approved' or new.reviewed_at is null then
      raise exception 'published codes require approved review';
    end if;
  end if;

  if new.code_status = 'active' and new.verified_at is null then
    raise exception 'active codes require verified_at';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.r1_guard_guide()
  from public, anon, authenticated;
revoke execute on function private.r1_guard_code()
  from public, anon, authenticated;
