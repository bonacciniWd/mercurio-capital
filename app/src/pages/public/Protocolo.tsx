import { useState } from 'react'
import { Logo } from '@/components/Logo'
import { StatusBadge } from '@/components/Badge'
import { Search, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'

export function Protocolo() {
  const [searched, setSearched] = useState(false)
  const steps = ['Recebida', 'Pré-análise', 'Análise de Crédito', 'Comitê', 'Contrato', 'Recurso Liberado']
  const current = 2

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-navy">Acompanhe sua proposta</h1>
          <p className="mt-1 text-sm text-silver-600">Sem necessidade de cadastro. Informe o número do protocolo.</p>
          <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); setSearched(true) }}>
            <div>
              <label className="label">Número do protocolo</label>
              <input className="input font-mono" placeholder="MC-2024-XXXXXX" defaultValue="MC-2024-0042" />
            </div>
            <div className="rounded-lg border border-silver-200 bg-silver-50 p-3 text-center text-xs text-silver-500">
              [ Cloudflare Turnstile · verificação de segurança ]
            </div>
            <button type="submit" className="btn-gold w-full"><Search className="h-4 w-4" /> Consultar</button>
          </form>

          {searched && (
            <div className="mt-8 border-t border-silver-200 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-silver-500">Protocolo</p>
                  <p className="font-mono font-semibold text-navy">MC-2024-0042</p>
                </div>
                <StatusBadge status="Análise de Crédito" />
              </div>

              <div className="mt-6">
                <p className="mb-3 text-sm font-medium text-silver-700">Andamento</p>
                <div className="flex items-center gap-2">
                  {steps.map((s, i) => (
                    <div key={s} className="flex-1">
                      <div className={`h-1.5 rounded-full ${i < current ? 'bg-success' : i === current ? 'bg-gold' : 'bg-silver-200'}`} />
                      <p className={`mt-2 text-[11px] ${i <= current ? 'text-silver-900' : 'text-silver-400'}`}>{s}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-warning/30 bg-warning/5 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-silver-900">2 documentos solicitados</p>
                    <ul className="mt-3 space-y-2">
                      <DocItem name="Comprovante de renda — últimos 3 meses" />
                      <DocItem name="Certidão de matrícula atualizada do imóvel" />
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-silver-500">Dúvidas? Entre em contato com seu parceiro.</p>
      </div>
    </div>
  )
}

function DocItem({ name }: { name: string }) {
  return (
    <li className="flex items-center justify-between rounded-md border border-silver-200 bg-white p-2.5">
      <span className="text-sm text-silver-800">{name}</span>
      <button className="btn-no-liquid btn-outline px-3 py-1.5 text-xs"><Upload className="h-3.5 w-3.5" /> Enviar</button>
    </li>
  )
}
