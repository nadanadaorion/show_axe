# Guía de configuración — Ori♡n Shows V2.0.0

## 1. Crear la base compartida

1. Entra al Dashboard de Supabase y crea un proyecto.
2. Espera a que termine la preparación de la base.
3. Abre **SQL Editor** y crea una consulta nueva.
4. Copia y ejecuta todo `supabase/SETUP.sql`.
5. Confirma que aparezcan las tablas:
   - `orion_workspace`
   - `orion_shows`
   - `orion_show_locks`

El archivo es idempotente: puede volver a ejecutarse para reparar funciones y políticas sin borrar los shows.

## 2. Obtener la conexión

Desde **Connect** o **Project Settings → API Keys**, copia:

- Project URL.
- Publishable key.

No uses `sb_secret_...` ni service-role. Una clave secreta expuesta en GitHub comprometería el proyecto.

## 3A. Versión portable

1. Ejecuta `CONFIGURAR_SUPABASE.bat`.
2. Pega la Project URL.
3. Pega la publishable key.
4. Ejecuta `INICIAR_PORTABLE.bat`.
5. Mantén abierta la consola mientras utilizas el servidor local.

## 3B. GitHub Pages

1. Descomprime el paquete para GitHub Pages.
2. Abre `config.js` con un editor de texto.
3. Sustituye los dos valores vacíos.
4. Sube `index.html`, `config.js`, `sw.js`, `assets/` y los demás archivos a la raíz del repositorio.
5. En **Settings → Pages** selecciona:
   - Source: Deploy from a branch.
   - Branch: main.
   - Folder: /(root).
6. Espera el despliegue y abre la dirección publicada.

## 4. Primer uso

V2 utiliza una base local distinta de V1, por lo que comienza sin shows. La Biblioteca incluye únicamente categorías iniciales de apoyo.

La importación de un respaldo anterior sigue disponible en **Preferencias → Importar JSON**, pero no se ejecuta automáticamente.

## 5. Cómo funciona el bloqueo

- Al abrir un show con conexión, el dispositivo obtiene un bloqueo.
- Otro dispositivo verá que el show está en edición y no podrá forzar el acceso.
- El bloqueo se renueva mientras existe actividad.
- Se libera al regresar a la lista de shows.
- Si la pestaña desaparece sin liberar correctamente, expira a los 10 minutos de la última actividad.
- Sin conexión se permite editar. Al reconectar pueden aparecer conflictos.

## 6. Conflictos offline

Cuando el mismo show cambió localmente y en Supabase, la aplicación muestra:

- **Conservar versión en línea:** descarta el cambio local.
- **Conservar versión local:** reemplaza la versión en línea cuando el show quede disponible.

No se genera una tercera copia.

## 7. Enlaces públicos

Dentro de un show, pulsa **Compartir**. El enlace:

- Es permanente mientras exista el show.
- Refleja la versión actualizada.
- Sigue funcionando al archivar.
- Deja de funcionar al eliminar.
- Muestra Equipo, Personas, Horarios e Input List en modo de consulta.

## 8. Trabajo offline

La primera visita debe realizarse con conexión para que el Service Worker guarde la aplicación. Después:

- La interfaz puede abrirse sin internet.
- Los datos se guardan en IndexedDB.
- El indicador lateral muestra cambios pendientes.
- Al volver internet, la cola se procesa automáticamente.

## 9. Reiniciar datos

`supabase/RESET_DATA.sql` elimina los datos en línea y conserva la estructura. Úsalo únicamente cuando quieras comenzar de cero. Los navegadores con cambios offline pendientes podrían volver a subir información al reconectar; limpia también los datos del sitio o abre una instalación nueva.
