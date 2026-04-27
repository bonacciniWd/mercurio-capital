import { Badge } from '@/components/Badge'
import { Download, ChevronDown } from 'lucide-react'

const events = [
  { ts: '12/04 14:32:08', user: 'mariana@aurora.com', action: 'UPDATE', table: 'propostas', desc: 'Proposta MC-2024-0042 avançou para "Análise de Crédito"' },
  { ts: '12/04 14:30:11', user: 'admin@mercurio.com', action: 'INSERT', table: 'precos_consulta', desc: 'Novo preço Serasa PF: R$ 4,90' },
  { ts: '12/04 14:28:50', user: 'sistema', action: 'UPDATE', table: 'partner_wallets', desc: 'Débito automático R$ 4,90 — saldo R$ 1.250,00' },
  { ts: '12/04 14:20:22', user: 'carlos@aurora.com', action: 'INSERT', table: 'documentos', desc: 'Upload de IRPF 2024 (1.2 MB)' },
  { ts: '12/04 14:15:00', user: 'admin@mercurio.com', action: 'DELETE', table: 'team_members', desc: 'Remoção do membro inactive@aurora.com' },
]

const VARIANT = { INSERT: 'green', UPDATE: 'blue', DELETE: 'red' } as const

export function AdminAuditoria() {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold text-navy">Log de auditoria</h1>
        <button className="btn-outline"><Download className="h-4 w-4" /> Exportar CSV</button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card p-4 text-sm"><p className="text-silver-500">Hoje</p><p className="text-2xl font-bold text-navy">124 eventos</p></div>
        <div className="card p-4 text-sm"><p className="text-silver-500">Esta semana</p><p className="text-2xl font-bold text-navy">891 eventos</p></div>
        <div className="card p-4 text-sm">
          <p className="text-silver-500">Usuário mais ativo</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">M</div>
            <span className="text-sm font-semibold">mariana@aurora.com</span>
          </div>
        </div>
      </div>

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <input type="date" className="input w-auto" />
        <input type="date" className="input w-auto" />
        <select className="input w-auto"><option>Usuário</option></select>
        <select className="input w-auto"><option>Ação</option><option>INSERT</option><option>UPDATE</option><option>DELETE</option></select>
        <select className="input w-auto"><option>Tabela</option></select>
      </div>

      <div className="card divide-y divide-silver-100">
        {events.map((e, i) => (
          <details key={i} className="group p-4">
            <summary className="flex cursor-pointer items-center gap-3 text-sm">
              <span className="font-mono text-xs text-silver-500 shrink-0 w-32">{e.ts}</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-white shrink-0">{e.user[0].toUpperCase()}</div>
              <Badge variant={VARIANT[e.action as keyof typeof VARIANT]}>{e.action}</Badge>
              <code className="text-xs text-silver-600">{e.table}</code>
              <span className="flex-1 text-silver-800">{e.desc}</span>
              <ChevronDown className="h-4 w-4 text-silver-400 transition group-open:rotate-180" />
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <pre className="overflow-x-auto rounded-md bg-danger/5 p-3 text-xs text-silver-700">
{`{
  "status": "Pré-análise"
}`}</pre>
              <pre className="overflow-x-auto rounded-md bg-success/5 p-3 text-xs text-silver-700">
{`{
  "status": "Análise de Crédito"
}`}</pre>
            </div>
          </details>
        ))}
      </div>
    </>
  )
}
