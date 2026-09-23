-- Public fallback keys were already published in the repository. No private
-- draft title, body, author, or review note is exposed by this registry.
create table if not exists private.r1_fallback_guide_visibility (
 universe_id bigint not null, slug text not null,
 state text not null default 'missing' check(state in ('missing','published','withheld')),
 primary key(universe_id,slug)
);
alter table private.r1_fallback_guide_visibility enable row level security;
revoke all on private.r1_fallback_guide_visibility from public,anon,authenticated,service_role;
insert into private.r1_fallback_guide_visibility(universe_id,slug) values
(994732206,'fruit-basics'),
(5750914919,'fishing-controls'),
(7436755782,'planting-basics'),
(6035872082,'first-duel'),
(66654135,'roles'),
(6931042565,'controls'),
(4777817887,'controls'),
(3808081382,'controls'),
(383310974,'pet-home-basics'),
(5578556129,'unit-progression'),
(601130232,'core-loop'),
(1686885941,'roleplay-basics'),
(2440500124,'before-you-enter'),
(245662005,'roles-basics'),
(31970568,'building-basics'),
(1176784616,'defense-basics'),
(7326934954,'camp-basics'),
(111958650,'weapon-loop'),
(6325068386,'match-basics'),
(5203828273,'runway-basics'),
(6331902150,'roles-objectives'),
(65241,'survival-basics'),
(3317771874,'pet-army-basics'),
(3317679266,'booth-basics'),
(73885730,'roles'),
(47545,'work-loop')
on conflict do nothing;
update private.r1_fallback_guide_visibility s set state=case when g.content_status='published' and g.review_status='approved' then 'published' else 'withheld' end
from public.game_guides g where g.universe_id=s.universe_id and g.slug=s.slug;
create or replace function private.r1_sync_guide_visibility() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op in ('DELETE','UPDATE') then
  update private.r1_fallback_guide_visibility set state='withheld' where universe_id=old.universe_id and slug=old.slug;
 end if;
 if tg_op in ('INSERT','UPDATE') then
  update private.r1_fallback_guide_visibility set state=case when new.content_status='published' and new.review_status='approved' then 'published' else 'withheld' end where universe_id=new.universe_id and slug=new.slug;
 end if;
 return null;
end;$$;
revoke all on function private.r1_sync_guide_visibility() from public,anon,authenticated,service_role;
drop trigger if exists r1_sync_guide_visibility on public.game_guides;
create trigger r1_sync_guide_visibility after insert or update or delete on public.game_guides for each row execute function private.r1_sync_guide_visibility();
create or replace function public.r1_public_guide_states() returns table(universe_id bigint,slug text,state text)
language sql stable security definer set search_path='' as $$
 select s.universe_id,s.slug,s.state from private.r1_fallback_guide_visibility s order by s.universe_id,s.slug;
$$;
revoke all on function public.r1_public_guide_states() from public;
grant execute on function public.r1_public_guide_states() to anon,authenticated;
-- Existing editorial approval guards, user roles, content bodies and timestamps
-- are deliberately left unchanged. Deleting a known DB guide retains a tombstone.
