import '@/pages/admin/proposta-detalhe.css'
import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { StatusBadge } from '@/components/Badge'
import { brl } from '@/lib/utils'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  FileSignature,
  FileText,
  History,
  Link2,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Copy,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { calcularFinanciamento, calcularLTV } from '@/lib/credito'
import { formatDateBr } from '@/lib/dateBr'
import { maskCpf, maskCnpj } from '@/lib/documentoBr'
import { PropostaDocsUploader } from '@/components/PropostaDocsUploader'
import { PropostaPendencias } from '@/components/PropostaPendencias'
import { PropostaConsultas } from '@/components/PropostaConsultas'
import { PropostaContrato } from '@/components/PropostaContrato'

const TABS = ['Resumo', 'Proponentes', 'Imóveis', 'Documentos', 'Pendências', 'Consultas', 'Contrato', 'Histórico'] as const

const TAB_DOM_ID: Record<typeof TABS[number], string> = {
  Resumo: 'resumo',
  Proponentes: 'proponentes',
  Imóveis: 'imoveis',
  Documentos: 'documentos',
  Pendências: 'pendencias',
  Consultas: 'consultas',
  Contrato: 'contrato',
  Histórico: 'historico',
}

const TAB_ICON: Record<typeof TABS[number], React.ComponentType<{ className?: string }>> = {
  Resumo: Sparkles,
  Proponentes: Users,
  Imóveis: Building2,
  Documentos: FileText,
  Pendências: AlertTriangle,
  Consultas: Search,
  Contrato: FileSignature,
  Histórico: History,
}

const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Rascunho',
  pre_analise: 'Pré-análise',
  analise_credito: 'Análise de Crédito',
  pre_aprovado: 'Pré-aprovado',
  analise_imovel: 'Análise de Imóvel',
  analise_juridica: 'Análise Jurídica',
  comite: 'Comitê',
  proposta_cliente: 'Proposta ao Cliente',
  resolucao_pendencias: 'Pré-análise',
  emissao_contrato: 'Emissão de Contrato',
  aguardando_assinatura: 'Aguardando Assinatura',
  em_registro: 'Em Registro',
  contrato_registrado: 'Contrato Registrado',
  recurso_liberado: 'Recurso Liberado',
  cancelado: 'Cancelado',
}

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Crédito Construção',
  financiamento_imobiliario: 'Financiamento Imobiliário',
}

interface Proposta {
  id: string
  protocolo: string | null
  produto: string
  status: string
  valor_solicitado: number
  valor_imoveis_total: number
  prazo_meses: number
  carencia_meses: number
  taxa_juros_mensal: number
  amortizacao: 'price' | 'sac'
  correcao: string
  indexador: string
  created_at: string
  updated_at: string
  cliente: { id: string; data_nascimento: string | null; nome_completo: string; cpf: string | null; cnpj: string | null; email: string | null; email_responsavel: string | null; telefone: string | null; celular_comercial: string | null; modelo_renda: string | null; renda_mensal: number | null; endereco_cidade: string | null; endereco_estado: string | null; razao_social: string | null; faturamento_mensal: number | null } | null
}

interface Proponente {
  id: string
  cliente_id: string | null
  endereco_cep: string | null
  endereco_logradouro: string | null
  endereco_numero: string | null
  endereco_complemento: string | null
  endereco_bairro: string | null
  nome: string
  cpf_cnpj: string | null
  principal: boolean
  relacao: string | null
  estado_civil: string | null
  pessoa_tipo: string
  compoe_renda: boolean | null
  modelo_renda: string | null
  renda_mensal: number | null
  endereco_cidade: string | null
  endereco_estado: string | null
}

const MODELO_RENDA_LABEL: Record<string, string> = {
  assalariado_clt: 'Assalariado (CLT)',
  empresario: 'Empresário',
  autonomo: 'Autônomo',
  aposentado_pensionista: 'Aposentado/Pensionista',
  funcionario_publico: 'Funcionário Público',
}

interface Imovel {
  id: string
  tipo: string
  cidade: string | null
  estado: string | null
  bairro: string | null
  logradouro: string | null
  numero: string | null
  cep: string | null
  valor: number
  alugado: boolean
  financiado: boolean
  possui_debitos: boolean
}

interface HistoricoRow {
  id: string
  status_anterior: string | null
  status_novo: string
  motivo: string | null
  created_at: string
}

export function PartnerPropostaDetalhe() {
  const { id } = useParams()
  const [tab, setTab] = useState<typeof TABS[number]>('Resumo')
  const [reissuing, setReissuing] = useState(false)
  const [reissueUrl, setReissueUrl] = useState<string | null>(null)
  const [reissueError, setReissueError] = useState<string | null>(null)
  const [reissueEmailStatus, setReissueEmailStatus] = useState<'enfileirado' | 'nao_enfileirado' | 'falha_enqueue' | null>(null)
  const [reissueEmailError, setReissueEmailError] = useState<string | null>(null)
  const [reissueCopied, setReissueCopied] = useState(false)

  async function handleReissue() {
    if (!id) return
    setReissuing(true)
    setReissueError(null)
    setReissueUrl(null)
    setReissueEmailStatus(null)
    setReissueEmailError(null)
    try {
      const { data, error } = await supabase.functions.invoke('magic-link-issue', {
        body: { proposta_id: id, send_email: true },
      })
      if (error) throw new Error(error.message)
      const payload = data as {
        url?: string
        magic_token?: string
        email_status?: 'enfileirado' | 'nao_enfileirado' | 'falha_enqueue'
        email_motivo?: string
        email_erro?: string
      }
      if (!payload?.url) throw new Error('Resposta inválida da função.')
      setReissueUrl(payload.url)
      setReissueEmailStatus(payload.email_status ?? null)
      setReissueEmailError(payload.email_erro ?? payload.email_motivo ?? null)
    } catch (err) {
      setReissueError(err instanceof Error ? err.message : 'Falha ao reemitir.')
    } finally {
      setReissuing(false)
    }
  }

  const { data: proposta, isLoading, error } = useQuery({
    queryKey: ['proposta', id],
    queryFn: async (): Promise<Proposta | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, valor_solicitado, valor_imoveis_total, prazo_meses, carencia_meses, taxa_juros_mensal, amortizacao, correcao, indexador, created_at, updated_at, cliente:clientes(id, data_nascimento, nome_completo, cpf, cnpj, email, email_responsavel, telefone, celular_comercial, modelo_renda, renda_mensal, endereco_cidade, endereco_estado, razao_social, faturamento_mensal)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as unknown as Proposta
    },
    enabled: !!id,
  })

  const { data: proponentes } = useQuery({
    queryKey: ['proposta-proponentes', id],
    queryFn: async (): Promise<Proponente[]> => {
      const { data, error } = await supabase
        .from('proponentes')
        .select('id, cliente_id, endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, nome, cpf_cnpj, principal, relacao, estado_civil, pessoa_tipo, compoe_renda, modelo_renda, renda_mensal, endereco_cidade, endereco_estado')
        .eq('proposta_id', id!)
        .order('principal', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!id && tab === 'Proponentes',
  })

  const { data: imoveis } = useQuery({
    queryKey: ['proposta-imoveis', id],
    queryFn: async (): Promise<Imovel[]> => {
      const { data, error } = await supabase
        .from('imoveis')
        .select('id, tipo, cidade, estado, bairro, logradouro, numero, cep, valor, alugado, financiado, possui_debitos')
        .eq('proposta_id', id!)
      if (error) throw error
      return data || []
    },
    enabled: !!id && tab === 'Imóveis',
  })

  const { data: historico } = useQuery({
    queryKey: ['proposta-historico', id],
    queryFn: async (): Promise<HistoricoRow[]> => {
      const { data, error } = await supabase
        .from('proposta_status_historico')
        .select('id, status_anterior, status_novo, motivo, created_at')
        .eq('proposta_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!id && tab === 'Histórico',
  })

  if (isLoading) return <div className="admin-proposal admin-proposal--partner"><div className="proposal-section p-10 text-center text-silver-500">Carregando…</div></div>
  if (error) return <div className="admin-proposal admin-proposal--partner"><div className="proposal-section p-10 text-center text-danger">Erro: {(error as Error).message}</div></div>
  if (!proposta) return <div className="admin-proposal admin-proposal--partner"><div className="proposal-section p-10 text-center text-silver-500">Proposta não encontrada.</div></div>

  const valor = Number(proposta.valor_solicitado)
  const valorImoveis = Number(proposta.valor_imoveis_total)
  const calc = calcularFinanciamento({
    valor,
    prazoMeses: proposta.prazo_meses,
    taxaMensal: Number(proposta.taxa_juros_mensal) / 100,
    amortizacao: proposta.amortizacao,
    carenciaMeses: proposta.carencia_meses,
  })
  const ltv = calcularLTV(valor, valorImoveis)

  return (
    <div className="admin-proposal admin-proposal--partner">
      <Link to="/p/propostas" className="proposal-back-link">
        <ArrowLeft className="h-4 w-4" /> Voltar às propostas
      </Link>
      <header className="proposal-heading proposal-heading--partner">
        <div>
          <p className="proposal-eyebrow">PROPOSTA {proposta.protocolo || 'SEM PROTOCOLO'}</p>
          <h1>{proposta.cliente?.razao_social || proposta.cliente?.nome_completo || 'Cliente'}</h1>
          <div className="proposal-heading__meta">
            <span>{PRODUTO_LABEL[proposta.produto] || proposta.produto}</span><span aria-hidden="true">·</span>
            <span>Criada em {formatDateBr(proposta.created_at)}</span>
          </div>
        </div>
        <div className="proposal-header-actions proposal-header-actions--partner">
          <button
            type="button"
            onClick={handleReissue}
            disabled={reissuing}
            className="btn-outline btn-no-liquid flex items-center gap-2 text-sm disabled:opacity-60"
          >
            {reissuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Reemitir magic link
          </button>
        </div>
      </header>
      <div className="proposal-status-strip proposal-status-strip--partner">
        <div><span>Status da proposta</span><strong><StatusBadge status={STATUS_LABEL[proposta.status] || proposta.status} /></strong></div>
        <div><span>Valor solicitado</span><strong>{brl(valor * 100)}</strong></div>
        <div><span>Prazo</span><strong>{proposta.prazo_meses} meses</strong></div>
        <div><span>Carência</span><strong>{proposta.carencia_meses} meses</strong></div>
        <div><span>Última atualização</span><strong>{formatDateBr(proposta.updated_at)}</strong></div>
      </div>
      {(reissueUrl || reissueError) && <div className="proposal-reissue-notice" role="status">
          {reissueUrl ? (
            <>
              <div className="proposal-reissue-link">
                <code className="max-w-[220px] truncate font-mono text-silver-700">{reissueUrl}</code>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(reissueUrl)
                    setReissueCopied(true)
                    setTimeout(() => setReissueCopied(false), 2000)
                  }}
                  className="btn-no-liquid"
                  title="Copiar"
                >
                  {reissueCopied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              {reissueEmailStatus === 'enfileirado' && (
                <p className="text-xs text-success">E-mail de reemissão enfileirado para o cliente.</p>
              )}
              {(reissueEmailStatus === 'nao_enfileirado' || reissueEmailStatus === 'falha_enqueue') && (
                <p className="max-w-[280px] text-xs text-warning">
                  {reissueEmailError || 'O e-mail não foi enfileirado. Copie o link e envie manualmente.'}
                </p>
              )}
            </>
          ) : null}
          {reissueError ? <p className="text-xs text-danger">{reissueError}</p> : null}
      </div>}

      <div className="proposal-tabs-shell">
        <div role="tablist" aria-label="Seções da proposta" className="proposal-tabs">
          {TABS.map(t => {
            const isActive = tab === t
            const Icon = TAB_ICON[t]

            return (
              <button
                key={t}
                id={`tab-${TAB_DOM_ID[t]}`}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`panel-${TAB_DOM_ID[t]}`}
                onClick={() => setTab(t)}
                className={`btn-no-liquid proposal-tab${isActive ? ' is-active' : ''}`}
                onKeyDown={(event) => {
                  const current = TABS.indexOf(t)
                  const next = event.key === 'ArrowRight' ? (current + 1) % TABS.length
                    : event.key === 'ArrowLeft' ? (current + TABS.length - 1) % TABS.length
                    : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null
                  if (next === null) return
                  event.preventDefault()
                  setTab(TABS[next])
                  document.getElementById(`tab-${TAB_DOM_ID[TABS[next]]}`)?.focus()
                }}
                tabIndex={isActive ? 0 : -1}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-red-600' : 'text-silver-400 group-hover:text-silver-600'}`} />
                <span>{t}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="proposal-panel" tabIndex={0} id={`panel-${TAB_DOM_ID[tab]}`} role="tabpanel" aria-labelledby={`tab-${TAB_DOM_ID[tab]}`}>
        <div className="proposal-page-heading">
          <h2>{tab}</h2>
          <p>{tab === 'Resumo' ? 'Informações e condições atuais desta proposta.' : `Informações de ${tab.toLocaleLowerCase('pt-BR')} desta proposta.`}</p>
        </div>

      {tab === 'Resumo' && (
        <div className="proposal-summary-grid grid gap-6 lg:grid-cols-2">
          <Section title="Dados do produto">
            <Row k="Produto" v={PRODUTO_LABEL[proposta.produto] || proposta.produto} />
            <Row k="Valor solicitado" v={brl(valor * 100)} />
            <Row k="Prazo" v={`${proposta.prazo_meses} meses`} />
            <Row k="Carência" v={`${proposta.carencia_meses} meses`} />
            <Row k="Sistema" v={`${proposta.amortizacao.toUpperCase()} · ${proposta.indexador} + ${Number(proposta.taxa_juros_mensal).toFixed(2)}% a.m.`} />
          </Section>
          <Section title="Dados do cliente">
            <Row k="Nome" v={proposta.cliente?.razao_social || proposta.cliente?.nome_completo || '—'} />
            <Row k="CPF/CNPJ" v={proposta.cliente?.cnpj ? maskCnpj(proposta.cliente.cnpj) : proposta.cliente?.cpf ? maskCpf(proposta.cliente.cpf) : '—'} />
            <Row k="E-mail" v={proposta.cliente?.email || '—'} />
            <Row k="Telefone" v={proposta.cliente?.telefone || '—'} />
            {proposta.cliente?.cnpj
              ? (proposta.cliente?.faturamento_mensal != null && <Row k="Faturamento" v={brl(Number(proposta.cliente.faturamento_mensal) * 100)} />)
              : (proposta.cliente?.renda_mensal != null && <Row k="Renda mensal" v={brl(Number(proposta.cliente.renda_mensal) * 100)} />)}
            {(proposta.cliente?.endereco_cidade || proposta.cliente?.endereco_estado) && (
              <Row k="Endereço" v={[proposta.cliente?.endereco_cidade, proposta.cliente?.endereco_estado].filter(Boolean).join('/')} />
            )}
          </Section>
          <Section title="Imóveis (garantia)">
            <Row k="Valor total" v={brl(valorImoveis * 100)} />
            <Row k="LTV" v={
              <span className={`badge ${ltv > 0.6 ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'}`}>
                {(ltv * 100).toFixed(1)}%
              </span>
            } />
          </Section>
          <Section title="Simulação financeira">
            <Row k="1ª parcela" v={brl(calc.primeiraParcela * 100)} />
            <Row k="Última parcela" v={brl(calc.ultimaParcela * 100)} />
            <Row k="Total a pagar" v={brl(calc.totalPago * 100)} />
            <Row k="Renda mínima" v={brl(calc.rendaMinima * 100) + '/mês'} />
          </Section>
        </div>
      )}

      {tab === 'Proponentes' && (
        !proponentes ? <div className="proposal-section p-10 text-center text-sm text-silver-500">Carregando…</div>
          : proponentes.length === 0 ? <div className="proposal-section p-10 text-center text-sm text-silver-500">Sem proponentes.</div>
          : <div className="proposal-applicants-layout">
            <section className="card proposal-applicants-section" aria-labelledby="partner-applicants-title">
              <div className="proposal-section-heading"><div><h2 id="partner-applicants-title">Proponentes da operação</h2><p>{proponentes.length} {proponentes.length === 1 ? 'pessoa vinculada' : 'pessoas vinculadas'} a esta proposta.</p></div></div>
              <div className="proposal-applicants-list">
                {proponentes.map((p) => {
                  const documentNumber = p.cpf_cnpj?.replace(/\D/g, '')
                  const clientDocument = (p.pessoa_tipo === 'PJ' ? proposta.cliente?.cnpj : proposta.cliente?.cpf)?.replace(/\D/g, '')
                  const client = (p.cliente_id && p.cliente_id === proposta.cliente?.id) || (documentNumber && documentNumber === clientDocument) ? proposta.cliente : null
                  const relation = p.relacao ? ({ conjuge: 'Cônjuge', socio: 'Sócio', outro: 'Outro' }[p.relacao] || p.relacao) : null
                  const marital = p.estado_civil ? ({ solteiro: 'Solteiro(a)', casado: 'Casado(a)', divorciado: 'Divorciado(a)', viuvo: 'Viúvo(a)', uniao_estavel: 'União estável' }[p.estado_civil] || p.estado_civil) : '—'
                  return (
                    <article className="proposal-applicant" key={p.id}>
                      <div className="proposal-person-heading">
                        <span className="proposal-avatar" aria-hidden="true">{p.nome.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('')}</span>
                        <div className="proposal-person-identity"><div><h3>{p.nome}</h3>{p.principal && <span className="proposal-principal">Principal</span>}</div><p>{p.pessoa_tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}{relation ? ` · ${relation}` : ''}</p></div>
                      </div>
                      <dl className="proposal-details proposal-applicant-details">
                        <PartnerRow k="CPF/CNPJ" v={p.cpf_cnpj ? (p.pessoa_tipo === 'PJ' ? maskCnpj(p.cpf_cnpj) : maskCpf(p.cpf_cnpj)) : '—'} />
                        <PartnerRow k="Data de nascimento" v={client?.data_nascimento ? formatDateBr(client.data_nascimento) : '—'} />
                        <PartnerRow k="Estado civil" v={marital} />
                        <PartnerRow k="Composição de renda" v={p.principal || p.compoe_renda === true ? 'Compõe renda' : p.compoe_renda === false ? 'Não compõe renda' : '—'} />
                        <PartnerRow k="E-mail" v={client?.email || client?.email_responsavel || '—'} />
                        <PartnerRow k="Telefone" v={client?.telefone || client?.celular_comercial || '—'} />
                        <PartnerRow k="Modelo de renda" v={p.modelo_renda ? MODELO_RENDA_LABEL[p.modelo_renda] ?? p.modelo_renda : '—'} />
                        <PartnerRow k="Renda declarada" v={p.renda_mensal != null ? brl(Number(p.renda_mensal) * 100) : '—'} />
                      </dl>
                      <div className="proposal-registration-note"><FileText className="h-4 w-4" /><span>Dados declarados no cadastro da proposta.</span></div>
                    </article>
                  )
                })}
              </div>
            </section>
            <aside className="proposal-applicant-aside" aria-label="Informações complementares dos proponentes">
              <section className="card proposal-analysis-section">
                <div className="proposal-section-heading"><h2>Consultas cadastrais</h2><ShieldCheck className="h-4 w-4" /></div>
                <div className="proposal-score-empty" aria-label="Resultados disponíveis na aba Consultas"><div><ShieldCheck className="h-7 w-7" /><span>Consultas</span></div></div>
                <div className="proposal-analysis-copy"><span className="proposal-neutral-badge">Resultados protegidos</span><p>Consulte os resultados autorizados para esta proposta na aba Consultas.</p></div>
                <button type="button" className="btn-no-liquid btn-outline proposal-aside-action" onClick={() => setTab('Consultas')}><Search className="h-3.5 w-3.5" /> Ver consultas</button>
              </section>
              <section className="card proposal-address-section">
                <div className="proposal-section-heading"><h2>Endereço do principal</h2><MapPin className="h-4 w-4" /></div>
                {(() => {
                  const principal = proponentes.find(p => p.principal)
                  const address = principal ? addressValue(principal) : []
                  return address.length ? <address className="proposal-address">{address.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}{principal?.endereco_cep && <span>CEP {principal.endereco_cep}</span>}</address> : <p className="proposal-address-empty">Endereço ainda não informado no cadastro do proponente principal.</p>
                })()}
              </section>
            </aside>
          </div>
      )}

      {tab === 'Imóveis' && (
        <div className="card overflow-x-auto">
          {!imoveis ? <div className="p-10 text-center text-sm text-silver-500">Carregando…</div>
            : imoveis.length === 0 ? <div className="p-10 text-center text-sm text-silver-500">Sem imóveis.</div>
            : <table className="w-full text-sm">
              <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
                <tr><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Endereço</th><th className="px-4 py-3">Cidade/UF</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Flags</th></tr>
              </thead>
              <tbody>
                {imoveis.map(i => (
                  <tr key={i.id} className="border-t border-silver-100">
                    <td className="px-4 py-3 capitalize">{i.tipo}</td>
                    <td className="px-4 py-3">{[i.logradouro, i.numero, i.bairro].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-4 py-3">{[i.cidade, i.estado].filter(Boolean).join('/') || '—'}</td>
                    <td className="px-4 py-3 font-medium">{brl(Number(i.valor) * 100)}</td>
                    <td className="px-4 py-3 text-xs">
                      {i.alugado && <span className="mr-1 badge bg-blue-100 text-blue-700">Alugado</span>}
                      {i.financiado && <span className="mr-1 badge bg-yellow-100 text-yellow-700">Financiado</span>}
                      {i.possui_debitos && <span className="badge bg-red-100 text-red-700">Débitos</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>}
        </div>
      )}

      {tab === 'Documentos' && id && (
        <PropostaDocsUploader propostaId={id} origem="parceiro" />
      )}

      {tab === 'Pendências' && id && (
        <PropostaPendencias propostaId={id} role="parceiro" />
      )}

      {tab === 'Consultas' && id && (
        <PropostaConsultas propostaId={id} />
      )}

      {tab === 'Contrato' && id && (
        <PropostaContrato propostaId={id} role="partner" />
      )}

      {tab === 'Histórico' && (
        <div className="card overflow-x-auto">
          {!historico ? <div className="p-10 text-center text-sm text-silver-500">Carregando…</div>
            : historico.length === 0 ? <div className="p-10 text-center text-sm text-silver-500">Sem alterações de status.</div>
            : <ol className="space-y-3 p-4">
              {historico.map(h => (
                <li key={h.id} className="flex items-start gap-3 border-l-2 border-gold/40 pl-4">
                  <div className="flex-1">
                    <p className="text-sm">
                      {h.status_anterior ? <><span className="text-silver-500">{STATUS_LABEL[h.status_anterior] || h.status_anterior}</span> → </> : null}
                      <b className="text-navy">{STATUS_LABEL[h.status_novo] || h.status_novo}</b>
                    </p>
                    {h.motivo && <p className="text-xs text-silver-600">{h.motivo}</p>}
                    <p className="mt-1 text-xs text-silver-500">{new Date(h.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                </li>
              ))}
            </ol>}
        </div>
      )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-silver-500">{title}</h3>
      <dl className="space-y-3 text-sm">{children}</dl>
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-silver-100 pb-2 last:border-0">
      <dt className="text-silver-600">{k}</dt><dd className="font-medium text-silver-900">{v}</dd>
    </div>
  )
}

function PartnerRow({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt>{k}</dt><dd>{v}</dd></div>
}

function addressValue(person: Proponente): string[] {
  return [
    person.endereco_logradouro && [person.endereco_logradouro, person.endereco_numero].filter(Boolean).join(', '),
    person.endereco_complemento,
    [person.endereco_bairro, [person.endereco_cidade, person.endereco_estado].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
  ].filter((line): line is string => Boolean(line))
}
