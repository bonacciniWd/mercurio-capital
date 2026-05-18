import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { StatusBadge } from '@/components/Badge'
import { brl } from '@/lib/utils'
import { ArrowLeft, Link2, Copy, Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { calcularFinanciamento, calcularLTV } from '@/lib/credito'
import { PropostaDocsUploader } from '@/components/PropostaDocsUploader'
import { PropostaPendencias } from '@/components/PropostaPendencias'
import { PropostaConsultas } from '@/components/PropostaConsultas'

const TABS = ['Resumo', 'Proponentes', 'Imóveis', 'Documentos', 'Pendências', 'Consultas', 'Histórico'] as const

const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Rascunho',
  pre_analise: 'Pré-análise',
  analise_credito: 'Análise de Crédito',
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
  cliente: { nome_completo: string; cpf: string | null; email: string | null; telefone: string | null } | null
}

interface Proponente {
  id: string
  nome: string
  cpf_cnpj: string | null
  principal: boolean
  relacao: string | null
  estado_civil: string | null
  pessoa_tipo: string
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
  const [reissueCopied, setReissueCopied] = useState(false)

  async function handleReissue() {
    if (!id) return
    setReissuing(true)
    setReissueError(null)
    setReissueUrl(null)
    try {
      const { data, error } = await supabase.functions.invoke('magic-link-issue', {
        body: { proposta_id: id },
      })
      if (error) throw new Error(error.message)
      const payload = data as { url?: string; magic_token?: string }
      if (!payload?.url) throw new Error('Resposta inválida da função.')
      setReissueUrl(payload.url)
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
        .select('id, protocolo, produto, status, valor_solicitado, valor_imoveis_total, prazo_meses, carencia_meses, taxa_juros_mensal, amortizacao, correcao, indexador, created_at, updated_at, cliente:clientes(nome_completo, cpf, email, telefone)')
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
        .select('id, nome, cpf_cnpj, principal, relacao, estado_civil, pessoa_tipo')
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

  if (isLoading) return <div className="p-10 text-center text-silver-500">Carregando…</div>
  if (error) return <div className="p-10 text-center text-danger">Erro: {(error as Error).message}</div>
  if (!proposta) return <div className="p-10 text-center text-silver-500">Proposta não encontrada.</div>

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
    <>
      <Link to="/p/propostas" className="mb-4 inline-flex items-center gap-1 text-sm text-silver-600 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-silver-500">{proposta.protocolo}</p>
          <h1 className="text-2xl font-bold text-navy">
            {proposta.cliente?.nome_completo || 'Cliente'} — {PRODUTO_LABEL[proposta.produto] || proposta.produto}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-silver-600">
            <StatusBadge status={STATUS_LABEL[proposta.status] || proposta.status} />
            <span>·</span>
            <span>Criada {new Date(proposta.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={handleReissue}
            disabled={reissuing}
            className="btn-outline flex items-center gap-2 text-sm disabled:opacity-60"
          >
            {reissuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Reemitir magic link
          </button>
          {reissueUrl ? (
            <div className="flex items-center gap-2 rounded-md border border-silver-200 bg-silver-50 px-2 py-1 text-xs">
              <code className="max-w-[220px] truncate font-mono text-silver-700">{reissueUrl}</code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(reissueUrl)
                  setReissueCopied(true)
                  setTimeout(() => setReissueCopied(false), 2000)
                }}
                className="rounded p-1 text-silver-600 hover:bg-white hover:text-navy"
                title="Copiar"
              >
                {reissueCopied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ) : null}
          {reissueError ? <p className="text-xs text-danger">{reissueError}</p> : null}
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-silver-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t ? 'border-gold text-navy' : 'border-transparent text-silver-500 hover:text-navy'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Resumo' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Dados do produto">
            <Row k="Produto" v={PRODUTO_LABEL[proposta.produto] || proposta.produto} />
            <Row k="Valor solicitado" v={brl(valor * 100)} />
            <Row k="Prazo" v={`${proposta.prazo_meses} meses`} />
            <Row k="Carência" v={`${proposta.carencia_meses} meses`} />
            <Row k="Sistema" v={`${proposta.amortizacao.toUpperCase()} · ${proposta.indexador} + ${Number(proposta.taxa_juros_mensal).toFixed(2)}% a.m.`} />
          </Section>
          <Section title="Dados do cliente">
            <Row k="Nome" v={proposta.cliente?.nome_completo || '—'} />
            <Row k="CPF/CNPJ" v={proposta.cliente?.cpf || '—'} />
            <Row k="E-mail" v={proposta.cliente?.email || '—'} />
            <Row k="Telefone" v={proposta.cliente?.telefone || '—'} />
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
        <div className="card overflow-x-auto">
          {!proponentes ? <div className="p-10 text-center text-sm text-silver-500">Carregando…</div>
            : proponentes.length === 0 ? <div className="p-10 text-center text-sm text-silver-500">Sem proponentes.</div>
            : <table className="w-full text-sm">
              <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
                <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">CPF/CNPJ</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Relação</th><th className="px-4 py-3">Estado civil</th></tr>
              </thead>
              <tbody>
                {proponentes.map(p => (
                  <tr key={p.id} className="border-t border-silver-100">
                    <td className="px-4 py-3 font-medium text-silver-900">{p.nome} {p.principal && <span className="ml-1 badge bg-gold/15 text-gold-700">Principal</span>}</td>
                    <td className="px-4 py-3">{p.cpf_cnpj || '—'}</td>
                    <td className="px-4 py-3">{p.pessoa_tipo}</td>
                    <td className="px-4 py-3">{p.relacao || '—'}</td>
                    <td className="px-4 py-3">{p.estado_civil || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>}
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
    </>
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
