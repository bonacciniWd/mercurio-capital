import { Badge } from '@/components/Badge'
import { Settings2 } from 'lucide-react'

const integrations = [
  { name: 'Evolution API (WhatsApp)', desc: 'Envio de mensagens transacionais.', status: 'Conectado', sync: 'há 2 min' },
  { name: 'Clicksign', desc: 'Assinatura eletrônica de contratos.', status: 'Conectado', sync: 'há 12 min' },
  { name: 'Stripe', desc: 'Pagamentos de carteira e LMS.', status: 'Conectado', sync: 'há 1 min' },
  { name: 'FCM Push', desc: 'Notificações push mobile.', status: 'Conectado', sync: 'há 5 min' },
  { name: 'Serasa', desc: 'Bureau PF/PJ.', status: 'Conectado', sync: 'há 8 min' },
  { name: 'Bacen', desc: 'Consulta CPF/CNPJ.', status: 'Erro', sync: 'há 1h' },
  { name: 'Jusbrasil', desc: 'Processos judiciais.', status: 'Conectado', sync: 'há 30 min' },
  { name: 'Escavador', desc: 'Histórico processual e relacionamentos.', status: 'Conectado', sync: 'há 14 min' },
  { name: 'RI Digital', desc: 'Matrícula de imóveis.', status: 'Conectado', sync: 'há 22 min' },
  { name: 'Nacional Consultas', desc: 'Bens e certidões.', status: 'Desconectado', sync: '—' },
  { name: 'Vimeo', desc: 'Streaming dos cursos da Universidade.', status: 'Conectado', sync: 'há 1h' },
]

export function AdminIntegracoes() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-navy">Integrações externas</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map(i => (
          <div key={i.name} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-silver-100 text-navy">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-silver-900">{i.name}</h3>
                  <p className="text-xs text-silver-500">{i.desc}</p>
                </div>
              </div>
              <Badge variant={i.status === 'Conectado' ? 'green' : i.status === 'Erro' ? 'red' : 'gray'}>{i.status}</Badge>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-silver-100 pt-3 text-xs">
              <span className="text-silver-500">Última sync: {i.sync}</span>
              <button className="font-medium text-gold-600 hover:underline">Configurar →</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-5">
        <h2 className="font-semibold text-navy">Stripe — detalhes</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div><label className="label">Publishable key</label><input className="input font-mono" defaultValue="pk_test_••••••••••8K2" readOnly /></div>
          <div><label className="label">Secret key</label><input className="input font-mono" defaultValue="sk_test_••••••••••P4n" readOnly /></div>
          <div><label className="label">Webhook secret</label><input className="input font-mono" defaultValue="whsec_••••••••" readOnly /></div>
          <div>
            <label className="label">Modo</label>
            <div className="inline-flex rounded-lg bg-silver-100 p-1">
              <button className="rounded-md bg-white px-4 py-1.5 text-sm font-medium shadow-sm">Test</button>
              <button className="rounded-md px-4 py-1.5 text-sm font-medium text-silver-600">Produção</button>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold text-silver-700">Eventos recentes</h3>
          <table className="mt-2 w-full text-xs">
            <thead className="text-left text-silver-500"><tr><th className="py-1.5">Evento</th><th className="py-1.5">ID</th><th className="py-1.5">Quando</th><th className="py-1.5">Status</th></tr></thead>
            <tbody>
              <tr className="border-t border-silver-100"><td className="py-2">payment_intent.succeeded</td><td className="py-2 font-mono">pi_3OxK9...</td><td className="py-2">há 2 min</td><td className="py-2"><Badge variant="green">200</Badge></td></tr>
              <tr className="border-t border-silver-100"><td className="py-2">charge.refunded</td><td className="py-2 font-mono">ch_3OxK7...</td><td className="py-2">há 15 min</td><td className="py-2"><Badge variant="green">200</Badge></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
