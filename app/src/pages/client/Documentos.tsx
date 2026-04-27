import { useState } from 'react'
import { Upload, Check, X, FileText } from 'lucide-react'

const tabs = ['Pendentes (3)', 'Enviados (5)', 'Aprovados (2)'] as const

const docs = [
  { name: 'Comprovante de renda', desc: 'Últimos 3 meses (holerite ou DECORE).', deadline: 'Vence em 2 dias', urgent: true },
  { name: 'Certidão de matrícula', desc: 'Atualizada (até 30 dias) do cartório de registro.', deadline: 'Vence em 6 dias', urgent: false },
  { name: 'IRPF 2024 completa', desc: 'Recibo + declaração com todas as páginas.', deadline: 'Vence em 7 dias', urgent: false },
]

export function ClientDocs() {
  const [tab, setTab] = useState<typeof tabs[number]>('Pendentes (3)')
  const [uploaded, setUploaded] = useState<Record<string, string | null>>({})

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Documentos solicitados</h1>
        <p className="text-sm text-silver-600">Proposta <span className="font-mono">MC-2024-0042</span></p>
      </div>

      <div className="mb-6 inline-flex rounded-lg bg-silver-100 p-1">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-white text-navy shadow-sm' : 'text-silver-600 hover:text-navy'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {docs.map(d => {
          const file = uploaded[d.name]
          return (
            <div key={d.name} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 h-5 w-5 text-navy" />
                  <div>
                    <p className="font-semibold text-navy">{d.name}</p>
                    <p className="text-sm text-silver-600">{d.desc}</p>
                  </div>
                </div>
                <span className={`badge ${d.urgent ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                  {d.deadline}
                </span>
              </div>

              {file ? (
                <div className="mt-4 flex items-center justify-between rounded-md bg-success/5 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-success/15 p-1"><Check className="h-3.5 w-3.5 text-success" /></div>
                    <span className="font-medium text-silver-900">{file}</span>
                    <span className="text-silver-500">(1.2 MB)</span>
                  </div>
                  <button onClick={() => setUploaded(p => ({ ...p, [d.name]: null }))} className="inline-flex items-center gap-1 text-danger hover:underline">
                    <X className="h-4 w-4" /> Remover
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setUploaded(p => ({ ...p, [d.name]: 'arquivo.pdf' }))}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-silver-300 bg-silver-50 p-6 text-sm text-silver-600 hover:border-gold hover:text-navy"
                >
                  <Upload className="h-4 w-4" /> Arraste ou clique para selecionar — PDF / JPG / PNG até 10MB
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="sticky bottom-0 mt-8 flex items-center justify-between rounded-lg border border-silver-200 bg-white p-4 shadow-card">
        <p className="text-sm text-silver-700">3 pendentes · 5 enviados · 2 aprovados</p>
        <button className="btn-gold">Enviar todos</button>
      </div>
    </>
  )
}
