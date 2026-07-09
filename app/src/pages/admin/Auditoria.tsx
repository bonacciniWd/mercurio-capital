import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/Badge'
import { Download, ChevronDown, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// =============================================
// Tipos
// =============================================
type AuditRow = {
  id: string
  usuario_id: string | null
  acao: string
  entidade: string
  entidade_id: string | null
  payload_antes: Record<string, unknown> | null
  payload_depois: Record<string, unknown> | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

type UsuarioLite = {
  id: string
  email: string
  nome_completo: string | null
}

type EnrichedRow = AuditRow & {
  usuario_email: string
  usuario_nome: string
}

// =============================================
// Helpers
// =============================================
const PAGE_SIZE = 100

const ACAO_VARIANT: Record<string, 'green' | 'blue' | 'red' | 'gold' | 'gray'> = {
  insert: 'green',
  update: 'blue',
  delete: 'red',
}

function actionVariant(acao: string) {
  return ACAO_VARIANT[acao.toLowerCase()] ?? 'gold'
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function fmtJson(payload: unknown) {
  if (payload == null) return '—'
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

function describe(row: EnrichedRow) {
  const acao = row.acao.toLowerCase()
  const id = row.entidade_id ? row.entidade_id.slice(0, 8) : ''
  const suffix = id ? ` #${id}` : ''
  switch (acao) {
    case 'insert':
      return `Novo registro em ${row.entidade}${suffix}`
    case 'update':
      return `Atualização em ${row.entidade}${suffix}`
    case 'delete':
      return `Remoção em ${row.entidade}${suffix}`
    default:
      return `${row.acao} em ${row.entidade}${suffix}`
  }
}

function startOfDayISO(offsetDays = 0) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - offsetDays)
  return d.toISOString()
}

function toCSV(rows: EnrichedRow[]) {
  const headers = ['created_at', 'usuario_email', 'acao', 'entidade', 'entidade_id', 'ip']
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(';')]
  for (const r of rows) {
    lines.push(
      [r.created_at, r.usuario_email, r.acao, r.entidade, r.entidade_id ?? '', r.ip ?? '']
        .map(esc)
        .join(';'),
    )
  }
  return lines.join('\n')
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// =============================================
// Componente
// =============================================
export function AdminAuditoria() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [usuarioFilter, setUsuarioFilter] = useState('')
  const [acaoFilter, setAcaoFilter] = useState('')
  const [entidadeFilter, setEntidadeFilter] = useState('')

  // ------- Query principal (eventos filtrados) -------
  const eventsQuery = useQuery({
    queryKey: ['admin', 'audit', { dateFrom, dateTo, usuarioFilter, acaoFilter, entidadeFilter }],
    queryFn: async (): Promise<EnrichedRow[]> => {
      let q = supabase
        .from('audit_log')
        .select(
          'id, usuario_id, acao, entidade, entidade_id, payload_antes, payload_depois, ip, user_agent, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString())
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        q = q.lte('created_at', to.toISOString())
      }
      if (usuarioFilter) q = q.eq('usuario_id', usuarioFilter)
      if (acaoFilter) q = q.eq('acao', acaoFilter)
      if (entidadeFilter) q = q.eq('entidade', entidadeFilter)

      const { data, error } = await q
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as AuditRow[]

      // Enriquecer com usuário (email/nome) — RLS admin_full_usuarios permite
      const userIds = Array.from(new Set(rows.map((r) => r.usuario_id).filter(Boolean))) as string[]
      let usersMap = new Map<string, UsuarioLite>()
      if (userIds.length > 0) {
        const { data: users, error: uerr } = await supabase
          .from('usuarios')
          .select('id, email, nome_completo')
          .in('id', userIds)
        if (uerr) throw new Error(uerr.message)
        usersMap = new Map((users ?? []).map((u) => [u.id as string, u as UsuarioLite]))
      }

      return rows.map<EnrichedRow>((r) => {
        const u = r.usuario_id ? usersMap.get(r.usuario_id) : undefined
        return {
          ...r,
          usuario_email: u?.email ?? (r.usuario_id ? '—' : 'sistema'),
          usuario_nome: u?.nome_completo ?? u?.email ?? 'sistema',
        }
      })
    },
  })

  // ------- KPIs (independentes dos filtros) -------
  const kpisQuery = useQuery({
    queryKey: ['admin', 'audit', 'kpis'],
    queryFn: async () => {
      const hojeIso = startOfDayISO(0)
      const semanaIso = startOfDayISO(6)

      const [hoje, semana, recent] = await Promise.all([
        supabase
          .from('audit_log')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', hojeIso),
        supabase
          .from('audit_log')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', semanaIso),
        supabase
          .from('audit_log')
          .select('usuario_id')
          .gte('created_at', semanaIso)
          .not('usuario_id', 'is', null)
          .limit(5000),
      ])

      if (hoje.error) throw new Error(hoje.error.message)
      if (semana.error) throw new Error(semana.error.message)
      if (recent.error) throw new Error(recent.error.message)

      const counts = new Map<string, number>()
      for (const r of (recent.data ?? []) as { usuario_id: string | null }[]) {
        if (!r.usuario_id) continue
        counts.set(r.usuario_id, (counts.get(r.usuario_id) ?? 0) + 1)
      }
      let topId: string | null = null
      let topCount = 0
      for (const [id, c] of counts) {
        if (c > topCount) {
          topId = id
          topCount = c
        }
      }

      let topUser: UsuarioLite | null = null
      if (topId) {
        const { data } = await supabase
          .from('usuarios')
          .select('id, email, nome_completo')
          .eq('id', topId)
          .maybeSingle()
        topUser = (data as UsuarioLite | null) ?? null
      }

      return {
        hoje: hoje.count ?? 0,
        semana: semana.count ?? 0,
        topUser,
        topCount,
      }
    },
  })

  // Opções derivadas para filtros (a partir dos eventos carregados)
  const { usuariosOptions, entidadesOptions } = useMemo(() => {
    const uMap = new Map<string, string>()
    const eSet = new Set<string>()
    for (const r of eventsQuery.data ?? []) {
      if (r.usuario_id) uMap.set(r.usuario_id, r.usuario_email)
      eSet.add(r.entidade)
    }
    return {
      usuariosOptions: Array.from(uMap.entries()).sort((a, b) => a[1].localeCompare(b[1])),
      entidadesOptions: Array.from(eSet).sort(),
    }
  }, [eventsQuery.data])

  const rows = eventsQuery.data ?? []
  const kpis = kpisQuery.data

  function handleExport() {
    if (rows.length === 0) return
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    downloadCSV(`auditoria-${stamp}.csv`, toCSV(rows))
  }

  function clearFilters() {
    setDateFrom('')
    setDateTo('')
    setUsuarioFilter('')
    setAcaoFilter('')
    setEntidadeFilter('')
  }

  const hasFilters = Boolean(dateFrom || dateTo || usuarioFilter || acaoFilter || entidadeFilter)

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Log de auditoria</h1>
          <p className="text-sm text-silver-600">
            Últimos {PAGE_SIZE} eventos registrados no sistema.
          </p>
        </div>
        <button
          type="button"
          className="btn-outline disabled:opacity-50"
          onClick={handleExport}
          disabled={rows.length === 0}
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card p-4 text-sm">
          <p className="text-silver-500">Hoje</p>
          <p className="text-2xl font-bold text-navy">
            {kpisQuery.isLoading ? '…' : `${kpis?.hoje ?? 0} eventos`}
          </p>
        </div>
        <div className="card p-4 text-sm">
          <p className="text-silver-500">Últimos 7 dias</p>
          <p className="text-2xl font-bold text-navy">
            {kpisQuery.isLoading ? '…' : `${kpis?.semana ?? 0} eventos`}
          </p>
        </div>
        <div className="card p-4 text-sm">
          <p className="text-silver-500">Usuário mais ativo</p>
          {kpisQuery.isLoading ? (
            <p className="text-sm text-silver-400">Carregando…</p>
          ) : kpis?.topUser ? (
            <div className="mt-1 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                {(kpis.topUser.nome_completo ?? kpis.topUser.email)[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-silver-800">
                  {kpis.topUser.email}
                </p>
                <p className="text-xs text-silver-500">{kpis.topCount} eventos na semana</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-silver-400">Sem atividade recente</p>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <input
          type="date"
          className="input w-auto"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="Data inicial"
        />
        <input
          type="date"
          className="input w-auto"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="Data final"
        />
        <select
          className="input w-auto"
          value={usuarioFilter}
          onChange={(e) => setUsuarioFilter(e.target.value)}
          aria-label="Usuário"
        >
          <option value="">Todos os usuários</option>
          {usuariosOptions.map(([id, email]) => (
            <option key={id} value={id}>
              {email}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={acaoFilter}
          onChange={(e) => setAcaoFilter(e.target.value)}
          aria-label="Ação"
        >
          <option value="">Todas as ações</option>
          <option value="insert">INSERT</option>
          <option value="update">UPDATE</option>
          <option value="delete">DELETE</option>
          <option value="lgpd_export">LGPD_EXPORT</option>
          <option value="lgpd_anonimizar">LGPD_ANONIMIZAR</option>
        </select>
        <select
          className="input w-auto"
          value={entidadeFilter}
          onChange={(e) => setEntidadeFilter(e.target.value)}
          aria-label="Tabela"
        >
          <option value="">Todas as tabelas</option>
          {entidadesOptions.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-silver-500 hover:text-navy"
          >
            Limpar filtros
          </button>
        )}
        <button
          type="button"
          onClick={() => eventsQuery.refetch()}
          className="ml-auto rounded-md p-2 text-silver-500 hover:bg-silver-100"
          aria-label="Recarregar"
          title="Recarregar"
        >
          <RefreshCw className={`h-4 w-4 ${eventsQuery.isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Lista */}
      <div className="card divide-y divide-silver-100">
        {eventsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-silver-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando eventos…</span>
          </div>
        ) : eventsQuery.error ? (
          <div className="flex items-start gap-2 p-6 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {(eventsQuery.error as Error).message}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-silver-500">
            Nenhum evento encontrado para os filtros atuais.
          </div>
        ) : (
          rows.map((e) => {
            const acaoUpper = e.acao.toUpperCase()
            const initialSrc = e.usuario_email && e.usuario_email !== '—' ? e.usuario_email : 'S'
            const initial = initialSrc[0]!.toUpperCase()
            const acao = e.acao.toLowerCase()
            return (
              <details key={e.id} className="group p-4">
                <summary className="flex cursor-pointer items-center gap-3 text-sm">
                  <span className="font-mono text-xs text-silver-500 shrink-0 w-32">
                    {fmtDateTime(e.created_at)}
                  </span>
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-white shrink-0"
                    title={e.usuario_email}
                  >
                    {initial}
                  </div>
                  <Badge variant={actionVariant(e.acao)}>{acaoUpper}</Badge>
                  <code className="text-xs text-silver-600 shrink-0">{e.entidade}</code>
                  <span className="flex-1 truncate text-silver-800">{describe(e)}</span>
                  <ChevronDown className="h-4 w-4 text-silver-400 transition group-open:rotate-180" />
                </summary>
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-silver-600">
                    <span>
                      <b className="text-silver-800">Usuário:</b> {e.usuario_email}
                    </span>
                    {e.entidade_id && (
                      <span>
                        <b className="text-silver-800">ID:</b>{' '}
                        <code className="font-mono">{e.entidade_id}</code>
                      </span>
                    )}
                    {e.ip && (
                      <span>
                        <b className="text-silver-800">IP:</b> {e.ip}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {acao !== 'insert' && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-danger">
                          Antes
                        </p>
                        <pre className="max-h-64 overflow-auto rounded-md bg-danger/5 p-3 text-xs text-silver-700">
                          {fmtJson(e.payload_antes)}
                        </pre>
                      </div>
                    )}
                    {acao !== 'delete' && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-success">
                          Depois
                        </p>
                        <pre className="max-h-64 overflow-auto rounded-md bg-success/5 p-3 text-xs text-silver-700">
                          {fmtJson(e.payload_depois)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            )
          })
        )}
      </div>
    </>
  )
}
