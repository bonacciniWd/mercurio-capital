import { Badge } from '@/components/Badge'
import { Plus, Play, Zap, MessageSquare } from 'lucide-react'

const fluxos = [
  { id: 1, name: 'Notificar cliente — pendência aberta', trigger: 'pendencia_aberta', active: true, runs: 124 },
  { id: 2, name: 'Cobrar saldo carteira baixo', trigger: 'saldo_baixo', active: true, runs: 38 },
  { id: 3, name: 'Boas-vindas parceiro aprovado', trigger: 'partner_aprovado', active: true, runs: 12 },
  { id: 4, name: 'Lembrete de assinatura pendente', trigger: 'cron diário 9h', active: false, runs: 0 },
]

const log = [
  { ts: '12/04 14:32', trig: 'pendencia_aberta', result: 'Sucesso', dest: '+55 11 9XXXX-1234' },
  { ts: '12/04 14:21', trig: 'pendencia_aberta', result: 'Sucesso', dest: '+55 11 9XXXX-5678' },
  { ts: '12/04 13:50', trig: 'saldo_baixo', result: 'Erro', dest: 'aurora@email.com' },
]

export function AdminFluxos() {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold text-navy">Fluxos automatizados</h1>
        <button className="btn-gold"><Plus className="h-4 w-4" /> Novo fluxo</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-2">
          {fluxos.map(f => (
            <div key={f.id} className={`card cursor-pointer p-4 ${f.id === 1 ? 'border-l-4 border-gold' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-silver-900">{f.name}</p>
                <label className="inline-flex cursor-pointer items-center">
                  <input type="checkbox" defaultChecked={f.active} className="peer sr-only" />
                  <div className="peer h-4 w-7 rounded-full bg-silver-300 after:absolute after:left-[2px] after:top-[2px] after:h-3 after:w-3 after:rounded-full after:bg-white peer-checked:bg-success peer-checked:after:translate-x-3 relative" />
                </label>
              </div>
              <p className="mt-1 text-xs text-silver-500">⚡ {f.trigger}</p>
              <p className="mt-2 text-xs text-silver-500">{f.runs} execuções</p>
            </div>
          ))}
        </aside>

        <div className="card p-5">
          <input className="text-lg font-bold text-navy bg-transparent outline-none w-full" defaultValue="Notificar cliente — pendência aberta" />

          <section className="mt-6 rounded-lg border border-silver-200 p-4">
            <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-silver-700"><Zap className="h-4 w-4 text-gold" /> Gatilho</h3>
            <select className="input">
              <option>pendencia_aberta</option><option>proposta_status_changed</option><option>partner_aprovado</option><option>manual</option><option>cron</option>
            </select>
          </section>

          <section className="mt-4 rounded-lg border border-silver-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-silver-700">Condições</h3>
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-silver-50 p-3 text-sm">
              <select className="input w-auto"><option>tipo_doc</option></select>
              <select className="input w-auto"><option>=</option></select>
              <input className="input w-32" defaultValue="comprovante_renda" />
            </div>
            <button className="mt-3 text-sm font-medium text-gold-600">+ Adicionar condição</button>
          </section>

          <section className="mt-4 rounded-lg border border-silver-200 p-4">
            <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-silver-700"><MessageSquare className="h-4 w-4 text-chart-blue" /> Ação — WhatsApp</h3>
            <select className="input"><option>Template: pendencia_doc_v1</option></select>
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-silver-900 p-3 text-xs text-silver-100">
{`Olá {{nome_cliente}} 👋
Sua proposta {{protocolo}} precisa do documento:
📄 {{nome_doc}}

Envie por aqui: {{magic_link}}`}</pre>
          </section>

          <section className="mt-4 flex items-center gap-2">
            <input className="input flex-1" placeholder="Testar com proposta MC-2024-0042" />
            <button className="btn-outline"><Play className="h-4 w-4" /> Executar teste</button>
          </section>

          <section className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-silver-700">Log de execução</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-silver-500">
                <tr><th className="py-2">Quando</th><th className="py-2">Gatilho</th><th className="py-2">Resultado</th><th className="py-2">Destinatário</th></tr>
              </thead>
              <tbody>
                {log.map((l, i) => (
                  <tr key={i} className="border-t border-silver-100">
                    <td className="py-2 text-silver-600">{l.ts}</td>
                    <td className="py-2 text-silver-700"><code>{l.trig}</code></td>
                    <td className="py-2"><Badge variant={l.result === 'Sucesso' ? 'green' : 'red'}>{l.result}</Badge></td>
                    <td className="py-2 text-silver-700">{l.dest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </>
  )
}
