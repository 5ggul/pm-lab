-- Timestamp-only provider update detection is useful as history, but it is
-- not a verified patch note. Keep collecting events while preventing follower
-- notification spam until an editorial update layer exists.
create or replace function private.r1_notify_followers_of_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;
