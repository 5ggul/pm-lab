-- Authenticated users may inspect only their own party membership rows.

create policy "party members own read"
on public.party_members for select
to authenticated
using ((select auth.uid())=user_id);

grant select on public.party_members to authenticated;
