import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Building, Home as HomeIcon, Hammer, Check, Plus, Trash2, MapPin, ChevronDown, Copy, Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { calcularFinanciamento, calcularLTV } from '@/lib/credito'
import { parseRangeInteger } from '@/lib/range'

const STEPS = ['Produto', 'Cliente', 'Localização', 'Valores', 'Proponentes', 'Imóveis', 'Revisão']
const PRAZO_MIN_MESES = 12
const PRAZO_MAX_MESES = 240
const CARENCIA_MIN_MESES = 0
const CARENCIA_MAX_MESES = 3

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
  valor_aluguel: number
  financiado: boolean
  instituicao_financiadora: string
  saldo_devedor: number
  possui_debitos: boolean
  debitos_iptu: number
  debitos_condominio: number
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

export function PartnerWizard({ mode = 'partner' }: { mode?: WizardMode } = {}) {
  const navigate = useNavigate()
  const isAdminMode = mode === 'admin'
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(initialState)
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
        .eq('status', 'approved')
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

      if (isAdminMode) {
        if (!adminPartnerId) throw new Error('Selecione um parceiro aprovado para criar a proposta.')
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
    if (s === 1) return !!form.cliente.nome_completo && !!form.cliente.cpf
    if (s === 2) return !!form.imoveis[0].cidade && !!form.imoveis[0].estado
    if (s === 3) {
      const prazoValido = Number.isInteger(form.prazo_meses) && form.prazo_meses >= PRAZO_MIN_MESES && form.prazo_meses <= PRAZO_MAX_MESES
      const carenciaValida = Number.isInteger(form.carencia_meses) && form.carencia_meses >= CARENCIA_MIN_MESES && form.carencia_meses <= CARENCIA_MAX_MESES
      return form.valor_solicitado > 0 && prazoValido && carenciaValida
    }
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
    return <SuccessPanel result={result} onNew={() => { setResult(null); setForm(initialState); setStep(0) }} onDetalhe={() => navigate(isAdminMode ? `/admin/propostas/${result.proposta_id}` : `/p/propostas/${result.proposta_id}`)} />
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
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando parceiros aprovados...
            </div>
          ) : adminPartnersQ.error ? (
            <p className="text-sm text-danger">Não foi possível carregar os parceiros aprovados.</p>
          ) : adminPartners.length === 0 ? (
            <p className="text-sm text-warning">Nenhum parceiro aprovado disponível para criação.</p>
          ) : (
            <select
              className="input"
              value={adminPartnerId}
              onChange={(e) => setAdminPartnerId(e.target.value)}
            >
              <option value="">Selecione um parceiro</option>
              {adminPartners.map((partner) => (
                <option key={partner.partner_id} value={partner.partner_id}>
                  {(partner.nome || partner.email || partner.partner_id)}
                </option>
              ))}
            </select>
          )}
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
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  const patch = (p: Partial<ImovelForm>) =>
    setForm(f => ({ ...f, imoveis: [{ ...f.imoveis[0], ...p }, ...f.imoveis.slice(1)] }))

  async function nominatim(query: string): Promise<{ lat: number; lng: number } | null> {
    const params = new URLSearchParams({ q: query, format: 'json', limit: '1', countrycodes: 'br', addressdetails: '0' })
    // Obs.: header User-Agent é proibido em fetch no browser e seria silenciosamente ignorado.
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'pt-BR' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const results = await res.json() as Array<{ lat: string; lon: string }>
    if (results.length === 0) return null
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
  }

  async function geocodificar(opts: { logradouro?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; cep?: string }) {
    setMapLoading(true)
    setMapError(null)
    const { logradouro, numero, bairro, cidade, estado, cep } = opts
    // Cascata: do mais específico ao mais genérico — Nominatim costuma falhar no endereço completo.
    const tentativas = [
      [logradouro, numero, bairro, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
      [logradouro, bairro, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
      [logradouro, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
      [bairro, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
      cep ? `${cep}, Brasil` : '',
      [cidade, estado, 'Brasil'].filter(Boolean).join(', '),
    ].filter(q => q && q.length > 5)

    try {
      for (const q of tentativas) {
        try {
          const found = await nominatim(q)
          if (found) {
            setMapCoords(found)
            setMapError(null)
            return
          }
        } catch {
          // tenta próxima estratégia
        }
      }
      setMapCoords(null)
      setMapError('Não foi possível localizar o endereço no mapa.')
    } finally {
      setMapLoading(false)
    }
  }

  async function buscarCep(digits: string) {
    setCepLoading(true)
    setCepError(null)
    setMapCoords(null)
    setMapError(null)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.ok) throw new Error()
      const data = await res.json() as Record<string, string>
      if (data['erro']) { setCepError('CEP não encontrado.'); return }
      const logradouro = data['logradouro'] ?? ''
      const bairro     = data['bairro'] ?? ''
      const cidade     = data['localidade'] ?? ''
      const estado     = data['uf'] ?? ''
      patch({ estado, cidade, bairro, logradouro })
      void geocodificar({ logradouro, numero: im.numero, bairro, cidade, estado, cep: digits })
    } catch {
      setCepError('Não foi possível consultar o CEP.')
    } finally {
      setCepLoading(false)
    }
  }

  function handleCep(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
    patch({ cep: formatted })
    setCepError(null)
    if (digits.length === 8) void buscarCep(digits)
  }

  function atualizarMapa() {
    void geocodificar({
      logradouro: im.logradouro,
      numero: im.numero,
      bairro: im.bairro,
      cidade: im.cidade,
      estado: im.estado,
      cep: im.cep.replace(/\D/g, ''),
    })
  }

  const osmSrc = mapCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${mapCoords.lng - 0.012},${mapCoords.lat - 0.008},${mapCoords.lng + 0.012},${mapCoords.lat + 0.008}&layer=mapnik&marker=${mapCoords.lat},${mapCoords.lng}`
    : null

  return (
    <>
      <h2 className="text-lg font-semibold text-navy">Localização do imóvel principal</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {/* CEP com busca automática */}
        <div>
          <label className="label">CEP</label>
          <div className="relative">
            <input
              className="input pr-8"
              value={im.cep}
              onChange={e => handleCep(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
              inputMode="numeric"
            />
            {cepLoading && (
              <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-silver-400" />
            )}
          </div>
          {cepError && <p className="mt-1 text-xs text-danger">{cepError}</p>}
        </div>
        <Field label="Estado *" value={im.estado} onChange={v => patch({ estado: v.toUpperCase().slice(0, 2) })} placeholder="SP" />
        <Field label="Cidade *" value={im.cidade} onChange={v => patch({ cidade: v })} />
        <Field label="Bairro" value={im.bairro} onChange={v => patch({ bairro: v })} />
        <div className="md:col-span-2"><Field label="Logradouro" value={im.logradouro} onChange={v => patch({ logradouro: v })} /></div>
        <Field label="Número" value={im.numero} onChange={v => patch({ numero: v })} />
        <div className="md:col-span-3"><Field label="Complemento" value={im.complemento} onChange={v => patch({ complemento: v })} /></div>
      </div>

      {/* Mapa */}
      {osmSrc ? (
        <div className="mt-5 overflow-hidden rounded-lg border border-silver-200 shadow-sm">
          <iframe
            title="Localização do imóvel"
            src={osmSrc}
            width="100%"
            height="240"
            loading="lazy"
            className="block"
            style={{ border: 0 }}
          />
          <div className="flex items-center justify-between bg-silver-50 px-3 py-2 text-xs text-silver-500">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 shrink-0 text-red-600" />
              {[im.logradouro, im.numero].filter(Boolean).join(', ')}
              {im.bairro ? ` — ${im.bairro}` : ''}
              {im.cidade ? `, ${im.cidade}/${im.estado}` : ''}
            </span>
            <div className="ml-3 flex shrink-0 items-center gap-3">
              <button type="button" onClick={atualizarMapa} className="flex items-center gap-1 hover:text-navy hover:underline" disabled={mapLoading}>
                <RefreshCw className={`h-3 w-3 ${mapLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <a
                href={`https://maps.google.com/maps?q=&layer=c&cbll=${mapCoords!.lat},${mapCoords!.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-navy hover:underline"
              >
                🚶 Street View ↗
              </a>
              <a
                href={`https://www.openstreetmap.org/?mlat=${mapCoords!.lat}&mlon=${mapCoords!.lng}#map=17/${mapCoords!.lat}/${mapCoords!.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-navy hover:underline"
              >
                Abrir no mapa ↗
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex items-center justify-between gap-2 rounded-lg border border-dashed border-silver-200 bg-silver-50 p-4 text-sm text-silver-500">
          <span className="flex items-center gap-2">
            {mapLoading
              ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              : <MapPin className="h-4 w-4 shrink-0" />}
            {mapLoading
              ? 'Carregando mapa…'
              : (mapError ?? 'Preencha o CEP para visualizar o mapa automaticamente.')}
          </span>
          {(im.cep || im.cidade) && !mapLoading && (
            <button
              type="button"
              onClick={atualizarMapa}
              className="flex items-center gap-1 rounded-md border border-silver-300 bg-white px-2.5 py-1 text-xs font-medium text-navy hover:border-red-600 hover:text-red-600"
            >
              <RefreshCw className="h-3 w-3" /> Tentar novamente
            </button>
          )}
        </div>
      )}
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
  const updatePrazo = (rawValue: string) => {
    patch({
      prazo_meses: parseRangeInteger(rawValue, form.prazo_meses, PRAZO_MIN_MESES, PRAZO_MAX_MESES),
    })
  }

  const updateCarencia = (rawValue: string) => {
    patch({
      carencia_meses: parseRangeInteger(rawValue, form.carencia_meses, CARENCIA_MIN_MESES, CARENCIA_MAX_MESES),
    })
  }

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
                  className={`btn-no-liquid rounded-md border px-4 py-1.5 text-sm font-medium transition ${form.correcao === c ? 'border-red-600 bg-red-600 text-white' : 'border-silver-300 bg-silver-100 text-silver-600'}`}>
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
                  className={`btn-no-liquid rounded-md border px-4 py-1.5 text-sm font-medium transition ${form.amortizacao === a ? 'border-red-600 bg-red-600 text-white' : 'border-silver-300 bg-silver-100 text-silver-600'}`}>
                  {a.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Prazo: {form.prazo_meses} meses</label>
            <input
              type="range"
              min={PRAZO_MIN_MESES}
              max={PRAZO_MAX_MESES}
              step={1}
              value={form.prazo_meses}
              onChange={e => updatePrazo(e.currentTarget.value)}
              onInput={e => updatePrazo(e.currentTarget.value)}
              className="w-full accent-red-600"
            />
          </div>
          <div>
            <label className="label">Carência: {form.carencia_meses} meses</label>
            <input
              type="range"
              min={CARENCIA_MIN_MESES}
              max={CARENCIA_MAX_MESES}
              step={1}
              value={form.carencia_meses}
              onChange={e => updateCarencia(e.currentTarget.value)}
              onInput={e => updateCarencia(e.currentTarget.value)}
              className="w-full accent-red-600"
            />
          </div>
        </div>
      </div>
      <div className="rounded-lg border-2 border-red-600/40 bg-red-600/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Simulação em tempo real</p>
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

function MoneyField({
  label, value, onChange, disabled, hint,
}: {
  label: string
  value: number
  onChange?: (v: number) => void
  disabled?: boolean
  hint?: string
}) {
  const display = value > 0
    ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
    : ''
  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    if (!digits) { onChange?.(0); return }
    onChange?.(Number(digits) / 100)
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-silver-500">R$</span>
        <input
          className="input pl-9"
          type="text"
          inputMode="numeric"
          value={display}
          disabled={disabled}
          placeholder="0,00"
          onChange={e => handleChange(e.target.value)}
        />
      </div>
      {hint && <p className="mt-1 text-xs text-silver-500">{hint}</p>}
    </div>
  )
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
