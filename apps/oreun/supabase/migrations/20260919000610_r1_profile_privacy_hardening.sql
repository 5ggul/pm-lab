-- Sprint 02 privacy hardening: keep age confirmation out of public profile rows.

alter table private.user_status
  add column if not exists age_confirmed_14_plus boolean not null default false;

update private.user_status as status
set age_confirmed_14_plus = profile.age_confirmed_14_plus
from public.profiles as profile
where profile.id = status.user_id;

create or replace function private.r1_is_active_user()
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
      from private.user_status as status
      where status.user_id = auth.uid()
        and status.age_confirmed_14_plus
        and status.status = 'active'
    );
$$;

create or replace function public.r1_my_community_permissions()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when auth.uid() is null then
      jsonb_build_object(
        'authenticated', false,
        'active', false,
        'age_confirmed_14_plus', false,
        'role', null
      )
    else
      jsonb_build_object(
        'authenticated', true,
        'active', coalesce((
          select status.status = 'active'
          from private.user_status as status
          where status.user_id = auth.uid()
        ), false),
        'age_confirmed_14_plus', coalesce((
          select status.age_confirmed_14_plus
          from private.user_status as status
          where status.user_id = auth.uid()
        ), false),
        'role', coalesce((
          select role_row.role
          from private.user_roles as role_row
          where role_row.user_id = auth.uid()
        ), 'user')
      )
  end;
$$;

create or replace function public.r1_set_age_confirmation(p_confirmed boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update private.user_status
  set
    age_confirmed_14_plus = p_confirmed,
    updated_at = now()
  where user_id = auth.uid();

  return found;
end;
$$;

revoke all on function public.r1_set_age_confirmation(boolean)
  from public, anon;
grant execute on function public.r1_set_age_confirmation(boolean)
  to authenticated;

create or replace function private.r1_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text := 'u_' || substr(replace(new.id::text, '-', ''), 1, 12);
  v_age_confirmed boolean :=
    lower(coalesce(new.raw_user_meta_data->>'age_confirmed_14_plus', '')) in ('true','1','yes');
begin
  insert into public.profiles(id, handle)
  values (new.id, v_handle)
  on conflict (id) do nothing;

  insert into private.user_status(
    user_id, status, age_confirmed_14_plus
  )
  values (new.id, 'active', v_age_confirmed)
  on conflict (user_id) do update
  set age_confirmed_14_plus = excluded.age_confirmed_14_plus;

  insert into private.user_roles(user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

alter table public.profiles
  drop column if exists age_confirmed_14_plus;
