import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Search, Plus, SlidersHorizontal } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { PartnerFeedback, PartnerScreen } from '@/components/parceiro/PartnerUI'
import { StatusBadge } from '@/components/Badge'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { PRODUTO_LABEL, STATUS_LABEL, diasParado } from '@/lib/partner'

type PropostaRow = { id: string; protocolo: string | null; produto: string; status: string; valor_solicitado: number; updated_at: string; cliente: { nome_completo: string | null; cpf: string | null } | null }
const PAGE_SIZE = 25
const PRODUCTS = [{ id: 'todos', label: 'Todos' }, { id: 'home_equity', label: 'Home Equity' }, { id: 'credito_construcao', label: 'Construção' }, { id: 'financiamento_imobiliario', label: 'Financiamento' }]
const STATUSES = [{ id: 'todos', label: 'Todos' }, { id: 'pre_analise', label: 'Pré-análise' }, { id: 'analise_credito', label: 'Análise' }, { id: 'pre_aprovado', label: 'Pré-aprovado' }, { id: 'comite', label: 'Comitê' }, { id: 'emissao_contrato', label: 'Contrato' }, { id: 'recurso_liberado', label: 'Liberado' }, { id: 'cancelada', label: 'Cancelada' }]

export default function Propostas() {
  const [busca, setBusca] = useState('')
  const [produto, setProduto] = useState('todos')
  const [status, setStatus] = useState('todos')
  const [page, setPage] = useState(0)
  const query = useQuery({
    queryKey: ['partner-propostas-list', produto, status, page],
    queryFn: async () => {
      const from = page * PAGE_SIZE
      let q = supabase.from('propostas').select('id, protocolo, produto, status, valor_solicitado, updated_at, cliente:clientes(nome_completo, cpf)', { count: 'exact' }).order('updated_at', { ascending: false }).range(from, from + PAGE_SIZE - 1)
      if (produto !== 'todos') q = q.eq('produto', produto)
      if (status !== 'todos') q = q.eq('status', status)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: (data ?? []) as unknown as PropostaRow[], count: count ?? 0 }
    },
  })
  const rows = useMemo(() => { const q = busca.trim().toLowerCase(); return !q ? query.data?.rows ?? [] : (query.data?.rows ?? []).filter(p => ((p.protocolo ?? '') + ' ' + (p.cliente?.nome_completo ?? '') + ' ' + (p.cliente?.cpf ?? '')).toLowerCase().includes(q)) }, [busca, query.data])
  const totalPages = Math.max(1, Math.ceil((query.data?.count ?? 0) / PAGE_SIZE))
  const selectFilter = (key: 'produto' | 'status', value: string) => { key === 'produto' ? setProduto(value) : setStatus(value); setPage(0) }

  return <PartnerScreen title="Propostas" subtitle="Acompanhe sua operação" refreshing={query.isRefetching} onRefresh={() => { void query.refetch() }}>
    <View className="flex-row items-center gap-3"><View className="flex-1 flex-row items-center rounded-2xl border border-[#414148] bg-[#202024] px-4"><Search size={18} color="#A1A1AA" /><TextInput accessibilityLabel="Buscar propostas" placeholder="Nome, CPF ou protocolo" placeholderTextColor="#71717A" value={busca} onChangeText={setBusca} className="ml-2 flex-1 py-3 text-sm text-white" /></View><Pressable accessibilityLabel="Nova proposta" onPress={() => router.push('/propostas/nova')} className="h-12 w-12 items-center justify-center rounded-2xl bg-[#DC2626]"><Plus size={20} color="white" /></Pressable></View>
    <PartnerCardLike title="Produto"><View className="flex-row flex-wrap gap-2">{PRODUCTS.map(item => <Filter key={item.id} label={item.label} active={produto === item.id} onPress={() => selectFilter('produto', item.id)} />)}</View></PartnerCardLike>
    <PartnerCardLike title="Etapa atual"><View className="flex-row flex-wrap gap-2">{STATUSES.map(item => <Filter key={item.id} label={item.label} active={status === item.id} onPress={() => selectFilter('status', item.id)} />)}</View></PartnerCardLike>
    {query.isLoading ? <PartnerFeedback loading title="Carregando propostas" /> : query.isError ? <PartnerFeedback title="Não foi possível carregar as propostas" retry={() => { void query.refetch() }} /> : <>
      <View className="flex-row items-center justify-between"><View><Text className="text-xs uppercase tracking-[1.5px] text-[#F87171]">Resultados</Text><Text className="mt-1 text-sm text-[#A1A1AA]">{query.data?.count ?? 0} operação(ões)</Text></View><SlidersHorizontal size={18} color="#A1A1AA" /></View>
      {rows.length === 0 ? <PartnerFeedback title="Nenhuma proposta neste recorte" text={busca ? 'Tente outro termo de busca.' : 'Quando houver propostas acessíveis, elas aparecerão aqui.'} /> : <View className="gap-3">{rows.map(p => <Pressable key={p.id} onPress={() => router.push('/(parceiro)/propostas/' + p.id as any)} className="rounded-3xl border border-[#2D2D32] bg-[#151518] p-5 active:opacity-70"><View className="flex-row items-center justify-between gap-2"><Text className="font-mono text-xs text-[#A1A1AA]">{p.protocolo ?? p.id.slice(0, 8)}</Text><StatusBadge status={STATUS_LABEL[p.status] ?? p.status} /></View><Text className="mt-2 text-base font-semibold text-white">{p.cliente?.nome_completo ?? 'Cliente sem nome'}</Text><Text className="mt-1 text-xs text-[#A1A1AA]">{PRODUTO_LABEL[p.produto] ?? p.produto}</Text><View className="mt-3 flex-row items-center justify-between"><Text className="text-base font-semibold text-[#F87171]">{brl(Number(p.valor_solicitado) * 100)}</Text><Text className={'text-xs ' + (diasParado(p.updated_at) > 10 ? 'font-semibold text-[#FCA5A5]' : 'text-[#A1A1AA]')}>{diasParado(p.updated_at)}d nesta etapa</Text></View></Pressable>)}</View>}
      {totalPages > 1 ? <View className="flex-row items-center justify-between"><Pressable disabled={page === 0} onPress={() => setPage(p => Math.max(0, p - 1))} className="rounded-xl border border-[#414148] px-4 py-3" style={{ opacity: page === 0 ? 0.4 : 1 }}><Text className="text-sm text-white">Anterior</Text></Pressable><Text className="text-xs text-[#A1A1AA]">{page + 1} de {totalPages}</Text><Pressable disabled={page + 1 >= totalPages} onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))} className="rounded-xl border border-[#414148] px-4 py-3" style={{ opacity: page + 1 >= totalPages ? 0.4 : 1 }}><Text className="text-sm text-white">Próxima</Text></Pressable></View> : null}
    </>}
  </PartnerScreen>
}
function PartnerCardLike({ title, children }: { title: string; children: ReactNode }) { return <View className="gap-3 rounded-3xl border border-[#2D2D32] bg-[#151518] p-5"><Text className="text-sm font-semibold text-white">{title}</Text>{children}</View> }
function Filter({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} className={'min-h-8 rounded-xl border px-3 py-2 ' + (active ? 'border-[#DC2626] bg-[#2A1519]' : 'border-[#414148] bg-[#202024]')}><Text className={'text-xs ' + (active ? 'font-semibold text-white' : 'text-[#B8B8C2]')}>{label}</Text></Pressable> }
