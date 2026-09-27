-- Catalogue alias only; no user content changes.
insert into public.game_aliases(universe_id,alias,normalized_alias,lang,alias_type)
select universe_id,'어돕미','어돕미','ko','korean' from public.games where canonical_slug='adopt-me'
on conflict(universe_id,normalized_alias) do nothing;
