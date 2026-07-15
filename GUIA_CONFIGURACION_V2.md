# Configurar y publicar Ori♡n Shows V2

Esta guía está pensada para quien administrará la instalación. No necesitas programar, pero sí acceso al repositorio de GitHub y a un proyecto Supabase.

## 1. Crear Supabase

1. Entra a [Supabase](https://supabase.com/dashboard) y crea un proyecto nuevo.
2. Espera a que termine la preparación.
3. Abre **SQL Editor**.
4. Copia y ejecuta todo `supabase/SETUP.sql` para una instalación nueva.
5. Copia y ejecuta `supabase/VERIFY.sql`. Todas las comprobaciones deben terminar correctamente.
6. En **Connect** copia:
   - Project URL, con forma `https://PROYECTO.supabase.co`;
   - publishable key (`sb_publishable_...`) o la anon key heredada.

Nunca copies una secret key ni una service-role key. La clave pública está diseñada para aparecer en el navegador; la protección depende de RLS.

## 2. Entender el acceso

V2 no tiene cuentas. Las políticas instaladas permiten a cualquier visitante con la URL principal leer, crear, editar y eliminar el espacio compartido. Los enlaces `/public/...` muestran una vista de solo lectura, pero los datos del proyecto no deben considerarse privados.

## 3. Configurar GitHub

En el repositorio abre **Settings → Secrets and variables → Actions → Variables** y crea:

- `SUPABASE_URL`: Project URL.
- `SUPABASE_PUBLISHABLE_KEY`: publishable/anon key pública.

Son variables públicas, no Secrets, porque terminan en `config.js` descargado por el navegador. No crees una variable de service-role.

Luego abre **Settings → Pages** y selecciona **GitHub Actions** como Source.

## 4. Publicar en GitHub Pages

1. Asegúrate de que el PR de release esté aprobado, fusionado y que CI esté verde.
2. Abre **Actions → Deploy GitHub Pages → Run workflow**.
3. Selecciona `main` y confirma.
4. Espera a que `build-and-deploy` termine en verde.
5. Abre `https://<usuario>.github.io/show_axe/`.

El workflow compila para `/show_axe/`, genera `config.js` desde las variables públicas, escanea secretos y publica `dist/`. Un dominio personalizado es opcional; si se usa, vuelve a validar base, rutas y scope del Service Worker.

## 5. Comprobar la publicación

En una ventana privada:

1. Abre la URL principal y confirma que no aparece Setup.
2. Crea un Show de prueba y espera **Guardado en línea**.
3. Ábrelo en otro navegador y confirma la sincronización.
4. Prueba su enlace público.
5. Exporta PDF vertical y horizontal.
6. Recarga una vez online; después activa modo sin conexión y recarga de nuevo.
7. Vuelve online y confirma que la cola se vacía.

La primera visita sin conexión no funciona. El offline posterior depende de que el navegador haya cargado y cacheado los chunks necesarios.

## 6. Actualizar una instalación

1. Exporta JSON desde **Preferencias → Exportar JSON**.
2. Conserva un backup de Supabase si el plan lo permite.
3. Aplica primero las migraciones nuevas, en orden, y ejecuta `VERIFY.sql`.
4. Despliega el frontend con el workflow.
5. Las pestañas abiertas mostrarán **Nueva versión disponible**; usa **Actualizar ahora** cuando no haya edición crítica en curso.
6. Repite la comprobación de la sección anterior.

La versión sale de `package.json`; el build y el cache del Service Worker la reciben automáticamente.

## 7. Backups e importación

- **Exportar JSON** descarga Shows, Biblioteca, Presets y Preferencias; no contiene claves, locks ni cola de sync.
- **Importar JSON → Fusionar** conserva IDs no coincidentes y deja ganar al respaldo en IDs coincidentes.
- **Reemplazar todo** sustituye el contenido local por el respaldo.
- Antes de cualquier importación la app crea una copia local de emergencia.
- Los backups automáticos del navegador se limitan a los 10 más recientes.

Si Supabase está caído, no borres los datos del sitio. Trabaja solo si entiendes el riesgo, exporta JSON cuando sea posible y espera la reconexión. Consulta [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## 8. Rollback

No limpies IndexedDB ni caches como primer paso. Sigue [docs/ROLLBACK_2.0.0.md](docs/ROLLBACK_2.0.0.md): conserva datos, restaura schema si corresponde, redespliega un SHA conocido y valida antes de reabrir edición.
