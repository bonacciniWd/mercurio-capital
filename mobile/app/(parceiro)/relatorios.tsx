import { useMemo } from 'react'
import { ScrollView, View, Text, Pressable, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Download, FileText } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import * as FileSystem from 'expo-file-system/legacy'
import * as WebBrowser from 'expo-web-browser'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Construção',
  financiamento_imobiliario: 'Financiamento',
}

const STATUS_LABEL: Record<string, string> = {
  pre_analise: 'Pré-análise',
  analise_credito: 'Análise crédito',
  analise_imovel: 'Análise imóvel',
  analise_juridica: 'Análise jurídica',
  comite: 'Comitê',
  emissao_contrato: 'Emissão contrato',
  aguardando_assinatura: 'Aguard. assinatura',
  em_registro: 'Em registro',
  contrato_registrado: 'Registrado',
  recurso_liberado: 'Liberado',
}

const FUNIL_STAGES: { key: string; label: string; matches: string[] }[] = [
  { key: 'simulacoes', label: 'Simulações', matches: ['simulacao', 'pre_analise', 'analise_credito', 'analise_imovel', 'analise_juridica', 'comite', 'proposta_cliente', 'resolucao_pendencias', 'emissao_contrato', 'aguardando_assinatura', 'em_registro', 'contrato_registrado', 'recurso_liberado'] },
  { key: 'pre_analise', label: 'Pré-análise', matches: ['pre_analise', 'analise_credito', 'analise_imovel', 'analise_juridica', 'comite', 'proposta_cliente', 'resolucao_pendencias', 'emissao_contrato', 'aguardando_assinatura', 'em_registro', 'contrato_registrado', 'recurso_liberado'] },
  { key: 'analise', label: 'Análise', matches: ['analise_credito', 'analise_imovel', 'analise_juridica', 'comite', 'proposta_cliente', 'resolucao_pendencias', 'emissao_contrato', 'aguardando_assinatura', 'em_registro', 'contrato_registrado', 'recurso_liberado'] },
  { key: 'comite', label: 'Comitê', matches: ['comite', 'proposta_cliente', 'resolucao_pendencias', 'emissao_contrato', 'aguardando_assinatura', 'em_registro', 'contrato_registrado', 'recurso_liberado'] },
  { key: 'contrato', label: 'Contrato', matches: ['emissao_contrato', 'aguardando_assinatura', 'em_registro', 'contrato_registrado', 'recurso_liberado'] },
]

const STATUS_TABLE_ORDER = ['pre_analise', 'analise_credito', 'analise_imovel', 'comite', 'emissao_contrato', 'aguardando_assinatura', 'contrato_registrado', 'recurso_liberado']

interface FunilRow { status: string; quantidade: number; volume: number }
interface MesRow { mes: string; quantidade: number; volume: number }
interface PropostaRow { produto: string }

export default function Relatorios() {
  const funilQ = useQuery({
    queryKey: ['p-rel-funil'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_funil_status')
        .select('status, quantidade, volume')
      if (error) throw error
      return (data ?? []) as FunilRow[]
    },
  })

  const mesQ = useQuery({
    queryKey: ['p-rel-mes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_partner_propostas_por_mes')
        .select('mes, quantidade, volume')
        .order('mes')
      if (error) throw error
      return (data ?? []) as MesRow[]
    },
  })

  const propostasQ = useQuery({
    queryKey: ['p-rel-produtos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('produto')
        .limit(5000)
      if (error) throw error
      return (data ?? []) as PropostaRow[]
    },
  })

  const monthly = useMemo(() => (mesQ.data ?? []).slice(-12).map(m => m.quantidade), [mesQ.data])
  const months = useMemo(() => (mesQ.data ?? []).slice(-12).map(m =>
    new Date(m.mes).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').charAt(0).toUpperCase(),
  ), [mesQ.data])
  const max = Math.max(1, ...monthly)

  const funnel = useMemo(() => {
    const rows = funilQ.data ?? []
    const map = new Map(rows.map(r => [r.status, r.quantidade]))
    return FUNIL_STAGES.map(s => ({
      stage: s.label,
      count: s.matches.reduce((acc, st) => acc + (map.get(st) ?? 0), 0),
    }))
  }, [funilQ.data])
  const funnelMax = Math.max(1, ...funnel.map(f => f.count))

  const products = useMemo(() => {
    const rows = propostasQ.data ?? []
    const counts = new Map<string, number>()
    rows.forEach(r => counts.set(r.produto, (counts.get(r.produto) ?? 0) + 1))
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1
    const colorMap: Record<string, string> = {
      home_equity: '#0F0F0F',
      credito_construcao: '#DC2626',
      financiamento_imobiliario: '#B91C1C',
    }
    return Array.from(counts.entries()).map(([k, v]) => ({
      name: PRODUTO_LABEL[k] ?? k,
      pct: Math.round((v / total) * 100),
      color: colorMap[k] ?? '#737373',
    }))
  }, [propostasQ.data])

  const statusTable = useMemo(() => {
    const rows = funilQ.data ?? []
    const byStatus = new Map(rows.map(r => [r.status, r]))
    return STATUS_TABLE_ORDER
      .map(st => {
        const r = byStatus.get(st)
        const q = r?.quantidade ?? 0
        const v = Number(r?.volume ?? 0)
        return { status: STATUS_LABEL[st] ?? st, q, v, t: q > 0 ? v / q : 0 }
      })
      .filter(r => r.q > 0)
  }, [funilQ.data])

  const loading = funilQ.isLoading || mesQ.isLoading || propostasQ.isLoading

  async function exportar(tipo: 'csv' | 'pdf') {
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) throw new Error('Sessão expirada')
      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
      const res = await fetch(`${baseUrl}/functions/v1/relatorios-exportar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ tipo: 'propostas', filtros: {} }),
      })
      if (!res.ok) throw new Error(await res.text())
      const text = await res.text()
      const filename = `propostas_${new Date().toISOString().slice(0, 10)}.csv`
      const fileUri = `${FileSystem.cacheDirectory}${filename}`
      await FileSystem.writeAsStringAsync(fileUri, text)
      await WebBrowser.openBrowserAsync(fileUri)
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao exportar')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <View className="bg-navy px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-gold">Parceiro</Text>
            <Text className="text-lg font-bold text-white">Relatórios</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <View className="flex-row gap-2">
          <ExportBtn icon={Download} label="CSV" onPress={() => exportar('csv')} />
          <ExportBtn icon={FileText} label="PDF" onPress={() => Alert.alert('PDF', 'Em breve.')} />
        </View>

        {loading ? (
          <View className="py-12">
            <ActivityIndicator color="#DC2626" />
          </View>
        ) : (
          <>
            <Card title="Volume mensal (qtd. propostas)">
              {monthly.length === 0 ? (
                <Text className="py-6 text-center text-xs text-silver-400">Sem dados.</Text>
              ) : (
                <View className="mt-2 h-32 flex-row items-end gap-1.5">
                  {monthly.map((v, i) => (
                    <View key={i} className="flex-1 items-center">
                      <View className="w-full rounded-t bg-gold" style={{ height: `${(v / max) * 100}%`, minHeight: 4 }} />
                      <Text className="mt-1 text-[10px] text-silver-500">{months[i]}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            <Card title="Funil de conversão">
              {funnel.every(f => f.count === 0) ? (
                <Text className="py-6 text-center text-xs text-silver-400">Sem propostas.</Text>
              ) : funnel.map(f => (
                <View key={f.stage} className="mb-2.5">
                  <View className="mb-1 flex-row items-center justify-between">
                    <Text className="text-xs text-silver-700">{f.stage}</Text>
                    <Text className="text-xs font-semibold text-silver-900">{f.count}</Text>
                  </View>
                  <View className="h-2 overflow-hidden rounded-full bg-silver-100">
                    <View className="h-full rounded-full bg-navy" style={{ width: `${(f.count / funnelMax) * 100}%` }} />
                  </View>
                </View>
              ))}
            </Card>

            <Card title="Por produto">
              {products.length === 0 ? (
                <Text className="py-6 text-center text-xs text-silver-400">Sem dados.</Text>
              ) : products.map(p => (
                <View key={p.name} className="mb-2.5">
                  <View className="mb-1 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <Text className="text-xs text-silver-700">{p.name}</Text>
                    </View>
                    <Text className="text-xs font-semibold text-silver-900">{p.pct}%</Text>
                  </View>
                  <View className="h-2 overflow-hidden rounded-full bg-silver-100">
                    <View className="h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: p.color }} />
                  </View>
                </View>
              ))}
            </Card>

            <View className="rounded-xl border border-silver-200 bg-white">
              <View className="flex-row border-b border-silver-200 bg-silver-50 px-3 py-2">
                <Text className="flex-[1.4] text-[10px] font-bold uppercase text-silver-500">Status</Text>
                <Text className="flex-1 text-[10px] font-bold uppercase text-silver-500">Qtd</Text>
                <Text className="flex-1 text-[10px] font-bold uppercase text-silver-500">Volume</Text>
                <Text className="flex-1 text-[10px] font-bold uppercase text-silver-500">Ticket</Text>
              </View>
              {statusTable.length === 0 ? (
                <Text className="py-6 text-center text-xs text-silver-400">Sem propostas.</Text>
              ) : statusTable.map(r => (
                <View key={r.status} className="flex-row border-t border-silver-100 px-3 py-3">
                  <Text className="flex-[1.4] text-xs text-silver-800">{r.status}</Text>
                  <Text className="flex-1 text-xs text-silver-700">{r.q}</Text>
                  <Text className="flex-1 text-xs font-semibold text-silver-900">{brl(r.v * 100)}</Text>
                  <Text className="flex-1 text-xs text-silver-700">{brl(r.t * 100)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Card({ title, children }: { title: string; children: any }) {
  return (
    <View className="rounded-xl border border-silver-200 bg-white p-4">
      <Text className="font-semibold text-silver-900">{title}</Text>
      <View className="mt-2">{children}</View>
    </View>
  )
}

function ExportBtn({ icon: Icon, label, onPress }: { icon: any; label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-silver-300 bg-white py-2.5 active:bg-silver-100"
    >
      <Icon size={14} color="#0F0F0F" />
      <Text className="text-xs font-bold text-navy">{label}</Text>
    </Pressable>
  )
}

