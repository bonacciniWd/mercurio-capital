import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { StatusBadge } from '@/components/Badge'
import { brl } from '@/lib/utils'
import { ArrowLeft, FileUp, ArrowRightCircle } from 'lucide-react'

const TABS = ['Resumo', 'Proponentes', 'Imóveis', 'Documentos', 'Histórico', 'Kanban'] as const

export function PartnerPropostaDetalhe() {
  const { id } = useParams()
  const [tab, setTab] = useState<typeof TABS[number]>('Resumo')

  return (
    <>
      <Link to="/p/propostas" className="mb-4 inline-flex items-center gap-1 text-sm text-silver-600 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-silver-500">Proposta {id}</p>
          <h1 className="text-2xl font-bold text-navy">João Silva — Home Equity</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-silver-600">
            <StatusBadge status="Análise de Crédito" />
            <span>·</span>
            <span>Responsável: <b>Mariana Costa</b></span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline"><FileUp className="h-4 w-4" /> Solicitar documentos</button>
          <button className="btn-gold"><ArrowRightCircle className="h-4 w-4" /> Avançar status</button>
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
            <Row k="Produto" v="Home Equity (PF)" />
            <Row k="Valor solicitado" v={brl(35000000)} />
            <Row k="Prazo" v="120 meses" />
            <Row k="Sistema" v="Price · IPCA + 1,39% a.m." />
          </Section>
          <Section title="Dados do cliente">
            <Row k="Nome" v="João Silva" />
            <Row k="CPF" v="***.***.***-12" />
            <Row k="E-mail" v="joao.silva@email.com" />
            <Row k="Telefone" v="(11) 9XXXX-1234" />
          </Section>
          <Section title="Imóvel garantia">
            <Row k="Endereço" v="Rua das Flores, 123 — Jardins, São Paulo/SP" />
            <Row k="Tipo" v="Apartamento residencial" />
            <Row k="Valor" v={brl(85000000)} />
          </Section>
          <Section title="Simulação financeira">
            <Row k="LTV" v={<span className="badge bg-success/15 text-success">41%</span>} />
            <Row k="Parcela" v={brl(423000)} />
            <Row k="Relação renda" v="28%" />
            <Row k="Total a pagar" v={brl(50760000)} />
          </Section>
        </div>
      )}

      {tab !== 'Resumo' && (
        <div className="card p-10 text-center text-silver-500">
          Aba <b className="text-navy">{tab}</b> — conteúdo do protótipo em construção.
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
