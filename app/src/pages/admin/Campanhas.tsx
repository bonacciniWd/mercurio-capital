import { Badge } from '@/components/Badge'
import { Plus, MessageSquare, Mail, Bell } from 'lucide-react'

const camp = [
  { name: 'Black Friday — Home Equity', canal: ['WhatsApp', 'E-mail'], publico: 'Parceiros ativos', envios: 47, abertura: 62, status: 'Enviada', data: '29/03' },
  { name: 'Recarga Bônus 10%', canal: ['Push'], publico: 'Saldo < R$50', envios: 12, abertura: 41, status: 'Enviada', data: '20/03' },
  { name: 'Comunicado RGPD', canal: ['E-mail'], publico: 'Todos clientes', envios: 0, abertura: 0, status: 'Rascunho', data: '—' },
  { name: 'Webinar Comitê', canal: ['WhatsApp'], publico: 'Parceiros premium', envios: 0, abertura: 0, status: 'Agendada', data: '15/04' },
]

const ICON: Record<string, React.ElementType> = { WhatsApp: MessageSquare, 'E-mail': Mail, Push: Bell }
const STATUS: Record<string, 'gray' | 'amber' | 'green'> = { Rascunho: 'gray', Agendada: 'amber', Enviada: 'green' }

export function AdminCampanhas() {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold text-navy">Campanhas de comunicação</h1>
        <button className="btn-gold"><Plus className="h-4 w-4" /> Nova campanha</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
            <tr>
              <th className="px-5 py-3">Nome</th><th className="px-5 py-3">Canais</th><th className="px-5 py-3">Público</th>
              <th className="px-5 py-3 text-right">Envios</th><th className="px-5 py-3 text-right">Abertura</th>
              <th className="px-5 py-3">Status</th><th className="px-5 py-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {camp.map(c => (
              <tr key={c.name} className="border-t border-silver-100 hover:bg-silver-50">
                <td className="px-5 py-3 font-medium text-silver-900">{c.name}</td>
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    {c.canal.map(k => {
                      const I = ICON[k]
                      return <span key={k} className="inline-flex items-center gap-1 rounded-md bg-silver-100 px-2 py-1 text-xs"><I className="h-3 w-3" /> {k}</span>
                    })}
                  </div>
                </td>
                <td className="px-5 py-3 text-silver-700">{c.publico}</td>
                <td className="px-5 py-3 text-right">{c.envios}</td>
                <td className="px-5 py-3 text-right">{c.abertura > 0 ? `${c.abertura}%` : '—'}</td>
                <td className="px-5 py-3"><Badge variant={STATUS[c.status]}>{c.status}</Badge></td>
                <td className="px-5 py-3 text-silver-700">{c.data}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card mt-6 p-5">
        <h3 className="mb-4 font-semibold text-navy">Pré-visualização — nova campanha</h3>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <div><label className="label">Nome</label><input className="input" placeholder="Webinar Crédito Construção" /></div>
            <div>
              <label className="label">Canais</label>
              <div className="flex gap-2">
                {['WhatsApp', 'E-mail', 'Push'].map(k => {
                  const I = ICON[k]
                  return <label key={k} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-silver-300 px-3 py-1.5 text-sm hover:border-gold">
                    <input type="checkbox" className="accent-gold" /><I className="h-4 w-4" /> {k}
                  </label>
                })}
              </div>
            </div>
            <div><label className="label">Público</label><select className="input"><option>Parceiros aprovados</option><option>Clientes ativos</option></select></div>
            <p className="text-xs text-silver-500">42 destinatários selecionados</p>
            <div>
              <label className="label">Mensagem (WhatsApp)</label>
              <textarea className="input min-h-[100px]" defaultValue="Olá {{nome}}! Convidamos você para o webinar exclusivo..." />
              <p className="mt-1 text-right text-xs text-silver-500">62 / 1024 caracteres</p>
            </div>
          </div>

          <div className="rounded-lg bg-silver-100 p-5">
            <p className="mb-3 text-xs font-semibold uppercase text-silver-500">Preview WhatsApp</p>
            <div className="rounded-2xl bg-[#dcf8c6] p-3 shadow text-sm text-silver-900">
              Olá <b>João</b>! Convidamos você para o webinar exclusivo "Crédito Construção 2026" — quinta às 19h.
              <p className="mt-2 text-xs text-silver-500">14:32 ✓✓</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-outline">Pré-visualizar</button>
          <button className="btn-gold">Enviar agora</button>
        </div>
      </div>
    </>
  )
}
