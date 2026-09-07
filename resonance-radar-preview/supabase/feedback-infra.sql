-- Feedback-only Resonance Radar infrastructure for project uxhlpmdneqkdydkuyqoj.
-- This does not enable indexing or a production domain.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create index if not exists wallets_trader_id_idx on public.wallets(trader_id);

-- Private request secrets. Values are never exposed to anon/authenticated roles.
do $$
declare
  v text;
  jid bigint;
begin
  if not exists (select 1 from public.collector_state where key='edge_cron_secret') then
    v := encode(extensions.gen_random_bytes(32),'hex');
    insert into public.collector_state(key,value,updated_at)
    values('edge_cron_secret',jsonb_build_object('secret',v),now());
  end if;

  if not exists (select 1 from public.collector_state where key='helius_webhook_secret') then
    v := 'Bearer ' || encode(extensions.gen_random_bytes(32),'hex');
    insert into public.collector_state(key,value,updated_at)
    values('helius_webhook_secret',jsonb_build_object('secret',v),now());
  end if;

  if not exists (select 1 from public.collector_state where key='rpc_poll_secret') then
    v := encode(extensions.gen_random_bytes(32),'hex');
    insert into public.collector_state(key,value,updated_at)
    values('rpc_poll_secret',jsonb_build_object('secret',v),now());
  end if;

  for jid in select jobid from cron.job where jobname in ('resonance-radar-minute-tick','resonance-radar-rpc-poll') loop
    perform cron.unschedule(jid);
  end loop;
end $$;

-- Rolling-window recompute. The Edge Function returns mode=ready while no trades exist.
select cron.schedule(
  'resonance-radar-minute-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://uxhlpmdneqkdydkuyqoj.supabase.co/functions/v1/resonance-radar-collector',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-radar-cron-secret',(select value->>'secret' from public.collector_state where key='edge_cron_secret')
    ),
    body := '{"action":"tick"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

-- Temporary feedback-period public Solana RPC poller.
-- Remove/disable this job when Helius or another dedicated RPC becomes the primary source.
select cron.schedule(
  'resonance-radar-rpc-poll',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://uxhlpmdneqkdydkuyqoj.supabase.co/functions/v1/resonance-rpc-poller',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-radar-rpc-secret',(select value->>'secret' from public.collector_state where key='rpc_poll_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
  $$
);
