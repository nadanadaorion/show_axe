# Guía de uso de Ori♡n Shows V2

## Estado de guardado

- **Guardado en línea:** los cambios locales alcanzaron Supabase.
- **Sincronizando:** hay trabajo en curso.
- **Sin conexión / cambios pendientes:** la app conserva cambios en este navegador y los enviará al volver la red.
- **Conflicto:** el mismo Show cambió en dos lugares; elige mantener la versión local o la online.

No cierres ni borres los datos del navegador mientras haya cambios pendientes.

## Shows y enlaces

Crea un Show con solo nombre y completa Equipo, Personas, Información e Input List después. Archivar conserva el enlace público; eliminar lo invalida cuando la eliminación llega a Supabase.

La acción Undo inmediata puede cancelar o sustituir una eliminación que aún esté en cola. Si la eliminación ya se sincronizó remotamente, el resultado puede requerir resolución de conflicto; esa semántica sigue abierta en V2.0. Verifica **Guardado en línea** y el enlace público antes de asumir que el Show fue restaurado en todos los dispositivos.

## Input List y PDF

El Input List puede generarse desde los usos de Equipo y luego editarse. Conserva filas manuales, CH personalizados, phantom, patch y notas al sincronizar explícitamente desde Equipo. Los retornos mono usan una salida; los estéreo usan dos consecutivas.

V2.0 no detecta colisiones entre outputs de retornos. Revisa manualmente la numeración antes de exportar PDF vertical u horizontal.

## Offline

La primera visita debe ser online. Después de una carga y recarga online controlada por el Service Worker, la app puede reabrir su shell offline y usar datos locales. Una pantalla lazy nunca visitada puede no estar disponible sin red hasta que se haya descargado al menos una vez.

Los locks no pueden verificarse offline. Dos personas pueden editar el mismo Show y producir un conflicto al reconectar. La app nunca debe borrar IndexedDB durante una actualización del Service Worker.

## Backups

En **Preferencias y respaldos**:

- **Exportar JSON** crea una copia portable completa.
- **Importar JSON** valida el archivo antes de mostrar Fusionar/Reemplazar.
- La app crea un backup local antes de importar.
- **Crear ahora** guarda una copia en este navegador.
- Se conservan hasta 10 backups automáticos/locales recientes.

Los backups locales desaparecen si borras los datos del sitio. Descarga JSON antes de una actualización importante. La pantalla de error global también ofrece **Exportar respaldo** cuando el estado puede leerse con seguridad.

## Actualizaciones

Cuando aparezca **Nueva versión disponible**, termina la edición crítica y pulsa **Actualizar ahora**. La app activa el worker en espera y recarga una vez. Si falla, ofrece reintentar; no debe entrar en un loop de recarga.

## Ayuda

Consulta [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) para configuración, sync, offline, importación, PDF y recuperación.
