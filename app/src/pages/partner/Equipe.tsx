import { Plus, Mail } from 'lucide-react'

const team = [
  { name: 'Mariana Costa', email: 'mariana@aurora.com', role: 'Assistente', team: 'Vendas SP', count: 12, active: true },
  { name: 'Carlos Oliveira', email: 'carlos@aurora.com', role: 'Assistente', team: 'Vendas SP', count: 8, active: true },
  { name: 'Beatriz Lima', email: 'beatriz@aurora.com', role: 'Assistente', team: 'Vendas RJ', count: 5, active: false },
]
const invites = [
  { email: 'novo@aurora.com', sent: 'há 2 dias' },
]

export function PartnerEquipe() {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Minha equipe</h1>
          <p className="text-sm text-silver-600">Gerencie assistentes e equipes da sua operação.</p>
        </div>
        <button className="btn-gold"><Plus className="h-4 w-4" /> Convidar assistente</button>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {team.map(m => (
          <div key={m.email} className="card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-white text-lg font-bold">{m.name[0]}</div>
              <div className="flex-1">
                <p className="font-semibold text-silver-900">{m.name}</p>
                <p className="text-xs text-silver-500">{m.email}</p>
              </div>
              <label className="inline-flex cursor-pointer items-center">
                <input type="checkbox" defaultChecked={m.active} className="peer sr-only" />
                <div className="peer h-5 w-9 rounded-full bg-silver-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-success peer-checked:after:translate-x-4 relative" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge bg-navy/10 text-navy">{m.role}</span>
              <span className="badge bg-gold/15 text-gold-700">{m.team}</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-silver-100 pt-3 text-sm">
              <span className="text-silver-600">{m.count} propostas</span>
              <button className="font-medium text-gold-600 hover:underline">Ver propostas →</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-semibold text-navy">Convites pendentes</h2>
        {invites.map(i => (
          <div key={i.email} className="flex items-center justify-between rounded-md bg-silver-50 p-3 text-sm">
            <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-silver-500" /> {i.email}</span>
            <span className="text-xs text-silver-500">enviado {i.sent}</span>
            <button className="text-xs font-medium text-gold-600 hover:underline">Reenviar convite</button>
          </div>
        ))}
      </div>
    </>
  )
}
