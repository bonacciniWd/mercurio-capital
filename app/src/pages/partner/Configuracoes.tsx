import { useState } from 'react'

const sub = ['Perfil da empresa', 'Notificações', 'Integrações', 'Segurança'] as const

export function PartnerConfig() {
  const [active, setActive] = useState<typeof sub[number]>('Perfil da empresa')
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-navy">Configurações</h1>
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="card h-fit p-2">
          {sub.map(s => (
            <button key={s} onClick={() => setActive(s)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium ${active === s ? 'bg-navy text-white' : 'text-silver-700 hover:bg-silver-100'}`}>
              {s}
            </button>
          ))}
        </nav>

        <div className="card p-6">
          {active === 'Perfil da empresa' && <Perfil />}
          {active === 'Notificações' && <Notif />}
          {active === 'Integrações' && <p className="text-silver-500">[ APIs externas em construção ]</p>}
          {active === 'Segurança' && <p className="text-silver-500">[ 2FA + sessões ativas em construção ]</p>}
        </div>
      </div>
    </>
  )
}

function Perfil() {
  return (
    <>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-navy text-3xl font-bold text-gold">A</div>
        <button className="btn-outline">Alterar logo</button>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Razão social" v="Construtora Aurora LTDA" />
        <Field label="CNPJ" v="12.345.678/0001-90" disabled />
        <Field label="Website" v="https://aurora.com.br" />
        <Field label="WhatsApp comercial" v="+55 (11) 9XXXX-1234" />
        <div className="md:col-span-2"><Field label="Endereço comercial" v="Av. Paulista, 1000 — Bela Vista, SP" /></div>
      </div>
      <button className="btn-gold mt-6">Salvar alterações</button>
    </>
  )
}

function Notif() {
  const items = [
    'Nova proposta atualizada',
    'Documento aprovado / rejeitado',
    'Saldo de carteira baixo (< R$ 50)',
    'Convite de membro aceito',
    'Status de proposta avançou',
  ]
  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Preferências de notificação</h2>
      <div className="mt-4 overflow-hidden rounded-lg border border-silver-200">
        <table className="w-full text-sm">
          <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
            <tr><th className="px-4 py-3">Evento</th><th className="px-4 py-3 text-center">WhatsApp</th><th className="px-4 py-3 text-center">E-mail</th><th className="px-4 py-3 text-center">Push</th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it} className="border-t border-silver-100">
                <td className="px-4 py-3 text-silver-800">{it}</td>
                {[0, 1, 2].map(i => (
                  <td key={i} className="px-4 py-3 text-center"><input type="checkbox" defaultChecked={i !== 2} className="h-4 w-4 accent-gold" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Field({ label, v, disabled }: { label: string; v: string; disabled?: boolean }) {
  return <div><label className="label">{label}</label><input className="input" defaultValue={v} disabled={disabled} /></div>
}
