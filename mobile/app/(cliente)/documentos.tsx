import { ScrollView, View, Text, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, FileText, CheckCircle2, Upload, AlertCircle, X } from 'lucide-react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/Badge'

const TIPOS = [
  { value: 'rg', label: 'RG' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnh', label: 'CNH' },
  { value: 'comprovante_residencia', label: 'Comprovante de Residência' },
  { value: 'comprovante_renda', label: 'Comprovante de Renda' },
  { value: 'matricula_imovel', label: 'Matrícula do Imóvel' },
  { value: 'iptu', label: 'IPTU' },
  { value: 'certidao_casamento', label: 'Certidão de Casamento' },
  { value: 'contrato_social', label: 'Contrato Social' },
  { value: 'outros', label: 'Outros' },
] as const

type DocTipo = typeof TIPOS[number]['value']

const TIPO_LABEL = Object.fromEntries(TIPOS.map(t => [t.value, t.label]))

interface DocRow {
  id: string
  tipo: DocTipo
  categoria: string
  storage_path: string
  origem: string | null
  validado: boolean
  created_at: string
}

interface Pendencia {
  id: string
  descricao: string
  status: string
  documento_solicitado_tipo: DocTipo | null
}

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
  // expo-file-system v19 (SDK 54): API baseada em classes
  try {
    const f = new File(uri)
    if (typeof (f as any).bytes === 'function') {
      const b = await (f as any).bytes()
      return b as Uint8Array
    }
    if (typeof (f as any).base64 === 'function') {
      const b64 = await (f as any).base64()
      return base64ToBytes(b64)
    }
  } catch {
    // fallback fetch+arrayBuffer
  }
  const res = await fetch(uri)
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

export default function Documentos() {
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const [uploadingTipo, setUploadingTipo] = useState<DocTipo | null>(null)

  // pega proposta mais recente do cliente
  const propostaQ = useQuery({
    queryKey: ['cliente-proposta-atual'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, protocolo')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const propostaId = propostaQ.data?.id

  const docsQ = useQuery({
    enabled: !!propostaId,
    queryKey: ['cliente-docs', propostaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_documentos')
        .select('id, tipo, categoria, storage_path, origem, validado, created_at')
        .eq('proposta_id', propostaId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as DocRow[]
    },
  })

  const pendQ = useQuery({
    enabled: !!propostaId,
    queryKey: ['cliente-docs-pend', propostaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposta_pendencias')
        .select('id, descricao, status, documento_solicitado_tipo')
        .eq('proposta_id', propostaId!)
        .in('status', ['aberta', 'em_analise'])
      if (error) throw error
      return (data ?? []) as Pendencia[]
    },
  })

  const uploadMut = useMutation({
    mutationFn: async ({ uri, mime, name, tipo }: { uri: string; mime: string; name: string; tipo: DocTipo }) => {
      if (!propostaId) throw new Error('Proposta não encontrada')
      const ext = (name.split('.').pop() || 'bin').toLowerCase()
      const categoria = tipo === 'matricula_imovel' || tipo === 'iptu' ? 'imovel' : 'pessoa_fisica'
      const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const path = `${propostaId}/${categoria}/${fileId}.${ext}`

      const bytes = await readFileBytes(uri)

      const { error: upErr } = await supabase.storage
        .from('proposta-docs')
        .upload(path, bytes, { contentType: mime, upsert: false })
      if (upErr) throw new Error(upErr.message)

      const { error: insErr } = await supabase.from('proposta_documentos').insert({
        proposta_id: propostaId,
        tipo,
        categoria,
        storage_path: path,
        bucket: 'proposta-docs',
        mime_type: mime,
        tamanho_bytes: bytes.byteLength,
        origem: 'cliente',
      })
      if (insErr) {
        await supabase.storage.from('proposta-docs').remove([path])
        throw new Error(insErr.message)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente-docs', propostaId] })
      Alert.alert('Sucesso', 'Documento enviado para análise.')
    },
    onError: (err: unknown) => Alert.alert('Falha no envio', err instanceof Error ? err.message : String(err)),
    onSettled: () => setUploadingTipo(null),
  })

  const removeMut = useMutation({
    mutationFn: async (d: DocRow) => {
      const { error } = await supabase.from('proposta_documentos').delete().eq('id', d.id)
      if (error) throw error
      await supabase.storage.from('proposta-docs').remove([d.storage_path])
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cliente-docs', propostaId] }),
    onError: (err: unknown) => Alert.alert('Falha', err instanceof Error ? err.message : String(err)),
  })

  const escolherEEnviar = async (tipo: DocTipo, source: 'camera' | 'galeria' | 'arquivo') => {
    try {
      let asset: { uri: string; mimeType?: string | null; name?: string | null } | null = null
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) return Alert.alert('Permissão negada', 'Habilite o acesso à câmera.')
        const r = await ImagePicker.launchCameraAsync({ quality: 0.85, mediaTypes: ['images'] })
        if (r.canceled) return
        asset = { uri: r.assets[0].uri, mimeType: r.assets[0].mimeType ?? 'image/jpeg', name: r.assets[0].fileName ?? `foto-${Date.now()}.jpg` }
      } else if (source === 'galeria') {
        const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, mediaTypes: ['images'] })
        if (r.canceled) return
        asset = { uri: r.assets[0].uri, mimeType: r.assets[0].mimeType ?? 'image/jpeg', name: r.assets[0].fileName ?? `img-${Date.now()}.jpg` }
      } else {
        const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true })
        if (r.canceled) return
        const a = r.assets[0]
        asset = { uri: a.uri, mimeType: a.mimeType ?? 'application/pdf', name: a.name ?? `doc-${Date.now()}` }
      }
      if (!asset) return
      setUploadingTipo(tipo)
      uploadMut.mutate({ uri: asset.uri, mime: asset.mimeType || 'application/octet-stream', name: asset.name || 'arquivo', tipo })
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : String(e))
      setUploadingTipo(null)
    }
  }

  const onPick = (tipo: DocTipo) => {
    Alert.alert('Enviar documento', `Como deseja enviar ${TIPO_LABEL[tipo]}?`, [
      { text: 'Câmera', onPress: () => escolherEEnviar(tipo, 'camera') },
      { text: 'Galeria', onPress: () => escolherEEnviar(tipo, 'galeria') },
      { text: 'Arquivo', onPress: () => escolherEEnviar(tipo, 'arquivo') },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  // Combina pendências (sem doc enviado) + tipos já enviados
  const linhas = useMemo(() => {
    const docsByTipo = new Map<string, DocRow>()
    for (const d of docsQ.data ?? []) {
      if (!docsByTipo.has(d.tipo)) docsByTipo.set(d.tipo, d)
    }
    const pendTipos = new Set(
      (pendQ.data ?? [])
        .map(p => p.documento_solicitado_tipo)
        .filter((x): x is DocTipo => !!x),
    )
    const todos = new Set<DocTipo>([...pendTipos, ...docsByTipo.keys() as Iterable<DocTipo>])
    return Array.from(todos).map(tipo => {
      const doc = docsByTipo.get(tipo)
      const status: 'aprovado' | 'enviado' | 'pendente' = doc?.validado
        ? 'aprovado'
        : doc
          ? 'enviado'
          : 'pendente'
      return { tipo, label: TIPO_LABEL[tipo] || tipo, status, doc }
    })
  }, [docsQ.data, pendQ.data])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([docsQ.refetch(), pendQ.refetch()])
    setRefreshing(false)
  }, [docsQ, pendQ])

  return (
    <SafeAreaView className="flex-1 bg-silver-50" edges={['top', 'bottom']}>
      <View className="bg-white px-5 pb-3 pt-2">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="-ml-2 p-2">
            <ArrowLeft size={22} color="#0F0F0F" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold text-navy">Documentos</Text>
            {propostaQ.data?.protocolo && (
              <Text className="font-mono text-[11px] text-silver-500">{propostaQ.data.protocolo}</Text>
            )}
          </View>
        </View>
      </View>

      {propostaQ.isLoading || docsQ.isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#D4AF37" /></View>
      ) : !propostaId ? (
        <View className="flex-1 items-center justify-center px-6">
          <FileText size={40} color="#9CA3AF" />
          <Text className="mt-3 text-center text-sm text-silver-600">Você ainda não possui uma proposta vinculada.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
        >
          {(pendQ.data?.length ?? 0) > 0 && (
            <View className="rounded-xl border border-gold/30 bg-gold/5 p-3">
              <View className="flex-row items-center gap-2">
                <AlertCircle size={16} color="#D4AF37" />
                <Text className="text-xs font-semibold text-gold">
                  {pendQ.data!.length} {pendQ.data!.length === 1 ? 'pendência aberta' : 'pendências abertas'}
                </Text>
              </View>
            </View>
          )}

          {linhas.length === 0 && (
            <View className="rounded-xl border border-silver-200 bg-white p-6">
              <Text className="text-center text-sm text-silver-600">Nenhum documento solicitado ainda.</Text>
            </View>
          )}

          {linhas.map(({ tipo, label, status, doc }) => {
            const enviando = uploadingTipo === tipo && uploadMut.isPending
            return (
              <View key={tipo} className="flex-row items-center gap-3 rounded-xl border border-silver-200 bg-white p-4">
                <View className={`h-10 w-10 items-center justify-center rounded-lg ${
                  status === 'aprovado' ? 'bg-success/15' :
                  status === 'enviado' ? 'bg-warning/15' : 'bg-silver-100'
                }`}>
                  {status === 'aprovado'
                    ? <CheckCircle2 size={20} color="#16A34A" />
                    : <FileText size={20} color="#9CA3AF" />}
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-silver-900">{label}</Text>
                  <Badge variant={status === 'aprovado' ? 'green' : status === 'enviado' ? 'amber' : 'gray'}>
                    {status === 'aprovado' ? 'Aprovado' : status === 'enviado' ? 'Em análise' : 'Pendente'}
                  </Badge>
                  {doc && (
                    <Text className="mt-0.5 text-[11px] text-silver-500">
                      Enviado em {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                    </Text>
                  )}
                </View>
                {status === 'pendente' && (
                  <Pressable
                    onPress={() => onPick(tipo)}
                    disabled={enviando}
                    className="rounded-lg bg-gold px-3 py-2"
                  >
                    {enviando ? <ActivityIndicator color="white" /> : <Text className="text-xs font-bold text-white">Enviar</Text>}
                  </Pressable>
                )}
                {status === 'enviado' && doc && (
                  <Pressable
                    onPress={() => Alert.alert('Remover', 'Deseja remover este envio?', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Remover', style: 'destructive', onPress: () => removeMut.mutate(doc) },
                    ])}
                    className="p-2"
                  >
                    <X size={18} color="#9CA3AF" />
                  </Pressable>
                )}
              </View>
            )
          })}

          {/* Botão genérico para enviar tipo livre */}
          <Pressable
            onPress={() => {
              const buttons: { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void }[] = TIPOS.map(t => ({
                text: t.label,
                onPress: () => onPick(t.value as DocTipo),
              }))
              buttons.push({ text: 'Cancelar', style: 'cancel' })
              Alert.alert('Tipo de documento', '', buttons)
            }}
            className="mt-2 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-silver-300 bg-white py-4"
          >
            <Upload size={18} color="#0F0F0F" />
            <Text className="font-semibold text-navy">Enviar outro documento</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
