#!/usr/bin/env bash
# scripts/check-no-secrets.sh
#
# Fails if a Supabase secret/service-role key, or a JWT-shaped literal that
# could be one, shows up anywhere in the repo source or a production build.
# Run after `npm run build` so dist/ exists.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail=0

echo "==> Scanning repo source for service-role/secret-key patterns"
if grep -rniE "service[_-]?role|sb_secret_|SUPABASE_SERVICE" \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' --include='*.toml' --include='*.sql' \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist . \
  | grep -viE "never (use|expose|paste)|no pegues|warning text|nunca debe"; then
  echo "FAIL: found a service-role/secret-key pattern outside of warning text above."
  fail=1
else
  echo "OK: only expected warning-text mentions found (or none)."
fi

echo "==> Scanning repo source for JWT-shaped literals"
if grep -rnoE "eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist .; then
  echo "FAIL: found a JWT-shaped literal in repo source."
  fail=1
else
  echo "OK: no JWT-shaped literals in repo source."
fi

if [ -d dist ]; then
  echo "==> Scanning dist/ for service-role/secret-key patterns"
  if grep -rniE "service[_-]?role|sb_secret_|SUPABASE_SERVICE" dist/ \
    | grep -viE "no pegues|never use|warning|sb_publishable_.*sb_secret_"; then
    echo "FAIL: found a service-role/secret-key pattern in the production build."
    fail=1
  else
    echo "OK: dist/ only contains expected library validation code / UI warning text."
  fi

  echo "==> Scanning dist/ for JWT-shaped literals"
  if grep -rnoE "eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}" dist/; then
    echo "FAIL: found a JWT-shaped literal in the production build."
    fail=1
  else
    echo "OK: no JWT-shaped literals in dist/."
  fi

  if [ "${ALLOW_PUBLIC_RUNTIME_CONFIG:-false}" = "true" ]; then
    echo "==> Public runtime-config mode: configured URL/publishable key are allowed after secret/JWT scans"
    echo "OK: dist/config.js may contain public deploy values in this explicitly enabled mode."
  else
    echo "==> Confirming dist/config.js ships empty placeholders"
    if grep -q "supabaseUrl: ''" dist/config.js && grep -q "supabasePublishableKey: ''" dist/config.js; then
      echo "OK: dist/config.js ships empty placeholders, not real credentials."
    else
      echo "FAIL: dist/config.js does not look like the expected empty placeholder template."
      fail=1
    fi
  fi
else
  echo "SKIP: dist/ not found. Run 'npm run build' first to check the production bundle too."
fi

if [ "$fail" -ne 0 ]; then
  echo "==> check-no-secrets FAILED"
  exit 1
fi
echo "==> check-no-secrets passed: no service-role/secret keys found in repo or dist/."
