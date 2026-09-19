-- Cover Sprint 03 source foreign keys for delete/update checks.

create index if not exists game_guides_source_idx
  on public.game_guides(source_id)
  where source_id is not null;

create index if not exists game_codes_source_idx
  on public.game_codes(source_id)
  where source_id is not null;
