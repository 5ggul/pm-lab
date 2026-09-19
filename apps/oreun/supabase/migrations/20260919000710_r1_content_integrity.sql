-- Sprint 03 content provenance integrity.

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

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.universe_id is distinct from old.universe_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'content source identity is immutable';
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

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.universe_id is distinct from old.universe_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'guide identity is immutable';
  end if;

  new.slug := lower(btrim(new.slug));
  new.title := btrim(new.title);
  new.summary := btrim(new.summary);
  new.body := btrim(new.body);

  if new.source_id is not null
    and not exists (
      select 1
      from public.content_sources as source
      where source.id = new.source_id
        and (
          source.universe_id is null
          or source.universe_id = new.universe_id
        )
    )
  then
    raise exception 'guide source does not belong to this game';
  end if;

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

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.universe_id is distinct from old.universe_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'code identity is immutable';
  end if;

  new.code := btrim(new.code);
  new.reward_text := btrim(new.reward_text);
  new.notes := btrim(new.notes);

  if new.source_id is not null
    and not exists (
      select 1
      from public.content_sources as source
      where source.id = new.source_id
        and (
          source.universe_id is null
          or source.universe_id = new.universe_id
        )
    )
  then
    raise exception 'code source does not belong to this game';
  end if;

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

revoke execute on function private.r1_guard_content_source()
  from public, anon, authenticated;
revoke execute on function private.r1_guard_guide()
  from public, anon, authenticated;
revoke execute on function private.r1_guard_code()
  from public, anon, authenticated;
