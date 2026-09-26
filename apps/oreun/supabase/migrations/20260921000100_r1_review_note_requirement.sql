-- Require a substantive human review note before content can become approved.
-- This keeps direct DB/API writes aligned with Content Studio review policy.

alter table public.game_guides
  drop constraint if exists game_guides_approved_review_note_check;
alter table public.game_guides
  add constraint game_guides_approved_review_note_check
  check (
    review_status <> 'approved'
    or char_length(btrim(review_note)) >= 10
  );

alter table public.game_codes
  drop constraint if exists game_codes_approved_review_note_check;
alter table public.game_codes
  add constraint game_codes_approved_review_note_check
  check (
    review_status <> 'approved'
    or char_length(btrim(review_note)) >= 10
  );
