import { ScrollView, View, Text, Pressable, ImageBackground, Image, ActivityIndicator, Linking, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { CheckCircle2, Circle, Clock, Upload, MessageCircle, AlertCircle, FileText, LogOut } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, useCallback } from 'react'
import { brl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { buildChecklist, countObrigatoriosPendentes, type DocRowLite, type RequisitoRow } from '@/lib/documentos'

const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Crédito Construção',
  financiamento_imobiliario: 'Financiamento Imobiliário',
}

const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Em rascunho',
  pre_analise: 'Pré-análise',
  analise_credito: 'Análise de crédito',
  analise_imovel: 'Análise do imóvel',
  analise_juridica: 'Análise jurídica',
  comite: 'Comitê',
  proposta_cliente: 'Aguardando sua resposta',
  resolucao_pendencias: 'Pendências em aberto',
  emissao_contrato: 'Emissão de contrato',
  aguardando_assinatura: 'Aguardando assinatura',
  em_registro: 'Em registro',
  contrato_registrado: 'Contrato registrado',
  recurso_liberado: 'Recurso liberado',
  cancelado: 'Cancelada',
}

const STEP_ORDER: { key: string; label: string }[] = [
  { key: 'simulacao', label: 'Proposta criada' },
  { key: 'pre_analise', label: 'Pré-análise' },
  { key: 'analise_credito', label: 'Análise de crédito' },
  { key: 'analise_imovel', label: 'Análise do imóvel' },
  { key: 'analise_juridica', label: 'Análise jurídica' },
  { key: 'comite', label: 'Comitê' },
  { key: 'emissao_contrato', label: 'Emissão de contrato' },
  { key: 'aguardando_assinatura', label: 'Assinatura' },
  { key: 'em_registro', label: 'Registro' },
  { key: 'contrato_registrado', label: 'Contrato registrado' },
  { key: 'recurso_liberado', label: 'Recurso liberado' },
]

interface Proposta {
  id: string
  protocolo: string
  produto: string
  status: string
  valor_solicitado: number | string
  prazo_meses: number
  taxa_juros_mensal: number | string | null
  updated_at: string
}

export default function ClienteHome() {
  const { session, signOut } = useAuth()
  const nome = (session?.nome?.split(' ')[0]) || 'Cliente'
  const [refreshing, setRefreshing] = useState(false)

  const propostasQ = useQuery({
    queryKey: ['cliente-propostas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, valor_solicitado, prazo_meses, taxa_juros_mensal, updated_at')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Proposta[]
    },
  })

  const proposta = propostasQ.data?.[0]

  const pendenciasQ = useQuery({
    enabled: !!proposta?.id,
    queryKey: ['cliente-pendencias', proposta?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_pendencias')
        .select('id, descricao, status, created_at')
        .eq('proposta_id', proposta!.id)
        .in('status', ['aberta', 'em_analise'])
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const historicoQ = useQuery({
    enabled: !!proposta?.id,
    queryKey: ['cliente-historico', proposta?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_status_historico')
        .select('status_novo, created_at')
        .eq('proposta_id', proposta!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const docsAllQ = useQuery({
    queryKey: ['cliente-docs-all'],
    queryFn: async (): Promise<DocRowLite[]> => {
      const { data, error } = await supabase
        .from('proposta_documentos')
        .select('proposta_id, categoria, tipo, storage_path, status, validado')
      if (error) throw error
      return (data ?? []) as DocRowLite[]
    },
  })

  const reqQ = useQuery({
    queryKey: ['doc-requisitos'],
    queryFn: async (): Promise<RequisitoRow[]> => {
      const { data, error } = await supabase
        .from('documento_requisitos')
        .select('categoria, tipo, obrigatorio, ordem')
      if (error) throw error
      return (data ?? []) as RequisitoRow[]
    },
  })

  const docsObrigatoriosPendentes = countObrigatoriosPendentes(buildChecklist(docsAllQ.data ?? [], reqQ.data ?? []))

  const steps = useMemo(() => {
    const currentIdx = proposta ? STEP_ORDER.findIndex(s => s.key === proposta.status) : -1
    const histMap: Record<string, string> = {}
    for (const h of historicoQ.data ?? []) {
      if (!histMap[h.status_novo]) histMap[h.status_novo] = h.created_at
    }
    return STEP_ORDER.map((s, i) => {
      const done = currentIdx > i
      const current = currentIdx === i
      const dt = histMap[s.key]
      return {
        key: s.key,
        label: s.label,
        done,
        current,
        date: dt
          ? new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : current ? 'em andamento' : '—',
      }
    })
  }, [proposta, historicoQ.data])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([propostasQ.refetch(), pendenciasQ.refetch(), historicoQ.refetch()])
    setRefreshing(false)
  }, [propostasQ, pendenciasQ, historicoQ])

  if (propostasQ.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-silver-50">
        <ActivityIndicator color="#D4AF37" />
      </SafeAreaView>
    )
  }

  if (!proposta) {
    return (
      <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-6">
          <FileText size={48} color="#9CA3AF" />
          <Text className="mt-3 text-center text-base font-semibold text-navy">Nenhuma proposta encontrada</Text>
          <Text className="mt-1 text-center text-sm text-silver-600">
            Se você recebeu um link de acesso do seu parceiro, abra-o para conectar à sua conta.
          </Text>
          <Pressable onPress={signOut} className="mt-6 flex-row items-center gap-2 rounded-lg border border-silver-300 px-4 py-2">
            <LogOut size={16} color="#0F0F0F" />
            <Text className="text-sm font-semibold text-navy">Sair</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const valor = Number(proposta.valor_solicitado)
  const taxa = proposta.taxa_juros_mensal ? Number(proposta.taxa_juros_mensal) : null
  const pendentesCount = pendenciasQ.data?.length ?? 0

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
      >
        <ImageBackground
          source={require('../../assets/general/clientcard.jpg')}
          style={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 16 }}
          imageStyle={{ resizeMode: 'cover' }}
        >
          <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(10,20,40,0.0)' }} />
          <Text className="text-xs uppercase tracking-wider text-gold">Sua proposta</Text>
          <Text className="mt-1 font-mono text-xs text-white/60">{proposta.protocolo}</Text>
          <Text className="mt-2 text-2xl font-bold text-white">Olá, {nome}</Text>
          <Text className="mt-1 text-sm text-white/70">{PRODUTO_LABEL[proposta.produto] || proposta.produto}</Text>

          <Image source={require('../../assets/general/clientlogo.png')} className="absolute -top-2 -right-2" style={{ width: 180, height: 180, opacity: 0.6 }} />

          <Pressable
            onPress={() => router.push(`/(cliente)/propostas/${proposta.id}` as any)}
            className="mt-4 rounded-xl border-[0.5px] border-gold bg-white/10 p-4 active:opacity-80"
          >
            <Text className="text-xs text-white/70">Valor solicitado</Text>
            <Text className="mt-1 text-3xl font-bold text-white">{brl(valor * 100)}</Text>
            <Text className="text-xs text-white/70">
              {proposta.prazo_meses} meses{taxa ? ` · ${taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}% a.m.` : ''}
            </Text>
            <Text className="mt-2 text-[11px] font-semibold text-gold">Ver detalhes →</Text>
          </Pressable>

          <View className="mt-3 self-start rounded-full bg-white/20 px-3 py-1">
            <Text className="text-xs font-semibold text-white">{STATUS_LABEL[proposta.status] || proposta.status}</Text>
          </View>
        </ImageBackground>

        {pendentesCount > 0 && (
          <View className="mx-5 mt-4 rounded-xl border border-gold/30 bg-gold/5 p-4">
            <View className="flex-row items-center gap-2">
              <AlertCircle size={20} color="#dc2626" />
              <Text className="font-bold text-gold">
                {pendentesCount} {pendentesCount === 1 ? 'pendência' : 'pendências'} em aberto
              </Text>
            </View>
            {(pendenciasQ.data ?? []).slice(0, 2).map(p => (
              <Text key={p.id} className="mt-1 text-sm text-silver-700">• {p.descricao}</Text>
            ))}
            <Pressable
              onPress={() => router.push('/(cliente)/documentos')}
              className="mt-3 self-start rounded-lg bg-gold px-4 py-2"
            >
              <Text className="text-sm font-bold text-white">Resolver agora</Text>
            </Pressable>
          </View>
        )}

        {docsObrigatoriosPendentes > 0 && (
          <Pressable
            onPress={() => router.push('/(cliente)/documentos')}
            className="mx-5 mt-4 flex-row items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 active:opacity-80"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-danger/10">
              <FileText size={20} color="#dc2626" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-navy">Documentos obrigatórios pendentes</Text>
              <Text className="text-xs text-silver-600">
                {docsObrigatoriosPendentes} {docsObrigatoriosPendentes === 1 ? 'documento pendente' : 'documentos pendentes'}. Toque para enviar.
              </Text>
            </View>
          </Pressable>
        )}

        <View className="px-5 pt-5">
          <Text className="text-base font-bold text-navy">Andamento</Text>
          <View className="mt-3 rounded-xl border border-silver-200 bg-white p-4">
            {steps.map((s, i) => (
              <View key={s.key} className="flex-row gap-3">
                <View className="items-center">
                  {s.done ? <CheckCircle2 size={20} color="#16A34A" /> :
                   s.current ? <Clock size={20} color="#DC2626" /> :
                   <Circle size={20} color="#CED4DA" />}
                  {i < steps.length - 1 && (
                    <View className={`my-1 h-8 w-0.5 ${s.done ? 'bg-success' : 'bg-silver-200'}`} />
                  )}
                </View>
                <View className="flex-1 pb-2">
                  <Text className={`text-sm font-semibold ${s.current ? 'text-gold-600' : s.done ? 'text-silver-900' : 'text-silver-400'}`}>
                    {s.label}
                  </Text>
                  <Text className="text-xs text-silver-500">{s.date}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="flex-row gap-2 px-5 pt-4">
          <Pressable
            onPress={() => router.push('/(cliente)/documentos')}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-silver-300 bg-white py-3"
          >
            <Upload size={18} color="#0F0F0F" />
            <Text className="font-semibold text-navy">Documentos</Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL('https://wa.me/5511999999999')}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-success py-3"
          >
            <MessageCircle size={18} color="white" />
            <Text className="font-semibold text-white">WhatsApp</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/(cliente)/universidade' as any)}
          className="mx-5 mt-3 flex-row items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4 active:opacity-80"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-gold/15">
            <Text className="text-base">🎓</Text>
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-navy">Universidade Mercurio</Text>
            <Text className="text-xs text-silver-600">Educação financeira premium</Text>
          </View>
        </Pressable>

        {(propostasQ.data?.length ?? 0) > 1 && (
          <View className="px-5 pt-5">
            <Text className="text-xs font-semibold uppercase tracking-wider text-silver-500">Outras propostas</Text>
            <View className="mt-2 gap-2">
              {propostasQ.data!.slice(1).map(p => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/(cliente)/propostas/${p.id}` as any)}
                  className="rounded-xl border border-silver-200 bg-white p-4 active:opacity-70"
                >
                  <Text className="font-mono text-[11px] text-silver-500">{p.protocolo}</Text>
                  <Text className="font-semibold text-navy">{PRODUTO_LABEL[p.produto] || p.produto}</Text>
                  <Text className="text-xs text-silver-600">
                    {brl(Number(p.valor_solicitado) * 100)} · {STATUS_LABEL[p.status] || p.status}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <Pressable onPress={signOut} className="mx-5 mt-6 flex-row items-center justify-center gap-2 rounded-lg border border-silver-300 py-2">
          <LogOut size={14} color="#6c757d" />
          <Text className="text-xs font-medium text-silver-600">Sair</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
