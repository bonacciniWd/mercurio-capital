import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { calcularFinanciamento } from '@/lib/credito'
import { PropostaDocsUploader } from '@/components/PropostaDocsUploader'
import { useState } from 'react'

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Crédito Construção',
  financiamento_imobiliario: 'Financiamento Imobiliário',
}

const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Em rascunho',
  pre_analise: 'Pré-análise',
  analise_credito: 'Análise de crédito',
  analise_imovel: 'Análise do imóvel',
  analise_juridica: 'Análise jurídica',
  comite: 'Comitê',
  proposta_cliente: 'Aguardando sua resposta',
  resolucao_pendencias: 'Pendências em aberto',
  emissao_contrato: 'Emissão de contrato',
  aguardando_assinatura: 'Aguardando assinatura',
  em_registro: 'Em registro',
  contrato_registrado: 'Contrato registrado',
  recurso_liberado: 'Recurso liberado',
  cancelado: 'Cancelada',
}

export function ClientPropostaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<'resumo' | 'documentos' | 'historico'>('resumo')

  const { data: proposta, isLoading } = useQuery({
    queryKey: ['client-proposta', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('*, cliente:clientes(nome_completo, email, cpf)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: imoveis } = useQuery({
    queryKey: ['client-proposta-imoveis', id],
    enabled: !!id && tab === 'resumo',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('imoveis')
        .select('*')
        .eq('proposta_id', id!)
      if (error) throw error
      return data || []
    },
  })

  const { data: historico } = useQuery({
    queryKey: ['client-proposta-historico', id],
    enabled: !!id && tab === 'historico',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_status_historico')
        .select('*')
        .eq('proposta_id', id!)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data || []
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    )
  }

  if (!proposta) {
    return (
      <div className="card p-10 text-center text-sm text-silver-600">
        Proposta não encontrada.
        <div className="mt-4">
          <Link to="/c" className="text-gold-600 underline">Voltar</Link>
        </div>
      </div>
    )
  }

  const taxa = Number(proposta.taxa_juros_mensal ?? 1.39) / 100
  const sim = calcularFinanciamento({
    valor: Number(proposta.valor_solicitado),
    prazoMeses: proposta.prazo_meses,
    taxaMensal: taxa,
    amortizacao: 'price',
    carenciaMeses: 0,
  })

  return (
    <div>
      <Link to="/c" className="inline-flex items-center gap-1 text-sm text-silver-500 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-silver-500">{proposta.protocolo}</p>
          <h1 className="text-2xl font-bold text-navy">{PRODUTO_LABEL[proposta.produto] || proposta.produto}</h1>
          <p className="text-sm text-silver-600">
            {brl(Number(proposta.valor_solicitado) * 100)} · {proposta.prazo_meses} meses
          </p>
        </div>
        <span className="rounded-full bg-navy/5 px-3 py-1.5 text-sm font-medium text-navy">
          {STATUS_LABEL[proposta.status] || proposta.status}
        </span>
      </div>

      <div className="mt-5 flex gap-2 border-b border-silver-200">
        <TabBtn active={tab === 'resumo'} onClick={() => setTab('resumo')}>Resumo</TabBtn>
        <TabBtn active={tab === 'documentos'} onClick={() => setTab('documentos')}>Documentos</TabBtn>
        <TabBtn active={tab === 'historico'} onClick={() => setTab('historico')}>Histórico</TabBtn>
      </div>

      <div className="mt-5">
        {tab === 'resumo' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-silver-500">Simulação estimada</p>
              <dl className="mt-3 space-y-2 text-sm">
                <Row k="Primeira parcela" v={brl(sim.primeiraParcela * 100)} />
                <Row k="Última parcela" v={brl(sim.ultimaParcela * 100)} />
                <Row k="Total a pagar" v={brl(sim.totalPago * 100)} />
                <Row k="Total de juros" v={brl(sim.totalJuros * 100)} />
              </dl>
            </div>
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-silver-500">Imóveis em garantia</p>
              {!imoveis?.length ? (
                <p className="mt-3 text-sm text-silver-500">Nenhum imóvel cadastrado.</p>
              ) : (
                <ul className="mt-3 space-y-3 text-sm">
                  {imoveis.map((im: any) => (
                    <li key={im.id} className="border-b border-silver-100 pb-2 last:border-0">
                      <p className="font-medium text-navy">{im.tipo} · {im.cidade}/{im.uf}</p>
                      <p className="text-silver-600">{im.endereco}</p>
                      <p className="text-xs text-silver-500">Avaliado em {brl(Number(im.valor_avaliacao ?? 0) * 100)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'documentos' && id && (
          <PropostaDocsUploader propostaId={id} origem="cliente" />
        )}

        {tab === 'historico' && (
          <div className="card p-5">
            {!historico?.length ? (
              <p className="text-sm text-silver-500">Sem eventos registrados.</p>
            ) : (
              <ul className="space-y-3">
                {historico.map((e: any) => (
                  <li key={e.id} className="flex items-start gap-3 border-b border-silver-100 pb-3 last:border-0">
                    <Clock className="mt-0.5 h-4 w-4 text-silver-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-navy">{e.status_anterior ?? '—'} → {e.status_novo}</p>
                      <p className="text-xs text-silver-500">{new Date(e.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
        active ? 'border-gold text-navy' : 'border-transparent text-silver-500 hover:text-navy'
      }`}
    >
      {children}
    </button>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-silver-100 pb-2 last:border-0">
      <dt className="text-silver-600">{k}</dt>
      <dd className="font-medium text-silver-900">{v}</dd>
    </div>
  )
}
