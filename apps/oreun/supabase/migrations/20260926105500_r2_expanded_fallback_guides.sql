-- Register the reviewed high-demand fallback guides added in R2.
-- This only extends the private publication registry. It does not mark any
-- existing DB-authored guide as published and preserves tombstone semantics.
insert into private.r1_fallback_guide_visibility(universe_id,slug) values
  (10563114921,'egg-pet-loop'),
  (3508322461,'controls'),
  (7709344486,'money-rebirth-loop'),
  (6701277882,'fishing-basics'),
  (2711375305,'avatar-tryon'),
  (3647333358,'survival-controls'),
  (703124385,'no-checkpoint-basics'),
  (5361032378,'roll-craft-loop'),
  (5569032992,'machine-team-basics'),
  (2619619496,'bed-resource-basics'),
  (1516533665,'escape-item-basics'),
  (88070565,'first-money-home')
on conflict (universe_id,slug) do nothing;

update private.r1_fallback_guide_visibility s
set state=case
  when g.content_status='published' and g.review_status='approved' then 'published'
  else 'withheld'
end
from public.game_guides g
where g.universe_id=s.universe_id
  and g.slug=s.slug
  and (s.universe_id,s.slug) in (
    (10563114921,'egg-pet-loop'),
    (3508322461,'controls'),
    (7709344486,'money-rebirth-loop'),
    (6701277882,'fishing-basics'),
    (2711375305,'avatar-tryon'),
    (3647333358,'survival-controls'),
    (703124385,'no-checkpoint-basics'),
    (5361032378,'roll-craft-loop'),
    (5569032992,'machine-team-basics'),
    (2619619496,'bed-resource-basics'),
    (1516533665,'escape-item-basics'),
    (88070565,'first-money-home')
  );
