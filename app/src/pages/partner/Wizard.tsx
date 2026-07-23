import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Building, Home as HomeIcon, Hammer, Check, Plus, Trash2, MapPin, ChevronDown, Copy, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { calcularFinanciamento, calcularLTV } from '@/lib/credito'
import { MoneyInput } from '@/components/MoneyInput'
import { SimuladorCredito, type SimuladorCreditoValues } from '@/components/SimuladorCredito'
import { consumeSimulacaoDraft } from '@/lib/simulacaoDraft'
import { publicAppUrl } from '@/lib/publicUrl'
import {
  maskCpf, maskCnpj, onlyDigits, isValidCpf, isValidCnpj, validarDocumento, consultarCnpj,
} from '@/lib/documentoBr'

const STEPS = ['Produto', 'Cliente', 'Imóveis', 'Valores', 'Proponentes', 'Revisão']
const PRAZO_MIN_MESES = 12
const PRAZO_MAX_MESES = 240
const CARENCIA_MIN_MESES = 0
const CARENCIA_MAX_MESES = 3

type ProdutoTipo = 'home_equity' | 'credito_construcao' | 'financiamento_imobiliario'
type PessoaTipo = 'PF' | 'PJ'
type EstadoCivil = '' | 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'uniao_estavel'
type ImovelTipo = 'apartamento' | 'casa' | 'comercial' | 'terreno' | 'vaga'

type ModeloRenda = '' | 'assalariado_clt' | 'empresario' | 'autonomo' | 'aposentado_pensionista' | 'funcionario_publico'

const MODELO_RENDA_OPTIONS: Array<{ id: Exclude<ModeloRenda, ''>; label: string }> = [
  { id: 'assalariado_clt', label: 'Assalariado (CLT)' },
  { id: 'empresario', label: 'Empresário' },
  { id: 'autonomo', label: 'Autônomo' },
  { id: 'aposentado_pensionista', label: 'Aposentado ou Pensionista' },
  { id: 'funcionario_publico', label: 'Funcionário Público' },
]

interface EnderecoForm {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

const enderecoVazio = (): EnderecoForm => ({
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
})

interface ProponenteForm {
  nome: string
  cpf_cnpj: string
  principal: boolean
  relacao: 'conjuge' | 'socio' | 'outro' | ''
  estado_civil: EstadoCivil
  compoe_renda: boolean | null
  modelo_renda: ModeloRenda
  renda_mensal: number
  endereco: EnderecoForm
}

interface ImovelForm {
  tipo: ImovelTipo
  principal: boolean
  cep: string
  estado: string
  cidade: string
  bairro: string
  logradouro: string
  numero: string
  complemento: string
  latitude: number | null
  longitude: number | null
  valor: number
  vagas_garagem: number
  alugado: boolean
  valor_aluguel: number
  financiado: boolean
  instituicao_financiadora: string
  saldo_devedor: number
  possui_debitos: boolean
  debitos_iptu: number
  debitos_condominio: number
}

interface ClienteForm {
  nome_completo: string
  cpf: string
  cnpj: string
  email: string
  telefone: string
  data_nascimento: string
  estado_civil: EstadoCivil
  modelo_renda: ModeloRenda
  renda_mensal: number
  endereco: EnderecoForm
  // Pessoa Jurídica
  razao_social: string
  email_responsavel: string
  celular_comercial: string
  tipo_empresa: string
  ramo_atuacao: string
  data_abertura: string
  faturamento_mensal: number
}

interface FormState {
  produto: ProdutoTipo
  pessoa_tipo: PessoaTipo
  cliente: ClienteForm
  valor_solicitado: number
  prazo_meses: number
  carencia_meses: number
  taxa_juros_mensal: number
  correcao: 'pos_fixado' | 'pre_fixado'
  amortizacao: 'price' | 'sac'
  limite_50_aplicado: boolean
  proponentes: ProponenteForm[]
  imoveis: ImovelForm[]
}

const initialState: FormState = {
  produto: 'home_equity',
  pessoa_tipo: 'PF',
  cliente: {
    nome_completo: '', cpf: '', cnpj: '', email: '', telefone: '', data_nascimento: '', estado_civil: '',
    modelo_renda: '', renda_mensal: 0, endereco: enderecoVazio(),
    razao_social: '', email_responsavel: '', celular_comercial: '', tipo_empresa: '',
    ramo_atuacao: '', data_abertura: '', faturamento_mensal: 0,
  },
  valor_solicitado: 350_000,
  prazo_meses: 120,
  carencia_meses: 0,
  taxa_juros_mensal: 1.29,
  correcao: 'pos_fixado',
  amortizacao: 'price',
  limite_50_aplicado: false,
  proponentes: [{
    nome: '', cpf_cnpj: '', principal: true, relacao: '', estado_civil: '',
    compoe_renda: true, modelo_renda: '', renda_mensal: 0, endereco: enderecoVazio(),
  }],
  imoveis: [{
    tipo: 'apartamento', principal: true, cep: '', estado: '', cidade: '', bairro: '', logradouro: '',
    numero: '', complemento: '', latitude: null, longitude: null, valor: 850_000, vagas_garagem: 0,
    alugado: false, valor_aluguel: 0,
    financiado: false, instituicao_financiadora: '', saldo_devedor: 0,
    possui_debitos: false, debitos_iptu: 0, debitos_condominio: 0,
  }],
}

interface SubmitResult {
  proposta_id: string
  protocolo: string
  cliente_id: string
  magic_token: string
}

type WizardMode = 'partner' | 'admin'

interface AdminPartnerOption {
  partner_id: string
  nome: string | null
  email: string | null
  status: string
}

const ADMIN_PARTNER_STATUS_LABEL: Record<string, string> = {
  approved: 'Aprovado',
  pending: 'Pendente de confirmação/aprovação',
}

export function PartnerWizard({ mode = 'partner' }: { mode?: WizardMode } = {}) {
  const navigate = useNavigate()
  const isAdminMode = mode === 'admin'
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(() => {
    if (isAdminMode) return initialState
    const draft = consumeSimulacaoDraft()
    if (!draft) return initialState
    return {
      ...initialState,
      produto: draft.produto,
      pessoa_tipo: draft.pessoa_tipo,
      valor_solicitado: draft.valor_solicitado,
      prazo_meses: draft.prazo_meses,
      carencia_meses: draft.carencia_meses,
      taxa_juros_mensal: draft.taxa_juros_mensal,
      correcao: draft.correcao,
      amortizacao: draft.amortizacao,
      imoveis: [{ ...initialState.imoveis[0], valor: draft.valor_garantia }],
    }
  })
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [adminPartnerId, setAdminPartnerId] = useState('')

  const adminPartnersQ = useQuery({
    queryKey: ['admin-propostas-create-partners'],
    enabled: isAdminMode,
    queryFn: async (): Promise<AdminPartnerOption[]> => {
      const { data, error } = await supabase
        .from('v_admin_partners')
        .select('partner_id, nome, email, status')
        .in('status', ['approved', 'pending'])
        .order('status', { ascending: true })
        .order('nome', { ascending: true })

      if (error) throw error
      return (data ?? []) as AdminPartnerOption[]
    },
  })

  const adminPartners = adminPartnersQ.data ?? []

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
        compoe_renda: true,
        nome: f.pessoa_tipo === 'PJ' ? (f.cliente.razao_social || f.cliente.nome_completo) : f.cliente.nome_completo,
        cpf_cnpj: f.pessoa_tipo === 'PJ' ? f.cliente.cnpj : f.cliente.cpf,
        estado_civil: f.cliente.estado_civil,
        modelo_renda: f.cliente.modelo_renda,
        renda_mensal: f.cliente.renda_mensal,
        endereco: { ...f.cliente.endereco },
      }
      // Cônjuge obrigatório se casado/união estável e ainda não existe
      const casado = f.cliente.estado_civil === 'casado' || f.cliente.estado_civil === 'uniao_estavel'
      if (f.pessoa_tipo === 'PF' && casado && !next.some(p => p.relacao === 'conjuge')) {
        next.push({
          nome: '', cpf_cnpj: '', principal: false, relacao: 'conjuge', estado_civil: f.cliente.estado_civil,
          compoe_renda: null, modelo_renda: '', renda_mensal: 0, endereco: enderecoVazio(),
        })
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
      const isPJ = form.pessoa_tipo === 'PJ'
      const c = form.cliente
      const flatEndereco = (e: EnderecoForm) => ({
        endereco_cep: onlyDigits(e.cep) || null,
        endereco_logradouro: e.logradouro || null,
        endereco_numero: e.numero || null,
        endereco_complemento: e.complemento || null,
        endereco_bairro: e.bairro || null,
        endereco_cidade: e.cidade || null,
        endereco_estado: e.estado || null,
      })

      const payload = {
        produto: form.produto,
        pessoa_tipo: form.pessoa_tipo,
        valor_solicitado: form.valor_solicitado,
        prazo_meses: form.prazo_meses,
        carencia_meses: form.carencia_meses,
        taxa_juros_mensal: form.taxa_juros_mensal,
        correcao: form.correcao,
        amortizacao: form.amortizacao,
        limite_50_aplicado: form.limite_50_aplicado,
        cliente: {
          nome_completo: isPJ ? (c.razao_social || c.nome_completo) : c.nome_completo,
          cpf: isPJ ? null : (onlyDigits(c.cpf) || null),
          cnpj: isPJ ? (onlyDigits(c.cnpj) || null) : null,
          email: c.email || null,
          telefone: c.telefone || null,
          data_nascimento: c.data_nascimento || null,
          estado_civil: c.estado_civil || null,
          modelo_renda: c.modelo_renda || null,
          renda_mensal: c.renda_mensal || null,
          ...flatEndereco(c.endereco),
          razao_social: isPJ ? (c.razao_social || null) : null,
          email_responsavel: isPJ ? (c.email_responsavel || null) : null,
          celular_comercial: isPJ ? (c.celular_comercial || null) : null,
          tipo_empresa: isPJ ? (c.tipo_empresa || null) : null,
          ramo_atuacao: isPJ ? (c.ramo_atuacao || null) : null,
          data_abertura: isPJ ? (c.data_abertura || null) : null,
          faturamento_mensal: isPJ ? (c.faturamento_mensal || null) : null,
        },
        proponentes: form.proponentes.map(p => ({
          nome: p.nome,
          cpf_cnpj: onlyDigits(p.cpf_cnpj) || null,
          principal: p.principal,
          relacao: p.relacao || null,
          estado_civil: p.estado_civil || null,
          pessoa_tipo: form.pessoa_tipo,
          compoe_renda: p.principal ? true : p.compoe_renda,
          modelo_renda: p.modelo_renda || null,
          renda_mensal: p.renda_mensal || null,
          ...flatEndereco(p.endereco),
        })),
        imoveis: form.imoveis.map(im => ({
          tipo: im.tipo,
          principal: im.principal,
          cep: onlyDigits(im.cep) || null,
          estado: im.estado || null,
          cidade: im.cidade || null,
          bairro: im.bairro || null,
          logradouro: im.logradouro || null,
          numero: im.numero || null,
          complemento: im.complemento || null,
          latitude: im.latitude,
          longitude: im.longitude,
          valor: im.valor,
          vagas_garagem: im.vagas_garagem,
          alugado: im.alugado,
          valor_aluguel: im.valor_aluguel,
          financiado: im.financiado,
          instituicao_financiadora: im.instituicao_financiadora,
          saldo_devedor: im.saldo_devedor,
          possui_debitos: im.possui_debitos,
          debitos_iptu: im.debitos_iptu,
          debitos_condominio: im.debitos_condominio,
        })),
      }

      if (isAdminMode) {
        if (!adminPartnerId) throw new Error('Selecione um parceiro para criar a proposta (aprovado ou pendente).')
        const { data, error } = await supabase.rpc('admin_create_proposta', {
          p_partner_id: adminPartnerId,
          p_payload: payload,
        })
        if (error) throw error
        return data as SubmitResult
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
    if (s === 0) {
      if (!form.produto || !form.pessoa_tipo) return false
      if (!isAdminMode) return true
      return !!adminPartnerId && !adminPartnersQ.isLoading
    }
    if (s === 1) {
      if (form.pessoa_tipo === 'PJ') {
        const c = form.cliente
        return isValidCnpj(c.cnpj)
          && !!c.razao_social && !!c.email_responsavel && !!c.celular_comercial
          && !!c.tipo_empresa && !!c.ramo_atuacao && !!c.data_abertura && c.faturamento_mensal > 0
      }
      return !!form.cliente.nome_completo && isValidCpf(form.cliente.cpf)
    }
    if (s === 2) return form.imoveis.every(i => i.valor > 0) && !!form.imoveis[0].cidade && !!form.imoveis[0].estado
    if (s === 3) {
      const prazoValido = Number.isInteger(form.prazo_meses) && form.prazo_meses >= PRAZO_MIN_MESES && form.prazo_meses <= PRAZO_MAX_MESES
      const carenciaValida = Number.isInteger(form.carencia_meses) && form.carencia_meses >= CARENCIA_MIN_MESES && form.carencia_meses <= CARENCIA_MAX_MESES
      const valorImoveis = form.imoveis.reduce((s2, i) => s2 + (Number(i.valor) || 0), 0)
      const limite50Ok = !form.limite_50_aplicado || (valorImoveis > 0 && form.valor_solicitado <= valorImoveis * 0.5)
      return form.valor_solicitado > 0 && prazoValido && carenciaValida && limite50Ok
    }
    if (s === 4) {
      const conjugeOk = !(form.pessoa_tipo === 'PF'
        && (form.cliente.estado_civil === 'casado' || form.cliente.estado_civil === 'uniao_estavel'))
        || form.proponentes.some(p => p.relacao === 'conjuge' && p.nome && p.cpf_cnpj)
      const coRendaOk = form.proponentes.every(p =>
        p.principal || (p.compoe_renda !== null && (p.compoe_renda === false || p.renda_mensal > 0)))
      return form.proponentes.every(p => p.nome && p.cpf_cnpj) && conjugeOk && coRendaOk
    }
    return true
  }

  const next = () => {
    setError(null)
    if (!canAdvance(step)) { setError('Preencha os campos obrigatórios.'); return }
    if (step === 1) syncProponente()
    setStep(s => Math.min(STEPS.length - 1, s + 1))
  }

  if (result) {
    return <SuccessPanel result={result} pessoaTipo={form.pessoa_tipo} onNew={() => { setResult(null); setForm(initialState); setStep(0) }} onDetalhe={() => navigate(isAdminMode ? `/admin/propostas/${result.proposta_id}` : `/p/propostas/${result.proposta_id}`)} />
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">{isAdminMode ? 'Nova proposta (admin)' : 'Nova proposta'}</h1>
        <Link to={isAdminMode ? '/admin/propostas' : '/p/propostas'} className="text-sm text-silver-500 hover:underline">Cancelar</Link>
      </div>
      <p className="mb-6 text-sm text-silver-600">Passo {step + 1} de {STEPS.length} — {STEPS[step]}</p>

      {isAdminMode && (
        <div className="mb-5 rounded-lg border border-gold/30 bg-gold/5 p-4">
          <label className="label">Parceiro responsável pela proposta *</label>
          {adminPartnersQ.isLoading ? (
            <div className="inline-flex items-center gap-2 text-sm text-silver-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando parceiros (aprovados e pendentes)...
            </div>
          ) : adminPartnersQ.error ? (
            <p className="text-sm text-danger">Não foi possível carregar os parceiros elegíveis.</p>
          ) : adminPartners.length === 0 ? (
            <p className="text-sm text-warning">Nenhum parceiro aprovado ou pendente disponível para criação.</p>
          ) : (
            <select
              className="input"
              value={adminPartnerId}
              onChange={(e) => setAdminPartnerId(e.target.value)}
            >
              <option value="">Selecione um parceiro</option>
              {adminPartners.map((partner) => (
                <option key={partner.partner_id} value={partner.partner_id}>
                  {(partner.nome || partner.email || partner.partner_id)} · {ADMIN_PARTNER_STATUS_LABEL[partner.status] ?? partner.status}
                </option>
              ))}
            </select>
          )}
          <p className="mt-2 text-xs text-silver-600">
            Admin pode criar proposta para parceiro aprovado ou pendente. Parceiro pendente continua sem acesso operacional ao módulo /p.
          </p>
        </div>
      )}

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
        {step === 1 && <Step2 form={form} patchCliente={patchCliente} setForm={setForm} />}
        {step === 2 && <StepImoveis form={form} setForm={setForm} />}
        {step === 3 && <Step4 form={form} patch={patch} valorImoveisTotal={valorImoveisTotal} />}
        {step === 4 && <Step5 form={form} setForm={setForm} />}
        {step === 5 && <StepRevisao form={form} setForm={setForm} patch={patch} patchCliente={patchCliente} calc={calc} ltv={ltv} valorImoveisTotal={valorImoveisTotal} />}
      </div>

      {error && <div className="mt-4 rounded-md border border-danger/40 bg-danger/5 p-3 text-sm text-danger">{error}</div>}

      <div className="mt-6 flex justify-between">
        <button onClick={() => setStep(s => Math.max(0, s - 1))} className="btn-ghost" disabled={step === 0 || submitMut.isPending}>← Anterior</button>
        {step < STEPS.length - 1 ? (
          <button onClick={next} className="btn-gold" disabled={isAdminMode && !adminPartnerId}>Próximo →</button>
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
              className={`btn-no-liquid rounded-md border-2 px-6 py-2 text-sm font-medium transition-all ${form.pessoa_tipo === t ? 'border-red-600 bg-red-600 text-white shadow-md' : 'border-silver-300 bg-silver-100 text-silver-600 hover:border-red-600/50'}`}>
              {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function Step2({ form, patchCliente, setForm }: {
  form: FormState
  patchCliente: (p: Partial<FormState['cliente']>) => void
  setForm: React.Dispatch<React.SetStateAction<FormState>>
}) {
  const isPJ = form.pessoa_tipo === 'PJ'
  const [docLoading, setDocLoading] = useState(false)
  const [docMsg, setDocMsg] = useState<string | null>(null)

  const patchEndereco = (p: Partial<EnderecoForm>) =>
    setForm(f => ({ ...f, cliente: { ...f.cliente, endereco: { ...f.cliente.endereco, ...p } } }))

  async function validarDoc() {
    setDocMsg(null)
    const valor = isPJ ? form.cliente.cnpj : form.cliente.cpf
    const validoLocal = isPJ ? isValidCnpj(valor) : isValidCpf(valor)
    if (!validoLocal) { setDocMsg(`Informe um ${isPJ ? 'CNPJ' : 'CPF'} válido para validar.`); return }
    setDocLoading(true)
    try {
      const r = await validarDocumento(valor)
      setDocMsg(r.valid
        ? `${(r.type || '').toUpperCase()} válido${r.formatted ? ` (${r.formatted})` : ''}.`
        : `${isPJ ? 'CNPJ' : 'CPF'} inválido segundo a base de validação.`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'falha'
      setDocMsg(msg === 'invertexto_nao_configurado'
        ? 'Validação online indisponível (integração não configurada).'
        : `Não foi possível validar: ${msg}`)
    } finally {
      setDocLoading(false)
    }
  }

  async function consultarCnpjAutofill() {
    setDocMsg(null)
    if (!isValidCnpj(form.cliente.cnpj)) { setDocMsg('Informe um CNPJ válido para consultar.'); return }
    setDocLoading(true)
    try {
      const r = await consultarCnpj(form.cliente.cnpj)
      patchCliente({
        razao_social: r.razao_social ?? form.cliente.razao_social,
        nome_completo: r.razao_social ?? form.cliente.nome_completo,
        email_responsavel: r.email ?? form.cliente.email_responsavel,
        celular_comercial: r.telefone ?? form.cliente.celular_comercial,
        tipo_empresa: r.tipo_empresa ?? form.cliente.tipo_empresa,
        ramo_atuacao: r.ramo_atuacao ?? form.cliente.ramo_atuacao,
        data_abertura: r.data_abertura ?? form.cliente.data_abertura,
      })
      // Autopreenche endereço da empresa quando disponível.
      setForm(f => ({
        ...f,
        cliente: {
          ...f.cliente,
          endereco: {
            cep: r.endereco_cep ?? f.cliente.endereco.cep,
            logradouro: r.endereco_logradouro ?? f.cliente.endereco.logradouro,
            numero: r.endereco_numero ?? f.cliente.endereco.numero,
            complemento: r.endereco_complemento ?? f.cliente.endereco.complemento,
            bairro: r.endereco_bairro ?? f.cliente.endereco.bairro,
            cidade: r.endereco_cidade ?? f.cliente.endereco.cidade,
            estado: r.endereco_estado ?? f.cliente.endereco.estado,
          },
        },
      }))
      setDocMsg(r.situacao ? `Empresa localizada · situação: ${r.situacao}` : 'Dados da empresa carregados.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'falha'
      setDocMsg(
        msg === 'invertexto_nao_configurado' ? 'Consulta CNPJ indisponível (integração não configurada).'
        : msg === 'cnpj_nao_encontrado' ? 'CNPJ não encontrado na base.'
        : `Não foi possível consultar o CNPJ: ${msg}`,
      )
    } finally {
      setDocLoading(false)
    }
  }

  const casado = form.cliente.estado_civil === 'casado' || form.cliente.estado_civil === 'uniao_estavel'

  return (
    <>
      <h2 className="text-lg font-semibold text-navy">
        {isPJ ? 'Dados da empresa (PJ)' : 'Dados do cliente (PF)'}
      </h2>

      {/* Documento primeiro, com formatação automática */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {isPJ ? (
          <div className="md:col-span-2">
            <label className="label">CNPJ *</label>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <input
                  className="input font-medium"
                  value={form.cliente.cnpj}
                  onChange={e => patchCliente({ cnpj: maskCnpj(e.target.value) })}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                  maxLength={18}
                />
                {form.cliente.cnpj && !isValidCnpj(form.cliente.cnpj) && (
                  <p className="mt-1 text-xs text-danger">CNPJ inválido.</p>
                )}
                {docMsg && <p className="mt-1 text-xs text-silver-600">{docMsg}</p>}
              </div>
              <button
                type="button"
                onClick={consultarCnpjAutofill}
                disabled={docLoading || !isValidCnpj(form.cliente.cnpj)}
                className="btn-outline mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-sm"
              >
                {docLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Consultar
              </button>
            </div>
          </div>
        ) : (
          <div className="md:col-span-2">
            <label className="label">CPF *</label>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <input
                  className="input font-medium"
                  value={form.cliente.cpf}
                  onChange={e => patchCliente({ cpf: maskCpf(e.target.value) })}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                />
                {form.cliente.cpf && !isValidCpf(form.cliente.cpf) && (
                  <p className="mt-1 text-xs text-danger">CPF inválido.</p>
                )}
                {docMsg && <p className="mt-1 text-xs text-silver-600">{docMsg}</p>}
              </div>
              <button
                type="button"
                onClick={validarDoc}
                disabled={docLoading || !isValidCpf(form.cliente.cpf)}
                className="btn-outline mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-sm"
              >
                {docLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Validar
              </button>
            </div>
          </div>
        )}

        {isPJ ? (
          <>
            <Field label="Razão social *" value={form.cliente.razao_social} onChange={v => patchCliente({ razao_social: v })} />
            <Field label="E-mail do responsável *" type="email" value={form.cliente.email_responsavel} onChange={v => patchCliente({ email_responsavel: v })} />
            <Field label="Celular comercial *" value={form.cliente.celular_comercial} onChange={v => patchCliente({ celular_comercial: v })} placeholder="+55 (11) 9XXXX-XXXX" />
            <Field label="Tipo de empresa *" value={form.cliente.tipo_empresa} onChange={v => patchCliente({ tipo_empresa: v })} placeholder="Ex.: LTDA, S.A., MEI" />
            <Field label="Ramo de atuação *" value={form.cliente.ramo_atuacao} onChange={v => patchCliente({ ramo_atuacao: v })} />
            <Field label="Data de abertura *" type="date" value={form.cliente.data_abertura} onChange={v => patchCliente({ data_abertura: v })} />
            <MoneyField label="Faturamento mensal *" value={form.cliente.faturamento_mensal} onChange={v => patchCliente({ faturamento_mensal: v })} />
            <Field label="E-mail de contato" type="email" value={form.cliente.email} onChange={v => patchCliente({ email: v })} />
          </>
        ) : (
          <>
            <Field label="Nome completo *" value={form.cliente.nome_completo} onChange={v => patchCliente({ nome_completo: v })} />
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
            <div>
              <label className="label">Composição de renda</label>
              <select className="input" value={form.cliente.modelo_renda} onChange={e => patchCliente({ modelo_renda: e.target.value as ModeloRenda })}>
                <option value="">—</option>
                {MODELO_RENDA_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <MoneyField label="Renda mensal do cliente" value={form.cliente.renda_mensal} onChange={v => patchCliente({ renda_mensal: v })} />
          </>
        )}
      </div>

      {!isPJ && casado && (
        <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm text-silver-700">
          ⚠️ Estado civil {form.cliente.estado_civil === 'casado' ? 'casado' : 'união estável'}: o cônjuge será exigido como co-proponente na etapa Proponentes.
        </div>
      )}

      {/* Endereço do cliente / da empresa */}
      <h3 className="mt-7 text-sm font-semibold uppercase tracking-wide text-silver-500">
        {isPJ ? 'Endereço da empresa' : 'Endereço do cliente'}
      </h3>
      <EnderecoFields endereco={form.cliente.endereco} onChange={patchEndereco} />
    </>
  )
}

// Bloco reutilizável de endereço com CEP + ViaCEP.
function EnderecoFields({ endereco, onChange }: {
  endereco: EnderecoForm
  onChange: (p: Partial<EnderecoForm>) => void
}) {
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)

  async function buscarCep(digits: string) {
    setCepLoading(true)
    setCepError(null)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) throw new Error()
      const data = await res.json() as Record<string, string>
      if (data['erro']) { setCepError('CEP não encontrado.'); return }
      onChange({
        logradouro: data['logradouro'] ?? '',
        bairro: data['bairro'] ?? '',
        cidade: data['localidade'] ?? '',
        estado: data['uf'] ?? '',
      })
    } catch {
      setCepError('Não foi possível consultar o CEP.')
    } finally {
      setCepLoading(false)
    }
  }

  function handleCep(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
    onChange({ cep: formatted })
    setCepError(null)
    if (digits.length === 8) void buscarCep(digits)
  }

  return (
    <div className="mt-3 grid gap-4 md:grid-cols-3">
      <div>
        <label className="label">CEP</label>
        <div className="relative">
          <input className="input pr-8" value={endereco.cep} onChange={e => handleCep(e.target.value)} placeholder="00000-000" maxLength={9} inputMode="numeric" />
          {cepLoading && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-silver-400" />}
        </div>
        {cepError && <p className="mt-1 text-xs text-danger">{cepError}</p>}
      </div>
      <Field label="Estado" value={endereco.estado} onChange={v => onChange({ estado: v.toUpperCase().slice(0, 2) })} placeholder="SP" />
      <Field label="Cidade" value={endereco.cidade} onChange={v => onChange({ cidade: v })} />
      <Field label="Bairro" value={endereco.bairro} onChange={v => onChange({ bairro: v })} />
      <div className="md:col-span-2"><Field label="Logradouro" value={endereco.logradouro} onChange={v => onChange({ logradouro: v })} /></div>
      <Field label="Número" value={endereco.numero} onChange={v => onChange({ numero: v })} />
      <div className="md:col-span-3"><Field label="Complemento (opcional)" value={endereco.complemento} onChange={v => onChange({ complemento: v })} /></div>
    </div>
  )
}

function Step4({
  form, patch, valorImoveisTotal,
}: {
  form: FormState
  patch: (p: Partial<FormState>) => void
  valorImoveisTotal: number
}) {
  const values: SimuladorCreditoValues = {
    valor_solicitado: form.valor_solicitado,
    valor_garantia: valorImoveisTotal,
    taxa_juros_mensal: form.taxa_juros_mensal,
    prazo_meses: form.prazo_meses,
    carencia_meses: form.carencia_meses,
    correcao: form.correcao,
    amortizacao: form.amortizacao,
  }
  return (
    <>
      <h2 className="mb-5 text-lg font-semibold text-navy">Valores e prazo</h2>
      <SimuladorCredito values={values} garantiaEditavel={false} garantiaHint="Atualize na etapa Imóveis" onChange={next => patch(next as Partial<FormState>)} />

      <div className="mt-6 rounded-lg border border-silver-200 bg-silver-50 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-red-600"
            checked={form.limite_50_aplicado}
            onChange={e => patch({ limite_50_aplicado: e.target.checked })}
          />
          <span className="text-sm">
            <span className="font-semibold text-navy">Aplicar limite de 50% do valor de referência do imóvel</span>
            <span className="mt-1 block text-xs text-silver-600">
              Quando marcado, o valor do empréstimo não pode ultrapassar 50% da soma do valor dos imóveis
              ({brl(valorImoveisTotal * 100)} → limite {brl(valorImoveisTotal * 0.5 * 100)}).
            </span>
          </span>
        </label>
        {form.limite_50_aplicado && valorImoveisTotal > 0 && form.valor_solicitado > valorImoveisTotal * 0.5 && (
          <p className="mt-3 rounded-md border border-danger/40 bg-danger/5 p-2 text-xs text-danger">
            Valor solicitado ({brl(form.valor_solicitado * 100)}) excede o limite de 50% ({brl(valorImoveisTotal * 0.5 * 100)}).
            Ajuste o valor para avançar.
          </p>
        )}
      </div>
    </>
  )
}

function Step5({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const patchProp = (idx: number, p: Partial<ProponenteForm>) =>
    setForm(f => ({ ...f, proponentes: f.proponentes.map((x, i) => i === idx ? { ...x, ...p } : x) }))
  const patchPropEndereco = (idx: number, p: Partial<EnderecoForm>) =>
    setForm(f => ({ ...f, proponentes: f.proponentes.map((x, i) => i === idx ? { ...x, endereco: { ...x.endereco, ...p } } : x) }))
  const addProp = () =>
    setForm(f => ({ ...f, proponentes: [...f.proponentes, {
      nome: '', cpf_cnpj: '', principal: false, relacao: 'outro', estado_civil: '',
      compoe_renda: null, modelo_renda: '', renda_mensal: 0, endereco: enderecoVazio(),
    }] }))
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
                {p.principal ? 'Principal' : p.relacao === 'conjuge' ? 'Cônjuge' : p.relacao === 'socio' ? 'Sócio' : 'Co-proponente'}
              </span>
              <div className="flex items-center gap-3">
                {!p.principal && form.proponentes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, proponentes: f.proponentes.map((x, i) => ({ ...x, principal: i === idx })) }))}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Marcar como principal
                  </button>
                )}
                {!p.principal && (
                  <button type="button" onClick={() => removeProp(idx)} className="text-xs text-danger hover:underline inline-flex items-center gap-1">
                    <Trash2 className="h-3 w-3" /> Remover
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome *" value={p.nome} onChange={v => patchProp(idx, { nome: v })} />
              <Field
                label="CPF/CNPJ *"
                value={p.cpf_cnpj}
                onChange={v => patchProp(idx, { cpf_cnpj: onlyDigits(v).length > 11 ? maskCnpj(v) : maskCpf(v) })}
                placeholder="000.000.000-00"
              />
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
              {!p.principal && (
                <div className="md:col-span-2">
                  <label className="label">Compõe a renda mínima da proposta? *</label>
                  <div className="mt-1 inline-flex gap-2">
                    {([['Sim', true], ['Não', false]] as const).map(([lbl, val]) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => patchProp(idx, { compoe_renda: val })}
                        className={`btn-no-liquid rounded-md border-2 px-5 py-1.5 text-sm font-medium transition-all ${p.compoe_renda === val ? 'border-red-600 bg-red-600 text-white' : 'border-silver-300 bg-white text-silver-700 hover:border-red-600/50'}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-silver-500">Vale para qualquer relação (cônjuge, sócio ou outro). Se sim, a renda é obrigatória.</p>
                </div>
              )}
              {(p.principal || p.compoe_renda === true) && (
                <>
                  <div>
                    <label className="label">Composição de renda</label>
                    <select className="input" value={p.modelo_renda} onChange={e => patchProp(idx, { modelo_renda: e.target.value as ModeloRenda })}>
                      <option value="">—</option>
                      {MODELO_RENDA_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                  <MoneyField label={p.principal ? 'Renda mensal' : 'Renda mensal *'} value={p.renda_mensal} onChange={v => patchProp(idx, { renda_mensal: v })} />
                </>
              )}
            </div>
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-silver-500">Endereço do proponente</p>
              <EnderecoFields endereco={p.endereco} onChange={pp => patchPropEndereco(idx, pp)} />
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addProp} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-red-600">
        <Plus className="h-4 w-4" /> Adicionar outro proponente
      </button>
    </>
  )
}

// Endereço + CEP + mapa para imóveis secundários (Step 6).
function ImovelEndereco({ im, onPatch }: { im: ImovelForm; onPatch: (p: Partial<ImovelForm>) => void }) {
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  async function geocode(): Promise<void> {
    setMapLoading(true)
    setMapError(null)
    const tentativas = [
      [im.logradouro, im.numero, im.bairro, im.cidade, im.estado, 'Brasil'].filter(Boolean).join(', '),
      [im.bairro, im.cidade, im.estado, 'Brasil'].filter(Boolean).join(', '),
      [im.cidade, im.estado, 'Brasil'].filter(Boolean).join(', '),
    ].filter(q => q.length > 5)
    try {
      for (const q of tentativas) {
        const params = new URLSearchParams({ q, format: 'json', limit: '1', countrycodes: 'br' })
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'Accept-Language': 'pt-BR' } })
        if (!res.ok) continue
        const results = await res.json() as Array<{ lat: string; lon: string }>
        if (results.length > 0) {
          onPatch({ latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) })
          setMapLoading(false)
          return
        }
      }
      setMapError('Não foi possível localizar o endereço no mapa.')
    } catch {
      setMapError('Falha ao consultar o mapa.')
    } finally {
      setMapLoading(false)
    }
  }

  async function buscarCep(digits: string) {
    setCepLoading(true); setCepError(null)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) throw new Error()
      const data = await res.json() as Record<string, string>
      if (data['erro']) { setCepError('CEP não encontrado.'); return }
      onPatch({
        logradouro: data['logradouro'] ?? '', bairro: data['bairro'] ?? '',
        cidade: data['localidade'] ?? '', estado: data['uf'] ?? '',
      })
    } catch {
      setCepError('Não foi possível consultar o CEP.')
    } finally {
      setCepLoading(false)
    }
  }

  function handleCep(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
    onPatch({ cep: formatted })
    setCepError(null)
    if (digits.length === 8) void buscarCep(digits)
  }

  const osmSrc = im.latitude != null && im.longitude != null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${im.longitude - 0.012},${im.latitude - 0.008},${im.longitude + 0.012},${im.latitude + 0.008}&layer=mapnik&marker=${im.latitude},${im.longitude}`
    : null

  return (
    <div className="mt-4 rounded-md border border-silver-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-silver-500">Endereço do imóvel</p>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="label">CEP *</label>
          <div className="relative">
            <input className="input pr-8" value={im.cep} onChange={e => handleCep(e.target.value)} placeholder="00000-000" maxLength={9} inputMode="numeric" />
            {cepLoading && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-silver-400" />}
          </div>
          {cepError && <p className="mt-1 text-xs text-danger">{cepError}</p>}
        </div>
        <Field label="Estado *" value={im.estado} onChange={v => onPatch({ estado: v.toUpperCase().slice(0, 2) })} placeholder="SP" />
        <Field label="Cidade *" value={im.cidade} onChange={v => onPatch({ cidade: v })} />
        <Field label="Bairro *" value={im.bairro} onChange={v => onPatch({ bairro: v })} />
        <div className="md:col-span-2"><Field label="Logradouro *" value={im.logradouro} onChange={v => onPatch({ logradouro: v })} /></div>
        <Field label="Número *" value={im.numero} onChange={v => onPatch({ numero: v })} />
        <div className="md:col-span-3"><Field label="Complemento (opcional)" value={im.complemento} onChange={v => onPatch({ complemento: v })} /></div>
      </div>
      <div className="mt-3">
        {osmSrc ? (
          <div className="overflow-hidden rounded-lg border border-silver-200">
            <iframe title="Localização do imóvel secundário" src={osmSrc} width="100%" height="200" loading="lazy" className="block" style={{ border: 0 }} />
            <div className="flex items-center justify-end bg-silver-50 px-3 py-1.5 text-xs">
              <button type="button" onClick={() => void geocode()} disabled={mapLoading} className="flex items-center gap-1 text-silver-500 hover:text-navy">
                <RefreshCw className={`h-3 w-3 ${mapLoading ? 'animate-spin' : ''}`} /> Atualizar mapa
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => void geocode()} disabled={mapLoading} className="inline-flex items-center gap-1.5 rounded-md border border-silver-300 bg-white px-2.5 py-1.5 text-xs font-medium text-navy hover:border-red-600 hover:text-red-600">
            {mapLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
            {mapError ?? 'Ver no mapa'}
          </button>
        )}
      </div>
    </div>
  )
}

function StepImoveis({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const patchIm = (idx: number, p: Partial<ImovelForm>) =>
    setForm(f => ({ ...f, imoveis: f.imoveis.map((x, i) => i === idx ? { ...x, ...p } : x) }))
  const addIm = () =>
    setForm(f => ({
      ...f,
      imoveis: [...f.imoveis, {
        tipo: 'apartamento', principal: false, cep: '', estado: '', cidade: '', bairro: '', logradouro: '',
        numero: '', complemento: '', latitude: null, longitude: null, valor: 0, vagas_garagem: 0,
        alugado: false, valor_aluguel: 0,
        financiado: false, instituicao_financiadora: '', saldo_devedor: 0,
        possui_debitos: false, debitos_iptu: 0, debitos_condominio: 0,
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
              <MoneyField label="Valor do imóvel *" value={im.valor} onChange={v => patchIm(idx, { valor: v })} />
              <NumberField label="Vagas de garagem" value={im.vagas_garagem} onChange={v => patchIm(idx, { vagas_garagem: v })} />
            </div>
            <ImovelEndereco im={im} onPatch={p => patchIm(idx, p)} />
            <div className="mt-4 space-y-2">
              <Toggle label="Imóvel alugado?" value={im.alugado} onChange={v => patchIm(idx, { alugado: v, valor_aluguel: v ? im.valor_aluguel : 0 })} />
              {im.alugado && (
                <div className="rounded-md border border-silver-200 bg-white p-3 pl-4">
                  <MoneyField label="Valor do aluguel mensal" value={im.valor_aluguel} onChange={v => patchIm(idx, { valor_aluguel: v })} />
                </div>
              )}

              <Toggle label="Imóvel financiado?" value={im.financiado} onChange={v => patchIm(idx, { financiado: v, instituicao_financiadora: v ? im.instituicao_financiadora : '', saldo_devedor: v ? im.saldo_devedor : 0 })} />
              {im.financiado && (
                <div className="grid gap-3 rounded-md border border-silver-200 bg-white p-3 pl-4 md:grid-cols-2">
                  <Field label="Instituição financiadora" value={im.instituicao_financiadora} onChange={v => patchIm(idx, { instituicao_financiadora: v })} placeholder="Ex.: Caixa, Itaú…" />
                  <MoneyField label="Saldo devedor" value={im.saldo_devedor} onChange={v => patchIm(idx, { saldo_devedor: v })} />
                </div>
              )}

              <Toggle label="Possui débitos?" value={im.possui_debitos} onChange={v => patchIm(idx, { possui_debitos: v, debitos_iptu: v ? im.debitos_iptu : 0, debitos_condominio: v ? im.debitos_condominio : 0 })} />
              {im.possui_debitos && (
                <div className="grid gap-3 rounded-md border border-silver-200 bg-white p-3 pl-4 md:grid-cols-2">
                  <MoneyField label="Débitos de IPTU" value={im.debitos_iptu} onChange={v => patchIm(idx, { debitos_iptu: v })} />
                  <MoneyField label="Débitos de condomínio" value={im.debitos_condominio} onChange={v => patchIm(idx, { debitos_condominio: v })} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addIm} className="mt-4 inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-silver-300 px-4 py-3 text-sm font-medium text-silver-600 hover:border-gold hover:text-red-600">
        <Plus className="h-4 w-4" /> Adicionar outro imóvel
      </button>
    </>
  )
}

function ReviewSection({ title, summary, children }: { title: string; summary: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-silver-200 bg-white">
      <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm">
        <span className="min-w-0"><b className="text-navy">{title}:</b> <span className="text-silver-700">{summary}</span></span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-red-600">
          Editar <ChevronDown className="h-4 w-4 text-silver-400 transition group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-silver-100 p-4">{children}</div>
    </details>
  )
}

function StepRevisao({
  form, setForm, patch, patchCliente, calc, ltv, valorImoveisTotal,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  patch: (p: Partial<FormState>) => void
  patchCliente: (p: Partial<FormState['cliente']>) => void
  calc: ReturnType<typeof calcularFinanciamento>
  ltv: number
  valorImoveisTotal: number
}) {
  const clienteNome = form.pessoa_tipo === 'PJ' ? (form.cliente.razao_social || form.cliente.nome_completo) : form.cliente.nome_completo
  const clienteDoc = form.pessoa_tipo === 'PJ' ? form.cliente.cnpj : form.cliente.cpf
  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Revisão final</h2>
      <p className="mt-1 text-sm text-silver-600">Abra qualquer seção para editar diretamente aqui, sem voltar etapas. O resumo recalcula em tempo real.</p>

      <div className="mt-4 space-y-2">
        <ReviewSection
          title="Produto"
          summary={`${produtoLabel(form.produto)} · ${form.pessoa_tipo} · ${brl(form.valor_solicitado * 100)} · ${form.prazo_meses}m · ${form.amortizacao.toUpperCase()}`}
        >
          <Step1 form={form} patch={patch} />
        </ReviewSection>

        <ReviewSection
          title="Cliente"
          summary={`${clienteNome || '—'} · ${clienteDoc || '—'} · ${form.cliente.telefone || form.cliente.celular_comercial || '—'}`}
        >
          <Step2 form={form} patchCliente={patchCliente} setForm={setForm} />
        </ReviewSection>

        <ReviewSection
          title="Localização e imóveis"
          summary={form.imoveis.map((i, idx) => `${i.principal || idx === 0 ? '★ ' : ''}${i.tipo} ${brl((i.valor || 0) * 100)}`).join(' · ')}
        >
          <StepImoveis form={form} setForm={setForm} />
        </ReviewSection>

        <ReviewSection
          title="Valores"
          summary={`LTV ${(ltv * 100).toFixed(1)}% · 1ª parcela ${brl(calc.primeiraParcela * 100)} · Renda mín. ${brl(calc.rendaMinima * 100)}${form.limite_50_aplicado ? ' · limite 50% aplicado' : ''}`}
        >
          <Step4 form={form} patch={patch} valorImoveisTotal={valorImoveisTotal} />
        </ReviewSection>

        <ReviewSection
          title="Proponentes"
          summary={form.proponentes.map(p => `${p.nome}${p.principal ? ' (principal)' : p.relacao ? ` (${p.relacao})` : ''}`).join(' · ')}
        >
          <Step5 form={form} setForm={setForm} />
        </ReviewSection>
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

function SuccessPanel({ result, pessoaTipo, onNew, onDetalhe }: { result: SubmitResult; pessoaTipo: PessoaTipo; onNew: () => void; onDetalhe: () => void }) {
  const url = publicAppUrl(`/c/proposta/${result.magic_token}`)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const consultasRecomendadas = pessoaTipo === 'PJ'
    ? ['Bacen SCR (CNPJ)', 'Serasa PJ', 'Jusbrasil (CNPJ)', 'Escavador (CNPJ)']
    : ['Bacen SCR (CPF)', 'Serasa PF', 'Certidões (Nacional Consultas)']
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

        {/* Consultas recomendadas por perfil */}
        <div className="mt-4 rounded-lg border border-navy/20 bg-navy/5 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-silver-500">
            Consultas recomendadas — {pessoaTipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {consultasRecomendadas.map(c => (
              <span key={c} className="rounded-full border border-silver-200 bg-white px-2.5 py-1 text-xs text-silver-700">{c}</span>
            ))}
          </div>
          <button onClick={onDetalhe} className="btn-outline mt-3 inline-flex items-center gap-1.5 text-sm">
            <Search className="h-3.5 w-3.5" /> Abrir consultas no detalhe da proposta
          </button>
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

function MoneyField({
  label, value, onChange, disabled, hint,
}: {
  label: string
  value: number
  onChange?: (v: number) => void
  disabled?: boolean
  hint?: string
}) {
  return <MoneyInput label={label} value={value} onChange={onChange} disabled={disabled} hint={hint} />
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
