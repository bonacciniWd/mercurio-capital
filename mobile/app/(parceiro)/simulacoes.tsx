import { useEffect, useMemo, useState } from 'react'
import { Alert, Share, Text, TextInput, View, Pressable } from 'react-native'
import { router } from 'expo-router'
import { Info } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { PartnerAction, PartnerBody, PartnerCard, PartnerFeedback, PartnerScreen, PartnerTitle } from '@/components/parceiro/PartnerUI'
import { calcularFinanciamento, calcularLTV } from '@/lib/credito'
import { supabase } from '@/lib/supabase'
import {
  PARTNER_SIMULATION_DEFAULTS,
  simulationShareText,
  type CorrecaoSimulacao,
  type PartnerSimulationValues,
  type PessoaSimulacao,
  type ProdutoSimulacao,
} from '@/lib/partnerSimulation'

const PRODUTOS: Array<{ id: ProdutoSimulacao; label: string }> = [
  { id: 'home_equity', label: 'Home Equity' },
  { id: 'credito_construcao', label: 'Crédito Construção' },
  { id: 'financiamento_imobiliario', label: 'Financiamento Imobiliário' },
]
const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Simulacoes() {
  const [values, setValues] = useState<PartnerSimulationValues>(PARTNER_SIMULATION_DEFAULTS)
  const paramsQ = useQuery({
    queryKey: ['partner-simulation-parameters'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('simulador_parametros_publicos')
      if (error) throw error
      const result = data as { taxa_juros_mensal_default?: number | string | null } | null
      const rawRate = result?.taxa_juros_mensal_default
      const rate = Number(rawRate)
      return rawRate !== null && rawRate !== undefined && Number.isFinite(rate) && rate >= 0 ? rate : null
    },
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (paramsQ.data !== null && paramsQ.data !== undefined) {
      setValues(current => ({ ...current, taxaMensalPercentual: paramsQ.data!, taxaMensal: paramsQ.data! / 100 }))
    }
  }, [paramsQ.data])

  const result = useMemo(() => calcularFinanciamento({
    valor: values.valor,
    prazoMeses: values.prazoMeses,
    taxaMensal: values.taxaMensalPercentual / 100,
    amortizacao: values.amortizacao,
    carenciaMeses: values.carenciaMeses,
  }), [values.valor, values.prazoMeses, values.taxaMensalPercentual, values.amortizacao, values.carenciaMeses])
  const ltv = calcularLTV(values.valor, values.valorGarantia)
  const valid = values.valor > 0 && values.valorGarantia > 0 && values.prazoMeses >= 12
    && values.prazoMeses <= 240 && (values.carenciaMeses ?? 0) >= 0 && (values.carenciaMeses ?? 0) <= 3
    && values.taxaMensalPercentual >= 0 && values.taxaMensalPercentual <= 100

  function update<K extends keyof PartnerSimulationValues>(key: K, value: PartnerSimulationValues[K]) {
    setValues(current => ({ ...current, [key]: value }))
  }

  async function shareSimulation() {
    try {
      await Share.share({ message: simulationShareText(values, result, ltv) })
    } catch {
      Alert.alert('Não foi possível compartilhar', 'Tente novamente em instantes.')
    }
  }

  function convertToProposal() {
    if (!valid) return
    router.push({
      pathname: '/propostas/nova',
      params: {
        sim_produto: values.produto,
        sim_pessoa_tipo: values.pessoaTipo,
        sim_valor: String(values.valor),
        sim_garantia: String(values.valorGarantia),
        sim_prazo: String(values.prazoMeses),
        sim_carencia: String(values.carenciaMeses),
        sim_taxa: String(values.taxaMensalPercentual),
        sim_correcao: values.correcao,
        sim_amortizacao: values.amortizacao,
      },
    } as any)
  }

  return <PartnerScreen title="Simulação comercial" subtitle="Monte uma prévia antes de iniciar a proposta" tabbed refreshing={paramsQ.isRefetching} onRefresh={() => { void paramsQ.refetch() }}>
    {paramsQ.isError ? <PartnerFeedback title="Não foi possível confirmar as premissas financeiras" text="A taxa configurada não foi carregada. Você pode corrigir a taxa abaixo ou atualizar para tentar novamente." retry={() => { void paramsQ.refetch() }} /> : null}

    <PartnerCard>
      <View><Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#F87171]">01 · Operação</Text><PartnerTitle>Condições da simulação</PartnerTitle></View>
      <View className="gap-2">
        <FieldLabel>Produto</FieldLabel>
        <View className="gap-2">
          {PRODUTOS.map(item => <Choice key={item.id} label={item.label} active={values.produto === item.id} onPress={() => update('produto', item.id)} />)}
        </View>
      </View>
      <View className="gap-2">
        <FieldLabel>Tipo de pessoa</FieldLabel>
        <View className="flex-row gap-2">{(['PF', 'PJ'] as PessoaSimulacao[]).map(item => <Choice key={item} label={item} active={values.pessoaTipo === item} onPress={() => update('pessoaTipo', item)} />)}</View>
      </View>
      <MoneyField label="Valor solicitado" value={values.valor} onChange={value => update('valor', value)} />
      <MoneyField label="Valor do imóvel/garantia" value={values.valorGarantia} onChange={value => update('valorGarantia', value)} />
      <View className="flex-row gap-3">
        <NumberField label="Prazo (meses)" value={values.prazoMeses} min={12} max={240} onChange={value => update('prazoMeses', value)} />
        <NumberField label="Carência (meses)" value={values.carenciaMeses ?? 0} min={0} max={3} onChange={value => update('carenciaMeses', value)} />
      </View>
      <NumberField label="Taxa mensal (%)" value={values.taxaMensalPercentual} min={0} max={100} decimals onChange={value => setValues(current => ({ ...current, taxaMensalPercentual: value, taxaMensal: value / 100 }))} />
      <View className="gap-2">
        <FieldLabel>Correção</FieldLabel>
        <View className="flex-row gap-2">{([{ id: 'pos_fixado', label: 'Pós-fixado' }, { id: 'pre_fixado', label: 'Pré-fixado' }] as { id: CorrecaoSimulacao; label: string }[]).map(item => <Choice key={item.id} label={item.label} active={values.correcao === item.id} onPress={() => update('correcao', item.id)} />)}</View>
      </View>
      <View className="gap-2">
        <FieldLabel>Amortização</FieldLabel>
        <View className="flex-row gap-2">{(['price', 'sac'] as const).map(item => <Choice key={item} label={item.toUpperCase()} active={values.amortizacao === item} onPress={() => update('amortizacao', item)} />)}</View>
      </View>
    </PartnerCard>

    {valid ? <PartnerCard>
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#F87171]">02 · Resultado estimado</Text>
      <View><Text className="text-xs text-[#A1A1AA]">Crédito solicitado</Text><Text className="mt-1 text-3xl font-bold text-white">{brl(values.valor)}</Text></View>
      <View className="flex-row flex-wrap gap-3">
        <Result label="LTV estimado" value={`${(ltv * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`} />
        <Result label="1ª parcela" value={brl(result.primeiraParcela)} />
        <Result label="Última parcela" value={brl(result.ultimaParcela)} />
        <Result label="Renda mínima estimada" value={`${brl(result.rendaMinima)}/mês`} />
        <Result label="Total estimado" value={brl(result.totalPago)} />
      </View>
      <View className="flex-row items-start gap-2 rounded-2xl border border-[#713035] bg-[#2A1519] p-4">
        <Info size={18} color="#F87171" />
        <Text className="flex-1 text-xs leading-5 text-[#FECACA]">Prévia sem IOF, TAC, registro e seguros. A variação futura do IPCA não está projetada. Não representa oferta, aprovação ou condição final de crédito.{paramsQ.isLoading ? ' Verificando as premissas financeiras…' : ''}</Text>
      </View>
      <PartnerAction secondary label="Compartilhar simulação" onPress={() => { void shareSimulation() }} />
      <PartnerAction label="Converter em proposta" onPress={convertToProposal} />
    </PartnerCard> : <PartnerFeedback title="Revise os valores informados" text="Informe valor e garantia maiores que zero, prazo entre 12 e 240 meses, carência de até 3 meses e uma taxa válida." />}
  </PartnerScreen>
}

function FieldLabel({ children }: { children: string }) { return <Text className="text-xs font-semibold text-[#D4D4D8]">{children}</Text> }

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} className={`min-h-11 flex-1 items-center justify-center rounded-xl border px-3 py-2 ${active ? 'border-[#DC2626] bg-[#2A1519]' : 'border-[#414148] bg-[#202024]'}`}>
    <Text className={`text-center text-xs font-semibold ${active ? 'text-white' : 'text-[#B8B8C2]'}`}>{label}</Text>
  </Pressable>
}

function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(brl(value))
  useEffect(() => { if (!focused) setDraft(brl(value)) }, [value, focused])
  return <View className="gap-2"><FieldLabel>{label}</FieldLabel><TextInput accessibilityLabel={label} keyboardType="decimal-pad" value={draft} onFocus={() => { setFocused(true); setDraft(String(value).replace('.', ',')) }} onChangeText={text => {
    setDraft(text)
    const normalized = text.trim().replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')
    const parsed = Number(normalized.replace(/[^\d.]/g, ''))
    if (Number.isFinite(parsed)) onChange(parsed)
  }} onBlur={() => { setFocused(false); if (!draft.trim()) onChange(0) }} className="min-h-12 rounded-xl border border-[#414148] bg-[#202024] px-4 text-sm text-white" placeholder="0,00" placeholderTextColor="#71717A" /></View>
}

function NumberField({ label, value, min, max, decimals = false, onChange }: { label: string; value: number; min: number; max: number; decimals?: boolean; onChange: (value: number) => void }) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(decimals ? value.toLocaleString('pt-BR') : String(value))
  useEffect(() => { if (!focused) setDraft(decimals ? value.toLocaleString('pt-BR') : String(value)) }, [value, decimals, focused])
  return <View className="flex-1 gap-2"><FieldLabel>{label}</FieldLabel><TextInput accessibilityLabel={label} keyboardType={decimals ? 'decimal-pad' : 'number-pad'} value={draft} onFocus={() => setFocused(true)} onChangeText={text => {
    setDraft(text)
    const parsed = Number(text.replace(',', '.').replace(/[^\d.]/g, ''))
    if (Number.isFinite(parsed)) onChange(parsed)
  }} onBlur={() => { const parsed = Number(draft.replace(',', '.').replace(/[^\d.]/g, '')); onChange(Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min); setFocused(false) }} className="min-h-12 rounded-xl border border-[#414148] bg-[#202024] px-4 text-sm text-white" placeholderTextColor="#71717A" />{decimals && <Text className="text-[10px] text-[#A1A1AA]">{paramsLabel()}</Text>}</View>
}

function paramsLabel() { return 'Premissa financeira configurada pela Mercúrio, editável para esta prévia.' }

function Result({ label, value }: { label: string; value: string }) {
  return <View className="min-w-[46%] flex-1 rounded-2xl border border-[#2D2D32] bg-[#101013] p-3"><Text className="text-[10px] uppercase tracking-wide text-[#A1A1AA]">{label}</Text><Text className="mt-1 text-sm font-semibold text-white">{value}</Text></View>
}
