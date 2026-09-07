-- Feedback-only seed set captured 2026-09-07.
-- `score` is initialized from FomoTop's picker hit-rate metric, NOT realised PnL.
-- Re-review these traders before any formal production launch.

insert into public.traders(external_key,label,score,status,updated_at)
values
  ('fomotop:wrldsol','wrldsol',90,'active',now()),
  ('fomotop:remus','remus',69,'active',now()),
  ('fomotop:frankdegods','frankdegods',69,'active',now())
on conflict(external_key) do update
set label=excluded.label, score=excluded.score, status='active', updated_at=now();

insert into public.wallets(trader_id,address,chain,cluster_id,is_active)
select id,'6bQSN4d6anoTwnE6XDPGLA9RV8cqZPeNJro4iQUsWmso','solana','fomotop:wrldsol',true
from public.traders where external_key='fomotop:wrldsol'
union all
select id,'BCrTEXmWutwPz8qv6w1S5gDbaLnSLpXKM5kSGVWyyfxu','solana','fomotop:remus',true
from public.traders where external_key='fomotop:remus'
union all
select id,'498g1rVnFcnjBjpfw1xyqA1WvgQXUU8RWuELjxkjAayQ','solana','fomotop:frankdegods',true
from public.traders where external_key='fomotop:frankdegods'
on conflict(chain,address) do update
set trader_id=excluded.trader_id, cluster_id=excluded.cluster_id, is_active=true;
