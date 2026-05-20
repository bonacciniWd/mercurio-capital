import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Building, Home as HomeIcon, Hammer, Check, Plus, Trash2, MapPin, ChevronDown, Copy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { calcularFinanciamento, calcularLTV } from '@/lib/credito'

const STEPS = ['Produto', 'Cliente', 'Localização', 'Valores', 'Proponentes', 'Imóveis', 'Revisão']

type ProdutoTipo = 'home_equity' | 'credito_construcao' | 'financiamento_imobiliario'
type PessoaTipo = 'PF' | 'PJ'
type EstadoCivil = '' | 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'uniao_estavel'
type ImovelTipo = 'apartamento' | 'casa' | 'comercial' | 'terreno' | 'vaga'

interface ProponenteForm {
  nome: string
  cpf_cnpj: string
  principal: boolean
  relacao: 'conjuge' | 'socio' | 'outro' | ''
  estado_civil: EstadoCivil
}

interface ImovelForm {
  tipo: ImovelTipo
  cep: string
  estado: string
  cidade: string
  bairro: string
  logradouro: string
  numero: string
  complemento: string
  valor: number
  vagas_garagem: number
  alugado: boolean
  financiado: boolean
  possui_debitos: boolean
}

interface FormState {
  produto: ProdutoTipo
  pessoa_tipo: PessoaTipo
  cliente: {
    nome_completo: string
    cpf: string
    email: string
    telefone: string
    data_nascimento: string
    estado_civil: EstadoCivil
  }
  valor_solicitado: number
  prazo_meses: number
  carencia_meses: number
  taxa_juros_mensal: number
  correcao: 'pos_fixado' | 'pre_fixado'
  amortizacao: 'price' | 'sac'
  proponentes: ProponenteForm[]
  imoveis: ImovelForm[]
}

const initialState: FormState = {
  produto: 'home_equity',
  pessoa_tipo: 'PF',
  cliente: { nome_completo: '', cpf: '', email: '', telefone: '', data_nascimento: '', estado_civil: '' },
  valor_solicitado: 350_000,
  prazo_meses: 120,
  carencia_meses: 0,
  taxa_juros_mensal: 1.39,
  correcao: 'pos_fixado',
  amortizacao: 'price',
  proponentes: [{ nome: '', cpf_cnpj: '', principal: true, relacao: '', estado_civil: '' }],
  imoveis: [{
    tipo: 'apartamento', cep: '', estado: '', cidade: '', bairro: '', logradouro: '',
    numero: '', complemento: '', valor: 850_000, vagas_garagem: 0,
    alugado: false, financiado: false, possui_debitos: false,
  }],
}

interface SubmitResult {
  proposta_id: string
  protocolo: string
  cliente_id: string
  magic_token: string
}

export function PartnerWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitResult | null>(null)

  const patch = (p: Partial<FormState>) => setForm(f => ({ ...f, ...p }))
  const patchCliente = (p: Partial<FormState['cliente']>) =>
    setForm(f => ({ ...f, cliente: { ...f.cliente, ...p } }))

  // Sincroniza proponente principal com cliente
  const syncProponente = () => {
    setForm(f => {
      const next = [...f.proponentes]
      next[0] = {
        ...next[0],
        principal: true,
        nome: f.cliente.nome_completo,
        cpf_cnpj: f.cliente.cpf,
        estado_civil: f.cliente.estado_civil,
      }
      // Cônjuge obrigatório se casado e ainda não existe
      const casado = f.cliente.estado_civil === 'casado' || f.cliente.estado_civil === 'uniao_estavel'
      if (casado && !next.some(p => p.relacao === 'conjuge')) {
        next.push({ nome: '', cpf_cnpj: '', principal: false, relacao: 'conjuge', estado_civil: f.cliente.estado_civil })
      }
      return { ...f, proponentes: next }
    })
  }

  const calc = useMemo(
    () => calcularFinanciamento({
      valor: form.valor_solicitado,
      prazoMeses: form.prazo_meses,
      taxaMensal: form.taxa_juros_mensal / 100,
      amortizacao: form.amortizacao,
      carenciaMeses: form.carencia_meses,
    }),
    [form.valor_solicitado, form.prazo_meses, form.taxa_juros_mensal, form.amortizacao, form.carencia_meses],
  )

  const valorImoveisTotal = form.imoveis.reduce((s, i) => s + (Number(i.valor) || 0), 0)
  const ltv = calcularLTV(form.valor_solicitado, valorImoveisTotal)

  const submitMut = useMutation({
    mutationFn: async () => {
      const payload = {
        produto: form.produto,
        pessoa_tipo: form.pessoa_tipo,
        valor_solicitado: form.valor_solicitado,
        prazo_meses: form.prazo_meses,
        carencia_meses: form.carencia_meses,
        taxa_juros_mensal: form.taxa_juros_mensal,
        correcao: form.correcao,
        amortizacao: form.amortizacao,
        cliente: form.cliente,
        proponentes: form.proponentes.map(p => ({
          nome: p.nome,
          cpf_cnpj: p.cpf_cnpj,
          principal: p.principal,
          relacao: p.relacao || null,
          estado_civil: p.estado_civil || null,
          pessoa_tipo: form.pessoa_tipo,
        })),
        imoveis: form.imoveis,
      }
      const { data, error } = await supabase.rpc('partner_create_proposta', { p_payload: payload })
      if (error) throw error
      return data as SubmitResult
    },
    onSuccess: (data) => {
      setResult(data)
      setError(null)
    },
    onError: (err: Error) => setError(err.message),
  })

  // Validação básica por step
  const canAdvance = (s: number): boolean => {
    if (s === 0) return !!form.produto && !!form.pessoa_tipo
    if (s === 1) return !!form.cliente.nome_completo && !!form.cliente.cpf
    if (s === 2) return !!form.imoveis[0].cidade && !!form.imoveis[0].estado
    if (s === 3) return form.valor_solicitado > 0 && form.prazo_meses >= 12
    if (s === 4) return form.proponentes.every(p => p.nome && p.cpf_cnpj)
    if (s === 5) return form.imoveis.every(i => i.valor > 0)
    return true
  }

  const next = () => {
    setError(null)
    if (!canAdvance(step)) { setError('Preencha os campos obrigatórios.'); return }
    if (step === 1) syncProponente()
    setStep(s => Math.min(STEPS.length - 1, s + 1))
  }

  if (result) {
    return <SuccessPanel result={result} onNew={() => { setResult(null); setForm(initialState); setStep(0) }} onDetalhe={() => navigate(`/p/propostas/${result.proposta_id}`)} />
  }

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
              i < step ? 'bg-success text-white' : i === step ? 'bg-red-600 text-white' : 'bg-silver-200 text-silver-500'
            }`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < step ? 'bg-success' : 'bg-silver-200'}`} />}
          </div>
        ))}
      </div>

      <div className="card p-6">
        {step === 0 && <Step1 form={form} patch={patch} />}
        {step === 1 && <Step2 form={form} patchCliente={patchCliente} />}
        {step === 2 && <Step3 form={form} setForm={setForm} />}
        {step === 3 && <Step4 form={form} patch={patch} calc={calc} ltv={ltv} valorImoveisTotal={valorImoveisTotal} />}
        {step === 4 && <Step5 form={form} setForm={setForm} />}
        {step === 5 && <Step6 form={form} setForm={setForm} />}
        {step === 6 && <Step7 form={form} calc={calc} ltv={ltv} />}
      </div>

      {error && <div className="mt-4 rounded-md border border-danger/40 bg-danger/5 p-3 text-sm text-danger">{error}</div>}

      <div className="mt-6 flex justify-between">
        <button onClick={() => setStep(s => Math.max(0, s - 1))} className="btn-ghost" disabled={step === 0 || submitMut.isPending}>← Anterior</button>
        {step < STEPS.length - 1 ? (
          <button onClick={next} className="btn-gold">Próximo →</button>
        ) : (
          <button
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending}
            className="btn-gold"
          >
            {submitMut.isPending ? 'Salvando…' : 'Salvar e gerar link cliente'}
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Steps
// ============================================================

function Step1({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  const opts: Array<{ id: ProdutoTipo; label: string; icon: typeof HomeIcon; desc: string }> = [
    { id: 'home_equity', label: 'Home Equity', icon: HomeIcon, desc: 'Crédito com garantia de imóvel.' },
    { id: 'credito_construcao', label: 'Crédito Construção', icon: Hammer, desc: 'Para obra ou reforma.' },
    { id: 'financiamento_imobiliario', label: 'Financiamento Imobiliário', icon: Building, desc: 'Para aquisição de imóvel.' },
  ]
  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Tipo de produto e cliente</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {opts.map(o => (
          <button key={o.id} type="button" onClick={() => patch({ produto: o.id })}
            className={`btn-no-liquid group relative flex flex-col rounded-lg border-2 p-5 text-left transition-all ${
              form.produto === o.id
                ? 'border-red-600 bg-gradient-to-br from-red-600/12 to-red-600/6 shadow-md'
                : 'border-silver-200 bg-white hover:border-red-600/50 hover:shadow-sm'
            }`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              form.produto === o.id ? 'bg-red-600/20' : 'bg-silver-100 group-hover:bg-silver-200'
            }`}>
              <o.icon className={`h-5 w-5 ${form.produto === o.id ? 'text-red-600' : 'text-silver-600'}`} />
            </div>
            <p className="mt-3 font-semibold text-navy">{o.label}</p>
            <p className="mt-2 flex-1 text-xs text-silver-700">{o.desc}</p>
            {form.produto === o.id && (
              <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-600">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="mt-6">
        <label className="label">Tipo de pessoa</label>
        <div className="inline-flex gap-2">
          {(['PF', 'PJ'] as const).map(t => (
            <button key={t} type="button" onClick={() => patch({ pessoa_tipo: t })}
              className={`btn-no-liquid rounded-md border-2 px-6 py-2 text-sm font-medium transition-all ${form.pessoa_tipo === t ? 'border-gold-600 bg-gold text-navy shadow-md' : 'border-silver-300 bg-silver-100 text-silver-600 hover:border-gold/50'}`}>
              {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function Step2({ form, patchCliente }: { form: FormState; patchCliente: (p: Partial<FormState['cliente']>) => void }) {
  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Dados do cliente</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Nome completo *" value={form.cliente.nome_completo} onChange={v => patchCliente({ nome_completo: v })} />
        <Field label={form.pessoa_tipo === 'PF' ? 'CPF *' : 'CNPJ *'} value={form.cliente.cpf} onChange={v => patchCliente({ cpf: v })} />
        <Field label="Data de nascimento" type="date" value={form.cliente.data_nascimento} onChange={v => patchCliente({ data_nascimento: v })} />
        <Field label="E-mail" type="email" value={form.cliente.email} onChange={v => patchCliente({ email: v })} />
        <Field label="Telefone" value={form.cliente.telefone} onChange={v => patchCliente({ telefone: v })} placeholder="+55 (11) 9XXXX-XXXX" />
        <div>
          <label className="label">Estado civil</label>
          <select className="input" value={form.cliente.estado_civil} onChange={e => patchCliente({ estado_civil: e.target.value as EstadoCivil })}>
            <option value="">—</option>
            <option value="solteiro">Solteiro(a)</option>
            <option value="casado">Casado(a)</option>
            <option value="divorciado">Divorciado(a)</option>
            <option value="viuvo">Viúvo(a)</option>
            <option value="uniao_estavel">União estável</option>
          </select>
        </div>
      </div>
    </>
  )
}

function Step3({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const im = form.imoveis[0]
  const patch = (p: Partial<ImovelForm>) =>
    setForm(f => ({ ...f, imoveis: [{ ...f.imoveis[0], ...p }, ...f.imoveis.slice(1)] }))
  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Localização do imóvel principal</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Field label="CEP" value={im.cep} onChange={v => patch({ cep: v })} />
        <Field label="Estado *" value={im.estado} onChange={v => patch({ estado: v.toUpperCase().slice(0, 2) })} placeholder="SP" />
        <Field label="Cidade *" value={im.cidade} onChange={v => patch({ cidade: v })} />
        <Field label="Bairro" value={im.bairro} onChange={v => patch({ bairro: v })} />
        <div className="md:col-span-2"><Field label="Logradouro" value={im.logradouro} onChange={v => patch({ logradouro: v })} /></div>
        <Field label="Número" value={im.numero} onChange={v => patch({ numero: v })} />
        <div className="md:col-span-3"><Field label="Complemento" value={im.complemento} onChange={v => patch({ complemento: v })} /></div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-silver-200 bg-silver-50 p-4 text-sm text-silver-600">
        <MapPin className="h-4 w-4" /> Mapa será integrado em fase futura.
      </div>
    </>
  )
}

function Step4({
  form, patch, calc, ltv, valorImoveisTotal,
}: {
  form: FormState
  patch: (p: Partial<FormState>) => void
  calc: ReturnType<typeof calcularFinanciamento>
  ltv: number
  valorImoveisTotal: number
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h2 className="text-lg font-semibold text-navy">Valores e prazo</h2>
        <div className="mt-5 space-y-4">
          <NumberField label="Crédito desejado (R$)" value={form.valor_solicitado} onChange={v => patch({ valor_solicitado: v })} />
          <NumberField label="Valor da garantia total (R$)" value={valorImoveisTotal} disabled hint="Atualize na etapa Imóveis" />
          <NumberField label="Taxa juros mensal (%)" value={form.taxa_juros_mensal} onChange={v => patch({ taxa_juros_mensal: v })} step={0.01} />
          <div>
            <label className="label">Correção</label>
            <div className="inline-flex gap-2">
              {(['pos_fixado', 'pre_fixado'] as const).map(c => (
                <button key={c} type="button" onClick={() => patch({ correcao: c })}
                  className={`btn-no-liquid rounded-md border px-4 py-1.5 text-sm font-medium transition ${form.correcao === c ? 'border-gold-600 bg-gold text-white' : 'border-silver-300 bg-silver-100 text-silver-600'}`}>
                  {c === 'pos_fixado' ? 'Pós (IPCA)' : 'Pré-fixado'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Sistema de amortização</label>
            <div className="inline-flex gap-2">
              {(['price', 'sac'] as const).map(a => (
                <button key={a} type="button" onClick={() => patch({ amortizacao: a })}
                  className={`btn-no-liquid rounded-md border px-4 py-1.5 text-sm font-medium transition ${form.amortizacao === a ? 'border-gold-600 bg-gold text-white' : 'border-silver-300 bg-silver-100 text-silver-600'}`}>
                  {a.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Prazo: {form.prazo_meses} meses</label>
            <input type="range" min={12} max={240} step={6} value={form.prazo_meses}
              onChange={e => patch({ prazo_meses: Number(e.target.value) })}
              className="w-full accent-gold" />
          </div>
          <div>
            <label className="label">Carência: {form.carencia_meses} meses</label>
            <input type="range" min={0} max={3} value={form.carencia_meses}
              onChange={e => patch({ carencia_meses: Number(e.target.value) })}
              className="w-full accent-gold" />
          </div>
        </div>
      </div>
      <div className="rounded-lg border-2 border-gold/40 bg-gold/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">Simulação em tempo real</p>
        <h3 className="mt-1 text-base font-semibold text-navy">Resultado</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <Row k="LTV" v={
            <span className={`badge ${ltv > 0.6 ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'}`}>
              {(ltv * 100).toFixed(1)}%
            </span>
          } />
          <Row k="1ª parcela" v={<b>{brl(calc.primeiraParcela * 100)}</b>} />
          <Row k="Última parcela" v={<b>{brl(calc.ultimaParcela * 100)}</b>} />
          <Row k="Total a pagar" v={<b>{brl(calc.totalPago * 100)}</b>} />
          <Row k="Total de juros" v={brl(calc.totalJuros * 100)} />
          <Row k="Renda mínima" v={<b>{brl(calc.rendaMinima * 100)}/mês</b>} />
        </dl>
      </div>
    </div>
  )
}

function Step5({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const patchProp = (idx: number, p: Partial<ProponenteForm>) =>
    setForm(f => ({ ...f, proponentes: f.proponentes.map((x, i) => i === idx ? { ...x, ...p } : x) }))
  const addProp = () =>
    setForm(f => ({ ...f, proponentes: [...f.proponentes, { nome: '', cpf_cnpj: '', principal: false, relacao: 'outro', estado_civil: '' }] }))
  const removeProp = (idx: number) =>
    setForm(f => ({ ...f, proponentes: f.proponentes.filter((_, i) => i !== idx) }))

  const casado = form.cliente.estado_civil === 'casado' || form.cliente.estado_civil === 'uniao_estavel'

  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Proponentes</h2>
      {casado && !form.proponentes.some(p => p.relacao === 'conjuge') && (
        <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
          ⚠️ Cliente {form.cliente.estado_civil} — adicione o cônjuge como co-proponente.
        </div>
      )}

      <div className="mt-5 space-y-4">
        {form.proponentes.map((p, idx) => (
          <div key={idx} className={`rounded-lg border p-4 ${p.principal ? 'border-gold/40 bg-gold/5' : 'border-silver-200'}`}>
            <div className="mb-3 flex items-center justify-between">
              <span className="badge bg-navy/10 text-navy">
                {p.principal ? 'Principal' : p.relacao === 'conjuge' ? 'Cônjuge' : 'Co-proponente'}
              </span>
              {!p.principal && (
                <button type="button" onClick={() => removeProp(idx)} className="text-xs text-danger hover:underline inline-flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Remover
                </button>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome *" value={p.nome} onChange={v => patchProp(idx, { nome: v })} />
              <Field label="CPF/CNPJ *" value={p.cpf_cnpj} onChange={v => patchProp(idx, { cpf_cnpj: v })} />
              {!p.principal && (
                <div>
                  <label className="label">Relação</label>
                  <select className="input" value={p.relacao} onChange={e => patchProp(idx, { relacao: e.target.value as ProponenteForm['relacao'] })}>
                    <option value="conjuge">Cônjuge</option>
                    <option value="socio">Sócio</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addProp} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-gold-600">
        <Plus className="h-4 w-4" /> Adicionar outro proponente
      </button>
    </>
  )
}

function Step6({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const patchIm = (idx: number, p: Partial<ImovelForm>) =>
    setForm(f => ({ ...f, imoveis: f.imoveis.map((x, i) => i === idx ? { ...x, ...p } : x) }))
  const addIm = () =>
    setForm(f => ({
      ...f,
      imoveis: [...f.imoveis, {
        tipo: 'apartamento', cep: '', estado: '', cidade: '', bairro: '', logradouro: '',
        numero: '', complemento: '', valor: 0, vagas_garagem: 0,
        alugado: false, financiado: false, possui_debitos: false,
      }],
    }))
  const removeIm = (idx: number) =>
    setForm(f => ({ ...f, imoveis: f.imoveis.filter((_, i) => i !== idx) }))

  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Imóveis envolvidos</h2>
      <p className="mt-1 text-sm text-silver-600">O primeiro imóvel é o de garantia principal.</p>

      <div className="mt-5 space-y-4">
        {form.imoveis.map((im, idx) => (
          <div key={idx} className="rounded-lg border border-silver-200 p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="badge bg-navy/10 text-navy">{idx === 0 ? 'Garantia principal' : `Imóvel ${idx + 1}`}</span>
              {idx > 0 && (
                <button type="button" onClick={() => removeIm(idx)} className="text-xs text-danger hover:underline inline-flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Remover
                </button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={im.tipo} onChange={e => patchIm(idx, { tipo: e.target.value as ImovelTipo })}>
                  <option value="apartamento">Apartamento</option>
                  <option value="casa">Casa</option>
                  <option value="comercial">Comercial</option>
                  <option value="terreno">Terreno</option>
                  <option value="vaga">Vaga</option>
                </select>
              </div>
              <NumberField label="Valor do imóvel (R$) *" value={im.valor} onChange={v => patchIm(idx, { valor: v })} />
              <NumberField label="Vagas de garagem" value={im.vagas_garagem} onChange={v => patchIm(idx, { vagas_garagem: v })} />
            </div>
            <div className="mt-4 space-y-2">
              <Toggle label="Imóvel alugado?" value={im.alugado} onChange={v => patchIm(idx, { alugado: v })} />
              <Toggle label="Imóvel financiado?" value={im.financiado} onChange={v => patchIm(idx, { financiado: v })} />
              <Toggle label="Possui débitos?" value={im.possui_debitos} onChange={v => patchIm(idx, { possui_debitos: v })} />
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addIm} className="mt-4 inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-silver-300 px-4 py-3 text-sm font-medium text-silver-600 hover:border-gold hover:text-gold-600">
        <Plus className="h-4 w-4" /> Adicionar outro imóvel
      </button>
    </>
  )
}

function Step7({ form, calc, ltv }: { form: FormState; calc: ReturnType<typeof calcularFinanciamento>; ltv: number }) {
  const sections: Array<[string, React.ReactNode]> = [
    ['Produto', `${produtoLabel(form.produto)} · ${form.pessoa_tipo} · ${brl(form.valor_solicitado * 100)} · ${form.prazo_meses}m · ${form.amortizacao.toUpperCase()}`],
    ['Cliente', `${form.cliente.nome_completo} · ${form.cliente.cpf} · ${form.cliente.telefone || '—'}`],
    ['Localização', `${form.imoveis[0].logradouro || ''} ${form.imoveis[0].numero || ''} · ${form.imoveis[0].cidade}/${form.imoveis[0].estado}`],
    ['Valores', `LTV ${(ltv * 100).toFixed(1)}% · 1ª parcela ${brl(calc.primeiraParcela * 100)} · Renda mín. ${brl(calc.rendaMinima * 100)}`],
    ['Proponentes', form.proponentes.map(p => `${p.nome}${p.principal ? ' (principal)' : p.relacao ? ` (${p.relacao})` : ''}`).join(' · ')],
    ['Imóveis', form.imoveis.map((i, idx) => `${idx === 0 ? '★ ' : ''}${i.tipo} ${brl((i.valor || 0) * 100)}`).join(' · ')],
  ]
  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Revisão final</h2>
      <p className="mt-1 text-sm text-silver-600">Confira os dados antes de salvar.</p>
      <div className="mt-5 space-y-2">
        {sections.map(([k, v]) => (
          <details key={k} className="group rounded-lg border border-silver-200 bg-white" open>
            <summary className="flex cursor-pointer items-center justify-between p-4 text-sm">
              <span><b className="text-navy">{k}:</b> <span className="text-silver-700">{v}</span></span>
              <ChevronDown className="h-4 w-4 text-silver-400 transition group-open:rotate-180" />
            </summary>
          </details>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-navy/30 bg-navy/5 p-4 text-sm">
        ℹ️ Após salvar, será gerado um <b>magic link</b> com validade de 30 minutos. Você poderá reemitir um novo link a qualquer momento na página da proposta.
      </div>
    </>
  )
}

// ============================================================
// Success
// ============================================================

function SuccessPanel({ result, onNew, onDetalhe }: { result: SubmitResult; onNew: () => void; onDetalhe: () => void }) {
  const url = `${window.location.origin}/c/proposta/${result.magic_token}`
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-navy">Proposta criada!</h2>
        <p className="mt-2 text-sm text-silver-600">Protocolo</p>
        <p className="font-mono text-lg font-semibold text-navy">{result.protocolo}</p>

        <div className="mt-6 rounded-lg border border-silver-200 bg-silver-50 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-silver-500">Magic link do cliente</p>
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={url} className="input flex-1 font-mono text-xs" />
            <button onClick={copy} className="btn-outline flex items-center gap-1 text-sm">
              <Copy className="h-3.5 w-3.5" /> {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="mt-2 text-xs text-silver-500">Envie este link ao cliente. Validade: 30 minutos (reemitir na página da proposta).</p>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <button onClick={onNew} className="btn-ghost">Nova proposta</button>
          <button onClick={onDetalhe} className="btn-gold">Ver detalhe →</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Helpers de UI
// ============================================================

function Field({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value} placeholder={placeholder} onChange={e => onChange?.(e.target.value)} />
    </div>
  )
}

function NumberField({
  label, value, onChange, step, disabled, hint,
}: {
  label: string
  value: number
  onChange?: (v: number) => void
  step?: number
  disabled?: boolean
  hint?: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type="number"
        value={value}
        step={step}
        disabled={disabled}
        onChange={e => onChange?.(Number(e.target.value))}
      />
      {hint && <p className="mt-1 text-xs text-silver-500">{hint}</p>}
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-silver-600">{k}</span><span>{v}</span></div>
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md bg-silver-50 p-3">
      <span className="text-sm text-silver-700">{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        className={`relative h-5 w-9 rounded-full transition border ${value ? 'bg-gold border-gold-600' : 'bg-silver-300 border-silver-300'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${value ? 'left-4' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

function produtoLabel(p: ProdutoTipo): string {
  return p === 'home_equity' ? 'Home Equity'
    : p === 'credito_construcao' ? 'Crédito Construção'
    : 'Financiamento Imobiliário'
}
