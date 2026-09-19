-- R1 / Oreun Sprint 05 hardening.
-- Make bounded observations explicit and prevent enabled-but-unverified targets.

alter table public.roblox_community_snapshots
  rename column forum_category_count to observed_forum_category_count;

alter table public.roblox_community_targets
  add constraint roblox_community_targets_authorized_requires_verification
  check (
    authorization_state <> 'authorized'
    or last_verified_at is not null
  );

alter table public.roblox_community_targets
  add constraint roblox_community_targets_enabled_requires_authorization
  check (
    not enabled
    or (
      authorization_state = 'authorized'
      and last_verified_at is not null
    )
  );

alter table public.roblox_community_snapshots
  add constraint roblox_community_snapshots_category_sample_consistency
  check (categories_scanned <= observed_forum_category_count);

alter table public.roblox_community_snapshots
  add constraint roblox_community_snapshots_post_sample_consistency
  check (posts_scanned <= observed_post_count);
