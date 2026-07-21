import { Cloud, Database, ExternalLink, ShieldAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { getRuntimeConfig, isSupportedSupabaseUrl, saveLocalRuntimeConfig } from '../lib/config'
import { branding } from '../lib/branding'
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

  return <div className="min-h-screen px-4 py-10 sm:px-6 lg:py-16">
    <div className="mx-auto max-w-3xl">
      <div className="mb-10 border-b-2 border-[var(--strong-line)] pb-6 text-center"><div className="text-5xl font-black uppercase leading-none tracking-[-.065em] sm:text-7xl">{branding.name}</div><p className="mt-3 font-mono text-[10px] uppercase tracking-[.18em] muted">Configuración inicial de la versión compartida</p></div>
      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <form onSubmit={submit} className="panel signal-rule p-6 shadow-[6px_6px_0_var(--shadow-ink)]">
          <div className="mb-5 flex h-11 w-11 items-center justify-center border-2 border-[var(--strong-line)] bg-[var(--accent)] text-white"><Cloud size={21} /></div>
          <h1 className="text-3xl font-black uppercase tracking-[-.04em]">Conectar Supabase</h1>
          <p className="mt-2 text-sm muted">Esta versión no utiliza cuentas. Todas las personas que abran la URL principal compartirán y podrán editar los mismos datos.</p>
          <div className="mt-6 space-y-4">
            <Field label="Project URL"><Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://tu-proyecto.supabase.co" autoComplete="off" /></Field>
            <Field label="Publishable key"><Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="sb_publishable_…" autoComplete="off" /></Field>
            {error && <div role="alert" className="danger-panel border-2 p-3 text-sm font-bold">{error}</div>}
            <Button type="submit" className="w-full"><Database size={16} />Guardar y abrir</Button>
          </div>
          <p className="mt-4 text-xs muted">Para una publicación en GitHub Pages, coloca estos valores en <code>config.js</code>. Así ningún visitante tendrá que configurarlos manualmente.</p>
        </form>
        <div className="space-y-5">
          <section className="panel p-5"><h2 className="font-semibold">Antes de conectar</h2><ol className="mt-4 space-y-3 text-sm muted"><li><strong className="text-[var(--text)]">1.</strong> Crea un proyecto en Supabase.</li><li><strong className="text-[var(--text)]">2.</strong> Ejecuta el archivo <code>supabase/SETUP.sql</code> en SQL Editor.</li><li><strong className="text-[var(--text)]">3.</strong> Copia la Project URL y la publishable key desde Connect.</li></ol><a className="mt-4 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Abrir Supabase <ExternalLink size={14} /></a></section>
          <section className="panel warning-panel p-5"><div className="flex gap-3"><ShieldAlert className="mt-0.5 flex-none" size={20} /><div><h2 className="font-semibold">Acceso abierto por diseño</h2><p className="mt-2 text-sm opacity-80">No pegues una secret key ni service-role key. Esta aplicación usa una publishable key y políticas anónimas deliberadamente abiertas porque decidiste que cualquiera con la URL principal pueda editar.</p></div></div></section>
        </div>
      </div>
    </div>
  </div>
}
