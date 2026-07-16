# Verificación reproducible de la candidata V2.0.0

## Gate local sin backend

```bash
npm ci
npm run lint
npm run test
npm run typecheck:tests
npm run build
npm run check:secrets
npm run test:pages
```

`test:pages` compila con base `/show_axe/`, sirve `dist/` y verifica shell, assets, chunk lazy público, recarga directa, scope/cache del Service Worker, segunda carga offline y un escaneo axe del Setup.

## Gate con Supabase real

Arranca una instancia desechable desde cero y exporta su URL y publishable/anon key:

```bash
supabase start
export SUPABASE_TEST_URL=http://127.0.0.1:54321
export SUPABASE_TEST_ANON_KEY='publishable-o-anon-local'
export SUPABASE_INTEGRATION_REQUIRED=true
npm run test:integration
npx playwright install chromium
npm run test:e2e
supabase stop
```

La ejecución es válida solo con:

- integración Supabase sin skips;
- E2E desktop y mobile sin skips;
- 0 failed y 0 retries;
- migraciones aplicadas desde base vacía;
- build y secrets scan en success.

## Referencia CI

`.github/workflows/ci.yml` reproduce los dos gates. El job `supabase-integration` inicia Supabase, exige configuración, ejecuta integración, Pages y E2E, y siempre detiene el stack. Un run final de la rama candidata es la evidencia de release; un run anterior solo prueba su SHA correspondiente.

## Bundle esperado

El build no genera sourcemaps. En la validación local de Milestone 4, el entry principal fue 250.85 kB (78.94 kB gzip) y el exportador PDF quedó lazy en 424.27 kB (139.20 kB gzip). Revisa cambios materiales en estos valores antes de release.
