# Guía de desarrollo

## Entorno

- Node.js 22
- npm (usa `npm ci`, no edites `package-lock.json` a mano)
- Git
- Docker y Supabase CLI solo para la validación local completa

```bash
git clone https://github.com/nadanadaorion/show_axe.git
cd show_axe
npm ci
npm run dev
```

`public/config.js` se entrega con valores vacíos. Para desarrollo manual puedes usar la pantalla Setup o editar una copia local no destinada a commit. Nunca uses una secret/service-role key.

## Gate rápido

```bash
npm run lint
npm run test
npm run typecheck:tests
npm run build
npm run check:secrets
```

En Windows, los dos scripts Bash requieren Git Bash/WSL. El CI Linux es la referencia exacta para `check:secrets` y `test:supabase:sql`.

## Supabase local desde cero

1. Instala Docker y Supabase CLI.
2. Ejecuta `supabase start`. Las migraciones de `supabase/migrations/` se aplican desde una base vacía.
3. Obtén la URL y publishable/anon key con `supabase status`.
4. Define las variables sin guardarlas en Git:

```bash
export SUPABASE_TEST_URL=http://127.0.0.1:54321
export SUPABASE_TEST_ANON_KEY='valor-publico-del-stack-local'
export SUPABASE_INTEGRATION_REQUIRED=true
```

5. Ejecuta:

```bash
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run test:pages
```

Con `SUPABASE_INTEGRATION_REQUIRED=true`, una configuración ausente hace fallar integración y E2E en vez de omitirlos. No apuntes estas suites a producción: crean, modifican y eliminan registros.

## Capas de prueba

- `tests/unit` y `tests/component`: dominio, store, UI, Error Boundaries, SW, backups y PDF.
- `tests/integration`: tablas, RPC, RLS, Realtime, locks, enlaces públicos, workspace y delete real.
- `tests/e2e`: flujos de navegador con Supabase real, desktop y mobile.
- `tests/pages`: build real bajo `/show_axe/`, assets/chunks, ruta pública, accesibilidad y offline posterior.
- `supabase/scripts/verify-sql-native.sh`: verificación SQL alternativa; no sustituye PostgREST/Realtime real.

## Convenciones

- Mantén commits pequeños con formato `type: resumen`, por ejemplo `test: cover backup validation`.
- No cambies políticas de sync, locks, conflictos, eliminación, auth o reglas de Input List sin una decisión aprobada.
- Añade pruebas al corregir una regresión.
- No marques aceptación basándote solo en revisión de código; registra test o CI.

## Pull requests

Incluye alcance, riesgo, comandos ejecutados, conteos passed/failed/skipped/retries, estado de secretos y limitaciones conocidas. No hagas merge, tag o release desde un PR de milestone sin aprobación explícita.
