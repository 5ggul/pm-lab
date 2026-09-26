-- Final cleanup after the age self-attestation app rollout.
-- Current permissions expose authentication, active status and role only.
create or replace function private.r1_current_permissions()
returns jsonb language sql stable security definer set search_path='' as $$
select case
 when auth.uid() is null then
   jsonb_build_object('authenticated',false,'active',false,'role',null)
 else
   jsonb_build_object(
     'authenticated',true,
     'active',coalesce((select status='active' from private.user_status where user_id=auth.uid()),false),
     'role',coalesce((select role from private.user_roles where user_id=auth.uid()),'user')
   )
end;
$$;

drop function if exists public.r1_set_age_confirmation(boolean);
drop function if exists private.r1_set_age_confirmation_private(boolean);
