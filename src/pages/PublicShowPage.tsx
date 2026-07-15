import { Calendar, Check, Clock, Headphones, ListOrdered, Package, Users } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, EmptyState, ProgressBar } from '../components/ui'
import { fetchRemoteShowBySlug, getSupabase, remoteRowToShow } from '../lib/supabase'
import { formatDate, formatTime, scheduleDuration } from '../lib/utils'
import type { Show } from '../types'

export default function PublicShowPage() {
  const { slug = '' } = useParams()
  const [show, setShow] = useState<Show>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const row = await fetchRemoteShowBySlug(slug)
        if (active) setShow(row ? remoteRowToShow(row) : undefined)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'No fue posible abrir el show.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    const supabase = getSupabase()
    const channel = supabase?.channel(`public-show-${slug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orion_shows', filter: `public_slug=eq.${slug}` }, () => void load())
      .subscribe()
    return () => {
      active = false
      if (supabase && channel) void supabase.removeChannel(channel)
    }
  }, [slug])

  const categories = useMemo(() => show ? [...show.equipmentCategories].sort((a, b) => a.order - b.order) : [], [show])
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--text)]" /><p className="text-sm muted">Abriendo show…</p></div></div>
  if (!show) return <div className="mx-auto flex min-h-screen max-w-xl items-center px-4"><EmptyState title="Show no disponible" description={error || 'El enlace no existe o el show fue eliminado.'} /></div>

  const checked = show.equipment.filter((item) => item.checked).length
  const progress = show.equipment.length ? Math.round(checked / show.equipment.length * 100) : 0
  return <div className="min-h-screen px-4 py-8 sm:px-6 lg:py-12">
    <main className="mx-auto max-w-6xl">
      <header className="mb-7"><div className="mb-4 flex items-center justify-between gap-3"><div className="text-sm font-semibold tracking-tight">Ori♡n Shows</div><Badge>Vista pública · solo lectura</Badge></div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{show.name}</h1><div className="mt-4 flex flex-wrap gap-2">{show.date && <Badge>{formatDate(show.date, 'dd/MM/yyyy')}</Badge>}{show.time && <Badge>{formatTime(show.time, '24h')}</Badge>}{show.showType && <Badge>{show.showType}</Badge>}{show.archived && <Badge>Archivado</Badge>}</div></header>

      <div className="mb-5 grid gap-4 sm:grid-cols-3"><Stat icon={<Calendar size={17} />} label="Fecha" value={formatDate(show.date, 'dd/MM/yyyy')} /><Stat icon={<Clock size={17} />} label="Hora" value={formatTime(show.time, '24h')} /><div className="panel p-4"><div className="mb-2 flex items-center justify-between text-xs muted"><span>Equipo listo</span><span>{checked}/{show.equipment.length}</span></div><ProgressBar value={progress} /><div className="mt-2 text-sm font-semibold">{progress}%</div></div></div>

      {show.note && <section className="panel mb-5 p-5"><h2 className="mb-2 font-semibold">Información general</h2><p className="whitespace-pre-wrap text-sm muted">{show.note}</p></section>}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel overflow-hidden"><SectionTitle icon={<Package size={17} />} title="Equipo" subtitle={`${show.equipment.length} elementos`} />{!show.equipment.length ? <EmptyRows text="No hay equipo registrado." /> : <div className="divide-y divide-[var(--line)]">{categories.map((category) => { const items = show.equipment.filter((item) => item.categoryId === category.id).sort((a, b) => a.order - b.order); if (!items.length) return null; return <div key={category.id}><div className="bg-[var(--panel-2)] px-5 py-2 text-xs font-semibold uppercase tracking-wide muted">{category.name}</div>{items.map((item) => <div key={item.id} className="flex gap-3 px-5 py-3"><div className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded border ${item.checked ? 'border-[var(--success)] text-[var(--success)]' : 'border-[var(--line)]'}`}>{item.checked && <Check size={13} />}</div><div className="min-w-0"><div className="text-sm font-medium">{item.quantity} × {item.name}{item.unit ? ` ${item.unit}` : ''}</div>{item.assignments?.some((assignment) => assignment.use) && <div className="mt-1 text-xs muted">{item.assignments.filter((assignment) => assignment.use).map((assignment) => assignment.use).join(' · ')}</div>}{item.notes && <div className="mt-1 text-xs muted">{item.notes}</div>}</div></div>)}</div>})}</div>}</section>

        <section className="panel overflow-hidden"><SectionTitle icon={<Users size={17} />} title="Personas" subtitle={`${show.people.length} registradas`} />{!show.people.length ? <EmptyRows text="No hay personas registradas." /> : <div className="divide-y divide-[var(--line)]">{[...show.people].sort((a,b) => a.order-b.order).map((person) => <div key={person.id} className="px-5 py-4"><div className="text-sm font-medium">{person.name}</div><div className="mt-1 text-xs muted">{[person.company, ...person.roleNames, ...person.typeNames].filter(Boolean).join(' · ') || 'Sin función registrada'}</div>{person.phones.length > 0 && <div className="mt-2 text-xs">{person.phones.join(' · ')}</div>}{person.emails.length > 0 && <div className="mt-1 text-xs">{person.emails.join(' · ')}</div>}</div>)}</div>}</section>

        <section className="panel overflow-hidden"><SectionTitle icon={<Clock size={17} />} title="Horarios" subtitle={`${show.schedule.length} hitos`} />{!show.schedule.length ? <EmptyRows text="No hay horarios registrados." /> : <div className="divide-y divide-[var(--line)]">{[...show.schedule].sort((a,b)=>a.startTime.localeCompare(b.startTime)).map((item,index,array) => <div key={item.id} className="flex gap-4 px-5 py-4"><div className="w-14 flex-none text-sm font-semibold tabular-nums">{item.startTime}</div><div><div className="text-sm font-medium">{item.name}</div><div className="mt-1 text-xs muted">{item.endTime ? `Hasta ${item.endTime}` : array[index+1] ? `Hasta ${array[index+1].startTime}` : 'Sin hora final'}{scheduleDuration(item,array[index+1]) ? ` · ${scheduleDuration(item,array[index+1])}` : ''}</div>{item.notes && <div className="mt-1 text-xs muted">{item.notes}</div>}</div></div>)}</div>}</section>

        <section className="panel overflow-hidden"><SectionTitle icon={<ListOrdered size={17} />} title="Input list" subtitle={show.inputList ? `${show.inputList.rows.length} entradas` : 'Sin configurar'} />{!show.inputList ? <EmptyRows text="El input list todavía no está configurado." /> : <div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-[var(--panel-2)] muted"><tr><th className="px-4 py-2">CH</th><th className="px-4 py-2">Uso</th><th className="px-4 py-2">Equipo</th><th className="px-4 py-2">48V</th><th className="px-4 py-2">Patch</th></tr></thead><tbody className="divide-y divide-[var(--line)]">{[...show.inputList.rows].sort((a,b)=>a.order-b.order).map((row) => <tr key={row.id}><td className="px-4 py-2 font-semibold">{row.channel}</td><td className="px-4 py-2">{row.use}</td><td className="px-4 py-2">{row.equipment}</td><td className="px-4 py-2">{row.phantom ? 'Sí' : 'No'}</td><td className="px-4 py-2">{row.patch || '—'}</td></tr>)}</tbody></table></div>{show.inputList.returns.length > 0 && <div className="border-t border-[var(--line)]"><div className="flex items-center gap-2 px-5 py-3 text-sm font-semibold"><Headphones size={16} />Retornos</div><div className="divide-y divide-[var(--line)]">{[...show.inputList.returns].sort((a,b)=>a.order-b.order).map((item)=><div key={item.id} className="flex justify-between gap-3 px-5 py-3 text-sm"><span>{item.destination || 'Sin destino'} · {item.system || 'Sistema'}</span><span className="font-medium">AUX {item.stereo ? `${item.outputStart}–${item.outputStart+1}` : item.outputStart}</span></div>)}</div></div>}</div>}</section>
      </div>
      <footer className="mt-8 text-center text-xs muted">Última actualización: {new Date(show.updatedAt).toLocaleString()} · Ori♡n Shows</footer>
    </main>
  </div>
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="panel p-4"><div className="flex items-center gap-2 text-xs muted">{icon}{label}</div><div className="mt-2 text-sm font-semibold">{value}</div></div> }
function SectionTitle({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) { return <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4"><div className="flex items-center gap-2 font-semibold">{icon}{title}</div><div className="text-xs muted">{subtitle}</div></div> }
function EmptyRows({ text }: { text: string }) { return <div className="p-8 text-center text-sm muted">{text}</div> }
