import { useState } from 'react'
import { brl } from '@/lib/utils'
import { Badge } from '@/components/Badge'
import { CreditCard, Wallet, ArrowDown, ArrowUp, RotateCcw } from 'lucide-react'

const PRECOS = [
  { id: 'serasa_pf', label: 'Serasa PF', preco: 490 },
  { id: 'serasa_pj', label: 'Serasa PJ', preco: 790 },
  { id: 'bacen_cpf', label: 'Bacen CPF', preco: 250 },
  { id: 'jusbrasil', label: 'Jusbrasil', preco: 500 },
  { id: 'ri_digital', label: 'RI Digital — matrícula', preco: 990 },
]
const EXTRATO = [
  { data: '12/04 14:32', tipo: 'Recarga', desc: 'Stripe · Cartão final 4242', valor: 10000, saldo: 125000 },
  { data: '12/04 14:00', tipo: 'Débito', desc: 'Serasa PF · CPF João Silva', valor: -490, saldo: 115000 },
  { data: '11/04 09:15', tipo: 'Estorno', desc: 'Bacen CPF (falha técnica)', valor: 250, saldo: 115490 },
  { data: '10/04 17:20', tipo: 'Débito', desc: 'Jusbrasil · CNPJ Ata Construções', valor: -500, saldo: 115240 },
]

export function PartnerCarteira() {
  const [valor, setValor] = useState(10000)
  const presets = [5000, 10000, 25000, 50000]

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-navy">Minha carteira</h1>

      <div className="mb-6 overflow-hidden rounded-lg bg-gradient-to-r from-navy to-navy-700 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="h-7 w-7 text-gold" />
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">Saldo disponível</p>
              <p className="text-3xl font-bold">{brl(125000)}</p>
              <p className="text-xs text-white/50">Atualizado agora</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-gold">Recarregar saldo</button>
            <button className="btn-outline border-white/30 bg-transparent text-white hover:bg-white/10">Ver extrato</button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold text-navy">Recarregar</h2>
          <p className="text-sm text-silver-600">Selecione um valor predefinido ou personalize.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {presets.map(v => (
              <button key={v} onClick={() => setValor(v)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium ${valor === v ? 'border-gold bg-gold text-navy' : 'border-silver-300 hover:border-gold'}`}>
                {brl(v)}
              </button>
            ))}
            <button className="rounded-full border border-silver-300 px-4 py-1.5 text-sm font-medium hover:border-gold">Outro</button>
          </div>
          <button className="btn-gold mt-5 w-full"><CreditCard className="h-4 w-4" /> Pagar com Stripe</button>
          <p className="mt-3 text-center text-xs text-silver-500">Aceitamos Visa · Mastercard · Pix</p>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-navy">Consultas disponíveis</h2>
          <p className="text-sm text-silver-600">Preços vigentes — débito automático no saldo.</p>
          <ul className="mt-4 divide-y divide-silver-100 text-sm">
            {PRECOS.map(p => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <span className="text-silver-800">{p.label}</span>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-navy">{brl(p.preco)}</span>
                  <button className="rounded-md border border-silver-300 px-3 py-1 text-xs font-medium hover:border-gold hover:text-gold-600">Consultar</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <h2 className="border-b border-silver-200 p-5 font-semibold text-navy">Extrato</h2>
        <table className="w-full text-sm">
          <thead className="bg-silver-50 text-left text-xs uppercase text-silver-500">
            <tr>
              <th className="px-5 py-3">Data</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Descrição</th><th className="px-5 py-3 text-right">Valor</th><th className="px-5 py-3 text-right">Saldo após</th>
            </tr>
          </thead>
          <tbody>
            {EXTRATO.map((e, i) => (
              <tr key={i} className="border-t border-silver-100">
                <td className="px-5 py-3 text-silver-600">{e.data}</td>
                <td className="px-5 py-3">
                  <Badge variant={e.tipo === 'Recarga' ? 'green' : e.tipo === 'Estorno' ? 'amber' : 'gray'}>
                    <span className="inline-flex items-center gap-1">
                      {e.tipo === 'Recarga' && <ArrowDown className="h-3 w-3" />}
                      {e.tipo === 'Débito' && <ArrowUp className="h-3 w-3" />}
                      {e.tipo === 'Estorno' && <RotateCcw className="h-3 w-3" />}
                      {e.tipo}
                    </span>
                  </Badge>
                </td>
                <td className="px-5 py-3 text-silver-700">{e.desc}</td>
                <td className={`px-5 py-3 text-right font-medium ${e.valor < 0 ? 'text-danger' : 'text-success'}`}>
                  {e.valor > 0 ? '+' : ''}{brl(e.valor)}
                </td>
                <td className="px-5 py-3 text-right font-medium text-silver-900">{brl(e.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
