-- supabase/scripts/assertions.sql
-- Self-checking RPC behavior assertions (raises an exception on any mismatch).
-- Run after migrations are applied. Cleans up its own rows before and after.

delete from public.orion_shows where id in ('assert-show');
delete from public.orion_workspace where id = 'main';

do $$
declare
  r record;
begin
  -- 1. create at revision 0 -> applied, revision 1
  select * into r from public.orion_save_show(
    'assert-show', 'assert-slug',
    '{"id":"assert-show","publicSlug":"assert-slug","name":"Assert Show","archived":false,"equipmentCategories":[],"equipment":[],"people":[],"schedule":[],"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}'::jsonb,
    false, 0, 'client-a'
  );
  if not (r.applied and r.reason = 'saved' and r.revision = 1) then
    raise exception 'assertion failed: create at revision 0, got applied=%, reason=%, revision=%', r.applied, r.reason, r.revision;
  end if;

  -- 2. re-create at stale revision 0 -> conflict, revision still 1
  select * into r from public.orion_save_show('assert-show', 'assert-slug', '{"name":"stale"}'::jsonb, false, 0, 'client-a');
  if not (not r.applied and r.reason = 'conflict' and r.revision = 1) then
    raise exception 'assertion failed: stale revision must conflict, got applied=%, reason=%, revision=%', r.applied, r.reason, r.revision;
  end if;

  -- 3. update at correct revision -> applied, revision 2
  select * into r from public.orion_save_show('assert-show', 'assert-slug', '{"name":"Updated"}'::jsonb, false, 1, 'client-a');
  if not (r.applied and r.revision = 2) then
    raise exception 'assertion failed: update at correct revision, got applied=%, revision=%', r.applied, r.revision;
  end if;

  raise notice 'PASS: optimistic concurrency (create/conflict/update)';
end $$;

do $$
declare
  r record;
begin
  -- 4. client A acquires the lock
  select * into r from public.orion_acquire_show_lock('assert-show', 'client-a', 'Chrome · macOS', 0);
  if not (r.acquired and r.owner_client_id = 'client-a') then
    raise exception 'assertion failed: client-a should acquire the lock, got acquired=%, owner=%', r.acquired, r.owner_client_id;
  end if;

  -- 5. client B blocked while A's lock is active
  select * into r from public.orion_acquire_show_lock('assert-show', 'client-b', 'Firefox · Windows', 0);
  if not (not r.acquired and r.owner_client_id = 'client-a') then
    raise exception 'assertion failed: client-b must be blocked by client-a, got acquired=%, owner=%', r.acquired, r.owner_client_id;
  end if;

  -- 6. client B blocked from saving while A holds the lock
  select * into r from public.orion_save_show('assert-show', 'assert-slug', '{"name":"from B"}'::jsonb, false, 2, 'client-b');
  if not (not r.applied and r.reason = 'locked') then
    raise exception 'assertion failed: save while locked by another client must be rejected, got applied=%, reason=%', r.applied, r.reason;
  end if;

  -- 7. client A renews (heartbeat) its own lock
  select * into r from public.orion_acquire_show_lock('assert-show', 'client-a', 'Chrome · macOS', 5);
  if not (r.acquired and r.owner_client_id = 'client-a') then
    raise exception 'assertion failed: client-a must be able to renew its own lock, got acquired=%', r.acquired;
  end if;

  -- 8. client A releases the lock
  perform public.orion_release_show_lock('assert-show', 'client-a');

  -- 9. client B can now acquire
  select * into r from public.orion_acquire_show_lock('assert-show', 'client-b', 'Firefox · Windows', 0);
  if not (r.acquired and r.owner_client_id = 'client-b') then
    raise exception 'assertion failed: client-b should acquire after release, got acquired=%, owner=%', r.acquired, r.owner_client_id;
  end if;
  perform public.orion_release_show_lock('assert-show', 'client-b');

  raise notice 'PASS: lock acquire/block/heartbeat-renew/release';
end $$;

do $$
declare
  acquired_flag boolean;
  expires_at_val timestamptz;
  expired boolean;
  r record;
begin
  -- 10. a lock acquired at the 10-minute inactivity ceiling expires immediately
  select acquired, expires_at into acquired_flag, expires_at_val
  from public.orion_acquire_show_lock('assert-show', 'client-b', 'Firefox · Windows', 600);
  expired := expires_at_val <= clock_timestamp() + interval '1 second';
  if not (acquired_flag and expired) then
    raise exception 'assertion failed: lock at max inactivity should expire immediately, got acquired=%, expired=%', acquired_flag, expired;
  end if;

  perform pg_sleep(1.1);

  -- 11. after expiry, a different client can acquire (expired lock swept)
  select * into r from public.orion_acquire_show_lock('assert-show', 'client-c', 'Safari · iOS', 0);
  if not (r.acquired and r.owner_client_id = 'client-c') then
    raise exception 'assertion failed: expired lock must be sweepable by another client, got acquired=%, owner=%', r.acquired, r.owner_client_id;
  end if;
  perform public.orion_release_show_lock('assert-show', 'client-c');

  raise notice 'PASS: lock expiry after inactivity ceiling';
end $$;

do $$
declare
  r record;
  remaining integer;
begin
  -- 12. delete at correct revision -> applied, row removed
  select * into r from public.orion_delete_show('assert-show', 2, 'client-a');
  if not (r.applied and r.reason = 'saved') then
    raise exception 'assertion failed: delete at correct revision, got applied=%, reason=%', r.applied, r.reason;
  end if;
  select count(*) into remaining from public.orion_shows where id = 'assert-show';
  if remaining <> 0 then
    raise exception 'assertion failed: Show row must be gone after delete, found %', remaining;
  end if;

  -- 13. delete of an already-missing Show is idempotent
  select * into r from public.orion_delete_show('assert-show', 0, 'client-a');
  if not (r.applied and r.reason = 'missing') then
    raise exception 'assertion failed: delete of missing Show must be idempotent, got applied=%, reason=%', r.applied, r.reason;
  end if;

  raise notice 'PASS: delete removes the row and is idempotent';
end $$;

do $$
declare
  r record;
begin
  -- 14. workspace optimistic save
  select * into r from public.orion_save_workspace('{"presets":[],"library":{},"preferences":{}}'::jsonb, 0);
  if not (r.applied and r.revision = 1) then
    raise exception 'assertion failed: workspace create at revision 0, got applied=%, revision=%', r.applied, r.revision;
  end if;
  select * into r from public.orion_save_workspace('{"presets":[],"library":{},"preferences":{}}'::jsonb, 0);
  if not (not r.applied and r.reason = 'conflict') then
    raise exception 'assertion failed: stale workspace revision must conflict, got applied=%, reason=%', r.applied, r.reason;
  end if;
  raise notice 'PASS: workspace optimistic concurrency';
end $$;

do $$
declare
  visible_count integer;
begin
  -- 15. RLS is deliberately open: anon can read and write directly (not just via RPC)
  set local role anon;
  insert into public.orion_shows (id, public_slug, data, archived, revision) values ('assert-rls', 'assert-rls-slug', '{}'::jsonb, false, 1);
  select count(*) into visible_count from public.orion_shows where id = 'assert-rls';
  reset role;
  delete from public.orion_shows where id = 'assert-rls';
  if visible_count <> 1 then
    raise exception 'assertion failed: anon role must have open read/write access by design, got count=%', visible_count;
  end if;
  raise notice 'PASS: anon RLS is open by design';
end $$;

do $$
begin
  -- 16. public_slug uniqueness is enforced
  insert into public.orion_shows (id, public_slug, data, archived, revision) values ('assert-dupe-1', 'assert-dupe-slug', '{}'::jsonb, false, 1);
  begin
    insert into public.orion_shows (id, public_slug, data, archived, revision) values ('assert-dupe-2', 'assert-dupe-slug', '{}'::jsonb, false, 1);
    raise exception 'assertion failed: duplicate public_slug must be rejected by the unique constraint';
  exception when unique_violation then
    null; -- expected
  end;
  raise notice 'PASS: public_slug uniqueness constraint';
end $$;

do $$
declare
  identity char;
begin
  -- 17. orion_shows must use REPLICA IDENTITY FULL (see migration 202607150002)
  select relreplident into identity from pg_class where relnamespace = 'public'::regnamespace and relname = 'orion_shows';
  if identity <> 'f' then
    raise exception 'assertion failed: orion_shows replica identity must be full, got %', identity;
  end if;
  raise notice 'PASS: orion_shows replica identity is full';
end $$;

delete from public.orion_shows where id in ('assert-show', 'assert-dupe-1', 'assert-dupe-2', 'assert-rls');
delete from public.orion_workspace where id = 'main';
