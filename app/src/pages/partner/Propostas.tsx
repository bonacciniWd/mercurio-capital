import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, Plus, LayoutGrid, ChevronLeft, ChevronRight, Download, FilterX } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { maskCpf } from '@/lib/documentoBr'
import { calcularLTV } from '@/lib/credito'
import { PROPOSTA_KANBAN_STATUS, PROPOSTA_STATUS_LABEL, PRODUTO_LABEL } from '@/lib/propostaStatus'
import '@/pages/admin/propostas.css'

const STATUS_FINALIZADOS = new Set(['contrato_registrado', 'completo', 'cancelado', 'standby'])
const STATUS_FILTER_OPTIONS = [...PROPOSTA_KANBAN_STATUS, 'simulacao', 'cancelado']
const PAGE_SIZE = 50

interface PropostaRow {
  id: string
  protocolo: string | null
  produto: string
  status: string
  valor_solicitado: number
  valor_imoveis_total: number
  created_at: string
  updated_at: string
  cliente: { nome_completo: string; cpf: string | null } | null
}

function diasDesde(iso: string) {
  const timestamp = new Date(iso).getTime()
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((Date.now() - timestamp) / 86400000)) : 0
}

export function PartnerPropostas() {
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('all')
  const [produtoFiltro, setProdutoFiltro] = useState('all')
  const [pagina, setPagina] = useState(1)

  const { data: propostas, isLoading, error } = useQuery({
    queryKey: ['partner-propostas'],
    queryFn: async (): Promise<PropostaRow[]> => {
      // Consulta direta preserva o escopo aplicado pelo RLS para partner/team_member.
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, valor_solicitado, valor_imoveis_total, created_at, updated_at, cliente:clientes(nome_completo, cpf)')
        .order('updated_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data || []) as unknown as PropostaRow[]
    },
  })

  const filtradas = useMemo(() => {
    if (!propostas) return []
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return propostas.filter((proposta) => {
      if (statusFiltro !== 'all' && proposta.status !== statusFiltro) return false
      if (produtoFiltro !== 'all' && proposta.produto !== produtoFiltro) return false
      if (!termo) return true
      const nome = proposta.cliente?.nome_completo?.toLocaleLowerCase('pt-BR') || ''
      const cpf = proposta.cliente?.cpf || ''
      const protocolo = (proposta.protocolo || '').toLocaleLowerCase('pt-BR')
      return nome.includes(termo) || cpf.includes(busca.trim()) || protocolo.includes(termo)
    })
  }, [propostas, busca, statusFiltro, produtoFiltro])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = filtradas.length ? (paginaAtual - 1) * PAGE_SIZE + 1 : 0
  const fim = Math.min(paginaAtual * PAGE_SIZE, filtradas.length)
  const propostasPagina = filtradas.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE)

  const kpis = useMemo(() => {
    const ativas = (propostas || []).filter((proposta) => !STATUS_FINALIZADOS.has(proposta.status))
    const volume = ativas.reduce((total, proposta) => total + Number(proposta.valor_solicitado || 0), 0)
    const ltvs = ativas
      .map((proposta) => calcularLTV(Number(proposta.valor_solicitado || 0), Number(proposta.valor_imoveis_total || 0)))
      .filter((ltv) => Number.isFinite(ltv) && ltv > 0)
    const tempo = ativas.length
      ? ativas.reduce((total, proposta) => total + diasDesde(proposta.created_at), 0) / ativas.length
      : 0
    return {
      total: ativas.length,
      volume,
      ltv: ltvs.length ? ltvs.reduce((total, ltv) => total + ltv, 0) / ltvs.length : 0,
      tempo,
    }
  }, [propostas])

  const filtrosAtivos = Boolean(busca || statusFiltro !== 'all' || produtoFiltro !== 'all')
  function limparFiltros() {
    setBusca('')
    setStatusFiltro('all')
    setProdutoFiltro('all')
    setPagina(1)
  }

  return (
    <div className="admin-proposals admin-proposals--partner">
      <div className="admin-proposals__container">
        <header className="admin-proposals__header">
          <div>
            <p className="admin-proposals__eyebrow">OPERAÇÕES DE CRÉDITO</p>
            <h1>Propostas</h1>
            <p className="admin-proposals__subtitle">Acompanhe sua carteira de propostas em um só lugar.</p>
          </div>
          <div className="admin-proposals__actions">
            <Link to="/p/propostas/nova" className="admin-proposals__button admin-proposals__button--primary">
              <Plus aria-hidden="true" className="h-4 w-4" /> Nova proposta
            </Link>
            <Link to="/p/kanban" className="admin-proposals__button admin-proposals__button--dark">
              <LayoutGrid aria-hidden="true" className="h-4 w-4" /> Ver Kanban
            </Link>
            <button className="admin-proposals__button admin-proposals__button--light" disabled type="button">
              <Download aria-hidden="true" className="h-4 w-4" /> Exportar
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
              <span className="sr-only">Buscar por protocolo, CPF ou cliente</span>
              <Search aria-hidden="true" className="admin-proposals__search-icon" />
              <input
                placeholder="Busque por protocolo, CPF ou cliente"
                type="search"
                value={busca}
                onChange={(event) => { setBusca(event.target.value); setPagina(1) }}
              />
            </label>
            <label className="admin-proposals__select">
              <span>Status</span>
              <select value={statusFiltro} onChange={(event) => { setStatusFiltro(event.target.value); setPagina(1) }}>
                <option value="all">Todos</option>
                {STATUS_FILTER_OPTIONS.map((status) => (
                  <option key={status} value={status}>{PROPOSTA_STATUS_LABEL[status] || status}</option>
                ))}
              </select>
            </label>
            <label className="admin-proposals__select">
              <span>Produto</span>
              <select value={produtoFiltro} onChange={(event) => { setProdutoFiltro(event.target.value); setPagina(1) }}>
                <option value="all">Todos</option>
                {Object.entries(PRODUTO_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-proposals__table-heading">
            <div>
              <h2>Lista de propostas</h2>
              <p>{filtradas.length} resultados encontrados</p>
            </div>
            {filtrosAtivos && (
              <button className="admin-proposals__clear-filters" onClick={limparFiltros} type="button">
                <FilterX aria-hidden="true" size={15} /> Limpar filtros
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="admin-proposals__loading"><Loader2 aria-hidden="true" className="h-6 w-6 animate-spin" />Carregando propostas…</div>
          ) : error ? (
            <div className="admin-proposals__empty" role="alert">Erro ao carregar propostas. Tente novamente.</div>
          ) : !filtradas.length ? (
            <div className="admin-proposals__empty">
              {propostas?.length ? 'Nenhum resultado para os filtros aplicados.' : 'Nenhuma proposta ainda — crie a primeira.'}
            </div>
          ) : (
            <div className="admin-proposals__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Protocolo</th>
                    <th>Cliente</th>
                    <th>Produto</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3 text-right">LTV</th>
                    <th>Status</th>
                    <th className="px-4 py-3 text-right">Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {propostasPagina.map((proposta) => {
                    const dias = diasDesde(proposta.created_at)
                    const ltv = calcularLTV(Number(proposta.valor_solicitado || 0), Number(proposta.valor_imoveis_total || 0))
                    const ltvPercentual = Math.round(ltv * 100)
                    return (
                      <tr key={proposta.id}>
                        <td>
                          <Link aria-label={`Abrir proposta ${proposta.protocolo || proposta.id.slice(0, 8)}`} className="admin-proposals__protocol" to={`/p/propostas/${proposta.id}`}>
                            {proposta.protocolo || proposta.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td>
                          <strong className="admin-proposals__client">{proposta.cliente?.nome_completo || '—'}</strong>
                          <span className="admin-proposals__secondary">{proposta.cliente?.cpf ? maskCpf(proposta.cliente.cpf) : ''}</span>
                        </td>
                        <td className="admin-proposals__product">{PRODUTO_LABEL[proposta.produto] || proposta.produto}</td>
                        <td className="admin-proposals__value">{brl(Number(proposta.valor_solicitado || 0) * 100)}</td>
                        <td>
                          {ltv > 0 ? <span className={`admin-proposals__ltv${ltvPercentual > 60 ? ' is-high' : ''}`}>{ltvPercentual}%</span> : <span className="admin-proposals__muted">—</span>}
                        </td>
                        <td><span className={`admin-proposals__status admin-proposals__status--${proposta.status}`}>{PROPOSTA_STATUS_LABEL[proposta.status] || proposta.status}</span></td>
                        <td className={`admin-proposals__days${dias > 7 ? ' is-overdue' : ''}`}>{dias}d</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && !error && filtradas.length > 0 && (
            <footer className="admin-proposals__pagination">
              <p>
                Exibindo <strong>{inicio}–{fim}</strong> de <strong>{filtradas.length}</strong>
                <span className="admin-proposals__per-page">50 itens por página</span>
              </p>
              <nav className="admin-proposals__pagination-controls" aria-label="Paginação das propostas">
                <button aria-label="Página anterior" className="btn-no-liquid admin-proposals__page-button" disabled={paginaAtual === 1} onClick={() => setPagina((atual) => Math.max(1, atual - 1))} type="button">
                  <ChevronLeft aria-hidden="true" size={17} />
                </button>
                {Array.from({ length: totalPaginas }, (_, index) => index + 1).map((item) => (
                  <button aria-current={paginaAtual === item ? 'page' : undefined} aria-label={`Ir para página ${item}`} className={`btn-no-liquid admin-proposals__page-button${paginaAtual === item ? ' is-current' : ''}`} key={item} onClick={() => setPagina(item)} type="button">
                    {item}
                  </button>
                ))}
                <button aria-label="Próxima página" className="btn-no-liquid admin-proposals__page-button" disabled={paginaAtual === totalPaginas} onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))} type="button">
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
