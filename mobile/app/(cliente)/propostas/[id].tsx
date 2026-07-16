import { useCallback, useState } from 'react'
import {
  ScrollView, View, Text, Pressable, ActivityIndicator, RefreshControl,
  Linking, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Clock, FileText, Upload, AlertTriangle, CheckCircle2, Send,
  FileSignature, Download, Loader2, Home, MapPin,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { calcularFinanciamento } from '@/lib/credito'

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

const PENDENCIA_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  aberta:     { label: 'Aberta',     bg: '#F59E0B22', fg: '#B45309' },
  em_analise: { label: 'Em análise', bg: '#38BDF822', fg: '#0369A1' },
  resolvida:  { label: 'Resolvida',  bg: '#16A34A22', fg: '#16A34A' },
  rejeitada:  { label: 'Rejeitada',  bg: '#DC262622', fg: '#DC2626' },
}

const TIPO_LABEL: Record<string, string> = {
  rg: 'RG', cpf: 'CPF', cnh: 'CNH', contrato_social: 'Contrato Social',
  comprovante_residencia: 'Comprovante de Residência', comprovante_renda: 'Comprovante de Renda',
  matricula_imovel: 'Matrícula do Imóvel', iptu: 'IPTU',
  certidao_casamento: 'Certidão de Casamento', outros: 'Outros',
}

const PRE_CONTRATO = new Set([
  'simulacao', 'pre_analise', 'analise_credito', 'analise_imovel',
  'analise_juridica', 'comite', 'proposta_cliente', 'resolucao_pendencias',
])

type Tab = 'resumo' | 'documentos' | 'pendencias' | 'contrato' | 'historico'

export default function ClientePropostaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('resumo')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ----- Queries
  const propostaQ = useQuery({
    enabled: !!id,
    queryKey: ['cliente-prop', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, valor_solicitado, prazo_meses, taxa_juros_mensal, amortizacao, carencia_meses, cliente:clientes(nome_completo, email, cpf)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
  })

  const imoveisQ = useQuery({
    enabled: !!id && tab === 'resumo',
    queryKey: ['cliente-prop-imoveis', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('imoveis')
        .select('id, tipo, endereco, cidade, uf, valor_avaliacao')
        .eq('proposta_id', id!)
      if (error) throw error
      return data ?? []
    },
  })

  const docsQ = useQuery({
    enabled: !!id && tab === 'documentos',
    queryKey: ['cliente-prop-docs', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_documentos')
        .select('id, tipo, categoria, storage_path, mime_type, tamanho_bytes, origem, validado, created_at')
        .eq('proposta_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const pendenciasQ = useQuery({
    enabled: !!id && tab === 'pendencias',
    queryKey: ['cliente-prop-pendencias', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_pendencias')
        .select('id, descricao, documento_solicitado_tipo, status, prazo, resolvida_em, created_at')
        .eq('proposta_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const contratoQ = useQuery({
    enabled: !!id && tab === 'contrato' && !PRE_CONTRATO.has(propostaQ.data?.status ?? ''),
    queryKey: ['cliente-prop-contrato', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select('id, pdf_storage_path, provedor_assinatura, gerado_em, assinado_em, registrado_em, versao')
        .eq('proposta_id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })

  const assinaturasQ = useQuery({
    enabled: !!contratoQ.data?.id,
    queryKey: ['cliente-prop-assinaturas', contratoQ.data?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assinaturas_contrato')
        .select('id, signatario_nome, papel, status, assinado_em, ordem')
        .eq('contrato_id', contratoQ.data!.id).order('ordem')
      if (error) throw error
      return data ?? []
    },
  })

  const historicoQ = useQuery({
    enabled: !!id && tab === 'historico',
    queryKey: ['cliente-prop-historico', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_status_historico')
        .select('id, status_anterior, status_novo, created_at, observacao')
        .eq('proposta_id', id!)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })

  // ----- Mutations
  const uploadMut = useMutation({
    mutationFn: async () => {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
      })
      if (res.canceled || !res.assets?.[0]) return null
      const asset = res.assets[0]
      const ext = (asset.name?.split('.').pop() ?? 'pdf').toLowerCase()
      const path = `${id}/${Date.now()}.${ext}`
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
      const bin = atob(base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const contentType = asset.mimeType || (ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`)

      const { error: upErr } = await supabase.storage
        .from('proposta-docs')
        .upload(path, bytes, { contentType, upsert: false })
      if (upErr) throw new Error(upErr.message)

      const { error: insErr } = await supabase.from('proposta_documentos').insert({
        proposta_id: id, tipo: 'outros',
        storage_path: path, bucket: 'proposta-docs',
        mime_type: contentType, tamanho_bytes: bytes.length,
        origem: 'cliente',
      })
      if (insErr) {
        await supabase.storage.from('proposta-docs').remove([path])
        throw new Error(insErr.message)
      }
      return path
    },
    onSuccess: (path) => { if (path) qc.invalidateQueries({ queryKey: ['cliente-prop-docs', id] }) },
    onError: (e: Error) => setError(e.message),
  })

  const responderMut = useMutation({
    mutationFn: async (pid: string) => {
      const { error } = await supabase.rpc('cliente_responder_pendencia', { p_id: pid })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cliente-prop-pendencias', id] }),
    onError: (e: Error) => setError(e.message),
  })

  // ----- Helpers
  async function abrirDocumento(storagePath: string, bucket = 'proposta-docs') {
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 60 * 10)
      if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Falha ao gerar URL')
      await Linking.openURL(data.signedUrl)
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao abrir documento')
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      propostaQ.refetch(), imoveisQ.refetch(), docsQ.refetch(),
      pendenciasQ.refetch(), contratoQ.refetch(), historicoQ.refetch(),
    ])
    setRefreshing(false)
  }, [propostaQ, imoveisQ, docsQ, pendenciasQ, contratoQ, historicoQ])

  // ----- Render
  if (propostaQ.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-silver-50" edges={['top', 'bottom']}>
        <ActivityIndicator color="#D4AF37" />
      </SafeAreaView>
    )
  }

  const p = propostaQ.data
  if (!p) {
    return (
      <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-6">
          <FileText size={48} color="#9CA3AF" />
          <Text className="mt-3 text-base font-semibold text-navy">Proposta não encontrada</Text>
          <Pressable onPress={() => router.replace('/(cliente)' as any)} className="mt-5 rounded-lg border border-silver-300 px-4 py-2">
            <Text className="text-sm font-semibold text-navy">Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const valor = Number(p.valor_solicitado)
  const taxaMensal = Number(p.taxa_juros_mensal ?? 1.29) / 100
  const sim = calcularFinanciamento({
    valor, prazoMeses: p.prazo_meses, taxaMensal,
    amortizacao: (p.amortizacao as 'price' | 'sac') || 'price',
    carenciaMeses: p.carencia_meses ?? 0,
  })

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      {/* Header fixo */}
      <View className="flex-row items-center gap-3 border-b border-silver-200 bg-white px-4 py-3">
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(cliente)' as any)} className="-ml-2 p-2">
          <ArrowLeft size={20} color="#0F0F0F" />
        </Pressable>
        <View className="flex-1">
          <Text className="font-mono text-[10px] text-silver-500">{p.protocolo}</Text>
          <Text className="text-base font-bold text-navy" numberOfLines={1}>
            {PRODUTO_LABEL[p.produto] || p.produto}
          </Text>
        </View>
        <View className="rounded-full bg-navy/10 px-2.5 py-1">
          <Text className="text-[10px] font-semibold text-navy" numberOfLines={1}>
            {STATUS_LABEL[p.status] || p.status}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-12 grow-0 border-b border-silver-200 bg-white"
        contentContainerStyle={{ paddingHorizontal: 12 }}
      >
        {(['resumo', 'documentos', 'pendencias', 'contrato', 'historico'] as Tab[]).map(t => (
          <Pressable key={t} onPress={() => setTab(t)} className="px-4 py-3">
            <Text className={`text-sm ${tab === t ? 'font-bold text-navy' : 'font-medium text-silver-500'}`}>
              {t === 'resumo' ? 'Resumo' : t === 'documentos' ? 'Documentos'
                : t === 'pendencias' ? 'Pendências' : t === 'contrato' ? 'Contrato' : 'Histórico'}
            </Text>
            {tab === t && <View className="-mb-px mt-1 h-0.5 rounded-full bg-gold" />}
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
      >
        {error && (
          <View className="flex-row items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2">
            <AlertTriangle size={14} color="#DC2626" />
            <Text className="flex-1 text-xs text-danger">{error}</Text>
            <Pressable onPress={() => setError(null)}><Text className="text-xs text-danger underline">fechar</Text></Pressable>
          </View>
        )}

        {tab === 'resumo' && (
          <>
            {/* Card valor */}
            <View className="rounded-2xl border border-silver-200 bg-white p-5">
              <Text className="text-xs uppercase tracking-wider text-silver-500">Valor solicitado</Text>
              <Text className="mt-1 text-3xl font-bold text-navy">{brl(valor * 100)}</Text>
              <Text className="mt-1 text-sm text-silver-600">
                {p.prazo_meses} meses
                {p.taxa_juros_mensal ? ` · ${Number(p.taxa_juros_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}% a.m.` : ''}
              </Text>
            </View>

            {/* Simulação */}
            <View className="rounded-2xl border border-silver-200 bg-white p-5">
              <Text className="text-xs font-semibold uppercase tracking-wider text-silver-500">Simulação estimada</Text>
              <View className="mt-3 gap-2">
                <Row k="Primeira parcela" v={brl(sim.primeiraParcela * 100)} />
                <Row k="Última parcela" v={brl(sim.ultimaParcela * 100)} />
                <Row k="Total a pagar" v={brl(sim.totalPago * 100)} />
                <Row k="Total de juros" v={brl(sim.totalJuros * 100)} highlight />
              </View>
            </View>

            {/* Imóveis */}
            <View className="rounded-2xl border border-silver-200 bg-white p-5">
              <View className="flex-row items-center gap-2">
                <Home size={16} color="#737373" />
                <Text className="text-xs font-semibold uppercase tracking-wider text-silver-500">
                  Imóveis em garantia
                </Text>
              </View>
              {imoveisQ.isLoading ? (
                <ActivityIndicator color="#D4AF37" className="mt-3" />
              ) : !imoveisQ.data?.length ? (
                <Text className="mt-3 text-sm text-silver-500">Nenhum imóvel cadastrado.</Text>
              ) : (
                <View className="mt-3 gap-3">
                  {imoveisQ.data.map(im => (
                    <View key={im.id} className="border-b border-silver-100 pb-3 last:border-0">
                      <Text className="font-semibold text-navy">{im.tipo} · {im.cidade}/{im.uf}</Text>
                      <View className="mt-0.5 flex-row items-center gap-1">
                        <MapPin size={11} color="#737373" />
                        <Text className="flex-1 text-xs text-silver-600">{im.endereco}</Text>
                      </View>
                      <Text className="mt-1 text-xs text-silver-500">
                        Avaliado em {brl(Number(im.valor_avaliacao ?? 0) * 100)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {tab === 'documentos' && (
          <>
            <View className="rounded-2xl border border-silver-200 bg-white p-4">
              <Text className="text-xs font-semibold uppercase tracking-wider text-silver-500">
                Enviar documento
              </Text>
              <Text className="mt-1 text-xs text-silver-600">
                Anexe PDFs ou imagens (JPG/PNG). Os documentos serão revisados pela equipe.
              </Text>
              <Pressable
                onPress={() => uploadMut.mutate()}
                disabled={uploadMut.isPending}
                className="mt-3 flex-row items-center justify-center gap-2 rounded-lg bg-gold py-3 active:opacity-80"
              >
                {uploadMut.isPending
                  ? <ActivityIndicator color="white" />
                  : <>
                      <Upload size={16} color="white" />
                      <Text className="text-sm font-bold text-white">Anexar documento</Text>
                    </>}
              </Pressable>
            </View>

            <View className="rounded-2xl border border-silver-200 bg-white p-4">
              <Text className="text-xs font-semibold uppercase tracking-wider text-silver-500">
                Documentos enviados {docsQ.data?.length ? `(${docsQ.data.length})` : ''}
              </Text>
              {docsQ.isLoading ? (
                <ActivityIndicator color="#D4AF37" className="mt-3" />
              ) : !docsQ.data?.length ? (
                <Text className="mt-3 text-sm text-silver-500">Nenhum documento enviado.</Text>
              ) : (
                <View className="mt-3 gap-2">
                  {docsQ.data.map(d => (
                    <Pressable
                      key={d.id}
                      onPress={() => abrirDocumento(d.storage_path)}
                      className="flex-row items-center gap-3 rounded-lg border border-silver-200 bg-silver-50 p-3 active:opacity-70"
                    >
                      <FileText size={18} color="#737373" />
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-navy">{TIPO_LABEL[d.tipo] || d.tipo}</Text>
                        <Text className="text-[11px] text-silver-500">
                          {d.origem ?? '—'} · {new Date(d.created_at).toLocaleDateString('pt-BR')}
                          {d.validado ? ' · validado' : ''}
                        </Text>
                      </View>
                      <Download size={14} color="#9CA3AF" />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {tab === 'pendencias' && (
          <View className="rounded-2xl border border-silver-200 bg-white p-4">
            <Text className="text-xs font-semibold uppercase tracking-wider text-silver-500">
              Pendências {pendenciasQ.data?.length ? `(${pendenciasQ.data.length})` : ''}
            </Text>
            {pendenciasQ.isLoading ? (
              <ActivityIndicator color="#D4AF37" className="mt-3" />
            ) : !pendenciasQ.data?.length ? (
              <Text className="mt-3 text-sm text-silver-500">Nenhuma pendência registrada.</Text>
            ) : (
              <View className="mt-3 gap-3">
                {pendenciasQ.data.map(pend => {
                  const badge = PENDENCIA_BADGE[pend.status] ?? PENDENCIA_BADGE.aberta
                  const ativa = pend.status === 'aberta' || pend.status === 'em_analise'
                  return (
                    <View key={pend.id} className="rounded-lg border border-silver-200 p-3">
                      <Text className="text-sm text-navy">{pend.descricao}</Text>
                      <View className="mt-2 flex-row flex-wrap items-center gap-2">
                        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
                          <Text className="text-[10px] font-bold" style={{ color: badge.fg }}>{badge.label}</Text>
                        </View>
                        {pend.documento_solicitado_tipo && (
                          <Text className="text-[11px] text-silver-500">
                            Doc: {TIPO_LABEL[pend.documento_solicitado_tipo] ?? pend.documento_solicitado_tipo}
                          </Text>
                        )}
                        {pend.prazo && (
                          <View className="flex-row items-center gap-1">
                            <Clock size={10} color="#737373" />
                            <Text className="text-[11px] text-silver-500">
                              Prazo {new Date(pend.prazo).toLocaleDateString('pt-BR')}
                            </Text>
                          </View>
                        )}
                      </View>
                      {ativa && pend.status === 'aberta' && (
                        <Pressable
                          onPress={() => responderMut.mutate(pend.id)}
                          disabled={responderMut.isPending}
                          className="mt-3 flex-row items-center justify-center gap-1.5 rounded-lg bg-gold py-2.5 active:opacity-80"
                        >
                          {responderMut.isPending && responderMut.variables === pend.id
                            ? <ActivityIndicator size="small" color="white" />
                            : <>
                                <Send size={13} color="white" />
                                <Text className="text-xs font-bold text-white">Marcar como respondida</Text>
                              </>}
                        </Pressable>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}

        {tab === 'contrato' && (
          <ContratoTab
            status={p.status}
            contrato={contratoQ.data}
            assinaturas={assinaturasQ.data ?? []}
            loading={contratoQ.isLoading}
            onAbrirPdf={(path) => abrirDocumento(path, 'contratos')}
          />
        )}

        {tab === 'historico' && (
          <View className="rounded-2xl border border-silver-200 bg-white p-4">
            <Text className="text-xs font-semibold uppercase tracking-wider text-silver-500">Histórico</Text>
            {historicoQ.isLoading ? (
              <ActivityIndicator color="#D4AF37" className="mt-3" />
            ) : !historicoQ.data?.length ? (
              <Text className="mt-3 text-sm text-silver-500">Sem eventos registrados.</Text>
            ) : (
              <View className="mt-3 gap-3">
                {historicoQ.data.map(h => (
                  <View key={h.id} className="flex-row items-start gap-3 border-b border-silver-100 pb-3 last:border-0">
                    <Clock size={14} color="#9CA3AF" className="mt-0.5" />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-navy">
                        {STATUS_LABEL[h.status_anterior ?? ''] ?? h.status_anterior ?? '—'}
                        {' → '}
                        {STATUS_LABEL[h.status_novo] ?? h.status_novo}
                      </Text>
                      <Text className="text-xs text-silver-500">
                        {new Date(h.created_at).toLocaleString('pt-BR')}
                      </Text>
                      {h.observacao && (
                        <Text className="mt-1 text-xs text-silver-600">{h.observacao}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <View className="flex-row items-center justify-between border-b border-silver-100 pb-2 last:border-0">
      <Text className="text-sm text-silver-600">{k}</Text>
      <Text className={`text-sm font-semibold ${highlight ? 'text-gold-600' : 'text-navy'}`}>{v}</Text>
    </View>
  )
}

interface ContratoTabProps {
  status: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contrato: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assinaturas: any[]
  loading: boolean
  onAbrirPdf: (path: string) => void
}
function ContratoTab({ status, contrato, assinaturas, loading, onAbrirPdf }: ContratoTabProps) {
  if (PRE_CONTRATO.has(status)) {
    return (
      <View className="items-center rounded-2xl border border-silver-200 bg-white p-8">
        <FileSignature size={36} color="#CED4DA" />
        <Text className="mt-3 text-sm font-semibold text-navy">Aguardando aprovação</Text>
        <Text className="mt-1 text-center text-xs text-silver-500">
          O contrato será disponibilizado após a aprovação da proposta.
          {'\n'}Status atual: {STATUS_LABEL[status] ?? status}
        </Text>
      </View>
    )
  }
  if (status === 'cancelado') {
    return (
      <View className="rounded-2xl border border-silver-200 bg-white p-8">
        <Text className="text-center text-sm text-silver-500">Proposta cancelada.</Text>
      </View>
    )
  }
  if (loading) {
    return <View className="rounded-2xl bg-white p-8"><ActivityIndicator color="#D4AF37" /></View>
  }
  if (!contrato) {
    return (
      <View className="items-center rounded-2xl border border-silver-200 bg-white p-8">
        <Loader2 size={28} color="#CED4DA" />
        <Text className="mt-3 text-sm text-silver-500">Contrato ainda não gerado.</Text>
      </View>
    )
  }
  return (
    <>
      <View className="rounded-2xl border border-silver-200 bg-white p-5">
        <View className="flex-row items-center gap-2">
          <FileSignature size={18} color="#D4AF37" />
          <Text className="text-sm font-bold text-navy">Contrato v{contrato.versao ?? 1}</Text>
        </View>
        <View className="mt-3 gap-1.5">
          {contrato.gerado_em && (
            <Text className="text-xs text-silver-600">
              Gerado em {new Date(contrato.gerado_em).toLocaleString('pt-BR')}
            </Text>
          )}
          {contrato.assinado_em && (
            <Text className="text-xs text-success">
              ✓ Assinado em {new Date(contrato.assinado_em).toLocaleString('pt-BR')}
            </Text>
          )}
          {contrato.registrado_em && (
            <Text className="text-xs text-success">
              ✓ Registrado em {new Date(contrato.registrado_em).toLocaleString('pt-BR')}
            </Text>
          )}
        </View>
        {contrato.pdf_storage_path && (
          <Pressable
            onPress={() => onAbrirPdf(contrato.pdf_storage_path)}
            className="mt-4 flex-row items-center justify-center gap-2 rounded-lg bg-navy py-3 active:opacity-80"
          >
            <Download size={16} color="white" />
            <Text className="text-sm font-bold text-white">Abrir PDF do contrato</Text>
          </Pressable>
        )}
      </View>

      {assinaturas.length > 0 && (
        <View className="rounded-2xl border border-silver-200 bg-white p-5">
          <Text className="text-xs font-semibold uppercase tracking-wider text-silver-500">
            Assinaturas
          </Text>
          <View className="mt-3 gap-2.5">
            {assinaturas.map(a => (
              <View key={a.id} className="flex-row items-center justify-between border-b border-silver-100 pb-2.5 last:border-0">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-navy">{a.signatario_nome}</Text>
                  <Text className="text-[11px] text-silver-500">{a.papel}</Text>
                </View>
                {a.assinado_em ? (
                  <View className="flex-row items-center gap-1">
                    <CheckCircle2 size={14} color="#16A34A" />
                    <Text className="text-xs font-semibold text-success">Assinado</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-1">
                    <Clock size={14} color="#F59E0B" />
                    <Text className="text-xs font-semibold" style={{ color: '#B45309' }}>{a.status ?? 'pendente'}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  )
}


