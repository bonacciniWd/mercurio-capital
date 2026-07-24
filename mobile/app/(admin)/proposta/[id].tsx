import { useState } from 'react'
import {
  ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Modal, FlatList, Linking, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle, RefreshCcw,
  User, Building2, Banknote, FileText, History as HistoryIcon, ListChecks,
  FileSignature, Send, Download, Award, Clock, Upload, Trash2, Tag,
} from 'lucide-react-native'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { calcularFinanciamento, calcularLTV } from '@/lib/credito'
import { isPropostaAprovada } from '@/lib/propostaStatus'
import { FUNDO_STATUS, FUNDO_STATUS_COLOR, FUNDO_STATUS_LABEL, type FundoStatus } from '@/lib/fundoStatus'

function base64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Uint8Array(256)
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i
  let bufferLength = b64.length * 0.75
  if (b64[b64.length - 1] === '=') bufferLength--
  if (b64[b64.length - 2] === '=') bufferLength--
  const bytes = new Uint8Array(bufferLength)
  let p = 0
  for (let i = 0; i < b64.length; i += 4) {
    const e1 = lookup[b64.charCodeAt(i)]
    const e2 = lookup[b64.charCodeAt(i + 1)]
    const e3 = lookup[b64.charCodeAt(i + 2)]
    const e4 = lookup[b64.charCodeAt(i + 3)]
    bytes[p++] = (e1 << 2) | (e2 >> 4)
    if (b64[i + 2] !== '=') bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2)
    if (b64[i + 3] !== '=') bytes[p++] = ((e3 & 3) << 6) | e4
  }
  return bytes
}

async function readFileBytes(uri: string): Promise<Uint8Array> {
  try {
    const f = new File(uri)
    if (typeof (f as any).bytes === 'function') return (await (f as any).bytes()) as Uint8Array
    if (typeof (f as any).base64 === 'function') return base64ToBytes(await (f as any).base64())
  } catch {
    // fallback fetch+arrayBuffer
  }
  const res = await fetch(uri)
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

interface FundoRow {
  fundo_id: string
  status_fundo: FundoStatus
  fundos: { id: string; nome: string; cor_hex: string } | null
}
interface ModeloRow {
  id: string
  storage_path: string
  nome_arquivo: string
  created_at: string
}

const TABS = ['Resumo', 'Proponentes', 'Imóveis', 'Documentos', 'Contrato', 'Histórico'] as const
type Tab = typeof TABS[number]

const STATUS_LABEL: Record<string, string> = {
  simulacao: 'Rascunho', pre_analise: 'Pré-análise', analise_credito: 'Análise Crédito',
  analise_imovel: 'Análise Imóvel', analise_juridica: 'Análise Jurídica', comite: 'Comitê',
  proposta_cliente: 'Proposta ao Cliente', resolucao_pendencias: 'Resolução pendências',
  emissao_contrato: 'Emissão de Contrato', aguardando_assinatura: 'Aguardando Assinatura',
  em_registro: 'Em Registro', contrato_registrado: 'Contrato Registrado',
  recurso_liberado: 'Recurso Liberado', cancelado: 'Cancelada',
}
const STATUS_ORDER = [
  'simulacao','pre_analise','analise_credito','analise_imovel','analise_juridica','comite',
  'proposta_cliente','resolucao_pendencias','emissao_contrato','aguardando_assinatura',
  'em_registro','contrato_registrado','recurso_liberado','cancelado',
] as const
const PRODUTO_LABEL: Record<string, string> = {
  home_equity: 'Home Equity',
  credito_construcao: 'Crédito Construção',
  financiamento_imobiliario: 'Financiamento Imobiliário',
}
const TIPO_LABEL: Record<string, string> = {
  rg: 'RG', cpf: 'CPF', cnh: 'CNH', contrato_social: 'Contrato Social',
  comprovante_residencia: 'Comprovante de Residência', comprovante_renda: 'Comprovante de Renda',
  matricula_imovel: 'Matrícula do Imóvel', iptu: 'IPTU',
  certidao_casamento: 'Certidão de Casamento', certidao_nascimento: 'Certidão de Nascimento',
  irpf_declaracao: 'IRPF — Declaração', irpf_recibo: 'IRPF — Recibo',
  extrato_bancario: 'Extrato Bancário', demonstrativo_contabil: 'Demonstrativo Contábil',
  ficha_cadastral_imovel: 'Ficha Cadastral do Imóvel', fotos_imovel: 'Fotos do Imóvel',
  contrato_compra_venda: 'Contrato de Compra e Venda', outros: 'Outros',
}

interface Proposta {
  id: string; protocolo: string | null; produto: string; status: string
  valor_solicitado: number; valor_imoveis_total: number; prazo_meses: number
  carencia_meses: number; taxa_juros_mensal: number; amortizacao: 'price' | 'sac'
  correcao: string; indexador: string; created_at: string; updated_at: string
  partner: { usuario: { nome_completo: string | null } | null } | null
  cliente: { nome_completo: string; cpf: string | null; cnpj: string | null; email: string | null; telefone: string | null; modelo_renda: string | null; renda_mensal: number | null; endereco_cidade: string | null; endereco_estado: string | null; razao_social: string | null; faturamento_mensal: number | null } | null
}
interface Proponente { id: string; nome: string; cpf_cnpj: string | null; principal: boolean; relacao: string | null; pessoa_tipo: string; compoe_renda: boolean | null }
interface Imovel { id: string; tipo: string; cidade: string | null; estado: string | null; bairro: string | null; logradouro: string | null; numero: string | null; valor: number }
interface HistoricoRow { id: string; status_anterior: string | null; status_novo: string; motivo: string | null; created_at: string }
interface DocRow { id: string; tipo: string; categoria: string; storage_path: string; validado: boolean; origem: string | null; created_at: string }

export default function PropostaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('Resumo')
  const [statusModal, setStatusModal] = useState(false)
  const [novoStatus, setNovoStatus] = useState('')
  const [motivo, setMotivo] = useState('')
  const [libModal, setLibModal] = useState(false)
  const [libValor, setLibValor] = useState('')
  const [libData, setLibData] = useState(() => new Date().toISOString().slice(0, 10))
  const [libObs, setLibObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const isAdminJuridico = session?.role === 'admin' && session.adminNivel === 'juridico'
  const canOperateAsAdmin = !isAdminJuridico

  const propQuery = useQuery({
    queryKey: ['admin-proposta-mobile', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo, produto, status, valor_solicitado, valor_imoveis_total, prazo_meses, carencia_meses, taxa_juros_mensal, amortizacao, correcao, indexador, created_at, updated_at, partner:partners(usuario:usuarios(nome_completo)), cliente:clientes(nome_completo, cpf, cnpj, email, telefone, modelo_renda, renda_mensal, endereco_cidade, endereco_estado, razao_social, faturamento_mensal)')
        .eq('id', id!).single()
      if (error) throw error
      return data as unknown as Proposta
    },
  })

  const propQ = useQuery({
    queryKey: ['admin-proposta-mob-proponentes', id],
    enabled: !!id && tab === 'Proponentes',
    queryFn: async () => {
      const { data, error } = await supabase.from('proponentes')
        .select('id, nome, cpf_cnpj, principal, relacao, pessoa_tipo, compoe_renda')
        .eq('proposta_id', id!).order('principal', { ascending: false })
      if (error) throw error
      return (data ?? []) as Proponente[]
    },
  })
  const imoQ = useQuery({
    queryKey: ['admin-proposta-mob-imoveis', id],
    enabled: !!id && tab === 'Imóveis',
    queryFn: async () => {
      const { data, error } = await supabase.from('imoveis')
        .select('id, tipo, cidade, estado, bairro, logradouro, numero, valor').eq('proposta_id', id!)
      if (error) throw error
      return (data ?? []) as Imovel[]
    },
  })
  const hisQ = useQuery({
    queryKey: ['admin-proposta-mob-historico', id],
    enabled: !!id && tab === 'Histórico',
    queryFn: async () => {
      const { data, error } = await supabase.from('proposta_status_historico')
        .select('id, status_anterior, status_novo, motivo, created_at')
        .eq('proposta_id', id!).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as HistoricoRow[]
    },
  })
  const docQ = useQuery({
    queryKey: ['admin-proposta-mob-docs', id],
    enabled: !!id && tab === 'Documentos',
    queryFn: async () => {
      const { data, error } = await supabase.from('proposta_documentos')
        .select('id, tipo, categoria, storage_path, validado, origem, created_at')
        .eq('proposta_id', id!).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as DocRow[]
    },
  })

  // ─── Contrato (tab Contrato) ──────────────────────────────────────────────
  const contratoQ = useQuery({
    queryKey: ['admin-proposta-mob-contrato', id],
    enabled: !!id && tab === 'Contrato',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select('id, pdf_storage_path, provedor_assinatura, provider_envelope_id, gerado_em, assinado_em, registrado_em, versao')
        .eq('proposta_id', id!).maybeSingle()
      if (error) throw error
      return data as {
        id: string; pdf_storage_path: string | null; provedor_assinatura: string | null
        provider_envelope_id: string | null; gerado_em: string | null; assinado_em: string | null
        registrado_em: string | null; versao: number
      } | null
    },
  })
  const assinaturasQ = useQuery({
    queryKey: ['admin-proposta-mob-assinaturas', contratoQ.data?.id],
    enabled: !!contratoQ.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assinaturas_contrato')
        .select('id, signatario_nome, signatario_email, papel, status, assinado_em, ordem')
        .eq('contrato_id', contratoQ.data!.id).order('ordem')
      if (error) throw error
      return (data ?? []) as Array<{
        id: string; signatario_nome: string; signatario_email: string | null
        papel: string; status: string | null; assinado_em: string | null; ordem: number
      }>
    },
  })
  const liberacaoQ = useQuery({
    queryKey: ['admin-proposta-mob-liberacao', id],
    enabled: !!id && tab === 'Contrato',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liberacoes_recurso')
        .select('id, valor_liberado, data_liberacao, comprovante_storage_path, observacao, created_at')
        .eq('proposta_id', id!).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw error
      return data as {
        id: string; valor_liberado: number; data_liberacao: string
        comprovante_storage_path: string | null; observacao: string | null; created_at: string
      } | null
    },
  })

  const modelosQ = useQuery({
    queryKey: ['admin-proposta-mob-modelos', id],
    enabled: !!id && tab === 'Contrato',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_contrato_modelos')
        .select('id, storage_path, nome_arquivo, created_at')
        .eq('proposta_id', id!).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ModeloRow[]
    },
  })

  const fundosQ = useQuery({
    queryKey: ['admin-proposta-mob-fundos', id],
    enabled: !!id && tab === 'Resumo',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_fundos')
        .select('fundo_id, status_fundo, fundos(id, nome, cor_hex)')
        .eq('proposta_id', id!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as FundoRow[]
    },
  })

  const statusMut = useMutation({
    mutationFn: async (vars: { status: string; motivo: string }) => {
      const { error } = await supabase.rpc('admin_set_proposta_status', {
        p_id: id!, p_status: vars.status, p_motivo: vars.motivo || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-proposta-mobile', id] })
      qc.invalidateQueries({ queryKey: ['admin-proposta-mob-historico', id] })
      qc.invalidateQueries({ queryKey: ['admin-propostas-mobile'] })
      setStatusModal(false); setMotivo(''); setNovoStatus('')
    },
  })

  const validarMut = useMutation({
    mutationFn: async (vars: { docId: string; validado: boolean }) => {
      const { error } = await supabase.rpc('admin_set_documento_validado', {
        p_id: vars.docId, p_validado: vars.validado,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-proposta-mob-docs', id] }),
  })

  const fundoStatusMut = useMutation({
    mutationFn: async (vars: { fundoId: string; status: FundoStatus }) => {
      const { error } = await supabase.rpc('admin_proposta_fundo_set', {
        p_proposta_id: id!, p_fundo_id: vars.fundoId, p_status: vars.status, p_obs: null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-proposta-mob-fundos', id] }),
    onError: (e: Error) => setErro(e.message),
  })

  const modeloUploadMut = useMutation({
    mutationFn: async () => {
      const r = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'], copyToCacheDirectory: true,
      })
      if (r.canceled || !r.assets?.[0]) return
      const a = r.assets[0]
      const ext = (a.name?.split('.').pop() ?? 'pdf').toLowerCase()
      const path = `${id}/modelos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const bytes = await readFileBytes(a.uri)
      const { error: upErr } = await supabase.storage
        .from('contratos')
        .upload(path, bytes, { contentType: a.mimeType ?? 'application/pdf', upsert: false })
      if (upErr) throw new Error(upErr.message)
      const { error: rpcErr } = await supabase.rpc('proposta_contrato_modelo_add', {
        p_proposta_id: id!, p_storage_path: path, p_nome_arquivo: a.name ?? 'modelo',
      })
      if (rpcErr) {
        await supabase.storage.from('contratos').remove([path])
        throw new Error(rpcErr.message)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-proposta-mob-modelos', id] }),
    onError: (e: Error) => setErro(e.message),
  })

  const modeloRemoveMut = useMutation({
    mutationFn: async (m: ModeloRow) => {
      const { data, error } = await supabase.rpc('proposta_contrato_modelo_remove', { p_id: m.id })
      if (error) throw error
      const path = (data as string | null) ?? m.storage_path
      await supabase.storage.from('contratos').remove([path])
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-proposta-mob-modelos', id] }),
    onError: (e: Error) => setErro(e.message),
  })

  function onPickFundoStatus(fundoId: string) {
    if (!canOperateAsAdmin) {
      Alert.alert('Perfil jurídico', 'Este perfil pode apenas enviar modelo de contrato.')
      return
    }

    Alert.alert('Status do fundo', 'Selecione o novo status', [
      ...FUNDO_STATUS.map((st) => ({
        text: FUNDO_STATUS_LABEL[st],
        onPress: () => fundoStatusMut.mutate({ fundoId, status: st }),
      })),
      { text: 'Cancelar', style: 'cancel' as const },
    ])
  }

  // ─── Contrato actions ─────────────────────────────────────────────────────
  function invalidateContrato() {
    qc.invalidateQueries({ queryKey: ['admin-proposta-mob-contrato', id] })
    qc.invalidateQueries({ queryKey: ['admin-proposta-mob-assinaturas'] })
    qc.invalidateQueries({ queryKey: ['admin-proposta-mob-liberacao', id] })
    qc.invalidateQueries({ queryKey: ['admin-proposta-mobile', id] })
  }
  const gerarContratoMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('contrato-gerar', { body: { proposta_id: id } })
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidateContrato,
    onError: (e: Error) => setErro(e.message),
  })
  const enviarAssinaturaMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('contrato-enviar-assinatura', {
        body: { contrato_id: contratoQ.data!.id },
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidateContrato,
    onError: (e: Error) => setErro(e.message),
  })
  const registrarMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('contrato_registrar', { p_contrato_id: contratoQ.data!.id })
      if (error) throw error
    },
    onSuccess: invalidateContrato,
    onError: (e: Error) => setErro(e.message),
  })
  const liberarMut = useMutation({
    mutationFn: async () => {
      const valor = Number(libValor.replace(/[^\d,]/g, '').replace(',', '.'))
      if (!Number.isFinite(valor) || valor <= 0) throw new Error('Informe um valor válido em reais.')
      const { error } = await supabase.rpc('liberacao_registrar', {
        p_proposta_id: id, p_valor: valor, p_data: libData,
        p_comprovante: null, p_observacao: libObs || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setLibModal(false); setLibValor(''); setLibObs('')
      invalidateContrato()
    },
    onError: (e: Error) => setErro(e.message),
  })
  const certificadoMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('certificado-gerar', {
        body: { proposta_id: id },
      })
      if (error) throw new Error(error.message)
      return data as { url?: string; storage_path?: string }
    },
    onSuccess: async (data) => {
      if (data?.url) {
        await Linking.openURL(data.url)
      } else if (data?.storage_path) {
        await abrirPdfStorage(data.storage_path, 'certificados')
      } else {
        Alert.alert('Certificado', 'Geração solicitada com sucesso.')
      }
    },
    onError: (e: Error) => setErro(e.message),
  })

  async function abrirPdfStorage(path: string, bucket: string) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10)
    if (error || !data?.signedUrl) {
      setErro(error?.message ?? 'Falha ao gerar URL.')
      return
    }
    await Linking.openURL(data.signedUrl)
  }

  if (propQuery.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#DC2626" />
        </View>
      </SafeAreaView>
    )
  }
  const p = propQuery.data
  if (!p) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
        <Text style={{ color: '#737373', textAlign: 'center', marginTop: 50 }}>Proposta não encontrada.</Text>
      </SafeAreaView>
    )
  }

  const valor = Number(p.valor_solicitado)
  const valorImoveis = Number(p.valor_imoveis_total)
  const ltv = calcularLTV(valor, valorImoveis)
  const calc = calcularFinanciamento({
    valor, prazoMeses: p.prazo_meses, taxaMensal: Number(p.taxa_juros_mensal) / 100,
    amortizacao: p.amortizacao, carenciaMeses: p.carencia_meses,
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)/propostas' as any)} style={s.backBtn}>
          <ArrowLeft size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>MODO ADMIN · PROPOSTA</Text>
          <Text style={s.headerTitle} numberOfLines={1}>{p.protocolo ?? p.id.slice(0, 8)}</Text>
        </View>
        {canOperateAsAdmin && (
          <Pressable onPress={() => setStatusModal(true)} style={s.statusBtn}>
            <RefreshCcw size={13} color="#fff" />
            <Text style={s.statusBtnText}>Status</Text>
          </Pressable>
        )}
      </View>

      <View style={s.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsScroll}>
          {TABS.map(t => {
            const active = tab === t
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={[s.tabPill, active && s.tabPillActive]}>
                <Text style={[s.tabLabel, active && s.tabLabelActive]}>{t}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}>
        {/* Hero card always visible */}
        <View style={s.heroCard}>
          <Text style={s.heroEyebrow}>{PRODUTO_LABEL[p.produto] ?? p.produto}</Text>
          <Text style={s.heroTitle} numberOfLines={2}>{p.cliente?.nome_completo ?? '—'}</Text>
          <View style={s.statusRow}>
            <View style={s.statusPill}>
              <Text style={s.statusText}>{STATUS_LABEL[p.status] ?? p.status}</Text>
            </View>
            <Text style={s.heroValor}>{brl(valor * 100)}</Text>
          </View>
          <Text style={s.heroMeta}>
            via {p.partner?.usuario?.nome_completo ?? '—'} · {new Date(p.created_at).toLocaleDateString('pt-BR')}
          </Text>
        </View>

        {tab === 'Resumo' && (
          <>
            <Card title="Produto" Icon={Banknote}>
              <Row k="Valor solicitado" v={brl(valor * 100)} />
              <Row k="Prazo" v={`${p.prazo_meses} meses`} />
              <Row k="Carência" v={`${p.carencia_meses} meses`} />
              <Row k="Sistema" v={`${p.amortizacao.toUpperCase()} · ${p.indexador} + ${Number(p.taxa_juros_mensal).toFixed(2)}% a.m.`} />
            </Card>
            <Card title="Cliente" Icon={User}>
              <Row k="Nome" v={p.cliente?.razao_social ?? p.cliente?.nome_completo ?? '—'} />
              <Row k="CPF/CNPJ" v={p.cliente?.cnpj ?? p.cliente?.cpf ?? '—'} />
              <Row k="E-mail" v={p.cliente?.email ?? '—'} />
              <Row k="Telefone" v={p.cliente?.telefone ?? '—'} />
              {p.cliente?.cnpj
                ? (p.cliente?.faturamento_mensal != null && <Row k="Faturamento" v={brl(Number(p.cliente.faturamento_mensal) * 100)} />)
                : (p.cliente?.renda_mensal != null && <Row k="Renda mensal" v={brl(Number(p.cliente.renda_mensal) * 100)} />)}
              {(p.cliente?.endereco_cidade || p.cliente?.endereco_estado) && (
                <Row k="Endereço" v={[p.cliente?.endereco_cidade, p.cliente?.endereco_estado].filter(Boolean).join('/')} />
              )}
            </Card>
            <Card title="Garantia" Icon={Building2}>
              <Row k="Imóveis (total)" v={brl(valorImoveis * 100)} />
              <Row k="LTV" v={
                <View style={[s.ltvBadge, { backgroundColor: ltv > 0.6 ? '#DC262622' : '#16A34A22' }]}>
                  <Text style={{ color: ltv > 0.6 ? '#DC2626' : '#16A34A', fontWeight: '700', fontSize: 12 }}>{(ltv * 100).toFixed(1)}%</Text>
                </View>
              } />
            </Card>
            <Card title="Simulação" Icon={ListChecks}>
              <Row k="1ª parcela" v={brl(calc.primeiraParcela * 100)} />
              <Row k="Última parcela" v={brl(calc.ultimaParcela * 100)} />
              <Row k="Total a pagar" v={brl(calc.totalPago * 100)} />
              <Row k="Renda mínima" v={`${brl(calc.rendaMinima * 100)}/mês`} />
            </Card>

            <Card title="Fundos" Icon={Tag}>
              {fundosQ.isLoading ? <ActivityIndicator color="#DC2626" /> :
               !fundosQ.data?.length ? <Empty text="Nenhum fundo atribuído." /> :
               <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                 {fundosQ.data.map((f) => (
                   <Pressable
                     key={f.fundo_id}
                     onPress={() => onPickFundoStatus(f.fundo_id)}
                     disabled={fundoStatusMut.isPending || !canOperateAsAdmin}
                     style={{
                       flexDirection: 'row', alignItems: 'center', gap: 6,
                       borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
                       backgroundColor: (f.fundos?.cor_hex ?? '#334155'),
                     }}
                   >
                     <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: FUNDO_STATUS_COLOR[f.status_fundo], borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' }} />
                     <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{f.fundos?.nome ?? 'Fundo'}</Text>
                     <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }}>· {FUNDO_STATUS_LABEL[f.status_fundo]}</Text>
                   </Pressable>
                 ))}
               </View>}
            </Card>
          </>
        )}

        {tab === 'Proponentes' && (
          <Card title={`Proponentes (${propQ.data?.length ?? 0})`} Icon={User}>
            {propQ.isLoading ? <ActivityIndicator color="#DC2626" /> :
             !propQ.data?.length ? <Empty text="Sem proponentes." /> :
             propQ.data.map((pr, i) => (
              <View key={pr.id} style={[s.listRow, i > 0 && s.listRowDivider]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.listName}>
                    {pr.nome} {pr.principal && <Text style={s.miniBadge}> · principal</Text>}
                  </Text>
                  <Text style={s.listSub}>{pr.cpf_cnpj ?? '—'} · {pr.pessoa_tipo}{pr.relacao ? ` · ${pr.relacao}` : ''}{!pr.principal ? ` · compõe renda: ${pr.compoe_renda === true ? 'Sim' : pr.compoe_renda === false ? 'Não' : '—'}` : ''}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {tab === 'Imóveis' && (
          <Card title={`Imóveis (${imoQ.data?.length ?? 0})`} Icon={Building2}>
            {imoQ.isLoading ? <ActivityIndicator color="#DC2626" /> :
             !imoQ.data?.length ? <Empty text="Sem imóveis." /> :
             imoQ.data.map((i, idx) => (
              <View key={i.id} style={[s.listRow, idx > 0 && s.listRowDivider]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.listName}>{i.tipo}</Text>
                  <Text style={s.listSub}>
                    {[i.logradouro, i.numero, i.bairro].filter(Boolean).join(', ') || '—'}
                  </Text>
                  <Text style={s.listSub}>{[i.cidade, i.estado].filter(Boolean).join('/')}</Text>
                </View>
                <Text style={s.listValor}>{brl(Number(i.valor) * 100)}</Text>
              </View>
            ))}
          </Card>
        )}

        {tab === 'Documentos' && (
          <Card title={`Documentos (${docQ.data?.length ?? 0})`} Icon={FileText}>
            {docQ.isLoading ? <ActivityIndicator color="#DC2626" /> :
             !docQ.data?.length ? <Empty text="Sem documentos enviados." /> :
             docQ.data.map((d, i) => (
              <View key={d.id} style={[s.listRow, i > 0 && s.listRowDivider]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.listName}>{TIPO_LABEL[d.tipo] ?? d.tipo}</Text>
                  <Text style={s.listSub}>
                    {d.categoria}{d.origem ? ` · ${d.origem}` : ''} · {new Date(d.created_at).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
                {canOperateAsAdmin && (
                  <Pressable
                    onPress={() => validarMut.mutate({ docId: d.id, validado: !d.validado })}
                    disabled={validarMut.isPending}
                    style={[s.docBtn, { backgroundColor: d.validado ? '#16A34A22' : '#F59E0B22' }]}
                  >
                    {d.validado
                      ? <CheckCircle2 size={13} color="#16A34A" />
                      : <XCircle size={13} color="#F59E0B" />}
                    <Text style={[s.docBtnText, { color: d.validado ? '#16A34A' : '#F59E0B' }]}>
                      {d.validado ? 'Aprovado' : 'Aprovar'}
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}
          </Card>
        )}

        {tab === 'Contrato' && (() => {
          const isPre = session?.role !== 'admin' && !isPropostaAprovada(p.status)
          const c = contratoQ.data
          const ass = assinaturasQ.data ?? []
          const lib = liberacaoQ.data
          if (p.status === 'cancelado') {
            return <Empty text="Proposta cancelada." />
          }
          if (isPre) {
            return (
              <View style={s.card}>
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <FileSignature size={32} color="#525252" />
                  <Text style={s.contratoEmpty}>Aguardando aprovação para liberar a aba de contrato.</Text>
                  <Text style={[s.contratoEmpty, { fontSize: 11, marginTop: 4 }]}>
                    Status atual: {STATUS_LABEL[p.status] ?? p.status}
                  </Text>
                </View>
              </View>
            )
          }
          return (
            <>
              {erro && (
                <View style={s.errBox}>
                  <AlertTriangle size={13} color="#DC2626" />
                  <Text style={s.errText}>{erro}</Text>
                  <Pressable onPress={() => setErro(null)}>
                    <Text style={[s.errText, { textDecorationLine: 'underline' }]}>fechar</Text>
                  </Pressable>
                </View>
              )}

              {isAdminJuridico && (
                <View style={s.errBox}>
                  <AlertTriangle size={13} color="#DC2626" />
                  <Text style={s.errText}>Perfil jurídico: apenas envio de modelo de contrato.</Text>
                </View>
              )}

              {/* Modelo de contrato (distinto do PDF Clicksign) */}
              <Card title="Modelo de contrato" Icon={FileText}>
                <Text style={[s.contratoEmpty, { textAlign: 'left', marginBottom: 10 }]}>
                  Documento de referência interno — distinto do PDF gerado para assinatura.
                </Text>
                <Pressable
                  onPress={() => modeloUploadMut.mutate()}
                  disabled={modeloUploadMut.isPending}
                  style={[s.secondaryBtn, { marginBottom: 10 }]}
                >
                  {modeloUploadMut.isPending
                    ? <ActivityIndicator color="#e5e5e5" size="small" />
                    : <><Upload size={14} color="#e5e5e5" /><Text style={s.secondaryBtnText}>Enviar modelo</Text></>}
                </Pressable>
                {modelosQ.isLoading ? (
                  <ActivityIndicator color="#DC2626" />
                ) : !modelosQ.data?.length ? (
                  <Text style={s.contratoEmpty}>Nenhum modelo disponível.</Text>
                ) : (
                  modelosQ.data.map((m, i) => (
                    <View key={m.id} style={[s.listRow, i > 0 && s.listRowDivider]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.listName} numberOfLines={1}>{m.nome_arquivo}</Text>
                        <Text style={s.listSub}>{new Date(m.created_at).toLocaleDateString('pt-BR')}</Text>
                      </View>
                      <Pressable onPress={() => abrirPdfStorage(m.storage_path, 'contratos')} style={[s.docBtn, { backgroundColor: '#38BDF822' }]}>
                        <Download size={13} color="#38BDF8" />
                        <Text style={[s.docBtnText, { color: '#38BDF8' }]}>Baixar</Text>
                      </Pressable>
                      {canOperateAsAdmin && (
                        <Pressable onPress={() => modeloRemoveMut.mutate(m)} disabled={modeloRemoveMut.isPending} style={{ padding: 8 }}>
                          <Trash2 size={16} color="#737373" />
                        </Pressable>
                      )}
                    </View>
                  ))
                )}
              </Card>

              {/* Contrato principal */}
              <Card title={c ? `Contrato v${c.versao ?? 1}` : 'Contrato'} Icon={FileSignature}>
                {contratoQ.isLoading ? (
                  <ActivityIndicator color="#DC2626" />
                ) : !c ? (
                  <>
                    <Text style={s.contratoEmpty}>Contrato ainda não foi gerado.</Text>
                    {canOperateAsAdmin && (
                      <Pressable
                        onPress={() => gerarContratoMut.mutate()}
                        disabled={gerarContratoMut.isPending}
                        style={[s.primaryBtn, { marginTop: 14 }]}
                      >
                        {gerarContratoMut.isPending
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <>
                              <FileSignature size={14} color="#fff" />
                              <Text style={s.primaryBtnText}>Gerar contrato</Text>
                            </>}
                      </Pressable>
                    )}
                  </>
                ) : (
                  <>
                    {c.gerado_em && <Row k="Gerado em" v={new Date(c.gerado_em).toLocaleString('pt-BR')} />}
                    {c.provedor_assinatura && <Row k="Provedor" v={c.provedor_assinatura} />}
                    {c.assinado_em && <Row k="Assinado em" v={new Date(c.assinado_em).toLocaleString('pt-BR')} />}
                    {c.registrado_em && <Row k="Registrado em" v={new Date(c.registrado_em).toLocaleString('pt-BR')} />}

                    <View style={{ gap: 8, marginTop: 14 }}>
                      {c.pdf_storage_path && (
                        <Pressable
                          onPress={() => abrirPdfStorage(c.pdf_storage_path!, 'contratos')}
                          style={s.secondaryBtn}
                        >
                          <Download size={14} color="#e5e5e5" />
                          <Text style={s.secondaryBtnText}>Abrir PDF</Text>
                        </Pressable>
                      )}
                      {!c.assinado_em && canOperateAsAdmin && (
                        <Pressable
                          onPress={() => enviarAssinaturaMut.mutate()}
                          disabled={enviarAssinaturaMut.isPending}
                          style={s.primaryBtn}
                        >
                          {enviarAssinaturaMut.isPending
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <>
                                <Send size={14} color="#fff" />
                                <Text style={s.primaryBtnText}>
                                  {c.provider_envelope_id ? 'Reenviar para assinatura' : 'Enviar para assinatura'}
                                </Text>
                              </>}
                        </Pressable>
                      )}
                      {c.assinado_em && !c.registrado_em && canOperateAsAdmin && (
                        <Pressable
                          onPress={() => registrarMut.mutate()}
                          disabled={registrarMut.isPending}
                          style={s.primaryBtn}
                        >
                          {registrarMut.isPending
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <>
                                <CheckCircle2 size={14} color="#fff" />
                                <Text style={s.primaryBtnText}>Marcar como registrado</Text>
                              </>}
                        </Pressable>
                      )}
                    </View>
                  </>
                )}
              </Card>

              {/* Assinaturas */}
              {c && (
                <Card title={`Assinaturas (${ass.length})`} Icon={Send}>
                  {assinaturasQ.isLoading ? (
                    <ActivityIndicator color="#DC2626" />
                  ) : ass.length === 0 ? (
                    <Empty text="Nenhum signatário ainda. Envie para assinatura." />
                  ) : (
                    ass.map((a, i) => (
                      <View key={a.id} style={[s.listRow, i > 0 && s.listRowDivider]}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.listName}>{a.signatario_nome}</Text>
                          <Text style={s.listSub}>{a.papel}{a.signatario_email ? ` · ${a.signatario_email}` : ''}</Text>
                        </View>
                        {a.assinado_em ? (
                          <View style={s.docBtn}>
                            <CheckCircle2 size={13} color="#16A34A" />
                            <Text style={[s.docBtnText, { color: '#16A34A' }]}>Assinado</Text>
                          </View>
                        ) : (
                          <View style={[s.docBtn, { backgroundColor: '#F59E0B22' }]}>
                            <Clock size={13} color="#F59E0B" />
                            <Text style={[s.docBtnText, { color: '#F59E0B' }]}>{a.status ?? 'pendente'}</Text>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </Card>
              )}

              {/* Liberação de recurso */}
              {c?.assinado_em && (
                <Card title="Liberação de recurso" Icon={Banknote}>
                  {liberacaoQ.isLoading ? (
                    <ActivityIndicator color="#DC2626" />
                  ) : lib ? (
                    <>
                      <Row k="Valor liberado" v={brl(Number(lib.valor_liberado) * 100)} />
                      <Row k="Data" v={new Date(lib.data_liberacao).toLocaleDateString('pt-BR')} />
                      {lib.observacao && <Row k="Obs." v={lib.observacao} />}
                      {lib.comprovante_storage_path && (
                        <Pressable
                          onPress={() => abrirPdfStorage(lib.comprovante_storage_path!, 'comprovantes')}
                          style={[s.secondaryBtn, { marginTop: 10 }]}
                        >
                          <Download size={13} color="#e5e5e5" />
                          <Text style={s.secondaryBtnText}>Baixar comprovante</Text>
                        </Pressable>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={s.contratoEmpty}>Recurso ainda não liberado.</Text>
                      {canOperateAsAdmin && (
                        <Pressable
                          onPress={() => setLibModal(true)}
                          style={[s.primaryBtn, { marginTop: 12 }]}
                        >
                          <Banknote size={14} color="#fff" />
                          <Text style={s.primaryBtnText}>Registrar liberação</Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </Card>
              )}

              {/* Certificado */}
              {p.status === 'recurso_liberado' && canOperateAsAdmin && (
                <Card title="Certificado" Icon={Award}>
                  <Text style={s.contratoEmpty}>
                    Gere o certificado de conclusão da operação.
                  </Text>
                  <Pressable
                    onPress={() => certificadoMut.mutate()}
                    disabled={certificadoMut.isPending}
                    style={[s.primaryBtn, { marginTop: 12, backgroundColor: '#16A34A' }]}
                  >
                    {certificadoMut.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <>
                          <Award size={14} color="#fff" />
                          <Text style={s.primaryBtnText}>Gerar certificado</Text>
                        </>}
                  </Pressable>
                </Card>
              )}
            </>
          )
        })()}

        {tab === 'Histórico' && (
          <Card title={`Histórico (${hisQ.data?.length ?? 0})`} Icon={HistoryIcon}>
            {hisQ.isLoading ? <ActivityIndicator color="#DC2626" /> :
             !hisQ.data?.length ? <Empty text="Sem alterações de status." /> :
             hisQ.data.map((h, i) => (
              <View key={h.id} style={[s.timelineRow, i > 0 && s.listRowDivider]}>
                <View style={s.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={s.listName}>
                    {h.status_anterior ? `${STATUS_LABEL[h.status_anterior] ?? h.status_anterior} → ` : ''}
                    <Text style={{ color: '#DC2626' }}>{STATUS_LABEL[h.status_novo] ?? h.status_novo}</Text>
                  </Text>
                  {h.motivo && <Text style={s.listSub}>{h.motivo}</Text>}
                  <Text style={s.listMeta}>{new Date(h.created_at).toLocaleString('pt-BR')}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* Status change modal */}
      <Modal visible={statusModal} transparent animationType="fade" onRequestClose={() => setStatusModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setStatusModal(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Alterar status</Text>
            <Text style={s.modalSub}>Atual: {STATUS_LABEL[p.status] ?? p.status}</Text>

            <Text style={s.modalLabel}>Novo status</Text>
            <View style={s.modalSelect}>
              <FlatList
                data={STATUS_ORDER.filter(st => st !== p.status)}
                keyExtractor={st => st}
                style={{ maxHeight: 220 }}
                renderItem={({ item }) => (
                  <Pressable onPress={() => setNovoStatus(item)} style={[s.modalOption, novoStatus === item && s.modalOptionActive]}>
                    <Text style={[s.modalOptionText, novoStatus === item && { color: '#fff', fontWeight: '700' }]}>
                      {STATUS_LABEL[item] ?? item}
                    </Text>
                    {novoStatus === item && <CheckCircle2 size={14} color="#fff" />}
                  </Pressable>
                )}
              />
            </View>

            <Text style={s.modalLabel}>Motivo (opcional)</Text>
            <TextInput
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Observação..."
              placeholderTextColor="#525252"
              style={s.modalInput}
              multiline
            />

            {statusMut.error && (
              <View style={s.errBox}>
                <AlertTriangle size={13} color="#DC2626" />
                <Text style={s.errText}>{(statusMut.error as Error).message}</Text>
              </View>
            )}

            <View style={s.modalActions}>
              <Pressable style={s.modalCancel} onPress={() => setStatusModal(false)}>
                <Text style={s.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[s.modalConfirm, (!novoStatus || statusMut.isPending) && { opacity: 0.5 }]}
                disabled={!novoStatus || statusMut.isPending}
                onPress={() => statusMut.mutate({ status: novoStatus, motivo })}
              >
                {statusMut.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.modalConfirmText}>Aplicar</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Liberação modal */}
      <Modal visible={libModal} transparent animationType="fade" onRequestClose={() => setLibModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setLibModal(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Registrar liberação</Text>
            <Text style={s.modalSub}>Recurso liberado ao tomador.</Text>

            <Text style={s.modalLabel}>Valor (R$)</Text>
            <TextInput
              value={libValor}
              onChangeText={setLibValor}
              placeholder="ex.: 250000,00"
              placeholderTextColor="#525252"
              keyboardType="decimal-pad"
              style={s.modalInput}
            />

            <Text style={s.modalLabel}>Data</Text>
            <TextInput
              value={libData}
              onChangeText={setLibData}
              placeholder="AAAA-MM-DD"
              placeholderTextColor="#525252"
              style={s.modalInput}
            />

            <Text style={s.modalLabel}>Observação (opcional)</Text>
            <TextInput
              value={libObs}
              onChangeText={setLibObs}
              placeholder="Banco emissor, conta, etc."
              placeholderTextColor="#525252"
              multiline
              style={s.modalInput}
            />

            {liberarMut.error && (
              <View style={s.errBox}>
                <AlertTriangle size={13} color="#DC2626" />
                <Text style={s.errText}>{(liberarMut.error as Error).message}</Text>
              </View>
            )}

            <View style={s.modalActions}>
              <Pressable style={s.modalCancel} onPress={() => setLibModal(false)}>
                <Text style={s.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[s.modalConfirm, (!libValor || liberarMut.isPending) && { opacity: 0.5 }]}
                disabled={!libValor || liberarMut.isPending}
                onPress={() => liberarMut.mutate()}
              >
                {liberarMut.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.modalConfirmText}>Registrar</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

function Card({ title, Icon, children }: { title: string; Icon?: any; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        {Icon && <Icon size={14} color="#DC2626" />}
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      <View style={{ padding: 14 }}>{children}</View>
    </View>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvKey}>{k}</Text>
      {typeof v === 'string' || typeof v === 'number'
        ? <Text style={s.kvVal}>{v}</Text>
        : <View>{v}</View>}
    </View>
  )
}

function Empty({ text }: { text: string }) {
  return <Text style={{ color: '#525252', fontSize: 12, textAlign: 'center', paddingVertical: 14 }}>{text}</Text>
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#DC2626', fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 1 },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  statusBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  tabsWrap: { borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  tabsScroll: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 11 },
  tabPill: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1c1c1c', borderWidth: 1, borderColor: '#2a2a2a' },
  tabPillActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#737373' },
  tabLabelActive: { color: '#fff' },

  heroCard: { backgroundColor: '#141414', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2a2a2a', borderTopWidth: 2, borderTopColor: '#DC2626' },
  heroEyebrow: { fontSize: 10, letterSpacing: 1.2, color: '#737373', fontWeight: '700', textTransform: 'uppercase' },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -0.3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  statusPill: { backgroundColor: '#DC262622', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  heroValor: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroMeta: { fontSize: 11, color: '#525252', marginTop: 8 },
  ltvBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },

  card: { backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#e5e5e5' },

  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1f1f1f', gap: 12 },
  kvKey: { fontSize: 12, color: '#737373' },
  kvVal: { fontSize: 13, color: '#e5e5e5', fontWeight: '600', textAlign: 'right', flexShrink: 1 },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  listRowDivider: { borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  listName: { fontSize: 13, color: '#e5e5e5', fontWeight: '600' },
  listSub: { fontSize: 11, color: '#737373', marginTop: 2 },
  listMeta: { fontSize: 10, color: '#525252', marginTop: 3 },
  listValor: { fontSize: 13, color: '#DC2626', fontWeight: '700' },
  miniBadge: { fontSize: 10, color: '#F59E0B', fontWeight: '700' },

  docBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  docBtnText: { fontSize: 11, fontWeight: '700' },

  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626', marginTop: 4 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#0f0f0f', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30, gap: 8, borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  modalSub: { fontSize: 12, color: '#737373', marginBottom: 8 },
  modalLabel: { fontSize: 11, color: '#737373', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  modalSelect: { backgroundColor: '#141414', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a' },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  modalOptionActive: { backgroundColor: '#DC2626' },
  modalOptionText: { fontSize: 13, color: '#e5e5e5' },
  modalInput: { backgroundColor: '#141414', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', padding: 12, color: '#fff', fontSize: 13, minHeight: 60, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalCancel: { flex: 1, padding: 13, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' },
  modalCancelText: { color: '#a3a3a3', fontWeight: '600' },
  modalConfirm: { flex: 1, padding: 13, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
  errBox: { flexDirection: 'row', gap: 6, backgroundColor: '#DC262622', borderRadius: 8, padding: 10, marginTop: 10, alignItems: 'center' },
  errText: { color: '#DC2626', fontSize: 12, flex: 1 },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1f1f1f', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  secondaryBtnText: { color: '#e5e5e5', fontSize: 13, fontWeight: '600' },
  contratoEmpty: { color: '#737373', fontSize: 12, textAlign: 'center' },
})

