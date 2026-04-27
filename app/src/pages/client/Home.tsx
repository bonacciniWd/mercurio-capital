import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/Badge'
import { brl } from '@/lib/utils'
import { AlertTriangle, ArrowRight, FileText, Clock } from 'lucide-react'

const propostas = [
  { id: 'MC-2024-0042', produto: 'Home Equity', valor: 35000000, status: 'Análise de Crédito', step: 2, updated: 'há 2h' },
  { id: 'MC-2024-0061', produto: 'Financiamento Imobiliário', valor: 62000000, status: 'Análise Jurídica', step: 4, updated: 'ontem' },
]

export function ClientHome() {
  return (
    <>
      <div className="mb-6 rounded-lg bg-gradient-to-r from-navy to-navy-600 p-6 text-white">
        <h1 className="text-2xl font-bold">Olá, João Silva 👋</h1>
        <p className="mt-1 text-white/80">Acompanhe o andamento das suas propostas.</p>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
        <AlertTriangle className="h-5 w-5 text-warning" />
        <span className="text-silver-800">Você tem <b>3 documentos pendentes</b> para envio.</span>
        <Link to="/c/documentos" className="ml-auto font-medium text-navy underline">Ver agora</Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card label="Propostas em andamento" value="2" />
        <Card label="Documentos pendentes" value="3" tone="danger" />
        <Card label="Próxima etapa" value="Análise Jurídica" small />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-silver-500">Suas propostas</h2>
      <div className="space-y-4">
        {propostas.map(p => (
          <div key={p.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-navy/5 p-2.5"><FileText className="h-5 w-5 text-navy" /></div>
                <div>
                  <p className="font-mono text-xs text-silver-500">{p.id}</p>
                  <p className="text-base font-semibold text-navy">{p.produto}</p>
                  <p className="text-sm text-silver-600">Valor: <b>{brl(p.valor)}</b></p>
                </div>
              </div>
              <StatusBadge status={p.status} />
            </div>

            <div className="mt-4 flex items-center gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i < p.step ? 'bg-success' : i === p.step ? 'bg-gold' : 'bg-silver-200'}`} />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-silver-500">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Atualizado {p.updated}</span>
              <Link to="/c/documentos" className="inline-flex items-center gap-1 font-medium text-gold-600">
                Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function Card({ label, value, tone, small }: { label: string; value: string; tone?: 'danger'; small?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wide text-silver-500">{label}</p>
      <p className={`mt-2 font-bold ${small ? 'text-lg' : 'text-3xl'} ${tone === 'danger' ? 'text-danger' : 'text-navy'}`}>{value}</p>
    </div>
  )
}
