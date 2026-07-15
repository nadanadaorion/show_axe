import { Cloud, Download, HardDrive, RefreshCw, ShieldAlert, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useAppStore, type ImportMode } from '../store'
import { db } from '../lib/db'
import { downloadJson, isAppSnapshot } from '../lib/utils'
import type { BackupRecord, DateFormat, InitialModule, Language, TimeFormat } from '../types'
import { Button, Label, Modal, PageHeader, Select } from '../components/ui'
import { SyncStatusBadge } from '../components/SyncController'
import { clearLocalRuntimeConfig, getRuntimeConfig, runtimeConfigComesFromFile } from '../lib/config'
import { useToast } from '../components/Toast'

export default function SettingsPage() {
  const { showToast } = useToast()
  const preferences = useAppStore((state) => state.preferences)
  const updatePreferences = useAppStore((state) => state.updatePreferences)
  const snapshot = useAppStore((state) => state.snapshot)
  const importSnapshot = useAppStore((state) => state.importSnapshot)
  const createBackup = useAppStore((state) => state.createBackup)
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof snapshot>>()
  const fileRef = useRef<HTMLInputElement>(null)

  const loadBackups = async () => setBackups(await db.backups.orderBy('createdAt').reverse().toArray())
  useEffect(() => { void loadBackups() }, [])

  const exportData = () => {
    const data = snapshot()
    downloadJson(`orion-shows-respaldo-${new Date().toISOString().slice(0, 10)}.json`, data)
    showToast('Respaldo JSON exportado')
  }

  const readImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isAppSnapshot(parsed)) throw new Error('Formato no válido')
      setPendingImport(parsed)
    } catch {
      showToast('El archivo no es un respaldo válido de Ori♡n Shows')
    }
  }

  const restoreBackup = (backup: BackupRecord) => {
    importSnapshot(backup.snapshot, 'replace')
    showToast('Respaldo local restaurado')
  }

  const runtime = getRuntimeConfig()
  const configuredInFile = runtimeConfigComesFromFile()

  return <>
    <PageHeader title="Preferencias y respaldos" description="Configuración del espacio compartido, visualización y copias portables." />
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="panel p-5 lg:col-span-2"><div className="grid gap-5 lg:grid-cols-[1fr_340px]"><div><div className="mb-3 flex items-center gap-2"><Cloud size={18} /><h2 className="font-semibold">Espacio compartido en Supabase</h2></div><p className="text-sm muted">Todos los dispositivos conectados a esta instalación comparten Shows, Biblioteca, Presets y Preferencias.</p><div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-4 text-xs"><div className="font-medium">{runtime.supabaseUrl.replace(/^https?:\/\//, '')}</div><div className="mt-1 muted">Configurado {configuredInFile ? 'mediante config.js' : 'en este navegador'}.</div></div><div className="mt-4 flex gap-3 rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100"><ShieldAlert className="mt-0.5 flex-none" size={18} /><p className="text-xs opacity-85">No hay cuentas ni autenticación. Cualquier persona con la URL principal puede editar o eliminar la información. Los enlaces públicos de cada show son de solo lectura.</p></div>{!configuredInFile && <Button className="mt-4" variant="secondary" size="sm" onClick={() => { clearLocalRuntimeConfig(); window.location.reload() }}>Cambiar conexión</Button>}</div><div><SyncStatusBadge /></div></div></section>
      <section className="panel p-5"><h2 className="mb-1 font-semibold">Preferencias</h2><p className="mb-5 text-sm muted">Se sincronizan con el espacio compartido.</p><div className="space-y-4"><div><Label>Módulo inicial</Label><Select value={preferences.initialModule} onChange={(event) => updatePreferences({ initialModule: event.target.value as InitialModule })}><option value="shows">Shows</option><option value="library">Biblioteca</option><option value="presets">Presets</option></Select></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Formato de fecha</Label><Select value={preferences.dateFormat} onChange={(event) => updatePreferences({ dateFormat: event.target.value as DateFormat })}><option value="dd/MM/yyyy">DD/MM/AAAA</option><option value="MM/dd/yyyy">MM/DD/AAAA</option><option value="yyyy-MM-dd">AAAA-MM-DD</option></Select></div><div><Label>Formato de hora</Label><Select value={preferences.timeFormat} onChange={(event) => updatePreferences({ timeFormat: event.target.value as TimeFormat })}><option value="24h">24 horas</option><option value="12h">12 horas</option></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Idioma</Label><Select value={preferences.language} onChange={(event) => updatePreferences({ language: event.target.value as Language })}><option value="es">Español</option><option value="en">English (estructura preparada)</option></Select></div><div><Label>Apariencia</Label><Select value={preferences.theme} onChange={(event) => updatePreferences({ theme: event.target.value as 'light' | 'dark' | 'system' })}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></Select></div></div><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-4"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={preferences.showInputListWarnings} onChange={(event) => updatePreferences({ showInputListWarnings: event.target.checked })} /><div><div className="text-sm font-medium">Advertir al abrir el input list con equipo pendiente</div><div className="mt-1 text-xs muted">Puede desactivarse desde la advertencia y reactivarse aquí.</div></div></label></div></section>

      <section className="panel p-5"><h2 className="mb-1 font-semibold">Respaldo portable</h2><p className="mb-5 text-sm muted">Exporta toda la aplicación a JSON o importa un respaldo anterior.</p><div className="grid gap-3 sm:grid-cols-2"><Button onClick={exportData}><Download size={16} />Exportar JSON</Button><Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={16} />Importar JSON</Button><input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={readImport} /></div><div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-4 text-xs muted"><strong className="mb-1 block text-[var(--text)]">Incluye</strong>Shows, Biblioteca, Presets y Preferencias. La importación valida la estructura antes de modificar los datos.</div></section>

      <section className="panel overflow-hidden lg:col-span-2"><div className="flex flex-col gap-3 border-b border-[var(--line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Respaldos automáticos locales</h2><p className="text-sm muted">Se conserva una rotación de hasta 10 copias dentro de este navegador.</p></div><Button variant="secondary" size="sm" onClick={async () => { await createBackup('Manual'); await loadBackups(); showToast('Respaldo local creado') }}><HardDrive size={15} />Crear ahora</Button></div>{!backups.length ? <div className="p-8 text-center text-sm muted">Todavía no hay respaldos locales.</div> : <div className="divide-y divide-[var(--line)]">{backups.map((backup) => <div key={backup.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-medium">{new Date(backup.createdAt).toLocaleString()}</div><div className="text-xs muted">{backup.reason} · {backup.snapshot.shows.length} shows · {backup.snapshot.presets.length} presets</div></div><div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => restoreBackup(backup)}><RefreshCw size={14} />Restaurar</Button><Button variant="danger" size="icon" onClick={async () => { await db.backups.delete(backup.id); await loadBackups() }} aria-label="Eliminar respaldo"><Trash2 size={14} /></Button></div></div>)}</div>}</section>
    </div>
    <ImportModal open={Boolean(pendingImport)} onClose={() => setPendingImport(undefined)} onImport={(mode) => { if (pendingImport) { importSnapshot(pendingImport, mode); setPendingImport(undefined); showToast(mode === 'replace' ? 'Datos reemplazados correctamente' : 'Datos fusionados correctamente') } }} />
  </>
}

function ImportModal({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (mode: ImportMode) => void }) {
  const [mode, setMode] = useState<ImportMode>('merge')
  return <Modal open={open} title="Importar respaldo" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => onImport(mode)}>Importar</Button></>}><div className="space-y-3"><label className="flex cursor-pointer gap-3 rounded-xl border border-[var(--line)] p-4"><input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /><div><div className="text-sm font-medium">Fusionar</div><p className="mt-1 text-xs muted">Agrega el contenido importado y actualiza elementos que compartan el mismo identificador.</p></div></label><label className="flex cursor-pointer gap-3 rounded-xl border border-[var(--line)] p-4"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /><div><div className="text-sm font-medium">Reemplazar todo</div><p className="mt-1 text-xs muted">Sustituye por completo los datos actuales. Conviene exportar un respaldo antes.</p></div></label></div></Modal>
}
