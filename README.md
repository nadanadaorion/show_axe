# Ori♡n Shows

Ori♡n Shows V2 es una aplicación local-first para preparar shows en vivo. Guarda una copia en el navegador, sincroniza un espacio compartido abierto en Supabase y publica vistas de solo lectura por enlace. No usa cuentas: quien tenga la URL principal puede leer, editar y eliminar datos.

La versión candidata es **2.0.0**. No es una release publicada hasta que el PR de Milestone 4 sea aprobado, fusionado y etiquetado de forma explícita.

## Inicio rápido de desarrollo

Requisitos: Node.js 22 y npm.

```bash
npm ci
npm run dev
```

Sin configuración aparece la pantalla para conectar Supabase. Para pruebas locales completas, usa el stack local descrito en [CONTRIBUTING.md](CONTRIBUTING.md).

## Verificación

```bash
npm run lint
npm run test
npm run typecheck:tests
npm run build
npm run check:secrets
```

El gate completo también incluye Supabase desde una base vacía, integración real, Playwright desktop/mobile y el build de GitHub Pages. La ruta exacta está en [BUILD_VERIFICATION.md](BUILD_VERIFICATION.md).

## Documentación por audiencia

- Uso cotidiano, backups y offline: [GUIA_USO.md](GUIA_USO.md)
- Configuración y despliegue para una persona no técnica: [GUIA_CONFIGURACION_V2.md](GUIA_CONFIGURACION_V2.md)
- Desarrollo y pruebas: [CONTRIBUTING.md](CONTRIBUTING.md)
- Operación, actualización y rollback: [docs/20-DEPLOYMENT_AND_OPERATIONS.md](docs/20-DEPLOYMENT_AND_OPERATIONS.md)
- Crear Supabase desde cero: [docs/15-SUPABASE_AND_DATABASE.md](docs/15-SUPABASE_AND_DATABASE.md)
- Problemas comunes: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- Notas de la candidata: [docs/RELEASE_NOTES_2.0.0.md](docs/RELEASE_NOTES_2.0.0.md)

## Seguridad y límites importantes

- Solo se usa la Project URL y una publishable/anon key. Nunca coloques una `service-role` o secret key en la app, GitHub o `config.js`.
- Las políticas RLS son públicas deliberadamente para el editor. La publishable key no convierte los datos en privados.
- La primera visita requiere conexión. El uso offline funciona después de una carga online controlada por el Service Worker.
- Los cambios offline se conservan en IndexedDB y se encolan; borrar datos del sitio puede destruir cambios aún no sincronizados.
- Las colisiones de outputs de retornos no se validan en V2.0.
- La semántica de Undo cuando una eliminación ya alcanzó Supabase sigue abierta; no se cambió en Milestone 4.

## Despliegue

El workflow manual `Deploy GitHub Pages` compila con base `/show_axe/`, genera `dist/config.js` desde variables públicas de GitHub y despliega el artefacto. Consulta la guía antes de ejecutarlo. El despliegue, tag y GitHub Release requieren aprobación explícita.
