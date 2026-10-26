import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, Download, Plus, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react'
import './propostas.css'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { maskCpf } from '@/lib/documentoBr'
import { useAuth } from '@/auth/AuthContext'
import { canCreateProposta } from '@/lib/adminScope'
import { calcularLTV } from '@/lib/credito'
import { PROPOSTA_KANBAN_STATUS, PROPOSTA_STATUS_LABEL } from '@/lib/propostaStatus'
import { FUNDO_STATUS_COLOR, FUNDO_STATUS_LABEL, type FundoStatus } from '@/lib/fundoStatus'

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Construção',
  financiamento_imobiliario: 'Financiamento',
}

const STATUS_FINAIS = new Set(['contrato_registrado', 'completo', 'cancelado', 'standby'])
const STATUS_FILTER_OPTIONS = [
  ...PROPOSTA_KANBAN_STATUS,
  'simulacao',
  'cancelado',
] as const
const PAGE_SIZE = 50

type RpcRow = {
  id: string
  protocolo: string | null
  produto: string
  status: string
  valor_solicitado: number
  valor_imoveis_total: number
  prazo_meses: number
  created_at: string
  updated_at: string
  partner_id: string | null
  partner_nome: string | null
  cliente_id: string | null
  cliente_nome: string | null
  cliente_cpf: string | null
}

type Row = {
  id: string
  protocolo: string | null
  produto: string
  status: string
  valor_solicitado: number
  valor_imoveis_total: number
  prazo_meses: number
  created_at: string
  updated_at: string
  partner: { usuario: { nome_completo: string | null } | null } | null
  cliente: { nome_completo: string; cpf: string | null } | null
}

type FundoRow = {
  proposta_id: string
  status_fundo: FundoStatus
  fundos: { id: string; nome: string; cor_hex: string } | null
}

type FundoBadge = {
  id: string
  nome: string
  cor_hex: string
  status_fundo: FundoStatus
}

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export function AdminPropostas() {
  const { session } = useAuth()
  const podeCriar = canCreateProposta(session)
  const [q, setQ] = useState('')
  const [statusF, setStatusF] = useState<string>('all')
  const [produtoF, setProdutoF] = useState<string>('all')
  const [pagina, setPagina] = useState(1)

  const { data: propostas, isLoading } = useQuery({
    queryKey: ['admin-propostas'],
    queryFn: async (): Promise<Row[]> => {
      // RPC SECURITY DEFINER: retorna propostas do admin E de todos os parceiros.
      // Evita depender do RLS nas tabelas filhas (partners/usuarios/clientes).
      const { data, error } = await supabase.rpc('admin_list_propostas', { p_limit: 500 })
      if (error) throw error
      return ((data || []) as RpcRow[]).map((r) => ({
        id: r.id,
        protocolo: r.protocolo,
        produto: r.produto,
        status: r.status,
        valor_solicitado: Number(r.valor_solicitado || 0),
        valor_imoveis_total: Number(r.valor_imoveis_total || 0),
        prazo_meses: r.prazo_meses,
        created_at: r.created_at,
        updated_at: r.updated_at,
        partner: r.partner_id
          ? { usuario: { nome_completo: r.partner_nome } }
          : null,
        cliente: r.cliente_id
          ? { nome_completo: r.cliente_nome || '', cpf: r.cliente_cpf }
          : null,
      }))
    },
  })

  const { data: fundosRows = [] } = useQuery({
    queryKey: ['admin-propostas-fundos'],
    queryFn: async (): Promise<FundoRow[]> => {
      const { data, error } = await supabase
        .from('proposta_fundos')
        .select('proposta_id, status_fundo, fundos(id, nome, cor_hex)')
      if (error) throw error
      return (data ?? []) as unknown as FundoRow[]
    },
  })

  const fundosByProposta = useMemo<Record<string, FundoBadge[]>>(() => {
    const map: Record<string, FundoBadge[]> = {}
    for (const row of fundosRows) {
      if (!row.fundos) continue
      const list = map[row.proposta_id] ?? (map[row.proposta_id] = [])
      list.push({
        id: row.fundos.id,
        nome: row.fundos.nome,
        cor_hex: row.fundos.cor_hex,
        status_fundo: row.status_fundo,
      })
    }
    return map
  }, [fundosRows])

  const filtradas = useMemo(() => {
    if (!propostas) return []
    const term = q.trim().toLowerCase()
    return propostas.filter((p) => {
      if (statusF !== 'all' && p.status !== statusF) return false
      if (produtoF !== 'all' && p.produto !== produtoF) return false
      if (!term) return true
      const haystack = [
        p.protocolo,
        p.cliente?.nome_completo,
        p.cliente?.cpf,
        p.partner?.usuario?.nome_completo,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [propostas, q, statusF, produtoF])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = filtradas.length ? (paginaAtual - 1) * PAGE_SIZE + 1 : 0
  const fim = Math.min(paginaAtual * PAGE_SIZE, filtradas.length)
  const propostasPagina = filtradas.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE)

  const kpis = useMemo(() => {
    const ativas = (propostas || []).filter((p) => !STATUS_FINAIS.has(p.status))
    const volume = ativas.reduce((sum, p) => sum + Number(p.valor_solicitado || 0), 0)
    const ltvs = ativas
      .map((p) => calcularLTV(Number(p.valor_solicitado || 0), Number(p.valor_imoveis_total || 0)))
      .filter((v) => Number.isFinite(v) && v > 0)
    const ltvMedio = ltvs.length ? ltvs.reduce((a, b) => a + b, 0) / ltvs.length : 0
    const tempoMedio = ativas.length
      ? ativas.reduce((s, p) => s + diasDesde(p.created_at), 0) / ativas.length
      : 0
    return {
      total: ativas.length,
      volume,
      ltv: ltvMedio,
      tempo: tempoMedio,
    }
  }, [propostas])

  return (
    <div className="admin-proposals">
      <div className="admin-proposals__container">
        <header className="admin-proposals__header">
          <div>
            <p className="admin-proposals__eyebrow">OPERAÇÕES DE CRÉDITO</p>
            <h1>Propostas</h1>
            <p className="admin-proposals__subtitle">Acompanhe sua carteira de propostas em um só lugar.</p>
          </div>
          <div className="admin-proposals__actions">
          {podeCriar && (
            <Link to="/admin/propostas/nova" className="admin-proposals__button admin-proposals__button--primary">
              <Plus className="h-4 w-4" /> Nova proposta
            </Link>
          )}
          <Link to="/admin/kanban" className="admin-proposals__button admin-proposals__button--dark">
            <LayoutGrid className="h-4 w-4" /> Ver Kanban
          </Link>
          <button className="admin-proposals__button admin-proposals__button--light" disabled>
            <Download className="h-4 w-4" /> Exportar
          </button>
          </div>
        </header>

        <section aria-label="Resumo da carteira" className="admin-proposals__metrics">
          <article className="admin-proposals__metric">
            <span>PROPOSTAS ATIVAS</span><strong>{kpis.total}</strong>
          </article>
          <article className="admin-proposals__metric">
            <span>VOLUME EM ANÁLISE</span><strong className="is-accent">{brl(kpis.volume * 100)}</strong>
          </article>
          <article className="admin-proposals__metric">
            <span>LTV MÉDIO</span><strong>{kpis.ltv ? `${Math.round(kpis.ltv * 100)}%` : '—'}</strong>
          </article>
          <article className="admin-proposals__metric">
            <span>TEMPO MÉDIO</span><strong className="is-accent">{kpis.tempo ? `${Math.round(kpis.tempo)} dias` : '—'}</strong>
          </article>
        </section>

        <section className="admin-proposals__list" aria-label="Lista de propostas">
          <div className="admin-proposals__filters">
            <label className="admin-proposals__search">
              <span className="sr-only">Buscar por protocolo, CPF, cliente ou parceiro</span>
              <Search aria-hidden="true" className="admin-proposals__search-icon" />
              <input
                placeholder="Busque por protocolo, CPF, cliente ou parceiro"
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPagina(1)
                }}
              />
            </label>
            <label className="admin-proposals__select">
              <span>Status</span>
              <select value={statusF} onChange={(e) => {
                setStatusF(e.target.value)
                setPagina(1)
              }}>
                <option value="all">Todos</option>
                {STATUS_FILTER_OPTIONS.map((status) => (
                  <option key={status} value={status}>{PROPOSTA_STATUS_LABEL[status]}</option>
                ))}
              </select>
            </label>
            <label className="admin-proposals__select">
              <span>Produto</span>
              <select value={produtoF} onChange={(e) => {
                setProdutoF(e.target.value)
                setPagina(1)
              }}>
                <option value="all">Todos</option>
                {Object.entries(PRODUTO_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-proposals__table-heading">
            <div>
              <h2>Lista de propostas</h2>
              <p>{filtradas.length} resultados encontrados</p>
            </div>
          </div>

        {isLoading ? (
          <div className="admin-proposals__loading"><Loader2 className="h-6 w-6 animate-spin" />Carregando propostas…</div>
        ) : !filtradas.length ? (
          <div className="admin-proposals__empty">Nenhuma proposta encontrada.</div>
        ) : (
          <div className="admin-proposals__table-wrap">
          <table>
            <thead>
              <tr>
                <th className="px-4 py-3">Protocolo</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Parceiro</th>
                <th className="px-4 py-3">Fundos</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">LTV</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Dias</th>
              </tr>
            </thead>
            <tbody>
              {propostasPagina.map((p) => {
                const dias = diasDesde(p.created_at)
                const ltv = calcularLTV(Number(p.valor_solicitado || 0), Number(p.valor_imoveis_total || 0))
                const ltvPct = Math.round(ltv * 100)
                const fundos = fundosByProposta[p.id] ?? []
                const adicionais = fundos.length - 1
                return (
                  <tr key={p.id}>
                    <td>
                      {p.protocolo ? (
                        <Link
                          aria-label={`Abrir proposta ${p.protocolo}`}
                          className="admin-proposals__protocol"
                          to={`/admin/propostas/${p.id}`}
                        >
                          {p.protocolo}
                        </Link>
                      ) : <span className="admin-proposals__protocol-empty">—</span>}
                    </td>
                    <td>
                      <strong className="admin-proposals__client">{p.cliente?.nome_completo || '—'}</strong>
                      <span className="admin-proposals__secondary">{p.cliente?.cpf ? maskCpf(p.cliente.cpf) : ''}</span>
                    </td>
                    <td className="admin-proposals__partner">
                      {p.partner?.usuario?.nome_completo || '—'}
                    </td>
                    <td>
                      {fundos.length === 0 ? (
                        <span className="admin-proposals__muted">—</span>
                      ) : (
                        <span
                          className="admin-proposals__funds-display"
                          tabIndex={adicionais > 0 ? 0 : undefined}
                          aria-label={adicionais > 0 ? `Fundo ${fundos[0].nome} e mais ${adicionais} ${adicionais === 1 ? 'fundo' : 'fundos'}` : undefined}
                        >
                          <span
                            className="admin-proposals__fund"
                            style={{ backgroundColor: fundos[0].cor_hex }}
                            title={`${fundos[0].nome}: ${FUNDO_STATUS_LABEL[fundos[0].status_fundo]}`}
                          >
                            <span className="admin-proposals__fund-dot" style={{ backgroundColor: FUNDO_STATUS_COLOR[fundos[0].status_fundo] }} />
                            {fundos[0].nome}
                          </span>
                          {adicionais > 0 && (
                            <>
                              <span className="admin-proposals__fund-count" aria-label={`Mais ${adicionais} ${adicionais === 1 ? 'fundo' : 'fundos'}`}>
                                +{adicionais}
                              </span>
                              <span className="admin-proposals__fund-tooltip" role="tooltip">
                                <span className="admin-proposals__fund-tooltip-title">Fundos atribuídos</span>
                                {fundos.map((f) => (
                                  <span className="admin-proposals__fund-tooltip-row" key={f.id}>
                                    <span className="admin-proposals__fund-tooltip-dot" style={{ backgroundColor: f.cor_hex }} />
                                    <span>{f.nome}</span>
                                    <small>{FUNDO_STATUS_LABEL[f.status_fundo]}</small>
                                  </span>
                                ))}
                              </span>
                            </>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="admin-proposals__product">{PRODUTO_LABEL[p.produto] || p.produto}</td>
                    <td className="admin-proposals__value">{brl(Number(p.valor_solicitado) * 100)}</td>
                    <td>
                      {ltv > 0 ? (
                        <span className={`admin-proposals__ltv${ltvPct > 60 ? ' is-high' : ''}`}>{ltvPct}%</span>
                      ) : <span className="admin-proposals__muted">—</span>}
                    </td>
                    <td>
                      <span className={`admin-proposals__status admin-proposals__status--${p.status}`}>
                        {PROPOSTA_STATUS_LABEL[p.status] || p.status}
                      </span>
                    </td>
                    <td className={`admin-proposals__days${dias > 7 ? ' is-overdue' : ''}`}>{dias}d</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}

        {!isLoading && filtradas.length > 0 && (
          <footer className="admin-proposals__pagination">
            <p>
              Exibindo <strong>{inicio}–{fim}</strong> de <strong>{filtradas.length}</strong>
              <span className="admin-proposals__per-page">50 itens por página</span>
            </p>
            <nav className="admin-proposals__pagination-controls" aria-label="Paginação das propostas">
              <button
                aria-label="Página anterior"
                className="btn-no-liquid admin-proposals__page-button"
                disabled={paginaAtual === 1}
                onClick={() => setPagina((current) => Math.max(1, current - 1))}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={17} />
              </button>
              {Array.from({ length: totalPaginas }, (_, index) => index + 1).map((item) => (
                <button
                  aria-current={paginaAtual === item ? 'page' : undefined}
                  aria-label={`Ir para página ${item}`}
                  className={`btn-no-liquid admin-proposals__page-button${paginaAtual === item ? ' is-current' : ''}`}
                  key={item}
                  onClick={() => setPagina(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
              <button
                aria-label="Próxima página"
                className="btn-no-liquid admin-proposals__page-button"
                disabled={paginaAtual === totalPaginas}
                onClick={() => setPagina((current) => Math.min(totalPaginas, current + 1))}
                type="button"
              >
                <ChevronRight aria-hidden="true" size={17} />
              </button>
            </nav>
          </footer>
        )}
        </section>
      </div>
    </div>
  )
}
