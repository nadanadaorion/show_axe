import { Cloud, Database, ExternalLink, ShieldAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { getRuntimeConfig, isSupportedSupabaseUrl, saveLocalRuntimeConfig } from '../lib/config'
import { Button, Field, Input } from '../components/ui'

export default function SetupPage() {
  const current = getRuntimeConfig()
  const [url, setUrl] = useState(current.supabaseUrl)
  const [key, setKey] = useState(current.supabasePublishableKey)
  const [error, setError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!isSupportedSupabaseUrl(url.trim())) {
      setError('Escribe una URL válida de proyecto Supabase.')
      return
    }
    if (key.trim().length < 20) {
      setError('Escribe la publishable key o anon key del proyecto.')
      return
    }
    saveLocalRuntimeConfig({ supabaseUrl: url, supabasePublishableKey: key })
    window.location.reload()
  }

  return <div className="min-h-screen px-4 py-10 sm:px-6">
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 text-center"><div className="text-2xl font-semibold tracking-tight">Ori♡n Shows</div><p className="mt-2 text-sm muted">Configuración inicial de la versión compartida</p></div>
      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <form onSubmit={submit} className="panel p-6">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--panel-2)]"><Cloud size={21} /></div>
          <h1 className="text-xl font-semibold">Conectar Supabase</h1>
          <p className="mt-2 text-sm muted">Esta versión no utiliza cuentas. Todas las personas que abran la URL principal compartirán y podrán editar los mismos datos.</p>
          <div className="mt-6 space-y-4">
            <Field label="Project URL"><Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://tu-proyecto.supabase.co" autoComplete="off" /></Field>
            <Field label="Publishable key"><Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="sb_publishable_…" autoComplete="off" /></Field>
            {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
            <Button type="submit" className="w-full"><Database size={16} />Guardar y abrir</Button>
          </div>
          <p className="mt-4 text-xs muted">Para una publicación en GitHub Pages, coloca estos valores en <code>config.js</code>. Así ningún visitante tendrá que configurarlos manualmente.</p>
        </form>
        <div className="space-y-5">
          <section className="panel p-5"><h2 className="font-semibold">Antes de conectar</h2><ol className="mt-4 space-y-3 text-sm muted"><li><strong className="text-[var(--text)]">1.</strong> Crea un proyecto en Supabase.</li><li><strong className="text-[var(--text)]">2.</strong> Ejecuta el archivo <code>supabase/SETUP.sql</code> en SQL Editor.</li><li><strong className="text-[var(--text)]">3.</strong> Copia la Project URL y la publishable key desde Connect.</li></ol><a className="mt-4 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Abrir Supabase <ExternalLink size={14} /></a></section>
          <section className="panel border-amber-300/70 bg-amber-50 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100"><div className="flex gap-3"><ShieldAlert className="mt-0.5 flex-none" size={20} /><div><h2 className="font-semibold">Acceso abierto por diseño</h2><p className="mt-2 text-sm opacity-80">No pegues una secret key ni service-role key. Esta aplicación usa una publishable key y políticas anónimas deliberadamente abiertas porque decidiste que cualquiera con la URL principal pueda editar.</p></div></div></section>
        </div>
      </div>
    </div>
  </div>
}
