-- Ori♡n Shows · Authenticated editor access — phase 1 (additive)
--
-- This migration is DELIBERATELY ADDITIVE. It creates the member registry, the
-- membership predicate and the narrow public-Show accessor, but it does NOT
-- revoke anonymous access to anything. Applying it changes no observable
-- behaviour, so it is safe to run against a live deployment whose client cannot
-- log in yet.
--
-- Anonymous access is revoked by a separate later migration, and only after
-- login has been verified in production. Reversing that order would leave the
-- deployed app unable to reach its own data.
--
-- See docs/adr/0006-authenticated-editor-access.md.

-- Member registry ------------------------------------------------------------
-- Authorisation is membership in this table, never a hardcoded email or UUID.
-- Adding a person is one INSERT; no code change and no redeploy.
create table if not exists public.orion_app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

alter table public.orion_app_users enable row level security;

revoke all on public.orion_app_users from anon;
grant select on public.orion_app_users to authenticated;

-- Membership predicate --------------------------------------------------------
-- `security definer` is load-bearing twice over. It lets the predicate read the
-- registry regardless of that table's own RLS, which both keeps the registry
-- unreadable by anon and avoids the classic infinite recursion of a policy on
-- orion_app_users that queries orion_app_users.
--
-- Membership rather than `auth.role() = 'authenticated'` is also load-bearing:
-- should e-mail signups ever be re-enabled by accident, a self-registered
-- stranger authenticates successfully but is still not a member, so every
-- policy below denies them.
create or replace function public.orion_is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orion_app_users as u where u.user_id = auth.uid()
  );
$$;

revoke all on function public.orion_is_member() from public;
grant execute on function public.orion_is_member() to authenticated;

-- Members may read the registry (to attribute locks and, later, list people).
-- No insert/update/delete policy exists on purpose: the registry is mutable
-- only from the Supabase SQL editor, so a compromised browser session cannot
-- grant access to anyone else.
drop policy if exists "orion members read registry" on public.orion_app_users;
create policy "orion members read registry" on public.orion_app_users
  for select to authenticated
  using (public.orion_is_member());

-- Public read-only Show accessor ----------------------------------------------
-- Replaces the anonymous `select` over the whole orion_shows table that the
-- public route uses today. The visitor must present an exact slug, so the Show
-- catalogue can no longer be enumerated with the publishable key.
--
-- Archived Shows are returned deliberately: D-213 keeps the public link alive
-- through archiving and disables it only on delete.
create or replace function public.orion_public_show(p_slug text)
returns table (
  id text,
  public_slug text,
  data jsonb,
  archived boolean,
  revision bigint,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.public_slug, s.data, s.archived, s.revision, s.updated_at
  from public.orion_shows as s
  where s.public_slug = p_slug
  limit 1;
$$;

revoke all on function public.orion_public_show(text) from public;
grant execute on function public.orion_public_show(text) to anon, authenticated;

-- Administrative helper --------------------------------------------------------
-- Resolves an e-mail to its auth user and records membership, so an operator
-- never has to copy a UUID by hand. Intentionally granted to no application
-- role: it is reachable only from the Supabase SQL editor, which runs as an
-- administrative role and bypasses these grants.
create or replace function public.orion_add_member(
  p_email text,
  p_display_name text,
  p_role text default 'owner'
)
returns public.orion_app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_row public.orion_app_users%rowtype;
begin
  select u.id into v_user_id
  from auth.users as u
  where lower(u.email) = lower(trim(p_email));

  if v_user_id is null then
    raise exception
      'No existe un usuario de autenticación con el email %. Creálo primero en Authentication > Users.',
      p_email;
  end if;

  insert into public.orion_app_users as t (user_id, display_name, role)
  values (v_user_id, p_display_name, p_role)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        role = excluded.role
  returning t.* into v_row;

  return v_row;
end;
$$;

revoke all on function public.orion_add_member(text, text, text) from public, anon, authenticated;
