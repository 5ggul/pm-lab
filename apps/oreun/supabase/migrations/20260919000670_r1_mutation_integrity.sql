-- Sprint 02 mutation-integrity hardening.

create or replace function private.r1_guard_notification_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.kind is distinct from old.kind
    or new.actor_id is distinct from old.actor_id
    or new.game_universe_id is distinct from old.game_universe_id
    or new.question_id is distinct from old.question_id
    or new.answer_id is distinct from old.answer_id
    or new.comment_id is distinct from old.comment_id
    or new.payload is distinct from old.payload
    or new.created_at is distinct from old.created_at
  then
    raise exception 'only notification read state can change';
  end if;

  if auth.uid() is distinct from old.user_id then
    raise exception 'notification ownership required';
  end if;

  return new;
end;
$$;

drop trigger if exists r1_guard_notification_update on public.notifications;
create trigger r1_guard_notification_update
before update on public.notifications
for each row execute function private.r1_guard_notification_update();

create or replace function private.r1_guard_report_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.r1_is_moderator() then
    raise exception 'moderator role required';
  end if;

  if new.id is distinct from old.id
    or new.reporter_id is distinct from old.reporter_id
    or new.target_type is distinct from old.target_type
    or new.target_id is distinct from old.target_id
    or new.reason is distinct from old.reason
    or new.details is distinct from old.details
    or new.created_at is distinct from old.created_at
  then
    raise exception 'report evidence is immutable';
  end if;

  if new.status in ('resolved','dismissed') then
    new.reviewed_at := coalesce(new.reviewed_at, now());
    new.reviewed_by := auth.uid();
  elsif new.status in ('open','reviewing') then
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists r1_guard_report_update on public.reports;
create trigger r1_guard_report_update
before update on public.reports
for each row execute function private.r1_guard_report_update();
