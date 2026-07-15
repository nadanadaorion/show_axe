#!/usr/bin/env bash
# supabase/scripts/verify-sql-native.sh
#
# Applies every migration under supabase/migrations/ to a throwaway Postgres
# database from empty, twice (to prove idempotency), then runs SQL-level
# behavioral assertions against the RPC functions: optimistic concurrency,
# lock acquire/renew/block/release/expire, delete idempotency, open RLS as
# `anon`, and the public_slug uniqueness constraint.
#
# This is a lightweight fallback for environments where the Supabase CLI's
# full Docker-based local stack (`supabase start`) is unavailable. It
# approximates only the two pieces our migrations assume the platform already
# provides: the `anon`/`authenticated` roles and an empty `supabase_realtime`
# publication. It does NOT verify PostgREST request/response shapes or actual
# Realtime delivery over the wire — use `supabase start` for that (see
# docs/19-TESTING_STRATEGY.md).
#
# Connection: set DATABASE_URL to a Postgres connection string for a
# maintenance database with CREATEDB/CREATEROLE privileges (e.g. the official
# `postgres:16` GitHub Actions service container: postgres://postgres:postgres@localhost:5432/postgres).
# Without DATABASE_URL, falls back to `sudo -u postgres psql` against the
# local cluster. Skips cleanly (exit 0) if neither psql nor a usable
# connection is available — this script never fakes a pass.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"
DB_NAME="orion_shows_sql_verify_$$"

skip() {
  echo "SKIP: $1"
  exit 0
}

command -v psql >/dev/null 2>&1 || skip "psql not found. Install PostgreSQL client tools, or verify via 'supabase start' instead."

if [ -n "${DATABASE_URL:-}" ]; then
  admin_psql() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }
  db_psql() { psql "${DATABASE_URL%/*}/$DB_NAME" -v ON_ERROR_STOP=1 -q "$@"; }
  drop_db() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB_NAME;" >/dev/null; }
elif command -v sudo >/dev/null 2>&1 && sudo -n -u postgres true 2>/dev/null; then
  admin_psql() { sudo -u postgres psql -v ON_ERROR_STOP=1 -q "$@"; }
  db_psql() { sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q "$@"; }
  drop_db() { sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB_NAME;" >/dev/null; }
else
  skip "no DATABASE_URL and no passwordless 'sudo -u postgres' available. Set DATABASE_URL to a Postgres connection string to run this check."
fi

cleanup() { drop_db || true; }
trap cleanup EXIT

echo "==> Creating throwaway database $DB_NAME"
admin_psql -c "create database $DB_NAME;" >/dev/null

echo "==> Approximating Supabase platform bootstrap (anon/authenticated roles, empty supabase_realtime publication)"
db_psql -c "
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end \$\$;
" >/dev/null
db_psql -c "create publication supabase_realtime;" >/dev/null 2>&1 || true

echo "==> Applying migrations from empty (pass 1)"
for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "    - $(basename "$f")"
  db_psql -f "$f" >/dev/null
done

echo "==> Re-applying migrations (pass 2, proves idempotency)"
for f in "$MIGRATIONS_DIR"/*.sql; do
  db_psql -f "$f" >/dev/null
done

echo "==> Running schema/RLS/RPC-signature/replica-identity checks"
db_psql -e -f "$SCRIPT_DIR/../VERIFY.sql"

echo "==> Running RPC behavior assertions"
db_psql -f "$SCRIPT_DIR/assertions.sql"

echo "==> All SQL-level checks passed."
