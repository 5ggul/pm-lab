create or replace function private.r1_handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_handle text := 'u_' || substr(replace(new.id::text,'-',''),1,12);
begin
 insert into public.profiles(id,handle) values(new.id,v_handle) on conflict(id) do nothing;
 insert into private.user_status(user_id,status) values(new.id,'active') on conflict(user_id) do nothing;
 insert into private.user_roles(user_id,role) values(new.id,'user') on conflict(user_id) do nothing;
 return new;
end; $$;

create or replace function private.r1_set_age_confirmation_private(p_confirmed boolean)
returns boolean language sql security definer set search_path='' as $$ select auth.uid() is not null; $$;

alter table private.user_status drop column if exists age_confirmed_14_plus;
