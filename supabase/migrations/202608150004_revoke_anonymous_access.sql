-- Ori♡n Shows · Authenticated editor access — phase 2 (revocation)
--
-- Closes anonymous access to the editor. Apply this ONLY after a client that can
-- sign in is deployed and verified in production; applying it first leaves the
-- running application unable to reach its own data.
--
-- After this migration the publishable key still identifies the project but
-- grants nothing: the only thing an anonymous caller may do is execute
-- `orion_public_show`, which requires an exact slug.
--
-- ROLLBACK. If the deployed client turns out to be unable to authenticate, this
-- reopens access exactly as it was. It is a deliberate, temporary regression to a
-- fully public database — treat it as an incident action, not an option:
--
--   grant select, insert, update, delete on public.orion_workspace   to anon;
--   grant select, insert, update, delete on public.orion_shows       to anon;
--   grant select, insert, update, delete on public.orion_show_locks  to anon;
--   create policy "orion workspace open access" on public.orion_workspace
--     for all to anon, authenticated using (true) with check (true);
--   create policy "orion shows open access" on public.orion_shows
--     for all to anon, authenticated using (true) with check (true);
--   create policy "orion locks open access" on public.orion_show_locks
--     for all to anon, authenticated using (true) with check (true);
--   grant execute on function public.orion_save_workspace(jsonb, bigint) to anon;
--   grant execute on function public.orion_save_show(text, text, jsonb, boolean, bigint, text) to anon;
--   grant execute on function public.orion_delete_show(text, bigint, text) to anon;
--   grant execute on function public.orion_acquire_show_lock(text, text, text, integer) to anon;
--   grant execute on function public.orion_release_show_lock(text, text) to anon;
--
-- See docs/adr/0006-authenticated-editor-access.md and D-215.

-- Table privileges ------------------------------------------------------------
-- `authenticated` keeps its grants; the policies below decide what it may reach.
revoke all on public.orion_workspace from anon;
revoke all on public.orion_shows from anon;
revoke all on public.orion_show_locks from anon;

-- Policies ---------------------------------------------------------------------
-- Membership rather than mere authentication: a stranger who self-registers,
-- should signups ever be re-enabled by accident, authenticates successfully and
-- is still denied here.
--
-- `orion_is_member()` references no column, so the planner evaluates it once per
-- statement rather than per row.
drop policy if exists "orion workspace open access" on public.orion_workspace;
drop policy if exists "orion workspace member access" on public.orion_workspace;
create policy "orion workspace member access" on public.orion_workspace
  for all to authenticated
  using (public.orion_is_member())
  with check (public.orion_is_member());

drop policy if exists "orion shows open access" on public.orion_shows;
drop policy if exists "orion shows member access" on public.orion_shows;
create policy "orion shows member access" on public.orion_shows
  for all to authenticated
  using (public.orion_is_member())
  with check (public.orion_is_member());

drop policy if exists "orion locks open access" on public.orion_show_locks;
drop policy if exists "orion locks member access" on public.orion_show_locks;
create policy "orion locks member access" on public.orion_show_locks
  for all to authenticated
  using (public.orion_is_member())
  with check (public.orion_is_member());

-- RPC execution ----------------------------------------------------------------
-- The load-bearing half. Every function below is `security definer` and so runs
-- as its owner, bypassing RLS entirely: the grant is the only gate on it. Closing
-- the tables while leaving any of these executable by `anon` would leave the
-- whole scheme bypassable through the RPC.
revoke execute on function public.orion_save_workspace(jsonb, bigint) from anon;
revoke execute on function public.orion_save_show(text, text, jsonb, boolean, bigint, text) from anon;
revoke execute on function public.orion_delete_show(text, bigint, text) from anon;
revoke execute on function public.orion_acquire_show_lock(text, text, text, integer) from anon;
revoke execute on function public.orion_release_show_lock(text, text) from anon;

-- `orion_public_show` is deliberately left executable by `anon`: it is the public
-- read-only route's only access path, and it returns at most the single Show
-- whose slug the caller already holds (D-219).
grant execute on function public.orion_public_show(text) to anon, authenticated;
