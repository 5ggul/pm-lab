-- Enable collection for community-selectable games added by the R2 catalog expansion.
insert into public.collector_targets(universe_id,tier,cadence_minutes,next_due_at,enabled)
select g.universe_id,'longtail',120,now(),true
from public.games g
where g.index_state='collecting'
on conflict (universe_id) do update
set enabled=true,
    next_due_at=least(public.collector_targets.next_due_at,now()),
    updated_at=now();
