-- Age self-attestation is retired. Existing technical identifiers remain.
-- A compatibility JSON key is temporarily returned as true so an older rolling
-- deployment does not block active users while the app update propagates.
create or replace function private.r1_current_permissions()
returns jsonb language sql stable security definer set search_path='' as $$
select case when auth.uid() is null then
 jsonb_build_object('authenticated',false,'active',false,'age_confirmed_14_plus',true,'role',null)
else jsonb_build_object(
 'authenticated',true,
 'active',coalesce((select status='active' from private.user_status where user_id=auth.uid()),false),
 'age_confirmed_14_plus',true,
 'role',coalesce((select role from private.user_roles where user_id=auth.uid()),'user')
) end;
$$;

create or replace function private.r1_is_active_user()
returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null
 and exists(select 1 from private.user_status where user_id=auth.uid() and status='active');
$$;

create or replace function public.r1_set_age_confirmation(p_confirmed boolean)
returns boolean language sql set search_path='' as $$ select auth.uid() is not null; $$;

create or replace function public.r1_release_auth_readiness()
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object(
 'google_identity_count',(select count(*)::integer from auth.identities where provider='google'),
 'active_admin_count',(select count(*)::integer from private.user_roles r join private.user_status s on s.user_id=r.user_id where r.role='admin' and s.status='active'),
 'active_google_admin_count',(select count(distinct r.user_id)::integer from private.user_roles r join private.user_status s on s.user_id=r.user_id join auth.identities i on i.user_id=r.user_id and i.provider='google' where r.role='admin' and s.status='active')
);
$$;

-- Live deployment also redefines r1_submit_question/answer/comment/party so
-- authenticated active status is the only account-state write gate. Their
-- validation, parent visibility, caller RLS and idempotency rules are unchanged.
