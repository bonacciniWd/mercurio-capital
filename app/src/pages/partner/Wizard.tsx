import { useState } from 'react'
import { Link } from 'react-router-dom'
import { brl } from '@/lib/utils'
import { Building, Home as HomeIcon, Hammer, Check, Plus, Trash2, MapPin, ChevronDown } from 'lucide-react'

const STEPS = ['Produto', 'Cliente', 'Localização', 'Valores', 'Proponentes', 'Imóveis', 'Revisão']

export function PartnerWizard() {
  const [step, setStep] = useState(0)

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Nova proposta</h1>
        <Link to="/p/propostas" className="text-sm text-silver-500 hover:underline">Cancelar</Link>
      </div>
      <p className="mb-6 text-sm text-silver-600">Passo {step + 1} de {STEPS.length} — {STEPS[step]}</p>

      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              i < step ? 'bg-success text-white' : i === step ? 'bg-gold text-navy' : 'bg-silver-200 text-silver-500'
            }`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < step ? 'bg-success' : 'bg-silver-200'}`} />}
          </div>
        ))}
      </div>

      <div className="card p-6">
        {step === 0 && <Step1 />}
        {step === 1 && <Step2 />}
        {step === 2 && <Step3 />}
        {step === 3 && <Step4 />}
        {step === 4 && <Step5 />}
        {step === 5 && <Step6 />}
        {step === 6 && <Step7 />}
      </div>

      <div className="mt-6 flex justify-between">
        <button onClick={() => setStep(s => Math.max(0, s - 1))} className="btn-ghost" disabled={step === 0}>← Anterior</button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} className="btn-gold">Próximo →</button>
        ) : (
          <button className="btn-gold">Salvar e enviar link ao cliente</button>
        )}
      </div>
    </div>
  )
}

function Step1() {
  const [produto, setProduto] = useState('Home Equity')
  const [tipo, setTipo] = useState<'PF' | 'PJ'>('PF')
  const opts = [
    { id: 'Home Equity', icon: HomeIcon, desc: 'Crédito com garantia de imóvel.' },
    { id: 'Crédito Construção', icon: Hammer, desc: 'Para obra ou reforma.' },
    { id: 'Financiamento Imobiliário', icon: Building, desc: 'Para aquisição de imóvel.' },
  ]
  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Tipo de produto e cliente</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {opts.map(o => (
          <button key={o.id} onClick={() => setProduto(o.id)}
            className={`rounded-lg border-2 p-5 text-left transition ${produto === o.id ? 'border-gold bg-gold/5' : 'border-silver-200 hover:border-silver-300'}`}>
            <o.icon className={`h-6 w-6 ${produto === o.id ? 'text-gold-600' : 'text-silver-500'}`} />
            <p className="mt-3 font-semibold text-navy">{o.id}</p>
            <p className="mt-1 text-xs text-silver-600">{o.desc}</p>
            {produto === o.id && <Check className="mt-3 h-4 w-4 text-gold-600" />}
          </button>
        ))}
      </div>
      <div className="mt-6">
        <label className="label">Tipo de pessoa</label>
        <div className="inline-flex rounded-lg bg-silver-100 p-1">
          {(['PF', 'PJ'] as const).map(t => (
            <button key={t} onClick={() => setTipo(t)}
              className={`rounded-md px-6 py-2 text-sm font-medium ${tipo === t ? 'bg-white text-navy shadow-sm' : 'text-silver-600'}`}>
              {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function Step2() {
  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Dados do cliente</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Nome completo *" placeholder="João Silva" />
        <Field label="CPF *" placeholder="000.000.000-00" />
        <Field label="Data de nascimento *" type="date" />
        <Field label="Nacionalidade" placeholder="Brasileiro" />
        <Field label="E-mail *" type="email" placeholder="joao@email.com" />
        <Field label="Telefone *" placeholder="+55 (11) 9XXXX-XXXX" />
        <div>
          <label className="label">Estado civil</label>
          <select className="input"><option>Solteiro(a)</option><option>Casado(a)</option><option>Divorciado(a)</option><option>Viúvo(a)</option><option>União estável</option></select>
        </div>
        <div>
          <label className="label">Vínculo empregatício</label>
          <select className="input"><option>CLT</option><option>Autônomo</option><option>Empresário</option><option>Aposentado</option></select>
        </div>
      </div>
      <div className="mt-6 border-t border-silver-200 pt-5">
        <h3 className="text-sm font-semibold text-silver-700">Renda</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <Field label="Profissão" placeholder="Engenheiro" />
          <Field label="Renda mensal bruta (R$)" placeholder="R$ 14.100,00" />
        </div>
      </div>
    </>
  )
}

function Step3() {
  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Localização do imóvel</h2>
      <div className="mt-5 flex items-end gap-2">
        <div className="flex-1"><Field label="CEP *" placeholder="01310-100" /></div>
        <button className="btn-outline">Buscar</button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Field label="Estado *" placeholder="SP" />
        <Field label="Cidade *" placeholder="São Paulo" />
        <Field label="Bairro *" placeholder="Jardins" />
        <div className="md:col-span-2"><Field label="Rua *" placeholder="Av. Paulista" /></div>
        <Field label="Número *" placeholder="1234" />
        <div className="md:col-span-3"><Field label="Complemento" placeholder="Apto 102" /></div>
      </div>
      <div className="mt-6 flex h-44 items-center justify-center rounded-lg border border-silver-200 bg-silver-100 text-silver-500">
        <MapPin className="mr-2 h-5 w-5" /> [ Mapa Google embed ]
      </div>
    </>
  )
}

function Step4() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h2 className="text-lg font-semibold text-navy">Valores e prazo</h2>
        <div className="mt-5 space-y-4">
          <Field label="Crédito desejado (R$)" placeholder="R$ 350.000,00" />
          <Field label="Valor do imóvel (R$)" placeholder="R$ 850.000,00" />
          <div>
            <label className="label">Correção</label>
            <div className="inline-flex rounded-lg bg-silver-100 p-1">
              <button className="rounded-md bg-white px-4 py-1.5 text-sm font-medium shadow-sm">Pós (IPCA)</button>
              <button className="rounded-md px-4 py-1.5 text-sm font-medium text-silver-600">Pré-fixado</button>
            </div>
          </div>
          <div>
            <label className="label">Sistema de amortização</label>
            <div className="inline-flex rounded-lg bg-silver-100 p-1">
              <button className="rounded-md bg-white px-4 py-1.5 text-sm font-medium shadow-sm">Price</button>
              <button className="rounded-md px-4 py-1.5 text-sm font-medium text-silver-600">SAC</button>
            </div>
          </div>
          <div>
            <label className="label">Prazo (meses): 120</label>
            <input type="range" min={12} max={240} defaultValue={120} className="w-full accent-gold" />
          </div>
        </div>
      </div>
      <div className="rounded-lg border-2 border-gold/40 bg-gold/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">Simulação em tempo real</p>
        <h3 className="mt-1 text-base font-semibold text-navy">Resultado</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <Row k="LTV" v={<span className="badge bg-success/15 text-success">41%</span>} />
          <Row k="Parcela estimada" v={<b>{brl(423000)}</b>} />
          <Row k="Taxa efetiva" v="IPCA + 1,39% a.m." />
          <Row k="Total a pagar" v={<b>{brl(50760000)}</b>} />
          <Row k="Renda mínima" v={<b>{brl(1410000)}/mês</b>} />
        </dl>
        <div className="mt-4 h-24 rounded bg-white p-3">
          <p className="text-xs text-silver-500">Curva de amortização Price vs SAC</p>
          <div className="mt-2 flex h-12 items-end gap-0.5">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="flex-1 rounded-t" style={{ height: `${30 + (i * 2)}%`, background: i % 2 ? '#2C6B9E' : '#D4AF37' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Step5() {
  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Proponentes</h2>
      <div className="mt-5 rounded-lg border border-silver-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white font-semibold">JS</div>
          <div className="flex-1">
            <p className="font-semibold text-silver-900">João Silva</p>
            <p className="text-xs text-silver-500">CPF ***.***.***-12 · Renda R$ 14.100/mês</p>
          </div>
          <span className="badge bg-gold/15 text-gold-700">Principal</span>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
        ⚠️ Estado civil: <b>Casado</b> — cônjuge deve ser incluído como co-proponente obrigatório.
      </div>

      <div className="mt-4 rounded-lg border-2 border-dashed border-silver-300 p-4">
        <h3 className="text-sm font-semibold text-silver-700">Cônjuge</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Nome" />
          <Field label="CPF" />
          <Field label="E-mail" />
          <Field label="Telefone" />
          <Field label="Profissão" />
          <Field label="Renda mensal (R$)" />
        </div>
      </div>

      <button className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-gold-600">
        <Plus className="h-4 w-4" /> Adicionar outro proponente
      </button>
    </>
  )
}

function Step6() {
  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Imóveis envolvidos</h2>
      <p className="mt-1 text-sm text-silver-600">Adicione o imóvel de garantia e outros se aplicável.</p>

      <div className="mt-5 rounded-lg border border-silver-200 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Tipo</label>
            <select className="input"><option>Apartamento</option><option>Casa</option><option>Terreno</option><option>Comercial</option><option>Rural</option></select>
          </div>
          <Field label="CEP" placeholder="01310-100" />
          <Field label="Valor do imóvel (R$)" placeholder="R$ 850.000,00" />
          <Field label="Vagas de garagem" placeholder="2" />
        </div>

        <div className="mt-4 space-y-2">
          <Toggle label="Imóvel alugado?" />
          <Toggle label="Imóvel financiado?" />
          <Toggle label="Possui débitos?" />
        </div>

        <div className="mt-4">
          <label className="label">Proprietários</label>
          <div className="flex flex-wrap gap-2">
            <span className="badge bg-navy/10 text-navy">João Silva</span>
            <span className="badge bg-silver-200 text-silver-700">+ Maria Silva</span>
          </div>
        </div>

        <button className="mt-4 inline-flex items-center gap-1 text-sm text-danger hover:underline">
          <Trash2 className="h-3.5 w-3.5" /> Remover imóvel
        </button>
      </div>

      <button className="mt-4 inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-silver-300 px-4 py-3 text-sm font-medium text-silver-600 hover:border-gold hover:text-gold-600">
        <Plus className="h-4 w-4" /> Adicionar outro imóvel
      </button>
    </>
  )
}

function Step7() {
  const sections = [
    ['Produto', 'Home Equity · PF · R$ 350.000 · 120 meses · Price · IPCA+1,39%'],
    ['Cliente', 'João Silva · CPF ***.***.***-12 · (11) 9XXXX-XXXX'],
    ['Localização', 'Rua das Flores, 123 · São Paulo/SP · 01310-100'],
    ['Valores', 'LTV 41% · Parcela R$ 4.230 · Renda mínima R$ 14.100'],
    ['Proponentes', 'João Silva (principal) · Maria Silva (cônjuge)'],
    ['Imóveis', 'Apartamento Jardins · R$ 850.000 · João Silva (proprietário)'],
  ]
  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Revisão final</h2>
      <p className="mt-1 text-sm text-silver-600">Confira todos os dados antes de salvar.</p>

      <div className="mt-5 space-y-2">
        {sections.map(([k, v]) => (
          <details key={k} className="group rounded-lg border border-silver-200 bg-white">
            <summary className="flex cursor-pointer items-center justify-between p-4 text-sm">
              <span><b className="text-navy">{k}:</b> <span className="text-silver-700">{v}</span></span>
              <ChevronDown className="h-4 w-4 text-silver-400 transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-silver-100 bg-silver-50 p-4 text-sm text-silver-600">[ detalhe completo desta seção ]</div>
          </details>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-navy/30 bg-navy/5 p-4 text-sm">
        ℹ️ Após salvar, um link mágico será enviado ao cliente via WhatsApp para acesso ao portal.
      </div>
    </>
  )
}

function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <div><label className="label">{label}</label><input className="input" {...rest} /></div>
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-silver-600">{k}</span><span>{v}</span></div>
}

function Toggle({ label }: { label: string }) {
  const [on, setOn] = useState(false)
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md bg-silver-50 p-3">
      <span className="text-sm text-silver-700">{label}</span>
      <button type="button" onClick={() => setOn(!on)}
        className={`relative h-5 w-9 rounded-full transition ${on ? 'bg-gold' : 'bg-silver-300'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${on ? 'left-4' : 'left-0.5'}`} />
      </button>
    </label>
  )
}
