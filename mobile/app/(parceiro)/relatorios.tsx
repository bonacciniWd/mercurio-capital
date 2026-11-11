import { useMemo, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { PartnerAction, PartnerCard, PartnerFeedback, PartnerScreen, PartnerTitle } from '@/components/parceiro/PartnerUI'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { canManagePartner } from '@/lib/partnerAccess'

type Periodo = 'mes' | 'trimestre' | 'ano' | 'ytd' | 'todos'
type Row = { id: string; produto: string; status: string; valor_solicitado: number | null; created_at: string }
const PRODUCTS: Record<string, string> = { home_equity: 'Home Equity', credito_construcao: 'Construção', financiamento_imobiliario: 'Financiamento imobiliário' }
const STATUS: Record<string, string> = {
  simulacao: 'Simulação', pre_analise: 'Pré-análise', analise_credito: 'Análise de crédito', pre_aprovado: 'Pré-aprovado',
  analise_imovel: 'Análise do imóvel', analise_juridica: 'Análise jurídica', comite: 'Comitê', proposta_cliente: 'Proposta ao cliente',
  resolucao_pendencias: 'Resolução de pendências', emissao_contrato: 'Emissão de contrato', aguardando_assinatura: 'Aguardando assinatura',
  em_registro: 'Em registro', contrato_registrado: 'Contrato registrado', recurso_liberado: 'Recurso liberado',
  cancelada: 'Cancelada', recusada: 'Recusada', reprovada: 'Reprovada', arquivada: 'Arquivada',
}
const PERIODS: { id: Periodo; label: string }[] = [
  { id: 'mes', label: 'Mês atual' }, { id: 'trimestre', label: '90 dias' }, { id: 'ano', label: '12 meses' },
  { id: 'ytd', label: 'YTD' }, { id: 'todos', label: 'Tudo' },
]
function startOf(period: Periodo): string | undefined {
  if (period === 'todos') return undefined
  const date = new Date()
  if (period === 'mes') date.setDate(1)
  if (period === 'trimestre') date.setDate(date.getDate() - 90)
  if (period === 'ano') date.setFullYear(date.getFullYear() - 1)
  if (period === 'ytd') { date.setMonth(0); date.setDate(1) }
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

export default function Relatorios() {
  const { session } = useAuth()
  const allowed = canManagePartner(session?.role)
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [produto, setProduto] = useState('todos')
  const [status, setStatus] = useState('todos')
  const [exporting, setExporting] = useState(false)
  const de = startOf(periodo)
  const rowsQ = useQuery({
    queryKey: ['p-relatorios-mobile', session?.userId, de, produto, status], enabled: allowed,
    queryFn: async () => {
      let q = supabase.from('propostas').select('id, produto, status, valor_solicitado, created_at')
        .order('created_at', { ascending: false }).limit(5000)
      if (de) q = q.gte('created_at', de)
      if (produto !== 'todos') q = q.eq('produto', produto)
      if (status !== 'todos') q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Row[]
    },
  })
  const rows = rowsQ.data ?? []
  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.valor_solicitado ?? 0), 0), [rows])
  const statuses = useMemo(() => {
    const counts = new Map<string, { count: number; volume: number }>()
    for (const row of rows) {
      const current = counts.get(row.status) ?? { count: 0, volume: 0 }
      counts.set(row.status, { count: current.count + 1, volume: current.volume + Number(row.valor_solicitado ?? 0) })
    }
    return Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count)
  }, [rows])

  async function exportCsv() {
    setExporting(true)
    let uri: string | null = null
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Compartilhamento indisponível neste aparelho.')
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/relatorios-exportar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ tipo: 'propostas', filtros: {
          ...(de ? { de } : {}), ...(produto !== 'todos' ? { produto: [produto] } : {}), ...(status !== 'todos' ? { status: [status] } : {}),
        } }),
      })
      if (!response.ok) throw new Error('Não foi possível gerar o CSV deste recorte.')
      const csv = await response.text()
      uri = `${FileSystem.cacheDirectory}propostas_${Date.now()}.csv`
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 })
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Compartilhar relatório', UTI: 'public.comma-separated-values-text' })
    } catch (error) {
      Alert.alert('Exportação indisponível', error instanceof Error ? error.message : 'Tente novamente.')
    } finally {
      // O compartilhamento pode manter o arquivo aberto no iOS; o cache é gerenciado pelo sistema.
      setExporting(false)
    }
  }

  return <PartnerScreen title="Relatórios" subtitle="Propostas da sua operação" refreshing={rowsQ.isRefetching} onRefresh={() => { void rowsQ.refetch() }}>
    {!allowed ? <PartnerFeedback title="Acesso restrito" text="Os relatórios estão disponíveis para o parceiro responsável." /> : <>
      <PartnerCard><PartnerTitle>Recorte</PartnerTitle>
        <Text className="text-xs text-[#A1A1AA]">Período de criação</Text><View className="flex-row flex-wrap gap-2">{PERIODS.map(item => <Filter key={item.id} label={item.label} active={periodo === item.id} onPress={() => setPeriodo(item.id)} />)}</View>
        <Text className="text-xs text-[#A1A1AA]">Produto</Text><View className="flex-row flex-wrap gap-2"><Filter label="Todos" active={produto === 'todos'} onPress={() => setProduto('todos')} />{Object.entries(PRODUCTS).map(([key, label]) => <Filter key={key} label={label} active={produto === key} onPress={() => setProduto(key)} />)}</View>
        <Text className="text-xs text-[#A1A1AA]">Etapa atual</Text><View className="flex-row flex-wrap gap-2"><Filter label="Todas" active={status === 'todos'} onPress={() => setStatus('todos')} />{Object.entries(STATUS).map(([key, label]) => <Filter key={key} label={label} active={status === key} onPress={() => setStatus(key)} />)}</View>
      </PartnerCard>
      {rowsQ.isLoading ? <PartnerFeedback loading title="Carregando relatório" /> : rowsQ.isError ? <PartnerFeedback title="Não foi possível carregar o relatório" retry={() => { void rowsQ.refetch() }} /> : <>
        <PartnerCard><PartnerTitle>Propostas do período</PartnerTitle>
          <View className="flex-row flex-wrap gap-5"><Metric label="Operações" value={String(rows.length)} /><Metric label="Volume solicitado" value={brl(Math.round(total * 100))} /></View>
          {rows.length >= 5000 ? <Text className="text-xs text-[#FCA5A5]">Limite de 5.000 propostas por recorte. Refine os filtros para ver os totais completos.</Text> : null}
        </PartnerCard>
        <PartnerCard><PartnerTitle>Etapas atuais</PartnerTitle>{statuses.length ? statuses.map(([key, value]) => <View key={key} className="flex-row items-center justify-between gap-3 border-b border-[#2D2D32] py-2"><Text className="flex-1 text-sm text-[#D4D4D8]">{STATUS[key] ?? key}</Text><Text className="text-sm font-semibold text-white">{value.count} · {brl(Math.round(value.volume * 100))}</Text></View>) : <Text className="text-sm text-[#A1A1AA]">Nenhuma proposta neste recorte.</Text>}</PartnerCard>
        <PartnerAction label="Compartilhar CSV deste recorte" busy={exporting} onPress={() => { void exportCsv() }} />
      </>}
    </>}
  </PartnerScreen>
}
function Filter({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} className={`min-h-11 items-center justify-center rounded-xl border px-3 py-2 ${active ? 'border-[#DC2626] bg-[#2A1519]' : 'border-[#414148] bg-[#202024]'}`}><Text className={`text-xs ${active ? 'font-semibold text-white' : 'text-[#B8B8C2]'}`}>{label}</Text></Pressable>
}
function Metric({ label, value }: { label: string; value: string }) {
  return <View className="min-w-[120px] flex-1"><Text className="text-xs text-[#A1A1AA]">{label}</Text><Text className="mt-2 text-xl font-semibold text-white">{value}</Text></View>
}
