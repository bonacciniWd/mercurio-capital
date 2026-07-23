import { useState } from 'react'
import { ScrollView, View, Text, Pressable, ActivityIndicator, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import {
  ArrowLeft, FileText, Users, Home, Clock, MessageSquare, ChevronRight,
  TrendingUp, Shield, Calendar, MapPin, Building2, User, Phone, Mail, Download,
} from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { StatusBadge } from '@/components/Badge'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { calcularFinanciamento, calcularLTV } from '@/lib/credito'
import { STATUS_LABEL, PRODUTO_LABEL } from '@/lib/partner'
import { isPropostaAprovada } from '@/lib/propostaStatus'

// Reusa a calculadora do app web
// (cópia simples, sem dependência cruzada)

const TABS = [
  { id: 'resumo', label: 'Resumo', icon: FileText },
  { id: 'proponentes', label: 'Proponentes', icon: Users },
  { id: 'imoveis', label: 'Imóveis', icon: Home },
  { id: 'historico', label: 'Histórico', icon: Clock },
] as const

interface Proposta {
  id: string
  protocolo: string | null
  produto: string
  status: string
  valor_solicitado: number
  valor_imoveis_total: number
  prazo_meses: number
  carencia_meses: number
  taxa_juros_mensal: number
  amortizacao: 'price' | 'sac'
  indexador: string
  created_at: string
  updated_at: string
  cliente: {
    nome_completo: string | null
    pessoa_tipo: 'PF' | 'PJ' | null
    cpf: string | null
    cnpj: string | null
    email: string | null
    telefone: string | null
  } | null
}

interface Proponente {
  id: string
  nome: string
  cpf_cnpj: string | null
  principal: boolean
  relacao: string | null
  estado_civil: string | null
  pessoa_tipo: string
  compoe_renda: boolean | null
}

interface Imovel {
  id: string
  tipo: string
  cidade: string | null
  estado: string | null
  bairro: string | null
  logradouro: string | null
  numero: string | null
  cep: string | null
  valor: number
  alugado: boolean
  financiado: boolean
  possui_debitos: boolean
}

interface HistoricoRow {
  id: string
  status_anterior: string | null
  status_novo: string
  motivo: string | null
  created_at: string
}

export default function PropostaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [tab, setTab] = useState<typeof TABS[number]['id']>('resumo')

  const propostaQ = useQuery({
    queryKey: ['proposta-mobile', id],
    queryFn: async (): Promise<Proposta | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, valor_solicitado, valor_imoveis_total, prazo_meses, carencia_meses, taxa_juros_mensal, amortizacao, indexador, created_at, updated_at, cliente:clientes(nome_completo, pessoa_tipo, cpf, cnpj, email, telefone)')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as unknown as Proposta | null
    },
    enabled: !!id,
  })

  const proponentesQ = useQuery({
    queryKey: ['proposta-mobile-proponentes', id],
    queryFn: async (): Promise<Proponente[]> => {
      const { data, error } = await supabase
        .from('proponentes')
        .select('id, nome, cpf_cnpj, principal, relacao, estado_civil, pessoa_tipo, compoe_renda')
        .eq('proposta_id', id!)
        .order('principal', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!id && tab === 'proponentes',
  })

  const imoveisQ = useQuery({
    queryKey: ['proposta-mobile-imoveis', id],
    queryFn: async (): Promise<Imovel[]> => {
      const { data, error } = await supabase
        .from('imoveis')
        .select('id, tipo, cidade, estado, bairro, logradouro, numero, cep, valor, alugado, financiado, possui_debitos')
        .eq('proposta_id', id!)
      if (error) throw error
      return data ?? []
    },
    enabled: !!id && tab === 'imoveis',
  })

  const historicoQ = useQuery({
    queryKey: ['proposta-mobile-historico', id],
    queryFn: async (): Promise<HistoricoRow[]> => {
      const { data, error } = await supabase
        .from('proposta_status_historico')
        .select('id, status_anterior, status_novo, motivo, created_at')
        .eq('proposta_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!id && tab === 'historico',
  })

  const modelosQ = useQuery({
    queryKey: ['proposta-mobile-modelos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_contrato_modelos')
        .select('id, storage_path, nome_arquivo, created_at')
        .eq('proposta_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as { id: string; storage_path: string; nome_arquivo: string; created_at: string }[]
    },
    enabled: !!id && tab === 'resumo',
  })

  async function baixarModelo(path: string) {
    try {
      const { data, error } = await supabase.storage.from('contratos').createSignedUrl(path, 60 * 5)
      if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Falha ao gerar URL')
      await Linking.openURL(data.signedUrl)
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : String(e))
    }
  }

  if (propostaQ.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-silver-50" edges={['top', 'bottom']}>
        <ActivityIndicator color="#DC2626" />
      </SafeAreaView>
    )
  }

  if (propostaQ.error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-silver-50 px-6" edges={['top', 'bottom']}>
        <Text className="text-center text-sm text-danger">
          Erro ao carregar: {(propostaQ.error as Error).message}
        </Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-lg border border-silver-300 px-4 py-2">
          <Text className="text-sm text-navy">Voltar</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const proposta = propostaQ.data
  if (!proposta) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-silver-50 px-6" edges={['top', 'bottom']}>
        <Text className="text-sm text-silver-500">Proposta não encontrada.</Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-lg border border-silver-300 px-4 py-2">
          <Text className="text-sm text-navy">Voltar</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const valor = Number(proposta.valor_solicitado)
  const valorImoveis = Number(proposta.valor_imoveis_total)
  const calc = calcularFinanciamento({
    valor,
    prazoMeses: proposta.prazo_meses,
    taxaMensal: Number(proposta.taxa_juros_mensal) / 100,
    amortizacao: proposta.amortizacao,
    carenciaMeses: proposta.carencia_meses,
  })
  const ltv = calcularLTV(valor, valorImoveis)

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="bg-navy-700 px-5 pb-4 pt-2">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="font-mono text-xs text-white/50">{proposta.protocolo ?? proposta.id.slice(0, 8)}</Text>
            <Text className="text-lg font-bold text-white" numberOfLines={1}>
              {proposta.cliente?.nome_completo ?? 'Cliente'}
            </Text>
          </View>
          <StatusBadge status={STATUS_LABEL[proposta.status] ?? proposta.status} />
        </View>
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-xl bg-white/10 px-4 py-3">
            <Text className="text-[11px] uppercase tracking-wider text-white/50">Valor solicitado</Text>
            <Text className="mt-0.5 text-xl font-bold text-white">{brl(valor * 100)}</Text>
          </View>
          <View className="flex-1 rounded-xl bg-white/10 px-4 py-3">
            <Text className="text-[11px] uppercase tracking-wider text-white/50">LTV</Text>
            <Text className="mt-0.5 text-xl font-bold text-gold">{(ltv * 100).toFixed(1)}%</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-12 border-b border-white/10 bg-navy">
        <View className="flex-row px-3">
          {TABS.map(t => (
            <Pressable key={t.id} onPress={() => setTab(t.id)}
              className={`flex-row items-center gap-1.5 border-b-2 px-4 py-3 ${tab === t.id ? 'border-gold' : 'border-transparent'}`}>
              <t.icon size={15} color={tab === t.id ? '#DC2626' : 'rgba(255,255,255,0.4)'} />
              <Text className={tab === t.id ? 'text-sm font-semibold text-gold' : 'text-sm text-white/40'}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>
        {tab === 'resumo' && (
          <Resumo proposta={proposta} calc={calc} ltv={ltv} valorImoveis={valorImoveis} valor={valor} />
        )}
        {tab === 'resumo' && isPropostaAprovada(proposta.status) && (
          <View className="rounded-2xl border border-silver-200 bg-white p-4">
            <View className="flex-row items-center gap-2">
              <FileText size={15} color="#DC2626" />
              <Text className="text-sm font-bold text-navy">Modelo de contrato</Text>
            </View>
            <Text className="mt-1 text-xs text-silver-500">
              Documento de referência da equipe — distinto do PDF gerado para assinatura.
            </Text>
            {modelosQ.isLoading ? (
              <ActivityIndicator color="#DC2626" className="mt-3" />
            ) : !modelosQ.data?.length ? (
              <Text className="mt-3 text-sm text-silver-500">Nenhum modelo disponível.</Text>
            ) : (
              <View className="mt-3 gap-2">
                {modelosQ.data.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => baixarModelo(m.storage_path)}
                    className="flex-row items-center gap-3 rounded-lg border border-silver-200 bg-silver-50 p-3 active:opacity-70"
                  >
                    <FileText size={18} color="#737373" />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-navy" numberOfLines={1}>{m.nome_arquivo}</Text>
                      <Text className="text-[11px] text-silver-500">{new Date(m.created_at).toLocaleDateString('pt-BR')}</Text>
                    </View>
                    <Download size={16} color="#9CA3AF" />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
        {tab === 'proponentes' && (
          <Proponentes loading={proponentesQ.isLoading} data={proponentesQ.data ?? []} />
        )}
        {tab === 'imoveis' && (
          <Imoveis loading={imoveisQ.isLoading} data={imoveisQ.data ?? []} />
        )}
        {tab === 'historico' && (
          <Historico loading={historicoQ.isLoading} data={historicoQ.data ?? []} />
        )}
      </ScrollView>

      {/* Bottom action */}
      <View className="flex-row gap-3 border-t border-silver-200 bg-white px-4 py-3">
        <Pressable
          onPress={() => Alert.alert('Em breve', 'Chat com o cliente será liberado em breve.')}
          className="flex-row items-center justify-center gap-2 rounded-xl border border-silver-200 bg-silver-50 px-5 py-3"
        >
          <MessageSquare size={17} color="#0F0F0F" />
          <Text className="font-semibold text-navy">Mensagem</Text>
        </Pressable>
        <Pressable
          onPress={() => Alert.alert('Em breve', 'Avanço de etapa estará disponível em breve. Use o painel web para alterar o status.')}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-gold py-3 active:opacity-80"
        >
          <Text className="font-bold text-white">Avançar etapa</Text>
          <ChevronRight size={17} color="white" />
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

// ─── Tab: Resumo ────────────────────────────────────────────────────────────
function Resumo({
  proposta, calc, ltv, valorImoveis, valor,
}: {
  proposta: Proposta
  calc: ReturnType<typeof calcularFinanciamento>
  ltv: number
  valorImoveis: number
  valor: number
}) {
  return (
    <>
      <Card title="Crédito" icon={<TrendingUp size={15} color="#DC2626" />}>
        <Row label="Produto" value={PRODUTO_LABEL[proposta.produto] ?? proposta.produto} />
        <Row label="Valor solicitado" value={brl(valor * 100)} highlight />
        <Row label="Prazo" value={`${proposta.prazo_meses} meses`} />
        <Row label="Carência" value={`${proposta.carencia_meses} meses`} />
        <Row label="Taxa" value={`${Number(proposta.taxa_juros_mensal).toFixed(2)}% a.m.`} />
        <Row label="Sistema" value={`${proposta.amortizacao.toUpperCase()} · ${proposta.indexador}`} />
        <Row label="LTV" value={`${(ltv * 100).toFixed(1)}%`} highlight />
      </Card>
      <Card title="Simulação financeira" icon={<TrendingUp size={15} color="#DC2626" />}>
        <Row label="1ª parcela" value={brl(calc.primeiraParcela * 100)} highlight />
        <Row label="Última parcela" value={brl(calc.ultimaParcela * 100)} />
        <Row label="Total a pagar" value={brl(calc.totalPago * 100)} />
        <Row label="Renda mínima" value={`${brl(calc.rendaMinima * 100)}/mês`} />
      </Card>
      <Card title="Cliente" icon={<Shield size={15} color="#DC2626" />}>
        <Row label="Nome" value={proposta.cliente?.nome_completo ?? '—'} />
        <Row label="Tipo" value={proposta.cliente?.pessoa_tipo ?? '—'} />
        <Row
          label={proposta.cliente?.pessoa_tipo === 'PJ' ? 'CNPJ' : 'CPF'}
          value={(proposta.cliente?.pessoa_tipo === 'PJ' ? proposta.cliente?.cnpj : proposta.cliente?.cpf) ?? '—'}
        />
        <Row label="E-mail" value={proposta.cliente?.email ?? '—'} />
        <Row label="Telefone" value={proposta.cliente?.telefone ?? '—'} />
      </Card>
      <Card title="Garantia" icon={<Home size={15} color="#DC2626" />}>
        <Row label="Valor de avaliação" value={brl(valorImoveis * 100)} highlight />
      </Card>
      <Card title="Prazos" icon={<Calendar size={15} color="#DC2626" />}>
        <Row label="Criada em" value={new Date(proposta.created_at).toLocaleDateString('pt-BR')} />
        <Row label="Atualizada em" value={new Date(proposta.updated_at).toLocaleString('pt-BR')} />
      </Card>
    </>
  )
}

// ─── Tab: Proponentes ───────────────────────────────────────────────────────
function Proponentes({ loading, data }: { loading: boolean; data: Proponente[] }) {
  if (loading) return <ActivityIndicator color="#DC2626" />
  if (data.length === 0) return <EmptyState text="Sem proponentes cadastrados." />
  return (
    <>
      {data.map(p => (
        <Card
          key={p.id}
          title={p.principal ? 'Titular' : (p.relacao ?? 'Co-participante')}
          icon={<User size={15} color="#DC2626" />}
        >
          <Row label="Nome" value={p.nome} highlight />
          <Row label="CPF/CNPJ" value={p.cpf_cnpj ?? '—'} />
          <Row label="Tipo" value={p.pessoa_tipo} />
          <Row label="Estado civil" value={p.estado_civil ?? '—'} />
          {!p.principal && <Row label="Compõe renda" value={p.compoe_renda === true ? 'Sim' : p.compoe_renda === false ? 'Não' : '—'} />}
        </Card>
      ))}
    </>
  )
}

// ─── Tab: Imóveis ───────────────────────────────────────────────────────────
function Imoveis({ loading, data }: { loading: boolean; data: Imovel[] }) {
  if (loading) return <ActivityIndicator color="#DC2626" />
  if (data.length === 0) return <EmptyState text="Sem imóveis cadastrados." />
  return (
    <>
      {data.map(i => (
        <View key={i.id} className="gap-3">
          <Card title={i.tipo || 'Imóvel'} icon={<Building2 size={15} color="#DC2626" />}>
            <Row label="Valor" value={brl(Number(i.valor) * 100)} highlight />
            <Row label="Alugado" value={i.alugado ? 'Sim' : 'Não'} />
            <Row label="Financiado" value={i.financiado ? 'Sim' : 'Não'} />
            <Row label="Possui débitos" value={i.possui_debitos ? 'Sim' : 'Não'} />
          </Card>
          <Card title="Localização" icon={<MapPin size={15} color="#DC2626" />}>
            <Row label="Endereço" value={[i.logradouro, i.numero].filter(Boolean).join(', ') || '—'} />
            <Row label="Bairro" value={i.bairro ?? '—'} />
            <Row label="Cidade / UF" value={[i.cidade, i.estado].filter(Boolean).join(' — ') || '—'} />
            <Row label="CEP" value={i.cep ?? '—'} />
          </Card>
        </View>
      ))}
    </>
  )
}

// ─── Tab: Histórico ─────────────────────────────────────────────────────────
function Historico({ loading, data }: { loading: boolean; data: HistoricoRow[] }) {
  if (loading) return <ActivityIndicator color="#DC2626" />
  if (data.length === 0) return <EmptyState text="Sem alterações de status registradas." />
  return (
    <View className="overflow-hidden rounded-2xl border border-silver-200 bg-white">
      <View className="flex-row items-center gap-2 border-b border-silver-100 bg-silver-50 px-4 py-3">
        <Clock size={15} color="#DC2626" />
        <Text className="text-xs font-bold uppercase tracking-wider text-silver-600">Linha do tempo</Text>
      </View>
      {data.map((e, i) => (
        <View key={e.id} className="flex-row gap-3 px-4 py-4">
          <View className="items-center" style={{ width: 20 }}>
            <View className="h-3 w-3 rounded-full bg-gold" />
            {i < data.length - 1 && <View className="mt-1 w-px flex-1 bg-silver-200" />}
          </View>
          <View className="flex-1 pb-2">
            <Text className="text-sm font-semibold text-navy">
              {e.status_anterior ? `${STATUS_LABEL[e.status_anterior] ?? e.status_anterior} → ` : ''}
              {STATUS_LABEL[e.status_novo] ?? e.status_novo}
            </Text>
            <Text className="mt-0.5 text-xs text-silver-400">
              {new Date(e.created_at).toLocaleString('pt-BR')}
            </Text>
            {e.motivo && <Text className="mt-1.5 text-xs leading-relaxed text-silver-600">{e.motivo}</Text>}
          </View>
        </View>
      ))}
    </View>
  )
}

// ─── Shared components ──────────────────────────────────────────────────────
function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-silver-200 bg-white">
      <View className="flex-row items-center gap-2 border-b border-silver-100 bg-silver-50 px-4 py-3">
        {icon}
        <Text className="text-xs font-bold uppercase tracking-wider text-silver-600">{title}</Text>
      </View>
      <View className="px-4 pb-2 pt-1">{children}</View>
    </View>
  )
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className="flex-row items-center justify-between border-b border-silver-100 py-3 last:border-b-0">
      <Text className="text-sm text-silver-500">{label}</Text>
      <Text className={`text-sm font-semibold ${highlight ? 'text-navy' : 'text-silver-700'}`} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <View className="rounded-xl border border-silver-200 bg-white p-8">
      <Text className="text-center text-sm text-silver-500">{text}</Text>
    </View>
  )
}

