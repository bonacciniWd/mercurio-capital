import { useMemo, useState } from 'react'
import { ScrollView, View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { X, ChevronRight, ChevronLeft, Check, Search } from 'lucide-react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { calcularFinanciamento } from '@/lib/credito'

const STEPS = ['Produto', 'Cliente', 'Imóvel', 'Crédito', 'Proponentes', 'Revisão']
const PRAZO_MIN = 12
const PRAZO_MAX = 240
const CARENCIA_MIN = 0
const CARENCIA_MAX = 3

type ProdutoTipo = 'home_equity' | 'credito_construcao' | 'financiamento_imobiliario'
type PessoaTipo = 'PF' | 'PJ'
type CorrecaoTipo = 'pos_fixado' | 'pre_fixado'
type AmortizacaoTipo = 'price' | 'sac'
type EstadoCivil = '' | 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'uniao_estavel'
type ModeloRenda = '' | 'assalariado_clt' | 'empresario' | 'autonomo' | 'aposentado_pensionista' | 'funcionario_publico'
type PropostaWizardMode = 'partner' | 'admin'

const MODELO_RENDA_OPTIONS: Array<{ id: Exclude<ModeloRenda, ''>; label: string }> = [
  { id: 'assalariado_clt', label: 'Assalariado (CLT)' },
  { id: 'empresario', label: 'Empresário' },
  { id: 'autonomo', label: 'Autônomo' },
  { id: 'aposentado_pensionista', label: 'Aposentado/Pensionista' },
  { id: 'funcionario_publico', label: 'Funcionário Público' },
]

const ESTADO_CIVIL_OPTIONS: Array<{ id: Exclude<EstadoCivil, ''>; label: string }> = [
  { id: 'solteiro', label: 'Solteiro(a)' },
  { id: 'casado', label: 'Casado(a)' },
  { id: 'divorciado', label: 'Divorciado(a)' },
  { id: 'viuvo', label: 'Viúvo(a)' },
  { id: 'uniao_estavel', label: 'União estável' },
]

interface WizardForm {
  produto: ProdutoTipo
  pessoa_tipo: PessoaTipo
  cliente_nome: string
  cliente_cpf: string
  cliente_cnpj: string
  cliente_email: string
  cliente_telefone: string
  cliente_data_nascimento: string
  cliente_estado_civil: EstadoCivil
  cliente_modelo_renda: ModeloRenda
  cliente_renda_mensal: number
  // Endereço do cliente/empresa
  cliente_end_cep: string
  cliente_end_estado: string
  cliente_end_cidade: string
  cliente_end_bairro: string
  cliente_end_logradouro: string
  cliente_end_numero: string
  cliente_end_complemento: string
  // Pessoa Jurídica
  pj_razao_social: string
  pj_email_responsavel: string
  pj_celular_comercial: string
  pj_tipo_empresa: string
  pj_ramo_atuacao: string
  pj_data_abertura: string
  pj_faturamento_mensal: number
  // Cônjuge (PF casado/união)
  conjuge_nome: string
  conjuge_cpf: string
  conjuge_compoe_renda: boolean | null
  conjuge_renda_mensal: number
  // Imóvel principal
  imovel_cep: string
  imovel_estado: string
  imovel_cidade: string
  imovel_bairro: string
  imovel_logradouro: string
  imovel_numero: string
  imovel_complemento: string
  valor_solicitado: number
  imovel_valor: number
  limite_50_aplicado: boolean
  prazo_meses: number
  carencia_meses: number
  taxa_juros_mensal: number
  correcao: CorrecaoTipo
  amortizacao: AmortizacaoTipo
}

interface AdminPartnerRow {
  partner_id: string
  nome: string | null
  email: string | null
  status: string
}

interface SubmitResult {
  proposta_id: string
  protocolo: string
  cliente_id: string
  magic_token: string
}

const INITIAL_FORM: WizardForm = {
  produto: 'home_equity',
  pessoa_tipo: 'PF',
  cliente_nome: '',
  cliente_cpf: '',
  cliente_cnpj: '',
  cliente_email: '',
  cliente_telefone: '',
  cliente_data_nascimento: '',
  cliente_estado_civil: '',
  cliente_modelo_renda: '',
  cliente_renda_mensal: 0,
  cliente_end_cep: '',
  cliente_end_estado: '',
  cliente_end_cidade: '',
  cliente_end_bairro: '',
  cliente_end_logradouro: '',
  cliente_end_numero: '',
  cliente_end_complemento: '',
  pj_razao_social: '',
  pj_email_responsavel: '',
  pj_celular_comercial: '',
  pj_tipo_empresa: '',
  pj_ramo_atuacao: '',
  pj_data_abertura: '',
  pj_faturamento_mensal: 0,
  conjuge_nome: '',
  conjuge_cpf: '',
  conjuge_compoe_renda: null,
  conjuge_renda_mensal: 0,
  imovel_cep: '',
  imovel_estado: '',
  imovel_cidade: '',
  imovel_bairro: '',
  imovel_logradouro: '',
  imovel_numero: '',
  imovel_complemento: '',
  valor_solicitado: 350000,
  imovel_valor: 850000,
  limite_50_aplicado: false,
  prazo_meses: 120,
  carencia_meses: 0,
  taxa_juros_mensal: 1.29,
  correcao: 'pos_fixado',
  amortizacao: 'price',
}

export function PropostaWizardScreen({ forcedMode }: { forcedMode?: PropostaWizardMode } = {}) {
  const { session, loading } = useAuth()
  const params = useLocalSearchParams<{ mode?: string }>()

  const requestedMode: PropostaWizardMode =
    forcedMode ?? (params.mode === 'admin' ? 'admin' : 'partner')

  const isAdminMode = requestedMode === 'admin' && session?.role === 'admin'
  const mode: PropostaWizardMode = isAdminMode ? 'admin' : 'partner'

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<WizardForm>(INITIAL_FORM)
  const [adminPartnerId, setAdminPartnerId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [cnpjMsg, setCnpjMsg] = useState<string | null>(null)
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [openReview, setOpenReview] = useState<Record<string, boolean>>({})

  async function consultarCnpjMobile() {
    setCnpjMsg(null)
    if (!isValidCnpj(form.cliente_cnpj)) { setCnpjMsg('Informe um CNPJ válido para consultar.'); return }
    setCnpjLoading(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('cnpj-consultar', {
        body: { cnpj: onlyDigits(form.cliente_cnpj) },
      })
      if (fnErr) throw new Error(fnErr.message)
      const d = data as Record<string, string | null> & { error?: string }
      if (d?.error) throw new Error(d.error)
      setForm((f) => ({
        ...f,
        pj_razao_social: d.razao_social ?? f.pj_razao_social,
        pj_email_responsavel: d.email ?? f.pj_email_responsavel,
        pj_celular_comercial: d.telefone ?? f.pj_celular_comercial,
        pj_tipo_empresa: d.tipo_empresa ?? f.pj_tipo_empresa,
        pj_ramo_atuacao: d.ramo_atuacao ?? f.pj_ramo_atuacao,
        pj_data_abertura: d.data_abertura ?? f.pj_data_abertura,
        cliente_end_cep: d.endereco_cep ?? f.cliente_end_cep,
        cliente_end_logradouro: d.endereco_logradouro ?? f.cliente_end_logradouro,
        cliente_end_numero: d.endereco_numero ?? f.cliente_end_numero,
        cliente_end_bairro: d.endereco_bairro ?? f.cliente_end_bairro,
        cliente_end_cidade: d.endereco_cidade ?? f.cliente_end_cidade,
        cliente_end_estado: d.endereco_estado ?? f.cliente_end_estado,
      }))
      setCnpjMsg(d.situacao ? `Empresa localizada · ${d.situacao}` : 'Dados da empresa carregados.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'falha'
      setCnpjMsg(
        msg === 'invertexto_nao_configurado' ? 'Consulta CNPJ indisponível (não configurada).'
        : msg === 'cnpj_nao_encontrado' ? 'CNPJ não encontrado.'
        : `Não foi possível consultar: ${msg}`,
      )
    } finally {
      setCnpjLoading(false)
    }
  }

  const partnersQ = useQuery({
    queryKey: ['admin-propostas-mobile-partners'],
    enabled: mode === 'admin',
    queryFn: async (): Promise<AdminPartnerRow[]> => {
      const { data, error } = await supabase
        .from('v_admin_partners')
        .select('partner_id, nome, email, status')
        .eq('status', 'approved')
        .order('nome', { ascending: true })
      if (error) throw error
      return (data ?? []) as AdminPartnerRow[]
    },
  })

  const calc = useMemo(() => calcularFinanciamento({
    valor: form.valor_solicitado,
    prazoMeses: form.prazo_meses,
    taxaMensal: form.taxa_juros_mensal / 100,
    amortizacao: form.amortizacao,
    carenciaMeses: form.carencia_meses,
  }), [form.valor_solicitado, form.prazo_meses, form.taxa_juros_mensal, form.amortizacao, form.carencia_meses])

  const submitMut = useMutation({
    mutationFn: async () => {
      const isPJ = form.pessoa_tipo === 'PJ'
      const clienteEndereco = {
        endereco_cep: onlyDigits(form.cliente_end_cep) || null,
        endereco_logradouro: form.cliente_end_logradouro || null,
        endereco_numero: form.cliente_end_numero || null,
        endereco_complemento: form.cliente_end_complemento || null,
        endereco_bairro: form.cliente_end_bairro || null,
        endereco_cidade: form.cliente_end_cidade || null,
        endereco_estado: form.cliente_end_estado || null,
      }
      const casado = form.cliente_estado_civil === 'casado' || form.cliente_estado_civil === 'uniao_estavel'

      const proponentes: Array<Record<string, unknown>> = [
        {
          nome: isPJ ? (form.pj_razao_social || form.cliente_nome) : form.cliente_nome,
          cpf_cnpj: isPJ ? onlyDigits(form.cliente_cnpj) : onlyDigits(form.cliente_cpf),
          principal: true,
          relacao: null,
          estado_civil: form.cliente_estado_civil || null,
          pessoa_tipo: form.pessoa_tipo,
          compoe_renda: true,
          modelo_renda: form.cliente_modelo_renda || null,
          renda_mensal: form.cliente_renda_mensal || null,
          ...clienteEndereco,
        },
      ]
      if (!isPJ && casado && form.conjuge_nome) {
        proponentes.push({
          nome: form.conjuge_nome,
          cpf_cnpj: onlyDigits(form.conjuge_cpf) || null,
          principal: false,
          relacao: 'conjuge',
          estado_civil: form.cliente_estado_civil || null,
          pessoa_tipo: 'PF',
          compoe_renda: form.conjuge_compoe_renda,
          renda_mensal: form.conjuge_compoe_renda ? (form.conjuge_renda_mensal || null) : null,
        })
      }

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
          nome_completo: isPJ ? (form.pj_razao_social || form.cliente_nome) : form.cliente_nome,
          cpf: isPJ ? null : (onlyDigits(form.cliente_cpf) || null),
          cnpj: isPJ ? (onlyDigits(form.cliente_cnpj) || null) : null,
          email: (isPJ ? form.pj_email_responsavel : form.cliente_email) || null,
          telefone: (isPJ ? form.pj_celular_comercial : form.cliente_telefone) || null,
          data_nascimento: form.cliente_data_nascimento || null,
          estado_civil: form.cliente_estado_civil || null,
          modelo_renda: form.cliente_modelo_renda || null,
          renda_mensal: form.cliente_renda_mensal || null,
          ...clienteEndereco,
          razao_social: isPJ ? (form.pj_razao_social || null) : null,
          email_responsavel: isPJ ? (form.pj_email_responsavel || null) : null,
          celular_comercial: isPJ ? (form.pj_celular_comercial || null) : null,
          tipo_empresa: isPJ ? (form.pj_tipo_empresa || null) : null,
          ramo_atuacao: isPJ ? (form.pj_ramo_atuacao || null) : null,
          data_abertura: isPJ ? (form.pj_data_abertura || null) : null,
          faturamento_mensal: isPJ ? (form.pj_faturamento_mensal || null) : null,
        },
        proponentes,
        imoveis: [
          {
            tipo: 'apartamento',
            principal: true,
            cep: onlyDigits(form.imovel_cep) || null,
            estado: form.imovel_estado || null,
            cidade: form.imovel_cidade || null,
            bairro: form.imovel_bairro || null,
            logradouro: form.imovel_logradouro || null,
            numero: form.imovel_numero || null,
            complemento: form.imovel_complemento || null,
            valor: form.imovel_valor,
            vagas_garagem: 0,
            alugado: false,
            valor_aluguel: 0,
            financiado: false,
            instituicao_financiadora: null,
            saldo_devedor: 0,
            possui_debitos: false,
            debitos_iptu: 0,
            debitos_condominio: 0,
          },
        ],
      }

      if (mode === 'admin') {
        if (!adminPartnerId) throw new Error('Selecione um parceiro aprovado.')
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

  const canAdvance = (s: number): boolean => {
    if (s === 0) {
      if (mode === 'admin') return !!adminPartnerId && !partnersQ.isLoading
      return true
    }
    if (s === 1) {
      if (form.pessoa_tipo === 'PJ') {
        return isValidCnpj(form.cliente_cnpj)
          && form.pj_razao_social.trim().length > 0
          && form.pj_email_responsavel.trim().length > 0
          && form.pj_celular_comercial.trim().length > 0
          && form.pj_tipo_empresa.trim().length > 0
          && form.pj_ramo_atuacao.trim().length > 0
          && form.pj_data_abertura.trim().length > 0
          && form.pj_faturamento_mensal > 0
      }
      return form.cliente_nome.trim().length > 0 && isValidCpf(form.cliente_cpf)
    }
    if (s === 2) return form.imovel_cidade.trim().length > 0 && form.imovel_estado.trim().length === 2 && form.imovel_valor > 0
    if (s === 3) {
      const limite50Ok = !form.limite_50_aplicado || (form.imovel_valor > 0 && form.valor_solicitado <= form.imovel_valor * 0.5)
      return form.valor_solicitado > 0
        && form.prazo_meses >= PRAZO_MIN
        && form.prazo_meses <= PRAZO_MAX
        && form.carencia_meses >= CARENCIA_MIN
        && form.carencia_meses <= CARENCIA_MAX
        && limite50Ok
    }
    if (s === 4) {
      const casado = form.cliente_estado_civil === 'casado' || form.cliente_estado_civil === 'uniao_estavel'
      if (form.pessoa_tipo === 'PF' && casado) {
        if (!(form.conjuge_nome.trim().length > 0 && isValidCpf(form.conjuge_cpf))) return false
        if (form.conjuge_compoe_renda === null) return false
        if (form.conjuge_compoe_renda === true && form.conjuge_renda_mensal <= 0) return false
      }
      return true
    }
    return true
  }

  const next = () => {
    setError(null)
    if (!canAdvance(step)) {
      setError('Preencha os campos obrigatórios para continuar.')
      return
    }
    if (step < STEPS.length - 1) setStep((s) => s + 1)
  }

  const prev = () => {
    if (step > 0) {
      setStep((s) => s - 1)
      return
    }
    const fallback = mode === 'admin' ? '/(admin)/propostas' : '/(parceiro)/propostas'
    if (router.canGoBack()) router.back()
    else router.replace(fallback as any)
  }

  // ── Render helpers (fonte única: usados no fluxo e na revisão editável) ──
  const renderProduto = () => (
    <>
      <Text className="text-sm text-silver-600">Selecione o produto desejado</Text>
      {[
        ['home_equity', 'Home Equity', 'Crédito com garantia de imóvel'],
        ['credito_construcao', 'Construção', 'Financiamento para construir/reformar'],
        ['financiamento_imobiliario', 'Financiamento', 'Aquisição de imóvel'],
      ].map(([id, label, desc]) => (
        <Pressable
          key={id}
          onPress={() => setForm((f) => ({ ...f, produto: id as ProdutoTipo }))}
          className={`rounded-xl border-2 p-4 ${form.produto === id ? 'border-gold bg-gold/5' : 'border-silver-200 bg-white'}`}
        >
          <Text className="font-bold text-navy">{label}</Text>
          <Text className="mt-1 text-sm text-silver-600">{desc}</Text>
        </Pressable>
      ))}
      <View className="flex-row gap-2">
        {(['PF', 'PJ'] as const).map((tipo) => (
          <Pressable
            key={tipo}
            onPress={() => setForm((f) => ({ ...f, pessoa_tipo: tipo }))}
            className={`rounded-lg px-4 py-2 ${form.pessoa_tipo === tipo ? 'bg-gold' : 'bg-silver-200'}`}
          >
            <Text className={`font-semibold ${form.pessoa_tipo === tipo ? 'text-white' : 'text-navy'}`}>{tipo}</Text>
          </Pressable>
        ))}
      </View>
    </>
  )

  const renderCliente = () => (
    <>
      {form.pessoa_tipo === 'PJ' ? (
        <>
          <Field label="CNPJ *" value={form.cliente_cnpj} onChange={(v) => setForm((f) => ({ ...f, cliente_cnpj: formatCnpj(v) }))} keyboard="numeric" />
          <Pressable
            onPress={consultarCnpjMobile}
            disabled={cnpjLoading || !isValidCnpj(form.cliente_cnpj)}
            className={`flex-row items-center justify-center gap-1.5 rounded-lg border py-2.5 ${cnpjLoading || !isValidCnpj(form.cliente_cnpj) ? 'border-silver-200 bg-silver-100' : 'border-gold bg-gold/10'}`}
          >
            {cnpjLoading ? <ActivityIndicator color="#991B1B" size="small" /> : <Search size={16} color="#991B1B" />}
            <Text className="text-sm font-semibold text-gold-700">Consultar CNPJ</Text>
          </Pressable>
          {cnpjMsg && <Text className="text-xs text-silver-600">{cnpjMsg}</Text>}
          <Field label="Razão social *" value={form.pj_razao_social} onChange={(v) => setForm((f) => ({ ...f, pj_razao_social: v }))} />
          <Field label="E-mail do responsável *" value={form.pj_email_responsavel} onChange={(v) => setForm((f) => ({ ...f, pj_email_responsavel: v }))} keyboard="email-address" />
          <Field label="Celular comercial *" value={form.pj_celular_comercial} onChange={(v) => setForm((f) => ({ ...f, pj_celular_comercial: v }))} keyboard="phone-pad" />
          <Field label="Tipo de empresa *" value={form.pj_tipo_empresa} onChange={(v) => setForm((f) => ({ ...f, pj_tipo_empresa: v }))} />
          <Field label="Ramo de atuação *" value={form.pj_ramo_atuacao} onChange={(v) => setForm((f) => ({ ...f, pj_ramo_atuacao: v }))} />
          <Field label="Data de abertura * (AAAA-MM-DD)" value={form.pj_data_abertura} onChange={(v) => setForm((f) => ({ ...f, pj_data_abertura: v }))} />
          <MoneyField label="Faturamento mensal *" value={form.pj_faturamento_mensal} onChange={(v) => setForm((f) => ({ ...f, pj_faturamento_mensal: v }))} />
        </>
      ) : (
        <>
          <Field label="CPF *" value={form.cliente_cpf} onChange={(v) => setForm((f) => ({ ...f, cliente_cpf: formatCpf(v) }))} keyboard="numeric" />
          <Field label="Nome completo *" value={form.cliente_nome} onChange={(v) => setForm((f) => ({ ...f, cliente_nome: v }))} />
          <Field label="Data de nascimento (AAAA-MM-DD)" value={form.cliente_data_nascimento} onChange={(v) => setForm((f) => ({ ...f, cliente_data_nascimento: v }))} />
          <Field label="E-mail" value={form.cliente_email} onChange={(v) => setForm((f) => ({ ...f, cliente_email: v }))} keyboard="email-address" />
          <Field label="Telefone" value={form.cliente_telefone} onChange={(v) => setForm((f) => ({ ...f, cliente_telefone: v }))} keyboard="phone-pad" />
          <ChipSelect label="Estado civil" value={form.cliente_estado_civil} options={ESTADO_CIVIL_OPTIONS} onChange={(v) => setForm((f) => ({ ...f, cliente_estado_civil: v as EstadoCivil }))} />
          <ChipSelect label="Composição de renda" value={form.cliente_modelo_renda} options={MODELO_RENDA_OPTIONS} onChange={(v) => setForm((f) => ({ ...f, cliente_modelo_renda: v as ModeloRenda }))} />
          <MoneyField label="Renda mensal" value={form.cliente_renda_mensal} onChange={(v) => setForm((f) => ({ ...f, cliente_renda_mensal: v }))} />
        </>
      )}
      <Text className="mt-2 text-xs font-semibold uppercase text-silver-500">
        Endereço {form.pessoa_tipo === 'PJ' ? 'da empresa' : 'do cliente'}
      </Text>
      <Field label="CEP" value={form.cliente_end_cep} onChange={(v) => setForm((f) => ({ ...f, cliente_end_cep: formatCep(v) }))} keyboard="numeric" />
      <Field label="Estado (UF)" value={form.cliente_end_estado} onChange={(v) => setForm((f) => ({ ...f, cliente_end_estado: v.toUpperCase().slice(0, 2) }))} />
      <Field label="Cidade" value={form.cliente_end_cidade} onChange={(v) => setForm((f) => ({ ...f, cliente_end_cidade: v }))} />
      <Field label="Bairro" value={form.cliente_end_bairro} onChange={(v) => setForm((f) => ({ ...f, cliente_end_bairro: v }))} />
      <Field label="Logradouro" value={form.cliente_end_logradouro} onChange={(v) => setForm((f) => ({ ...f, cliente_end_logradouro: v }))} />
      <Field label="Número" value={form.cliente_end_numero} onChange={(v) => setForm((f) => ({ ...f, cliente_end_numero: v }))} keyboard="numeric" />
      <Field label="Complemento (opcional)" value={form.cliente_end_complemento} onChange={(v) => setForm((f) => ({ ...f, cliente_end_complemento: v }))} />
    </>
  )

  const renderImovel = () => (
    <>
      <Text className="text-xs font-semibold uppercase text-silver-500">Imóvel de garantia</Text>
      <Field label="CEP" value={form.imovel_cep} onChange={(v) => setForm((f) => ({ ...f, imovel_cep: formatCep(v) }))} keyboard="numeric" />
      <Field label="Estado (UF) *" value={form.imovel_estado} onChange={(v) => setForm((f) => ({ ...f, imovel_estado: v.toUpperCase().slice(0, 2) }))} />
      <Field label="Cidade *" value={form.imovel_cidade} onChange={(v) => setForm((f) => ({ ...f, imovel_cidade: v }))} />
      <Field label="Bairro" value={form.imovel_bairro} onChange={(v) => setForm((f) => ({ ...f, imovel_bairro: v }))} />
      <Field label="Endereço" value={form.imovel_logradouro} onChange={(v) => setForm((f) => ({ ...f, imovel_logradouro: v }))} />
      <Field label="Número" value={form.imovel_numero} onChange={(v) => setForm((f) => ({ ...f, imovel_numero: v }))} keyboard="numeric" />
      <Field label="Complemento" value={form.imovel_complemento} onChange={(v) => setForm((f) => ({ ...f, imovel_complemento: v }))} />
      <MoneyField label="Valor do imóvel (garantia) *" value={form.imovel_valor} onChange={(v) => setForm((f) => ({ ...f, imovel_valor: v }))} />
    </>
  )

  const renderCredito = () => (
    <>
      <MoneyField label="Valor solicitado" value={form.valor_solicitado} onChange={(v) => setForm((f) => ({ ...f, valor_solicitado: v }))} />
      <NumberAdjust label="Prazo (meses)" value={form.prazo_meses} min={PRAZO_MIN} max={PRAZO_MAX} onChange={(v) => setForm((f) => ({ ...f, prazo_meses: v }))} />
      <NumberAdjust label="Carência (meses)" value={form.carencia_meses} min={CARENCIA_MIN} max={CARENCIA_MAX} onChange={(v) => setForm((f) => ({ ...f, carencia_meses: v }))} />
      <Field
        label="Taxa mensal (%)"
        value={String(form.taxa_juros_mensal)}
        onChange={(v) => setForm((f) => ({ ...f, taxa_juros_mensal: clampFloat(v, f.taxa_juros_mensal, 0.01, 99) }))}
        keyboard="decimal-pad"
      />
      <Pressable
        onPress={() => setForm((f) => ({ ...f, limite_50_aplicado: !f.limite_50_aplicado }))}
        className="flex-row items-start gap-3 rounded-xl border border-silver-200 bg-silver-50 p-4"
      >
        <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${form.limite_50_aplicado ? 'border-gold bg-gold' : 'border-silver-400 bg-white'}`}>
          {form.limite_50_aplicado && <Check size={14} color="#FFFFFF" />}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-navy">Aplicar limite de 50% do valor do imóvel</Text>
          <Text className="mt-1 text-xs text-silver-600">
            Limite: {brl(form.imovel_valor * 0.5 * 100)}. O empréstimo não pode ultrapassar 50% do valor de referência.
          </Text>
        </View>
      </Pressable>
      {form.limite_50_aplicado && form.imovel_valor > 0 && form.valor_solicitado > form.imovel_valor * 0.5 && (
        <View className="rounded-lg border border-danger/30 bg-danger/5 p-3">
          <Text className="text-xs text-danger">
            Valor solicitado ({brl(form.valor_solicitado * 100)}) excede o limite de 50% ({brl(form.imovel_valor * 0.5 * 100)}).
          </Text>
        </View>
      )}
      <View className="rounded-xl bg-silver-50 p-4">
        <Text className="text-xs uppercase text-silver-500">Simulação</Text>
        <Text className="mt-1 text-base font-bold text-navy">1a parcela: {brl(calc.primeiraParcela * 100)}</Text>
        <Text className="text-sm text-silver-600">Última: {brl(calc.ultimaParcela * 100)}</Text>
        <Text className="text-sm text-silver-600">Total: {brl(calc.totalPago * 100)}</Text>
      </View>
    </>
  )

  const renderProponentes = () => (
    <>
      <View className="rounded-xl border border-silver-200 bg-white p-4">
        <Text className="text-sm text-silver-600">O proponente principal será criado automaticamente com os dados do cliente informado.</Text>
      </View>
      {form.pessoa_tipo === 'PF' && (form.cliente_estado_civil === 'casado' || form.cliente_estado_civil === 'uniao_estavel') && (
        <View className="gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4">
          <Text className="text-sm font-semibold text-navy">
            Cônjuge obrigatório ({form.cliente_estado_civil === 'casado' ? 'casado' : 'união estável'})
          </Text>
          <Field label="Nome do cônjuge *" value={form.conjuge_nome} onChange={(v) => setForm((f) => ({ ...f, conjuge_nome: v }))} />
          <Field label="CPF do cônjuge *" value={form.conjuge_cpf} onChange={(v) => setForm((f) => ({ ...f, conjuge_cpf: formatCpf(v) }))} keyboard="numeric" />
          <Text className="text-xs font-medium text-silver-700">Compõe a renda mínima da proposta? *</Text>
          <View className="flex-row gap-2">
            {([['Sim', true], ['Não', false]] as const).map(([lbl, val]) => (
              <Pressable
                key={lbl}
                onPress={() => setForm((f) => ({ ...f, conjuge_compoe_renda: val }))}
                className={`rounded-lg px-5 py-2 ${form.conjuge_compoe_renda === val ? 'bg-gold' : 'bg-silver-200'}`}
              >
                <Text className={`font-semibold ${form.conjuge_compoe_renda === val ? 'text-white' : 'text-navy'}`}>{lbl}</Text>
              </Pressable>
            ))}
          </View>
          {form.conjuge_compoe_renda === true && (
            <MoneyField label="Renda mensal do cônjuge *" value={form.conjuge_renda_mensal} onChange={(v) => setForm((f) => ({ ...f, conjuge_renda_mensal: v }))} />
          )}
        </View>
      )}
    </>
  )

  const reviewSection = (title: string, summary: string, body: React.ReactNode) => {
    const open = !!openReview[title]
    return (
      <View key={title} className="rounded-xl border border-silver-200 bg-white">
        <Pressable onPress={() => setOpenReview((s) => ({ ...s, [title]: !open }))} className="flex-row items-center justify-between p-4">
          <View className="flex-1 pr-2">
            <Text className="text-sm font-semibold text-navy">{title}</Text>
            <Text className="text-xs text-silver-500" numberOfLines={1}>{summary}</Text>
          </View>
          <Text className="text-xs font-semibold text-gold-700">{open ? 'Fechar' : 'Editar'}</Text>
        </Pressable>
        {open && <View className="gap-3 border-t border-silver-100 p-4">{body}</View>}
      </View>
    )
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#DC2626" />
      </SafeAreaView>
    )
  }

  if (requestedMode === 'admin' && session?.role !== 'admin') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-base font-semibold text-danger">Acesso restrito ao admin.</Text>
      </SafeAreaView>
    )
  }

  if (result) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <View className="flex-1 items-center justify-center px-6">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <Check size={28} color="#16A34A" />
          </View>
          <Text className="text-center text-2xl font-bold text-navy">Proposta criada</Text>
          <Text className="mt-2 text-center text-sm text-silver-500">Protocolo</Text>
          <Text className="font-mono text-lg font-semibold text-navy">{result.protocolo}</Text>

          <View className="mt-5 w-full rounded-xl border border-navy/20 bg-navy/5 p-4">
            <Text className="text-xs font-semibold uppercase text-silver-500">
              Consultas recomendadas — {form.pessoa_tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {(form.pessoa_tipo === 'PJ'
                ? ['Bacen SCR (CNPJ)', 'Serasa PJ', 'Jusbrasil', 'Escavador']
                : ['Bacen SCR (CPF)', 'Serasa PF', 'Certidões']
              ).map((c) => (
                <View key={c} className="rounded-full border border-silver-200 bg-white px-2.5 py-1">
                  <Text className="text-xs text-silver-700">{c}</Text>
                </View>
              ))}
            </View>
            <Text className="mt-2 text-xs text-silver-500">Execute as consultas na aba Consultas do detalhe da proposta.</Text>
          </View>

          <View className="mt-6 w-full gap-2">
            <Pressable
              onPress={() => router.replace((mode === 'admin' ? `/(admin)/proposta/${result.proposta_id}` : `/(parceiro)/propostas/${result.proposta_id}`) as any)}
              className="items-center rounded-lg bg-gold py-3"
            >
              <Text className="font-bold text-white">Ver detalhe</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setResult(null)
                setForm(INITIAL_FORM)
                setStep(0)
                setError(null)
              }}
              className="items-center rounded-lg border border-silver-300 py-3"
            >
              <Text className="font-semibold text-navy">Nova proposta</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="border-b border-silver-200 bg-white px-5 py-3">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={prev} className="-ml-2 p-2">
            <X size={24} color="#0F0F0F" />
          </Pressable>
          <Text className="text-sm font-medium text-silver-700">Passo {step + 1} de {STEPS.length}</Text>
          <View className="w-10" />
        </View>
        <View className="mt-2 h-1 overflow-hidden rounded-full bg-silver-200">
          <View className="h-full rounded-full bg-gold" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </View>
        <Text className="mt-2 text-lg font-bold text-navy">
          {mode === 'admin' ? `Admin • ${STEPS[step]}` : STEPS[step]}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
        {step === 0 && (
          <>
            {mode === 'admin' && (
              <View className="rounded-xl border border-gold/30 bg-gold/5 p-4">
                <Text className="text-xs font-semibold uppercase text-gold-600">Parceiro responsável *</Text>
                {partnersQ.isLoading ? (
                  <View className="mt-3 flex-row items-center gap-2">
                    <ActivityIndicator color="#991B1B" />
                    <Text className="text-sm text-silver-600">Carregando parceiros...</Text>
                  </View>
                ) : partnersQ.error ? (
                  <Text className="mt-2 text-sm text-danger">Erro ao carregar parceiros aprovados.</Text>
                ) : (
                  <View className="mt-3 gap-2">
                    {(partnersQ.data ?? []).map((p) => {
                      const active = adminPartnerId === p.partner_id
                      return (
                        <Pressable
                          key={p.partner_id}
                          onPress={() => setAdminPartnerId(p.partner_id)}
                          className={`rounded-lg border p-3 ${active ? 'border-gold bg-gold/10' : 'border-silver-200 bg-white'}`}
                        >
                          <Text className="font-semibold text-navy">{p.nome ?? p.email ?? p.partner_id}</Text>
                          <Text className="text-xs text-silver-500">{p.email ?? 'sem e-mail'}</Text>
                        </Pressable>
                      )
                    })}
                    {(partnersQ.data ?? []).length === 0 && (
                      <Text className="text-sm text-warning">Nenhum parceiro aprovado disponível.</Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {renderProduto()}
          </>
        )}

        {step === 1 && renderCliente()}

        {step === 2 && renderImovel()}

        {step === 3 && renderCredito()}

        {step === 4 && renderProponentes()}

        {step === 5 && (
          <>
            <Text className="text-sm text-silver-600">Abra qualquer seção para editar diretamente aqui. O resumo recalcula em tempo real.</Text>
            {reviewSection('Produto', `${produtoLabel(form.produto)} · ${form.pessoa_tipo}`, renderProduto())}
            {reviewSection('Cliente', form.pessoa_tipo === 'PJ' ? (form.pj_razao_social || '—') : (form.cliente_nome || '—'), renderCliente())}
            {reviewSection('Imóvel', `${form.imovel_cidade || '—'}/${form.imovel_estado || '—'} · ${brl(form.imovel_valor * 100)}`, renderImovel())}
            {reviewSection('Crédito', `${brl(form.valor_solicitado * 100)} · ${form.prazo_meses}m${form.limite_50_aplicado ? ' · limite 50%' : ''}`, renderCredito())}
            {reviewSection('Proponentes', form.cliente_nome || (form.pj_razao_social || '—'), renderProponentes())}
          </>
        )}

        {error && (
          <View className="rounded-lg border border-danger/30 bg-danger/5 p-3">
            <Text className="text-sm text-danger">{error}</Text>
          </View>
        )}
      </ScrollView>

      <View className="flex-row gap-2 border-t border-silver-200 bg-white px-8 py-3">
        <Pressable onPress={prev} className="flex-row items-center gap-1 rounded-lg border border-silver-300 px-5 py-3">
          <ChevronLeft size={18} color="#0F0F0F" />
          <Text className="font-semibold text-navy">Voltar</Text>
        </Pressable>

        {step < STEPS.length - 1 ? (
          <Pressable
            onPress={next}
            className={`flex-1 flex-row items-center justify-center gap-1 rounded-lg py-3 ${mode === 'admin' && !adminPartnerId && step === 0 ? 'bg-silver-300' : 'bg-gold'}`}
            disabled={mode === 'admin' && !adminPartnerId && step === 0}
          >
            <Text className="font-bold text-white">Próximo</Text>
            <ChevronRight size={18} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => submitMut.mutate()}
            disabled={submitMut.isPending}
            className={`flex-1 flex-row items-center justify-center gap-1 rounded-lg py-3 ${submitMut.isPending ? 'bg-silver-300' : 'bg-gold'}`}
          >
            {submitMut.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Check size={18} color="#FFFFFF" />}
            <Text className="font-bold text-white">{submitMut.isPending ? 'Salvando...' : 'Concluir'}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  )
}

export default function NovaProposta() {
  return <PropostaWizardScreen />
}

function Field({
  label,
  value,
  onChange,
  keyboard,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  keyboard?: 'default' | 'numeric' | 'email-address' | 'phone-pad' | 'decimal-pad'
}) {
  return (
    <View>
      <Text className="mb-1.5 text-xs font-medium text-silver-700">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard ?? 'default'}
        className="rounded-lg border border-silver-300 px-3 py-3 text-sm text-silver-900"
      />
    </View>
  )
}

function ChipSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ id: string; label: string }>
  onChange: (v: string) => void
}) {
  return (
    <View>
      <Text className="mb-1.5 text-xs font-medium text-silver-700">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.id
          return (
            <Pressable
              key={o.id}
              onPress={() => onChange(active ? '' : o.id)}
              className={`rounded-full border px-3 py-1.5 ${active ? 'border-gold bg-gold/10' : 'border-silver-300 bg-white'}`}
            >
              <Text className={`text-xs font-medium ${active ? 'text-gold-700' : 'text-silver-700'}`}>{o.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View>
      <Text className="mb-1.5 text-xs font-medium text-silver-700">{label}</Text>
      <TextInput
        value={formatMoney(value)}
        onChangeText={(raw) => onChange(parseMoneyInput(raw))}
        keyboardType="numeric"
        className="rounded-lg border border-silver-300 px-3 py-3 text-sm text-silver-900"
      />
    </View>
  )
}

function NumberAdjust({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <View>
      <Text className="mb-1.5 text-xs font-medium text-silver-700">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          className="h-10 w-10 items-center justify-center rounded-lg border border-silver-300"
        >
          <Text className="text-lg font-bold text-navy">-</Text>
        </Pressable>
        <TextInput
          value={String(value)}
          onChangeText={(raw) => onChange(clampInt(raw, value, min, max))}
          keyboardType="numeric"
          className="flex-1 rounded-lg border border-silver-300 px-3 py-3 text-center text-sm text-silver-900"
        />
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          className="h-10 w-10 items-center justify-center rounded-lg border border-silver-300"
        >
          <Text className="text-lg font-bold text-navy">+</Text>
        </Pressable>
      </View>
    </View>
  )
}

function formatCpf(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function formatCnpj(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const calc = (base: string, factor: number): number => {
    let sum = 0
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i)
    const mod = (sum * 10) % 11
    return mod === 10 ? 0 : mod
  }
  return calc(cpf.slice(0, 9), 10) === Number(cpf[9]) && calc(cpf.slice(0, 10), 11) === Number(cpf[10])
}

function isValidCnpj(raw: string): boolean {
  const cnpj = onlyDigits(raw)
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const calc = (len: number): number => {
    let pos = len - 7
    let sum = 0
    for (let i = len; i >= 1; i--) {
      sum += Number(cnpj[len - i]) * pos--
      if (pos < 2) pos = 9
    }
    const res = sum % 11
    return res < 2 ? 0 : 11 - res
  }
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13])
}

function formatCep(raw: string): string {
  const d = onlyDigits(raw).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, '')
}

function parseMoneyInput(raw: string): number {
  const digits = onlyDigits(raw)
  if (!digits) return 0
  return Number(digits) / 100
}

function formatMoney(value: number): string {
  if (!value) return ''
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function clampInt(raw: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw, 10)
  const normalized = Number.isNaN(parsed) ? fallback : parsed
  return Math.min(max, Math.max(min, normalized))
}

function clampFloat(raw: string, fallback: number, min: number, max: number): number {
  const normalized = raw.replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  const base = Number.isNaN(parsed) ? fallback : parsed
  return Math.min(max, Math.max(min, base))
}

function produtoLabel(produto: ProdutoTipo): string {
  if (produto === 'home_equity') return 'Home Equity'
  if (produto === 'credito_construcao') return 'Construção'
  return 'Financiamento'
}
