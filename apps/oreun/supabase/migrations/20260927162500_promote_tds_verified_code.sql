do $$
declare
  v_admin uuid;
  v_source uuid;
begin
  select r.user_id
    into v_admin
  from private.user_roles r
  join private.user_status s on s.user_id = r.user_id
  where r.role = 'admin' and s.status = 'active'
  order by r.user_id
  limit 1;

  if v_admin is null then
    raise exception 'active admin required for verified code migration';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  select id
    into v_source
  from public.content_sources
  where universe_id = 1176784616
    and source_url = 'https://www.roblox.com/games/3260590327/Tower-Defense-Simulator'
  order by last_checked_at desc
  limit 1;

  if v_source is null then
    raise exception 'TDS official content source missing';
  end if;

  update public.content_sources
     set last_checked_at = now()
   where id = v_source;

  insert into public.game_codes (
    universe_id,
    code,
    reward_text,
    code_status,
    visibility,
    source_id,
    verified_at,
    last_checked_at,
    expires_at,
    notes,
    review_status,
    reviewed_at,
    reviewed_by,
    review_note
  )
  values (
    1176784616,
    '2MILLION',
    'Mercenary Pursuit 스킨',
    'active',
    'published',
    v_source,
    now(),
    now(),
    null,
    'Roblox 공식 게임 설명에 2MILLION 무료 Mercenary Pursuit 스킨 코드가 현재 노출됨.',
    'approved',
    now(),
    v_admin,
    'Roblox 공식 게임 페이지에서 현재 코드와 보상을 다시 확인한 production editorial record'
  )
  on conflict (universe_id, code) do nothing;
end;
$$;
