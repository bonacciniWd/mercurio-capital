import { useMemo, useState } from 'react'
import { ScrollView, View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { calcularFinanciamento } from '@/lib/credito'

const STEPS = ['Produto', 'Cliente', 'Local', 'Crédito', 'Proponentes', 'Imóvel', 'Revisão']
const PRAZO_MIN = 12
const PRAZO_MAX = 240
const CARENCIA_MIN = 0
const CARENCIA_MAX = 3

type ProdutoTipo = 'home_equity' | 'credito_construcao' | 'financiamento_imobiliario'
type PessoaTipo = 'PF' | 'PJ'
type CorrecaoTipo = 'pos_fixado' | 'pre_fixado'
type AmortizacaoTipo = 'price' | 'sac'
type EstadoCivil = '' | 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'uniao_estavel'
type PropostaWizardMode = 'partner' | 'admin'

interface WizardForm {
  produto: ProdutoTipo
  pessoa_tipo: PessoaTipo
  cliente_nome: string
  cliente_cpf: string
  cliente_email: string
  cliente_telefone: string
  cliente_data_nascimento: string
  cliente_estado_civil: EstadoCivil
  imovel_cep: string
  imovel_estado: string
  imovel_cidade: string
  imovel_bairro: string
  imovel_logradouro: string
  imovel_numero: string
  imovel_complemento: string
  valor_solicitado: number
  imovel_valor: number
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
  cliente_email: '',
  cliente_telefone: '',
  cliente_data_nascimento: '',
  cliente_estado_civil: '',
  imovel_cep: '',
  imovel_estado: '',
  imovel_cidade: '',
  imovel_bairro: '',
  imovel_logradouro: '',
  imovel_numero: '',
  imovel_complemento: '',
  valor_solicitado: 350000,
  imovel_valor: 850000,
  prazo_meses: 120,
  carencia_meses: 0,
  taxa_juros_mensal: 1.39,
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
      const payload = {
        produto: form.produto,
        pessoa_tipo: form.pessoa_tipo,
        valor_solicitado: form.valor_solicitado,
        prazo_meses: form.prazo_meses,
        carencia_meses: form.carencia_meses,
        taxa_juros_mensal: form.taxa_juros_mensal,
        correcao: form.correcao,
        amortizacao: form.amortizacao,
        cliente: {
          nome_completo: form.cliente_nome,
          cpf: onlyDigits(form.cliente_cpf),
          email: form.cliente_email,
          telefone: form.cliente_telefone,
          data_nascimento: form.cliente_data_nascimento || null,
          estado_civil: form.cliente_estado_civil || null,
        },
        proponentes: [
          {
            nome: form.cliente_nome,
            cpf_cnpj: onlyDigits(form.cliente_cpf),
            principal: true,
            relacao: null,
            estado_civil: form.cliente_estado_civil || null,
            pessoa_tipo: form.pessoa_tipo,
          },
        ],
        imoveis: [
          {
            tipo: 'apartamento',
            cep: onlyDigits(form.imovel_cep),
            estado: form.imovel_estado,
            cidade: form.imovel_cidade,
            bairro: form.imovel_bairro,
            logradouro: form.imovel_logradouro,
            numero: form.imovel_numero,
            complemento: form.imovel_complemento,
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
    if (s === 1) return form.cliente_nome.trim().length > 0 && onlyDigits(form.cliente_cpf).length >= 11
    if (s === 2) return form.imovel_cidade.trim().length > 0 && form.imovel_estado.trim().length === 2
    if (s === 3) {
      return form.valor_solicitado > 0
        && form.prazo_meses >= PRAZO_MIN
        && form.prazo_meses <= PRAZO_MAX
        && form.carencia_meses >= CARENCIA_MIN
        && form.carencia_meses <= CARENCIA_MAX
    }
    if (s === 5) return form.imovel_valor > 0
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
        )}

        {step === 1 && (
          <>
            <Field label="CPF do cliente" value={form.cliente_cpf} onChange={(v) => setForm((f) => ({ ...f, cliente_cpf: formatCpf(v) }))} keyboard="numeric" />
            <Field label="Nome completo" value={form.cliente_nome} onChange={(v) => setForm((f) => ({ ...f, cliente_nome: v }))} />
            <Field label="E-mail" value={form.cliente_email} onChange={(v) => setForm((f) => ({ ...f, cliente_email: v }))} keyboard="email-address" />
            <Field label="Telefone" value={form.cliente_telefone} onChange={(v) => setForm((f) => ({ ...f, cliente_telefone: v }))} keyboard="phone-pad" />
          </>
        )}

        {step === 2 && (
          <>
            <Field label="CEP" value={form.imovel_cep} onChange={(v) => setForm((f) => ({ ...f, imovel_cep: formatCep(v) }))} keyboard="numeric" />
            <Field label="Estado (UF)" value={form.imovel_estado} onChange={(v) => setForm((f) => ({ ...f, imovel_estado: v.toUpperCase().slice(0, 2) }))} />
            <Field label="Cidade" value={form.imovel_cidade} onChange={(v) => setForm((f) => ({ ...f, imovel_cidade: v }))} />
            <Field label="Bairro" value={form.imovel_bairro} onChange={(v) => setForm((f) => ({ ...f, imovel_bairro: v }))} />
            <Field label="Endereço" value={form.imovel_logradouro} onChange={(v) => setForm((f) => ({ ...f, imovel_logradouro: v }))} />
            <Field label="Número" value={form.imovel_numero} onChange={(v) => setForm((f) => ({ ...f, imovel_numero: v }))} keyboard="numeric" />
          </>
        )}

        {step === 3 && (
          <>
            <MoneyField label="Valor solicitado" value={form.valor_solicitado} onChange={(v) => setForm((f) => ({ ...f, valor_solicitado: v }))} />
            <MoneyField label="Valor do imóvel" value={form.imovel_valor} onChange={(v) => setForm((f) => ({ ...f, imovel_valor: v }))} />
            <NumberAdjust label="Prazo (meses)" value={form.prazo_meses} min={PRAZO_MIN} max={PRAZO_MAX} onChange={(v) => setForm((f) => ({ ...f, prazo_meses: v }))} />
            <NumberAdjust label="Carência (meses)" value={form.carencia_meses} min={CARENCIA_MIN} max={CARENCIA_MAX} onChange={(v) => setForm((f) => ({ ...f, carencia_meses: v }))} />
            <Field
              label="Taxa mensal (%)"
              value={String(form.taxa_juros_mensal)}
              onChange={(v) => setForm((f) => ({ ...f, taxa_juros_mensal: clampFloat(v, f.taxa_juros_mensal, 0.01, 99) }))}
              keyboard="decimal-pad"
            />

            <View className="rounded-xl bg-silver-50 p-4">
              <Text className="text-xs uppercase text-silver-500">Simulação</Text>
              <Text className="mt-1 text-base font-bold text-navy">1a parcela: {brl(calc.primeiraParcela * 100)}</Text>
              <Text className="text-sm text-silver-600">Última: {brl(calc.ultimaParcela * 100)}</Text>
              <Text className="text-sm text-silver-600">Total: {brl(calc.totalPago * 100)}</Text>
            </View>
          </>
        )}

        {step === 4 && (
          <View className="rounded-xl border border-silver-200 bg-white p-4">
            <Text className="text-sm text-silver-600">O proponente principal será criado automaticamente com os dados do cliente informado.</Text>
          </View>
        )}

        {step === 5 && (
          <>
            <MoneyField label="Valor de avaliação do imóvel" value={form.imovel_valor} onChange={(v) => setForm((f) => ({ ...f, imovel_valor: v }))} />
            <Field label="Complemento" value={form.imovel_complemento} onChange={(v) => setForm((f) => ({ ...f, imovel_complemento: v }))} />
          </>
        )}

        {step === 6 && (
          <View className="gap-2 rounded-xl border border-silver-200 bg-white p-4">
            <Text className="font-semibold text-navy">Revisão rápida</Text>
            <Text className="text-sm text-silver-600">Produto: {produtoLabel(form.produto)}</Text>
            <Text className="text-sm text-silver-600">Cliente: {form.cliente_nome || '-'}</Text>
            <Text className="text-sm text-silver-600">Valor: {brl(form.valor_solicitado * 100)}</Text>
            <Text className="text-sm text-silver-600">Prazo: {form.prazo_meses} meses</Text>
            <Text className="text-sm text-silver-600">Carência: {form.carencia_meses} meses</Text>
          </View>
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
