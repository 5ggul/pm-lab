-- Fix restricted-contact matching without fragile backslash escaping.

create or replace function private.r1_contains_restricted_contact(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    lower(coalesce(p_text, '')) like '%.roblosecurity%'
    or lower(coalesce(p_text, '')) like '%discord.gg/%'
    or lower(coalesce(p_text, '')) like '%discord.com/invite/%'
    or coalesce(p_text, '') ~* 'javascript[[:space:]]*:'
    or coalesce(p_text, '') ~* '<[[:space:]]*script'
    or coalesce(p_text, '') ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}'
    or coalesce(p_text, '') ~* '01[016789][ -]?[0-9]{3,4}[ -]?[0-9]{4}'
    or coalesce(p_text, '') ~* '(카카오톡|카톡|telegram|텔레그램)[[:space:]]*(id|아이디|:)';
$$;
